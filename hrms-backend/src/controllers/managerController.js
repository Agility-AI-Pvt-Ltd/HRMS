import prisma from "../prismaClient.js";

/* =====================================================
   🔹 COMMON HELPERS (UPDATED FOR MULTI-DEPARTMENT)
===================================================== */

// ✅ Get department IDs managed by manager
const getManagedDeptIds = async (userId) => {
  const depts = await prisma.department.findMany({
    where: {
      managers: {
        some: { id: userId },
      },
    },
    select: { id: true },
  });

  return depts.map((d) => d.id);
};
/* ================= TODAY RANGE HELPER ================= */
const todayRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date();
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

const toLocalISO = (date) => {
  const d = new Date(date);
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
};

/* =====================================================
   📌 LEAVES — MANAGER
===================================================== */

export const managerLeaves = async (req, res) => {
  try {
    const deptIds = await getManagedDeptIds(req.user.id);

    const leaves = await prisma.leave.findMany({
      where: {
        user: {
          departments: {
            some: {
              departmentId: { in: deptIds },
            },
          },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, leaves });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

/* =====================================================
   💰 REIMBURSEMENTS — MANAGER
===================================================== */

export const managerReimbursements = async (req, res) => {
  try {
    const deptIds = await getManagedDeptIds(req.user.id);

    const list = await prisma.reimbursement.findMany({
      where: {
        isAdminDeleted: false,
        user: {
          departments: {
            some: {
              departmentId: { in: deptIds },
            },
          },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            position: true,
          },
        },
        bills: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, list });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

/* =====================================================
   👥 EMPLOYEES — MANAGER
===================================================== */

export const managerEmployees = async (req, res) => {
  try {
    const deptIds = await getManagedDeptIds(req.user.id);

    const employees = await prisma.user.findMany({
      where: {
        departments: {
          some: {
            departmentId: { in: deptIds },
          },
        },
        isActive: true,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
        email: true,
        position: true,
      },
      orderBy: { firstName: "asc" },
    });

    res.json({ success: true, employees });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

/* =====================================================
   🕒 ATTENDANCE — MANAGER (P / L / WFH)
===================================================== */
/* =======================================================
   🧑‍💼 MANAGER — TODAY ATTENDANCE SNAPSHOT
======================================================= */
export const managerTodayAttendance = async (req, res) => {
  try {
    const managerId = req.user.id;

    const depts = await prisma.department.findMany({
      where: { managers: { some: { id: managerId } } },
      select: { id: true },
    });

    const deptIds = depts.map((d) => d.id);

    const employees = await prisma.user.findMany({
      where: {
        departments: { some: { departmentId: { in: deptIds } } },
        isActive: true,
      },
      select: { id: true, firstName: true, lastName: true },
    });

    const employeeIds = employees.map((e) => e.id);

    const { start, end } = todayRange();

    const todayAttendance = await prisma.attendance.findMany({
      where: {
        userId: { in: employeeIds },
        date: { gte: start, lte: end },
      },
    });

    const leaves = await prisma.leave.findMany({
      where: {
        userId: { in: employeeIds },
        status: "APPROVED",
        startDate: { lte: end },
        endDate: { gte: start },
      },
    });

    const attendanceMap = {};
    todayAttendance.forEach((a) => {
      attendanceMap[a.userId] = a;
    });

    const leaveMap = {};
    leaves.forEach((l) => {
      leaveMap[l.userId] = l.type;
    });

    const rows = employees.map((emp) => {
      let status = "ABSENT";
      let checkIn = null;
      let checkOut = null;

      if (leaveMap[emp.id]) {
        status =
          leaveMap[emp.id] === "WFH"
            ? "WFH"
            : leaveMap[emp.id] === "HALF_DAY"
            ? "HALF_DAY"
            : "LEAVE";
      } else if (attendanceMap[emp.id]) {
        status = attendanceMap[emp.id].status || "PRESENT";
        checkIn = attendanceMap[emp.id].checkIn;
        checkOut = attendanceMap[emp.id].checkOut;
      }

      return {
        userId: emp.id,
        name: `${emp.firstName} ${emp.lastName || ""}`,
        status,
        checkIn,
        checkOut,
      };
    });

    const summary = {
      present: rows.filter((r) => r.status === "PRESENT").length,
      late: rows.filter((r) => r.status === "LATE").length,
      leave: rows.filter((r) => r.status === "LEAVE").length,
      wfh: rows.filter((r) => r.status === "WFH").length,
      halfDay: rows.filter((r) => r.status === "HALF_DAY").length,
      absent: rows.filter((r) => r.status === "ABSENT").length,
    };

    return res.json({
      success: true,
      date: toLocalISO(new Date()),
      rows,
      summary,
    });
  } catch (err) {
    console.error("managerTodayAttendance ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const managerAttendance = async (req, res) => {
  try {
    const deptIds = await getManagedDeptIds(req.user.id);
    const records = await prisma.attendance.findMany({
      where: {
        user: {
          departments: {
            some: {
              departmentId: { in: deptIds },
            },
          },
        },
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { date: "desc" },
    });

    res.json({ success: true, records });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

/* =====================================================
   🔔 NOTIFICATION — MANAGER → EMPLOYEES
===================================================== */
// GET /manager/notifications
export const managerNotifications = async (req, res) => {
  try {
    const managerId = req.user.id;

    // 1️⃣ Manager ke departments
    const depts = await prisma.department.findMany({
      where: {
        managers: {
          some: { id: managerId },
        },
      },
      select: { id: true },
    });

    const deptIds = depts.map((d) => d.id);

    // 2️⃣ Employees of those departments
    const employees = await prisma.user.findMany({
      where: {
        departments: {
          some: { departmentId: { in: deptIds } },
        },
      },
      select: { id: true },
    });

    const employeeIds = employees.map((e) => e.id);

    // 3️⃣ Notifications sent to those employees
    const notifications = await prisma.notification.findMany({
      where: {
        userId: { in: employeeIds },
      },
      include: {
        user: {
          select: { firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, notifications });
  } catch (err) {
    console.error("managerNotifications ERROR:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const managerSendNotification = async (req, res) => {
  try {
    const { employeeIds, title, body } = req.body;

    if (!employeeIds?.length || !title || !body) {
      return res.status(400).json({
        success: false,
        message: "employeeIds, title and body are required",
      });
    }

    await prisma.notification.createMany({
      data: employeeIds.map((id) => ({
        userId: id,
        title,
        body,
      })),
    });

    res.json({ success: true, message: "Notification sent" });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};
