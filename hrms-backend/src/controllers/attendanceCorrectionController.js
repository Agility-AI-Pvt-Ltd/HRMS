import prisma from "../prismaClient.js";

export const requestPresentCorrection = async (req, res) => {
  const userId = req.user.id;
  const { date, reason } = req.body;

  if (!date || !reason) {
    return res.status(400).json({ message: "Date & reason required" });
  }

  const day = new Date(date);
  day.setHours(0,0,0,0);

  // Check attendance is ABSENT
  const attendance = await prisma.attendance.findFirst({
    where: {
      userId,
      date: {
        gte: day,
        lte: new Date(day.getTime() + 86400000 - 1)
      }
    }
  });

  if (attendance && attendance.status !== "ABSENT") {
    return res.status(400).json({
      message: "Attendance is not absent for this date"
    });
  }

  const reqEntry = await prisma.attendanceCorrection.create({
    data: {
      userId,
      date: day,
      reason
    }
  });

  return res.json({
    success: true,
    message: "Present request sent successfully",
    request: reqEntry
  });
};


export const getAllAttendanceCorrections = async (req, res) => {
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({ message: "Admin only" });
  }

  const list = await prisma.attendanceCorrection.findMany({
    where: { status: "PENDING" },
    include: { user: true },
    orderBy: { createdAt: "desc" }
  });

  res.json({ success: true, data: list });
};


export const decideAttendanceCorrection = async (req, res) => {
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({ message: "Admin only" });
  }

  const { id, action, reason } = req.body;

  const reqItem = await prisma.attendanceCorrection.findUnique({
    where: { id }
  });

  if (!reqItem || reqItem.status !== "PENDING") {
    return res.status(400).json({ message: "Invalid request" });
  }

  if (action === "APPROVE") {
    // create or update attendance
    await prisma.attendance.upsert({
      where: {
        userId_date: {
          userId: reqItem.userId,
          date: reqItem.date
        }
      },
      update: { status: "PRESENT" },
      create: {
        userId: reqItem.userId,
        date: reqItem.date,
        status: "PRESENT"
      }
    });
  }

  await prisma.attendanceCorrection.update({
    where: { id },
    data: {
      status: action === "APPROVE" ? "APPROVED" : "REJECTED",
      adminReason: reason || null,
      decidedAt: new Date()
    }
  });

  res.json({
    success: true,
    message: `Request ${action.toLowerCase()}`
  });
};
