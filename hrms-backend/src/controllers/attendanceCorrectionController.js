import prisma from "../prismaClient.js";
import { emitToAdmins, emitToUser } from "../socket/socketServer.js";

// Parse date string (YYYY-MM-DD or DD-MM-YYYY) to (year, month0, day)
function parseDateParts(dateStr) {
  const parts = dateStr.trim().split("-").map(Number);
  if (parts.length !== 3) return null;
  const [a, b, c] = parts;
  if (a > 31) return { y: a, m: b, d: c }; // YYYY-MM-DD
  if (c > 31) return { y: c, m: b, d: a }; // DD-MM-YYYY
  return { y: a, m: b, d: c }; // assume YYYY-MM-DD
}

// Office timezone (IST). User enters times in this zone; we store UTC so display shows same times.
const OFFICE_TZ_OFFSET = "+05:30"; // Asia/Kolkata

// Build a Date (UTC) from date + time interpreted as office time (IST)
function officeTimeToUTC(y, m, d, hour, min) {
  const pad = (n) => String(n).padStart(2, "0");
  const iso = `${y}-${pad(m)}-${pad(d)}T${pad(hour)}:${pad(min || 0)}:00${OFFICE_TZ_OFFSET}`;
  return new Date(iso);
}

export const requestPresentCorrection = async (req, res) => {
  try {
    const userId = req.user.id;
    const { date, reason, checkInTime, checkOutTime, witnessId, witness } = req.body;

    if (!date || !checkInTime || !checkOutTime || (!witnessId && !witness)) {
      return res.status(400).json({ message: "Date, times and witness are required" });
    }

    const parsed = parseDateParts(date);
    if (!parsed) {
      return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD or DD-MM-YYYY" });
    }
    const { y, m, d } = parsed;
    const day = new Date(Date.UTC(y, m - 1, d));
    if (isNaN(day.getTime())) {
      return res.status(400).json({ message: "Invalid date" });
    }

    const [ciH, ciM] = String(checkInTime).split(":").map(Number);
    const [coH, coM] = String(checkOutTime).split(":").map(Number);
    // Interpret times as office time (IST) so display shows same 09:00 / 19:00
    const checkIn = officeTimeToUTC(y, m, d, ciH || 0, ciM || 0);
    const checkOut = officeTimeToUTC(y, m, d, coH || 0, coM || 0);

    if (checkOut <= checkIn) {
      return res.status(400).json({ message: "Checkout time must be after check-in time" });
    }

    const start = new Date(day);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(day);
    end.setUTCHours(23, 59, 59, 999);

    const attendance = await prisma.attendance.findFirst({
      where: {
        userId,
        date: { gte: start, lte: end },
      },
    });

    if (attendance && attendance.status !== "ABSENT") {
      return res.status(400).json({
        message: "Attendance is not absent for this date",
      });
    }

    if (witnessId) {
  const witnessUser = await prisma.user.findFirst({
    where: { id: witnessId, isActive: true },
    select: { id: true },
  });
  if (!witnessUser) {
    return res.status(400).json({ message: "Selected witness is invalid" });
  }
}


    const reasonText = reason && String(reason).trim() ? reason : "Missed check-in correction";

    const reqEntry = await prisma.attendanceCorrection.create({
      data: {
        userId,
        date: day,
        reason: reasonText,
        checkIn,
        checkOut,
        witnessId: witnessId || null,
      },
    });

    const admins = await prisma.user.findMany({
      where: { role: "ADMIN", isActive: true },
      select: { id: true },
    });
    const adminIds = admins.map((a) => a.id);

    if (adminIds.length > 0) {
      await prisma.notification.createMany({
        data: adminIds.map((id) => ({
          userId: id,
          title: "Attendance Correction Request",
          body: `Employee requested to cancel leave on ${date}`,
          meta: {
            type: "attendance_correction",
            correctionId: reqEntry.id,
            date,
            userId,
          },
        })),
      });
      emitToAdmins("notification_created", {
        scope: "ATTENDANCE_CORRECTION",
        title: "Attendance Correction Request",
        body: `Employee requested to cancel leave on ${date}`,
      });
    }

    return res.json({
      success: true,
      message: "Cancel leave request submitted. Admins will be notified for approval.",
      request: reqEntry,
    });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(400).json({
        message: "You have already submitted a correction request for this date.",
      });
    }
    console.error("requestPresentCorrection error:", err);
    const safeMessage =
      process.env.NODE_ENV === "production"
        ? "Failed to submit correction request. Please try again."
        : err.message || "Failed to submit correction request";
    return res.status(500).json({ message: safeMessage });
  }
};


