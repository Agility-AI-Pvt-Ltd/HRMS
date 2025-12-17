import prisma from "../prismaClient.js";

/* =====================================================
   Helper: Today Range (00:00 → 23:59)
===================================================== */
const getTodayRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date();
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
      const totalEmployees = await prisma.user.count({
        where: { role: { in: ["AGILITY_EMPLOYEE", "LYF_EMPLOYEE"] } }
      });

      const totalDepartments = await prisma.department.count();

      const deptWithUsers = await prisma.department.findMany({
        include: { users: true }
      });

const deptStats = deptWithUsers.map((d) => ({
  id: d.id,
  name: d.name,
  count: d.users?.length || 0
}));


      const { start, end } = getTodayRange();

      const todayAttendance = await prisma.attendance.findMany({
        where: { date: { gte: start, lte: end } },
        include: { user: true }
      });

      const presentToday = todayAttendance.filter((a) => a.checkIn).length;
      const wfhToday = todayAttendance.filter((a) => a.status === "WFH").length;
      const absentToday = totalEmployees - (presentToday + wfhToday);

      const leaveSummary = await prisma.leave.groupBy({
        by: ["status"],
        _count: { id: true }
      });

      const agilityEmployees = await prisma.user.count({
        where: { role: "AGILITY_EMPLOYEE" }
      });

      const lyfEmployees = await prisma.user.count({
        where: { role: "LYF_EMPLOYEE" }
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
        where: { date: { gte: last7, lte: now } },
        include: { user: true },
        orderBy: { date: "asc" }
      });

      const attendanceTrendFormatted = attendanceTrend.map((a) => ({
        ...a,
        dateFormatted: new Date(a.date).toLocaleDateString()
      }));

      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const leavesTrend = await prisma.leave.findMany({
        where: { startDate: { gte: monthStart } },
        include: { user: true }
      });

      const leavesTrendFormatted = leavesTrend.map((l) => ({
        ...l,
        dateFormatted: new Date(l.startDate).toLocaleDateString()
      }));

      const leavesToday = await prisma.leave.findMany({
        where: {
          startDate: { lte: end },
          endDate: { gte: start }
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
          departments: deptStats,
          attendanceTrend: attendanceTrendFormatted,
          leavesTrend: leavesTrendFormatted,
          leavesToday: leavesTodayFormatted,
          wfhToday: wfhTodayList
        }
      });
    }
/* =====================================================
   🔥 EMPLOYEE DASHBOARD — FINAL FIXED VERSION (MATCHES LEAVES UI)
====================================================== */

const uid = user.id;

// 1️⃣ Fetch raw attendance
const rawAttendance = await prisma.attendance.findMany({
  where: { userId: uid },
  orderBy: { date: "asc" }
});

// 2️⃣ Fetch ALL leaves
const allLeaves = await prisma.leave.findMany({
  where: { userId: uid },
  orderBy: { startDate: "asc" }
});

// 3️⃣ APPROVED LEAVES + APPROVED WFH
const approvedLeaveItems = allLeaves.filter(
  (l) => l.status === "APPROVED" && l.type !== "WFH" && l.type !== "UNPAID"
);

const approvedWFHItems = allLeaves.filter(
  (l) => l.status === "APPROVED" && l.type === "WFH"
);

/* =====================================================
   ⭐ SAME HELPER USED IN LEAVES UI (UNIQUE MERGED DAYS)
====================================================== */
function getUniqueLeaveDays(arr) {
  const ranges = arr.map(l => ({
    start: new Date(l.startDate),
    end: new Date(l.endDate),
  }));

  if (ranges.length === 0) return 0;

  ranges.sort((a, b) => a.start - b.start);

  const merged = [ranges[0]];

  for (let i = 1; i < ranges.length; i++) {
    const last = merged[merged.length - 1];
    const curr = ranges[i];

    if (curr.start <= last.end) {
      last.end = new Date(Math.max(last.end, curr.end));
    } else {
      merged.push(curr);
    }
  }

  let total = 0;
  merged.forEach(r => {
    total += Math.floor((r.end - r.start) / 86400000) + 1;
  });

  return total;
}

/* =====================================================
   ⭐ YEAR RANGE (same as UI)
====================================================== */
const currentYear = new Date().getFullYear();
const yearStart = new Date(`${currentYear}-01-01`);
const yearEnd   = new Date(`${currentYear}-12-31`);

/* =====================================================
   ⭐ FINAL KPI VALUES (EXACT SAME AS UI)
====================================================== */

// Total leaves applied (non-WFH, all)
const totalLeaves = allLeaves
  .filter((l) => l.type !== "WFH")
  .reduce((sum, l) => {
    const days =
      Math.floor((new Date(l.endDate) - new Date(l.startDate)) / 86400000) + 1;
    return sum + days;
  }, 0);

// APPROVED Leave Days (unique merged)
const approvedLeaves = getUniqueLeaveDays(
  allLeaves.filter(
    (l) =>
      l.status === "APPROVED" &&
      l.type !== "WFH" &&
      l.type !== "UNPAID" &&
      new Date(l.startDate) >= yearStart &&
      new Date(l.endDate) <= yearEnd
  )
);

// APPROVED WFH Days (unique merged)
const wfhDays = getUniqueLeaveDays(
  allLeaves.filter(
    (l) =>
      l.status === "APPROVED" &&
      l.type === "WFH" &&
      new Date(l.startDate) >= yearStart &&
      new Date(l.endDate) <= yearEnd
  )
);

/* =====================================================
   ⭐ MERGED ATTENDANCE (LEAVES + WFH)
====================================================== */
const mergedAttendance = [...rawAttendance];

[...approvedLeaveItems, ...approvedWFHItems].forEach((l) => {
  let cur = new Date(l.startDate);
  const end = new Date(l.endDate);
  const type = l.type === "WFH" ? "WFH" : "LEAVE";

  while (cur <= end) {
    const iso = cur.toISOString().slice(0, 10);

    const exists = mergedAttendance.some((a) => {
      const d =
        typeof a.date === "string"
          ? a.date.slice(0, 10)
          : a.date.toISOString().slice(0, 10);
      return d === iso;
    });

    if (!exists) {
      mergedAttendance.push({
        date: iso,
        checkIn: false,
        status: type
      });
    }

    cur.setDate(cur.getDate() + 1);
  }
});

mergedAttendance.sort((a, b) => new Date(a.date) - new Date(b.date));

/* =====================================================
   ⭐ PRESENT DAYS
====================================================== */
const presentDays = mergedAttendance.filter((a) => a.checkIn).length;

/* =====================================================
   Payroll + Trend
====================================================== */
const myPayroll = await prisma.payroll.findMany({
  where: { userId: uid },
  orderBy: { salaryMonth: "desc" },
  take: 6
});

const now2 = new Date();
const last7e = new Date();
last7e.setDate(now2.getDate() - 7);

const myTrend = await prisma.attendance.findMany({
  where: { userId: uid, date: { gte: last7e, lte: now2 } },
  orderBy: { date: "asc" }
});

/* =====================================================
   RESPONSE
====================================================== */
return res.json({
  success: true,
  admin: false,
  stats: {
    presentDays,      // ✔ same as UI
    totalLeaves,      // ✔ same as UI
    approvedLeaves,   // ✔ same unique logic as UI
    wfhDays,          // ✔ same unique logic as UI

    payrollHistory: myPayroll,
    attendanceTrend: myTrend,
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