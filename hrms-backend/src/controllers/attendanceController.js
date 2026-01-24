import prisma from "../prismaClient.js";
import { Parser } from "json2csv";
import ExcelJS from "exceljs";

/* =======================================================
   DATE HELPERS (TZ SAFE)
======================================================= */

function rangeFromISO(start, end) {
  const s = new Date(start);
  s.setHours(0, 0, 0, 0);

  const e = new Date(end);
  e.setHours(23, 59, 59, 999);

  return { s, e };
}

function todayRange() {
  const d = new Date();
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);

  const e = new Date(d);
  e.setHours(23, 59, 59, 999);

  return { s, e };
}

function toLocalISO(date) {
  const d = new Date(
    new Date(date).toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );

  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

// ================= Auto Grant Comp-Off on Weekly Off Work =================
async function autoGrantCompOff(userId, workDate) {
  
  const user = await prisma.user.findFirst({
  where: { id: userId, isActive: true },
});

if (!user) return; // 🚫 silently ignore
  // Normalize date (IMPORTANT)
  const isoDate = toLocalISO(workDate);
  const dateObj = new Date(isoDate);
  dateObj.setHours(0, 0, 0, 0);

  const dayName = dateObj.toLocaleDateString("en-US", {
    weekday: "long",
  });

  /* =========================================
     1️⃣ CHECK WEEK-OFF (FIXED + ROSTER)
  ========================================= */
  const weeklyOff = await prisma.weeklyOff.findFirst({
    where: {userId, OR: [{ isFixed: true, offDay: dayName }, { isFixed: false, offDate: dateObj }  ] }
  });

  if (!weeklyOff) return; // ❌ not a week-off

  /* =========================================
     2️⃣ PREVENT DUPLICATE COMP-OFF
  ========================================= */
  const alreadyGranted = await prisma.compOff.findFirst({
    where: { userId, workDate: dateObj } });

  if (alreadyGranted) return;

  /* =========================================
     3️⃣ CREATE COMP-OFF ENTRY
  ========================================= */
  await prisma.compOff.create({
    data: {userId, workDate: dateObj,  duration: 1, status: "APPROVED", approvedAt: new Date(), note: "Worked on weekly off" }
  });

  /* =========================================
     4️⃣ UPDATE USER BALANCE
  ========================================= */
  await prisma.user.update({
    where: { id: userId },
    data: {
      compOffBalance: { increment: 1 }
    }
  });

  console.log(`🎉 Comp-Off granted for ${isoDate}`);
}

/* =======================================================
   CHECK-IN (Holiday + WeekOff BLOCK)
======================================================= */
export const checkIn = async (req, res) => {
  try {
    const user = req.user;
    const activeUser = await prisma.user.findFirst({
  where: { id: user.id, isActive: true },
});

if (!activeUser) {
  return res.status(403).json({
    success: false,
    message: "Account deactivated. Contact admin.",
  });
}

    if (!user)
      return res.status(401).json({ success: false, message: "Not authenticated" });

    if (user.role === "ADMIN")
      return res.status(403).json({ success: false, message: "Admin cannot check in" });

    const today = new Date(); // UTC — CORRECT
    const todayISO = toLocalISO(today);

    /* =====================================================
       1️⃣ BLOCK: HOLIDAY
    ===================================================== */
    const holiday = await prisma.holiday.findFirst({
      where: { date: new Date(todayISO) }
    });

    if (holiday) {
      return res.status(400).json({
        success: false,
        message: `Today is Holiday (${holiday.title}), Check-in not allowed`
      });
    }

    /* =====================================================
       2️⃣ BLOCK: APPROVED LEAVE / WFH
    ===================================================== */
    const leaveToday = await prisma.leave.findFirst({
      where: {
        userId: user.id,
        status: "APPROVED",
        startDate: { lte: new Date(todayISO) },
        endDate: { gte: new Date(todayISO) }
      }
    });

if (leaveToday && !["WFH", "HALF_DAY"].includes(leaveToday.type)) {
  return res.status(400).json({
    success: false,
    message: `You are on ${leaveToday.type} today. Check-in denied.`
  });
}

    /* =====================================================
       3️⃣ CHECK: WEEK-OFF
    ===================================================== */
    const weeklyOff = await prisma.weeklyOff.findFirst({
      where: { userId: user.id }
    });

    let isWeekOff = false;

    if (weeklyOff) {
      const dayName = today.toLocaleDateString("en-US", { weekday: "long" });

      const isFixedOff =
        weeklyOff.isFixed && weeklyOff.offDay === dayName;

      const isRosterOff =
        !weeklyOff.isFixed &&
        weeklyOff.offDate &&
        toLocalISO(weeklyOff.offDate) === todayISO;

      isWeekOff = isFixedOff || isRosterOff;
    }

    /* =====================================================
       4️⃣ DUPLICATE CHECK
    ===================================================== */
const existing = await prisma.attendance.findFirst({
  where: {
    userId: user.id,
    checkOut: null   // 🔥 key fix
  },
  orderBy: { checkIn: "desc" }
});

    if (existing?.checkIn) {
      return res.json({
        success: true,
        message: "Already checked in",
        attendance: existing
      });
    }

    /* =====================================================
       5️⃣ FINAL STATUS (🔥 IMPORTANT PART)
    ===================================================== */
let status = "PRESENT";
let lateHalfDayEligible = false;

const istNow = new Date(
  today.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
);
const halfDayCutoff = new Date(istNow);
halfDayCutoff.setHours(12, 0, 0, 0);

if (isWeekOff) {
  status = "WEEKOFF_PRESENT";
}
else if (leaveToday?.type === "WFH") {
  status = "WFH";
}
else if (leaveToday?.type === "HALF_DAY") {
  status = "HALF_DAY";
}
else {
  if (istNow >= halfDayCutoff) {
    status = "HALF_DAY_PENDING";                 // still present
    lateHalfDayEligible = true;         // 🔥 ADMIN DECISION PENDING
  } else {
    status = "PRESENT";
  }
}

    /* =====================================================
       6️⃣ SAVE ATTENDANCE
    ===================================================== */
    const attendance = existing
      ? await prisma.attendance.update({
          where: { id: existing.id },
          data: { checkIn: today, status, lateHalfDayEligible }
        })
      : await prisma.attendance.create({
          data: {
            userId: user.id,
            date: new Date(todayISO),
            checkIn: today,
            status, lateHalfDayEligible
          }
        });
        // ✅ AUTO COMP-OFF ON WEEKOFF CHECK-IN (IMMEDIATE)
if (status === "WEEKOFF_PRESENT") {
  await autoGrantCompOff(user.id, todayISO);
}

    return res.json({
      success: true,
      message: "Checked in successfully",
      attendance
    });

  } catch (err) {
    console.error("[CHECKIN ERROR]", err);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

/* =======================================================
   CHECK-OUT
======================================================= */
export const checkOut = async (req, res) => {
  try {
    const user = req.user;
    const activeUser = await prisma.user.findFirst({
  where: { id: user.id, isActive: true },
});

if (!activeUser) {
  return res.status(403).json({
    success: false,
    message: "Account deactivated. Contact admin.",
  });
}

    if (!user) return res.status(401).json({ success: false, message: "Not authenticated" });
    if (user.role === "ADMIN") return res.status(403).json({ success: false, message: "Admin cannot check out" });

const today = new Date(); // UTC — CORRECT
const todayISO = toLocalISO(today);
    const { s, e } = todayRange();
const existing = await prisma.attendance.findFirst({
  where: {
    userId: user.id,
   date: { gte: new Date(todayISO+"T00:00:00"), lte: new Date(todayISO+"T23:59:59.999") }
  }
});

    if (!existing)
      return res.status(400).json({ success: false, message: "You have not checked in today" });

    if (existing.checkOut)
      return res.json({ success: true, message: "Already checked out", attendance: existing });

const nowTime = new Date(); // UTC
const updated = await prisma.attendance.update({
  where: { id: existing.id },
  data: { checkOut: nowTime }
});

    return res.json({ success: true, message: "Checked out", attendance: updated });
  } catch (err) {
    console.error("[checkOut ERROR]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* =======================================================
   GET MY ATTENDANCE (EMPLOYEE)
======================================================= */
export const getMyAttendance = async (req, res) => {
  try {
    const userId = req.user.id;
    const activeUser = await prisma.user.findFirst({
  where: { id: userId, isActive: true },
});

if (!activeUser) {
  return res.status(403).json({
    success: false,
    message: "Account deactivated",
  });
}
    const { start, end } = req.query;

    /* =====================================================
       1️⃣ FETCH DATA
    ===================================================== */
    const dbAttendances = await prisma.attendance.findMany({
      where: {
        userId,
        date: { gte: new Date(start), lte: new Date(end) }
      },
      orderBy: { date: "asc" }
    });

    const leaves = await prisma.leave.findMany({
      where: { userId, status: "APPROVED" }
    });

    const holidays = await prisma.holiday.findMany();
    const weekOff = await prisma.weeklyOff.findFirst({ where: { userId } });

    /* =====================================================
       2️⃣ ATTENDANCE MAP
    ===================================================== */
    const attendanceMap = {};
    dbAttendances.forEach(a => {
      const iso = toLocalISO(a.date);
      attendanceMap[iso] = a;
    });

    /* =====================================================
       3️⃣ ITERATE DATE RANGE
    ===================================================== */
    const dailyLogs = [];
    const calendar = {};

    let cur = new Date(start);
    cur.setHours(0, 0, 0, 0);

    const last = new Date(end);
    last.setHours(0, 0, 0, 0);

const today = new Date(); // UTC — CORRECT
today.setHours(0, 0, 0, 0);

    while (cur <= last && cur <= today) {
      const iso = toLocalISO(cur);

      /* =========================
      B️⃣ LEAVE (WFH / HALF_DAY / OTHERS)
      ========================= */
      const leave = leaves.find(
        l => new Date(l.startDate) <= cur && new Date(l.endDate) >= cur
      );
      
      if (leave) {
        const status =
        leave.type === "WFH" ? "WFH"
        : leave.type === "HALF_DAY" ? "HALF_DAY"  : "LEAVE";
        
        dailyLogs.push({
          date: iso,
          status,
          checkIn: null,
          checkOut: null
        });
        
        calendar[iso] = status;
        cur.setDate(cur.getDate() + 1);
        continue;
      }
      /* =========================
         A️⃣ ATTENDANCE
      ========================= */
      
      if (attendanceMap[iso]) {
        const a = attendanceMap[iso];
        dailyLogs.push({ ...a, date: iso });
        calendar[iso] = a.lateHalfDayEligible ? "HALF_DAY_PENDING" : a.status; // PRESENT / LATE / WFH / HALF_DAY / WEEKOFF_PRESENT
        cur.setDate(cur.getDate() + 1);
        continue;
      }
      /* =========================
         C️⃣ HOLIDAY
      ========================= */
      const holiday = holidays.find(h => toLocalISO(h.date) === iso);
      if (holiday) {
        dailyLogs.push({
          date: iso,
          status: "HOLIDAY",
          checkIn: null,
          checkOut: null
        });
        calendar[iso] = "HOLIDAY";
        cur.setDate(cur.getDate() + 1);
        continue;
      }

      /* =========================
         D️⃣ WEEK-OFF
      ========================= */
      const dayName = cur.toLocaleDateString("en-US", { weekday: "long" });

      const isWeekOff =
        weekOff &&
        (
          (weekOff.isFixed && weekOff.offDay === dayName) ||
          (!weekOff.isFixed && weekOff.offDate && toLocalISO(weekOff.offDate) === iso)
        );

      if (isWeekOff) {
        dailyLogs.push({
          date: iso,
          status: "WEEKOFF",
          checkIn: null,
          checkOut: null
        });
        calendar[iso] = "WEEKOFF";
        cur.setDate(cur.getDate() + 1);
        continue;
      }

      /* =========================
         E️⃣ ABSENT
      ========================= */
      dailyLogs.push({
        date: iso,
        status: "ABSENT",
        checkIn: null,
        checkOut: null
      });
      calendar[iso] = "ABSENT";

      cur.setDate(cur.getDate() + 1);
    }

const corrections = await prisma.attendanceCorrection.findMany({
  where: { userId },
});

const correctionMap = {};
corrections.forEach(c => {
  correctionMap[toLocalISO(c.date)] = {
    status: c.status,
    adminReason: c.adminReason,
  };
});

    return res.json({
      success: true,
      attendances: dailyLogs,
      calendar,
      corrections: correctionMap,
    });

  } catch (err) {
    console.error("[getMyAttendance ERROR]", err);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

/* =======================================================
   ADMIN — GET ALL ATTENDANCE  (FINAL WFH FIX)
======================================================= */
export const getAllAttendance = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ success: false, message: "Admin only" });
    }

    const { start, end, departmentId, userId, status } = req.query;

    const startDate = new Date(start);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);

    /* =====================================================
       1️⃣ EMPLOYEES
    ===================================================== */
    const employees = await prisma.user.findMany({
      where: {
        role: { not: "ADMIN" },
        isActive: true,  
        ...(departmentId && { departmentId }),
        ...(userId && { id: userId }),
      },
    });

    /* =====================================================
       2️⃣ WEEK OFF CONFIG
    ===================================================== */
   const weeklyOffs = await prisma.weeklyOff.findMany({
  where: { user: { isActive: true } }
});

    /* =====================================================
       3️⃣ ATTENDANCE
    ===================================================== */
const attendances = await prisma.attendance.findMany({
  where: {
    date: { gte: startDate, lte: endDate },
    user: { isActive: true },
  },
  include: { user: true },
});

    /* =====================================================
       4️⃣ LEAVES
    ===================================================== */
    const leaves = await prisma.leave.findMany({
      where: {
        status: "APPROVED",
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      include: { user: true },
    });

    /* =====================================================
       5️⃣ MAPS
    ===================================================== */
    
    const leaveMap = {};
    leaves.forEach(l => {
      let cur = new Date(l.startDate);
      cur.setHours(0, 0, 0, 0);
      const last = new Date(l.endDate);
      last.setHours(0, 0, 0, 0);
      
      while (cur <= last) {
        const key = `${l.userId}_${toLocalISO(cur)}`;
        leaveMap[key] = l.type; // PAID / SICK / CASUAL / WFH / HALF_DAY / COMP_OFF
        cur.setDate(cur.getDate() + 1);
      }
    });
    
    const attendanceMap = {};
    attendances.forEach(a => {
      const key = `${a.userId}_${toLocalISO(a.date)}`;
      attendanceMap[key] = a;
    });
    
    const rosterWeekOffMap = {};
    weeklyOffs.forEach(w => {
      if (!w.isFixed && w.offDate) {
        const key = `${w.userId}_${toLocalISO(w.offDate)}`;
        rosterWeekOffMap[key] = true;
      }
    });

    /* =====================================================
       6️⃣ BUILD ROWS (PRIORITY BASED)
    ===================================================== */
    const rows = [];

    employees.forEach(emp => {
      let cur = new Date(startDate);

      while (cur <= endDate) {
        const iso = toLocalISO(cur);
        const key = `${emp.id}_${iso}`;

        
        /* B️⃣ LEAVE / WFH / HALF_DAY / COMP_OFF */
        if (leaveMap[key]) {
          rows.push({
            user: emp,
            userId: emp.id,
            date: iso,
            status: leaveMap[key],
            checkIn: null,
            checkOut: null,
          });
          cur.setDate(cur.getDate() + 1);
          continue;
        }

        /* A️⃣ ATTENDANCE (TOP PRIORITY) */
        if (attendanceMap[key]) {
          rows.push(attendanceMap[key]);
          cur.setDate(cur.getDate() + 1);
          continue;
        }
        
        /* C️⃣ WEEK-OFF */
        const dayName = cur.toLocaleDateString("en-US", { weekday: "long" });

        const isFixedWeekOff = weeklyOffs.some(
          w => w.userId === emp.id && w.isFixed && w.offDay === dayName
        );

        const isRosterWeekOff = rosterWeekOffMap[key];

        if (isFixedWeekOff || isRosterWeekOff) {
          rows.push({
            user: emp,
            userId: emp.id,
            date: iso,
            status: "WEEKOFF",
            checkIn: null,
            checkOut: null,
          });
        }

        cur.setDate(cur.getDate() + 1);
      }
    });

    /* =====================================================
       7️⃣ STATUS FILTER
    ===================================================== */
    const finalRows = status
      ? rows.filter(r => r.status === status)
      : rows;

    /* =====================================================
       8️⃣ KPI SUMMARY (NO CONFUSION)
    ===================================================== */
    const totalEmployees = employees.length;

    const presentCount = finalRows.filter(r => r.status === "PRESENT").length;

    const weekOffPresentCount = finalRows.filter(
      r => r.status === "WEEKOFF_PRESENT"
    ).length;

    const wfhCount = finalRows.filter(r => r.status === "WFH").length;

    const compOffCount = finalRows.filter(r => r.status === "COMP_OFF").length;

 const halfDayCount = finalRows.filter(
  r => r.status === "HALF_DAY"
).length;

const leaveCount = finalRows.filter(
  r => ["PAID", "UNPAID", "SICK", "CASUAL"].includes(r.status)
).length;

const weekOffCount = finalRows.filter(r => r.status === "WEEKOFF").length;

const absentCount = Math.max(
  totalEmployees -
    (
      presentCount +
      weekOffPresentCount +
      wfhCount +
      halfDayCount+
      leaveCount +
      compOffCount +
      weekOffCount
    ),
  0
);

    const summary = {
      totalEmployees,
      present: presentCount,
      weekOffPresent: weekOffPresentCount,
      wfh: wfhCount,
      halfDay: halfDayCount,
      leave: leaveCount,
      compOff: compOffCount,
      weekOff: weekOffCount,
      absent: absentCount,
    };

    return res.json({
      success: true,
      attendances: finalRows,
      summary,
    });

  } catch (err) {
    console.error("[getAllAttendance ERROR]", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
/* =======================================================
   ADMIN — HALF DAY DECISION (APPROVE / REJECT)
======================================================= */
export const decideHalfDay = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ success: false, message: "Admin only" });
    }

    const { attendanceId, action } = req.body;

    if (!attendanceId || !["APPROVE", "REJECT"].includes(action)) {
      return res.status(400).json({ success: false, message: "Invalid request" });
    }

    const attendance = await prisma.attendance.findUnique({
      where: { id: attendanceId },
      include: { user: true }
    });

    if (!attendance || !attendance.lateHalfDayEligible) {
      return res.status(400).json({
        success: false,
        message: "No pending half-day request"
      });
    }

    if (!attendance.user.isActive) {
  return res.status(400).json({
    success: false,
    message: "Cannot decide half-day for deactivated user",
  });
}

  const alreadyLeave = await prisma.leave.findFirst({
  where: {
    userId: attendance.userId,
    type: "HALF_DAY",
    startDate: attendance.date,
    endDate: attendance.date
  }
});

if (alreadyLeave) {
  return res.status(400).json({
    success: false,
    message: "Half-day already applied for this date"
  });
}

    /* =========================
       APPROVE
    ========================= */
    if (action === "APPROVE") {

      // 1️⃣ Update attendance
      await prisma.attendance.update({
        where: { id: attendanceId },
        data: {
          status: "HALF_DAY",
          lateHalfDayEligible: false
        }
      });

      // 2️⃣ Create HALF DAY leave
      await prisma.leave.create({
        data: {
          userId: attendance.userId,
          type: "HALF_DAY",
          status: "APPROVED",
          startDate: attendance.date,
          endDate: attendance.date,
          reason: "Late Check-in"
        }
      });

      return res.json({
        success: true,
        message: "Half-day approved"
      });
    }

    /* =========================
       REJECT
    ========================= */
    await prisma.attendance.update({
      where: { id: attendanceId },
      data: {
        status: "PRESENT",
        lateHalfDayEligible: false
      }
    });

    return res.json({
      success: true,
      message: "Half-day rejected, marked present"
    });

  } catch (err) {
    console.error("[decideHalfDay ERROR]", err);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

/* =======================================================
   ADMIN — USER FULL HISTORY
======================================================= */
export const getAttendanceForUser = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN")
      return res.status(403).json({ success: false, message: "Admin only" });

    const userId = req.params.userId;
    const activeUser = await prisma.user.findFirst({
  where: { id: userId, isActive: true },
});

if (!activeUser) {
  return res.status(404).json({
    success: false,
    message: "User deactivated",
  });
}

const rows = await prisma.attendance.findMany({
  where: { userId },
  orderBy: { date: "desc" },
});

    return res.json({ success: true, attendances: rows });
  } catch (err) {
    console.error("[getAttendanceForUser ERROR]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* =======================================================
   ADMIN — MONTHLY LOGS
======================================================= */
export const getUserMonthlyLogs = async (req, res) => {
  try {
    const { userId } = req.params;
    const { month } = req.query;

    const [y, m] = month.split("-").map(Number);

    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0);
    end.setHours(23, 59, 59, 999);

    const logs = await prisma.attendance.findMany({
      where: { userId, user: { isActive: true }, date: { gte: start, lte: end } },
      orderBy: { date: "asc" }
    });

    return res.json({ success: true, month, days: logs });
  } catch (err) {
    console.error("[getUserMonthlyLogs ERROR]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* =======================================================
   ADMIN — DELETE ATTENDANCE
======================================================= */
export const deleteAttendance = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN")
      return res.status(403).json({ success: false, message: "Admin only" });
    

    const attendance = await prisma.attendance.findUnique({
      where: { id: req.params.id }
    });

    if (!attendance)
      return res.status(404).json({ success: false, message: "Not found" });

        const activeUser = await prisma.user.findFirst({
        where: { id: attendance.userId, isActive: true },
        });

if (!activeUser) {
  return res.status(400).json({
    success: false,
    message: "Cannot modify attendance of deactivated user",
  });
}

    // 🔥 IF WEEKOFF_PRESENT → revert compOff
    if (attendance.status === "WEEKOFF_PRESENT") {
      const iso = toLocalISO(attendance.date);

      const comp = await prisma.compOff.findFirst({
        where: {
          userId: attendance.userId,
          workDate: new Date(iso),
          status: "APPROVED"
        }
      });

      if (comp) {
        await prisma.$transaction(async (tx) => {
          await tx.compOff.delete({ where: { id: comp.id } });
          await tx.user.update({
            where: { id: attendance.userId },
            data: { compOffBalance: { decrement: comp.duration } }
          });
        });
      }
    }
    await prisma.attendance.delete({ where: { id: req.params.id } });
    return res.json({ success: true, message: "Attendance deleted successfully" });
  } catch (err) {
    console.error("[deleteAttendance ERROR]", err);
    return res.status(500).json({ success: false, message: "Failed to delete attendance" });
  }
};


/* =======================================================
   EXPORT CSV / EXCEL
======================================================= */
export const exportAttendance = async (req, res) => {
  try {
    const user = req.user;
    const formatIST = (d) =>
  d
    ? new Date(d).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Kolkata",
      })
    : "";

    let { start, end, userId, departmentId, format } = req.query;
    if (!format) format = "csv";

    if (user.role !== "ADMIN") userId = user.id;

    const where = {};

    if (start && end) {
      const { s, e } = rangeFromISO(start, end);
      where.date = { gte: s, lte: e };
    }

    if (userId) where.userId = userId;
    if (departmentId) where.user = { departmentId };

  const rows = await prisma.attendance.findMany({
where: {
  ...where,
  user: { isActive: true }
},
include: { user: true },
orderBy: { date: "asc" }
});

if (format === "csv") {
  const csvRows = rows.map(r => ({
    employee: r.user.firstName,
    date: toLocalISO(r.date),
    checkIn: formatIST(r.checkIn),
    checkOut: formatIST(r.checkOut),
    status: r.lateHalfDayEligible ? "HALF_DAY_PENDING" : r.status,
  }));
  
   const parser = new Parser({
    fields: ["employee", "date", "checkIn", "checkOut", "status"],
  });

  const csv = parser.parse(csvRows);
  
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=attendance.csv");
      return res.send(csv);
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Attendance");

    sheet.columns = [
      { header: "Employee", key: "employee", width: 20 },
      { header: "Date", key: "date", width: 15 },
      { header: "Check In", key: "checkIn", width: 15 },
      { header: "Check Out", key: "checkOut", width: 15 },
      { header: "Status", key: "status", width: 12 }
    ];

    rows.forEach((r) => {
      sheet.addRow({
        employee: r.user.firstName,
        date: toLocalISO(r.date),
        checkIn: formatIST(r.checkIn),
        checkOut: formatIST(r.checkOut),
        status: r.lateHalfDayEligible ? "HALF_DAY_PENDING" : r.status,
      });
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", "attachment; filename=attendance.xlsx");

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error("[exportAttendance ERROR]", err);
    return res.status(500).json({ success: false, message: "Export failed" });
  }
};