import prisma from "../prismaClient.js";
import {
  countActiveEmployees,
  findActiveEmployees
} from "../services/userService.js";

const WEEKDAY_MAP = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

const sameDay = (d1, d2) =>
  new Date(d1).toISOString().slice(0, 10) ===
  new Date(d2).toISOString().slice(0, 10);

/* =====================================================
   Helper: Today Range (00:00 → 23:59)
===================================================== */
const getTodayRange = () => {
  const nowIST = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );

  const start = new Date(nowIST);
  start.setHours(0, 0, 0, 0);

  const end = new Date(nowIST);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

/* =====================================================
   DASHBOARD CONTROLLER
===================================================== */
export const dashboard = async (req, res) => {
  try {
    const user = req.user;

    /* =====================================================
       🔥 ADMIN DASHBOARD (UNCHANGED)
    ====================================================== */
   if (user.role === "ADMIN") {
  const totalEmployees = await countActiveEmployees();

  const totalDepartments = await prisma.department.count();

  /* ===================== FIXED: DEPARTMENT EMPLOYEE COUNT ===================== */
   const deptStatsRaw = await prisma.department.findMany({
    select: {
      id: true,
      name: true,

      // 👥 Employees (multi-department mapping)
      members: {
        select: {
          userId: true
        }
      },

      // 👔 Managers (department managers)
      managers: {
        select: {
          id: true,
          firstName: true,
          lastName: true
        }
      }
    },
    orderBy: { name: "asc" }
  });

const deptStats = await Promise.all(
  deptStatsRaw.map(async (d) => {
    const userIds = new Set();

    d.members.forEach((m) => userIds.add(m.userId));
    d.managers.forEach((m) => userIds.add(m.id));

    const activeCount = await prisma.user.count({
      where: {
        id: { in: Array.from(userIds) },
        isActive: true
      }
    });

    return {
      id: d.id,
      name: d.name,
      count: activeCount, // ✅ ONLY ACTIVE
      managers: d.managers.map(
        (m) => `${m.firstName} ${m.lastName || ""}`.trim()
      )
    };
  })
);
  /* =========================================================================== */

  const { start, end } = getTodayRange();

  const todayAttendance = await prisma.attendance.findMany({
    where: { date: { gte: start, lte: end },
      user: { isActive: true }
   },
    include: { user: true }
  });

  const presentToday = todayAttendance.filter((a) => a.checkIn).length;
  const wfhToday = todayAttendance.filter((a) => a.status === "WFH").length;
const absentToday = Math.max(
  totalEmployees - (presentToday + wfhToday),//+ weekoffpresent+leave+compOff+weakOff
  0
);

  const leaveSummary = await prisma.leave.groupBy({
    by: ["status"],
    _count: { id: true }
  });

const agilityEmployees = await countActiveEmployees({
  role: "AGILITY_EMPLOYEE"
});

const lyfEmployees = await countActiveEmployees({
  role: "LYF_EMPLOYEE"
});

  const payrollLast = await prisma.payroll.findMany({
    orderBy: { salaryMonth: "desc" },
    take: 12
  });

  const payrollSummary = payrollLast.reduce(
    (acc, p) => {
      acc.totalBase += p.baseSalary;
      acc.totalBonus += p.bonus;
      acc.totalDeduction += p.deductions;
      acc.totalNet += p.netSalary;
      return acc;
    },
    { totalBase: 0, totalBonus: 0, totalDeduction: 0, totalNet: 0 }
  );

  const now = new Date();
  const last7 = new Date();
  last7.setDate(now.getDate() - 7);

  const attendanceTrend = await prisma.attendance.findMany({
    where: { date: { gte: last7, lte: now },
    user: { isActive: true }
   },
    include: { user: true },
    orderBy: { date: "asc" }
  });

  const attendanceTrendFormatted = attendanceTrend.map((a) => ({
    ...a,
    dateFormatted: new Date(a.date).toLocaleDateString()
  }));

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const leavesTrend = await prisma.leave.findMany({
    where: { startDate: { gte: monthStart },
  user: { isActive: true } },
    include: { user: true }
  });

  const leavesTrendFormatted = leavesTrend.map((l) => ({
    ...l,
    dateFormatted: new Date(l.startDate).toLocaleDateString()
  }));

  const leavesToday = await prisma.leave.findMany({
    where: {
      startDate: { lte: end },
      endDate: { gte: start },
      user: { isActive: true }
    },
    include: { user: true }
  });

  const leavesTodayFormatted = leavesToday.map((l) => ({
    ...l,
    days:
      Math.floor(
        (new Date(l.endDate) - new Date(l.startDate)) /
        (1000 * 60 * 60 * 24)
      ) + 1,
    startDateFormatted: new Date(l.startDate).toLocaleDateString()
  }));

  const wfhTodayList = todayAttendance
    .filter((a) => a.status === "WFH")
    .map((a) => ({
      ...a,
      dateFormatted: new Date(a.date).toLocaleDateString()
    }));

  return res.json({
    success: true,
    admin: true,
    stats: {
      totalEmployees,
      totalDepartments,
      presentToday,
      wfhToday,
      absentToday,
      leaveSummary,
      payrollSummary,
      companyWise: {
        agility: agilityEmployees,
        lyfshilp: lyfEmployees
      },
      departments: deptStats, // ✅ FIXED DATA
      attendanceTrend: attendanceTrendFormatted,
      leavesTrend: leavesTrendFormatted,
      leavesToday: leavesTodayFormatted,
      wfhToday: wfhTodayList
    }
  });
}

 /* =====================================================
       🔥 EMPLOYEE DASHBOARD — FINAL (MATCHES LEAVE CONTROLLER)
    ====================================================== */
if (!user.isActive) {
  return res.status(403).json({
    success: false,
    message: "Account deactivated"
  });
}

    const uid = user.id;

    /* ---------------- FETCH DATA ---------------- */
    const allLeaves = await prisma.leave.findMany({
      where: { userId: uid },
      orderBy: { startDate: "asc" }
    });

    const rawAttendance = await prisma.attendance.findMany({
      where: { userId: uid },
      orderBy: { date: "asc" }
    });

    // 🔥 FETCH WEEKLY OFF CONFIG
const weeklyOffs = await prisma.weeklyOff.findMany({
  where: { userId: uid }
});

    /* ---------------- SAME HELPER AS LEAVES UI ---------------- */
    const getUniqueLeaveUnits = (leaves) => {
      const dayMap = {}; // { "2025-02-12": 1 | 0.5 }

      leaves.forEach((l) => {
        let cur = new Date(l.startDate);
        const end = new Date(l.endDate);
        const value = l.type === "HALF_DAY" ? 0.5 : 1;

        while (cur <= end) {
          const iso = cur.toISOString().slice(0, 10);
          dayMap[iso] = Math.max(dayMap[iso] || 0, value);
          cur.setDate(cur.getDate() + 1);
        }
      });

      return Object.values(dayMap).reduce((a, b) => a + b, 0);
    };

    /* ---------------- YEAR RANGE (OVERLAP BASED ✅) ---------------- */
    const currentYear = new Date().getFullYear();
    const yearStart = new Date(`${currentYear}-01-01`);
    const yearEnd   = new Date(`${currentYear}-12-31`);

    /* ================= KPI VALUES ================= */

    // ✅ Applied Leave Days (NON-WFH)
    const appliedLeaveDays = getUniqueLeaveUnits(
      allLeaves.filter(
        (l) =>
          l.type !== "WFH" &&
          new Date(l.startDate) <= yearEnd &&
          new Date(l.endDate) >= yearStart
      )
    );

    // ✅ Approved Leave Days (NON-WFH, NON-UNPAID)
    const approvedLeaveDays = getUniqueLeaveUnits(
      allLeaves.filter(
        (l) =>
          l.status === "APPROVED" &&
          l.type !== "WFH" &&
          l.type !== "UNPAID" &&
          new Date(l.startDate) <= yearEnd &&
          new Date(l.endDate) >= yearStart
      )
    );

    // ✅ Applied WFH Days
    const appliedWFHDays = getUniqueLeaveUnits(
      allLeaves.filter(
        (l) =>
          l.type === "WFH" &&
          new Date(l.startDate) <= yearEnd &&
          new Date(l.endDate) >= yearStart
      )
    );

    // ✅ Approved WFH Days
    const approvedWFHDays = getUniqueLeaveUnits(
      allLeaves.filter(
        (l) =>
          l.type === "WFH" &&
          l.status === "APPROVED" &&
          new Date(l.startDate) <= yearEnd &&
          new Date(l.endDate) >= yearStart
      )
    );

    /* ================= ATTENDANCE MERGE ================= */

    const mergedAttendance = [...rawAttendance];
    // 🔥 ADD WEEKOFFS FOR FULL YEAR
const yearCursor = new Date(yearStart);

while (yearCursor <= yearEnd) {
  const iso = yearCursor.toISOString().slice(0, 10);

 const exists = mergedAttendance.some((a) =>
  sameDay(a.date, yearCursor)
);

  if (!exists) {
    const dayIndex = yearCursor.getDay();

    const isWeeklyOff = weeklyOffs.some(
      (w) =>
        w.isFixed &&
        WEEKDAY_MAP[w.offDay] === dayIndex
    );

    if (isWeeklyOff) {
      mergedAttendance.push({
        date: new Date(yearCursor),
        status: "WEEKOFF",
        checkIn: null,
      });
    }
  }

  yearCursor.setDate(yearCursor.getDate() + 1);
}

const holidays = await prisma.holiday.findMany({
  where: {
    date: {
      gte: yearStart,
      lte: yearEnd
    }
  }
});

// 🔥 ADD HOLIDAYS (NO PRESENT ON HOLIDAY)
holidays.forEach((h) => {
  const holidayDate = new Date(h.date);

  const exists = mergedAttendance.some((a) =>
    sameDay(a.date, holidayDate)
  );

  if (!exists) {
    mergedAttendance.push({
      date: new Date(holidayDate),
      status: "HOLIDAY",
      checkIn: null, // ❌ NO PRESENT ON HOLIDAY
      title: h.title
    });
  }
});

// 🔥 APPROVED LEAVES → ATTENDANCE MERGE
allLeaves
  .filter(
    (l) =>
      l.status === "APPROVED" &&
      new Date(l.startDate) <= yearEnd &&
      new Date(l.endDate) >= yearStart
  )
  .forEach((l) => {
    let cur = new Date(l.startDate);
    const end = new Date(l.endDate);

let status = "LEAVE";

if (l.type === "WFH") status = "WFH";
else if (l.type === "HALF_DAY") status = "HALF_DAY";
else if (l.type === "COMP_OFF") status = "COMP_OFF";

    while (cur <= end) {
      const iso = cur.toISOString().slice(0, 10);

const exists = mergedAttendance.some((a) =>
  sameDay(a.date, cur)
);

      if (!exists) {
        mergedAttendance.push({
          date: new Date(cur),
          status,
          checkIn: null,
        });
      }

      cur.setDate(cur.getDate() + 1);
    }
  });
mergedAttendance.forEach((a) => {
  if (
    a.status === "WEEKOFF" &&
    rawAttendance.some(
      (r) =>
        sameDay(r.date, a.date) &&
        r.checkIn
    )
  ) {
    a.status = "WEEKOFF_PRESENT";
  }
});

    mergedAttendance.sort((a, b) => new Date(a.date) - new Date(b.date));

    const presentDays = mergedAttendance.filter((a) => a.checkIn).length;

    /* ================= PAYROLL + TREND ================= */

    const myPayroll = await prisma.payroll.findMany({
      where: { userId: uid },
      orderBy: { salaryMonth: "desc" },
      take: 6
    });

    const now = new Date();
    const last7 = new Date();
    last7.setDate(now.getDate() - 7);

    const attendanceTrend = await prisma.attendance.findMany({
      where: { userId: uid, date: { gte: last7, lte: now } },
      orderBy: { date: "asc" }
    });

    /* ================= RESPONSE ================= */

    return res.json({
      success: true,
      admin: false,
      stats: {
        presentDays,
        appliedLeaveDays,
        approvedLeaveDays,
        appliedWFHDays,
        approvedWFHDays,
        payrollHistory: myPayroll,
        attendanceTrend,
        attendance: mergedAttendance
      }
    });

  } catch (err) {
    console.error("dashboard ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};