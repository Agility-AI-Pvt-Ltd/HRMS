import prisma from "../prismaClient.js";
import { emitToUsers } from "../socket/socketServer.js";

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
          isActive: true, 
          departments: {
            some: {
              departmentId: { in: deptIds },
            },
          },
        },
      },
      include: {
        user: { select: { id:true, firstName:true,lastName:true } },
        approvals: {
          include: {
            manager: { select: { firstName:true,lastName:true,email:true } }
          }
        }
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
          isActive: true, 
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
        approvals: {
          include: { manager:{select:{firstName:true,lastName:true,email:true}} }
        }
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
      include: {
        weeklyOffs: true,    // 🔥 FIXED: plural
      },
    });
    
    const employeeIds = employees.map((e) => e.id);
    
    const { start, end } = todayRange();
    const todayISO = toLocalISO(new Date());
    const todayDayName = new Date().toLocaleDateString("en-US", { weekday: "long" });
    
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
    
    // 🔥 FIXED: Handle array of weeklyOffs
    const isWeekOff = (weeklyOffs) => {
      if (!weeklyOffs || weeklyOffs.length === 0) return false;
      
      return weeklyOffs.some((wo) => {
        if (wo.isFixed && wo.offDay === todayDayName) return true;
        if (!wo.isFixed && wo.offDate === todayISO) return true;
        return false;
      });
    };
    
    let weekOffPresentCount = 0;
    let weekOffCount = 0;
    
    const rows = employees.map((emp) => {
      let status = "ABSENT";
      let checkIn = null;
      let checkOut = null;
      const empWeekOff = isWeekOff(emp.weeklyOffs);  // 🔥 FIXED: plural
      
      if (empWeekOff) {
        weekOffCount++;
      }

      if (leaveMap[emp.id]) {
        const leaveType = leaveMap[emp.id];
        if (leaveType === "WFH") {
          status = "WFH";
        } else if (leaveType === "HALF_DAY") {
          status = "HALF_DAY";
        } else if (leaveType === "COMP_OFF") {
          status = "COMP_OFF";
        } else {
          status = "LEAVE";
        }
      } else if (attendanceMap[emp.id]) {
        status = attendanceMap[emp.id].status || "PRESENT";
        checkIn = attendanceMap[emp.id].checkIn;
        checkOut = attendanceMap[emp.id].checkOut;

        // 🔥 WeekOff but still present
        if (empWeekOff && (status === "PRESENT" || status === "LATE")) {
          weekOffPresentCount++;
        }
      } else if (empWeekOff) {
        status = "WEEK_OFF";
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
      totalEmployees: employees.length,
      present: rows.filter((r) => r.status === "PRESENT").length,
      halfDay: rows.filter((r) => r.status === "HALF_DAY").length,
      wfh: rows.filter((r) => r.status === "WFH").length,
      weekOffPresent: weekOffPresentCount,
      leave: rows.filter((r) => r.status === "LEAVE").length,
      compOff: rows.filter((r) => r.status === "COMP_OFF").length,
      weekOff: rows.filter((r) => r.status === "WEEK_OFF").length,
      absent: rows.filter((r) => r.status === "ABSENT").length,
      late: rows.filter((r) => r.status === "LATE").length,
    };

    return res.json({
      success: true,
      date: todayISO,
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
          isActive: true,
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
        isActive: true,
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

    // 🔔 Socket: notify all targeted employees in real-time
    emitToUsers(employeeIds, "notification_created", {
      scope: "MANAGER_EMPLOYEES",
      title,
      body,
    });

    res.json({ success: true, message: "Notification sent" });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};/* =====================================================
   🗑️ DELETE REIMBURSEMENT — MANAGER (FIXED FOREIGN KEY)
===================================================== */
export const deleteReimbursementByManager = async (req, res) => {
  try {
    const { id } = req.params;
    const managerId = req.user.id;

    console.log("🗑️ DELETE REIMBURSEMENT:", { reimbId: id, managerId });

    const reimbursement = await prisma.reimbursement.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!reimbursement) {
      console.log("❌ Reimbursement not found:", id);
      return res.status(404).json({ success: false, message: "Reimbursement not found" });
    }

    console.log("✅ Reimbursement found:", { reimbId: id, status: reimbursement.status });

    if (reimbursement.status !== "PENDING") {
      console.log("❌ Reimbursement not PENDING:", reimbursement.status);
      return res.status(400).json({ 
        success: false, 
        message: `Cannot delete ${reimbursement.status} reimbursement. Only PENDING can be deleted.` 
      });
    }

    const deptIds = await getManagedDeptIds(managerId);
    const canAccess = await prisma.userDepartment.findFirst({
      where: {
        userId: reimbursement.userId,
        departmentId: { in: deptIds }
      }
    });

    if (!canAccess) {
      console.log("❌ Manager cannot access this employee");
      return res.status(403).json({ 
        success: false, 
        message: "Employee not in your department" 
      });
    }

    console.log("✅ Deleting reimbursement and related data:", id);
    
    // 🔥 DELETE ORDER MATTERS:
    // 1. Delete Bills (child of Reimbursement)
    await prisma.bill.deleteMany({
      where: { reimbursementId: id }
    });
    console.log("✅ Bills deleted");
    
    // 2. Delete Approvals (child of Reimbursement)
    await prisma.reimbursementApproval.deleteMany({
      where: { reimbursementId: id }
    });
    console.log("✅ Approvals deleted");
    
    // 3. Finally delete the Reimbursement
    await prisma.reimbursement.delete({ where: { id } });
    console.log("✅ Reimbursement deleted");

    return res.json({ success: true, message: "Reimbursement deleted successfully" });
  } catch (err) {
    console.error("❌ deleteReimbursementByManager ERROR:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* =====================================================
   🗑️ DELETE LEAVE — MANAGER (FIXED)
===================================================== */
export const deleteLeaveByManager = async (req, res) => {
  try {
    const { id } = req.params;
    const managerId = req.user.id;

    console.log("🗑️ DELETE LEAVE:", { leaveId: id, managerId });

    const leave = await prisma.leave.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!leave) {
      console.log("❌ Leave not found:", id);
      return res.status(404).json({ success: false, message: "Leave not found" });
    }

    console.log("✅ Leave found:", { leaveId: id, status: leave.status });

    if (leave.status !== "PENDING") {
      console.log("❌ Leave not PENDING:", leave.status);
      return res.status(400).json({ 
        success: false, 
        message: `Cannot delete ${leave.status} leave. Only PENDING can be deleted.` 
      });
    }

    const deptIds = await getManagedDeptIds(managerId);
    const canAccess = await prisma.userDepartment.findFirst({
      where: {
        userId: leave.userId,
        departmentId: { in: deptIds }
      }
    });

    if (!canAccess) {
      console.log("❌ Manager cannot access this leave");
      return res.status(403).json({ 
        success: false, 
        message: "Employee not in your department" 
      });
    }

    console.log("✅ Deleting leave and approvals:", id);
    
    // 🔥 Delete Approvals first (child of Leave)
    await prisma.leaveApproval.deleteMany({
      where: { leaveId: id }
    });
    console.log("✅ Leave approvals deleted");
    
    // Then delete the Leave
    await prisma.leave.delete({ where: { id } });
    console.log("✅ Leave deleted");

    return res.json({ success: true, message: "Leave deleted successfully" });
  } catch (err) {
    console.error("❌ deleteLeaveByManager ERROR:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};