export const getAllAttendanceCorrections = async (req, res) => {
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({ message: "Admin only" });
  }

const list = await prisma.attendanceCorrection.findMany({
  where: { status: "PENDING" },
  include: {
    user: true,
    witness: {
      select: { firstName: true, lastName: true }
    }
  },
  orderBy: { createdAt: "desc" }
});

  res.json({ success: true, data: list });
};


export const decideAttendanceCorrection = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ message: "Admin only" });
    }

    const { id, action, reason } = req.body;

    const reqItem = await prisma.attendanceCorrection.findUnique({
      where: { id },
    });

    if (!reqItem || reqItem.status !== "PENDING") {
      return res.status(400).json({ message: "Invalid request" });
    }

    if (action === "APPROVE") {
    // 1️⃣ create or update attendance with provided times
    await prisma.attendance.upsert({
      where: {
        userId_date: {
          userId: reqItem.userId,
          date: reqItem.date,
        },
      },
      update: {
        status: "PRESENT",
        checkIn: reqItem.checkIn,
        checkOut: reqItem.checkOut,
      },
      create: {
        userId: reqItem.userId,
        date: reqItem.date,
        status: "PRESENT",
        checkIn: reqItem.checkIn,
        checkOut: reqItem.checkOut,
      },
    });

// AFTER:
// With @db.Date, reqItem.date is already date-only, direct comparison works
const leaves = await prisma.leave.findMany({
  where: {
    userId: reqItem.userId,
    startDate: { lte: reqItem.date },
    endDate: { gte: reqItem.date },
    status: { in: ["PENDING", "APPROVED"] },
    isAdminDeleted: false,
    isEmployeeDeleted: false,
  },
});

    for (const leave of leaves) {
      if (
        leave.status === "APPROVED" &&
        !["WFH", "UNPAID", "COMP_OFF"].includes(leave.type)
      ) {
        // single day → increment balance back by 1
        await prisma.user.update({
          where: { id: leave.userId },
          data: {
            leaveBalance: { increment: 1 },
          },
        });
      }

      await prisma.leave.update({
        where: { id: leave.id },
        data: {
          status: "REJECTED",
          rejectReason:
            reason || "Leave cancelled due to attendance correction approval",
        },
      });
    }
  }

  const updatedReq = await prisma.attendanceCorrection.update({
    where: { id },
    data: {
      status: action === "APPROVE" ? "APPROVED" : "REJECTED",
      adminReason: reason || null,
      decidedAt: new Date(),
    },
  });

  // Notify employee about decision
  await prisma.notification.create({
    data: {
      userId: updatedReq.userId,
      title: "Attendance Correction Decision",
      body: `Your attendance correction request for ${updatedReq.date.toISOString().slice(0, 10)} has been ${action.toLowerCase()}`,
      meta: {
        type: "attendance_correction_decision",
        correctionId: updatedReq.id,
        action,
      },
    },
  });

  emitToUser(updatedReq.userId, "notification_created", {
    scope: "ATTENDANCE_CORRECTION_DECISION",
    title: "Attendance Correction Decision",
    body: `Your attendance correction request has been ${action.toLowerCase()}`,
  });

    return res.json({
      success: true,
      message: `Request ${action.toLowerCase()}`,
    });
  } catch (err) {
    console.error("decideAttendanceCorrection error:", err);
    const safeMessage =
      process.env.NODE_ENV === "production"
        ? "Failed to process decision. Please try again."
        : err.message || "Failed to process decision";
    return res.status(500).json({ message: safeMessage });
  }
};
