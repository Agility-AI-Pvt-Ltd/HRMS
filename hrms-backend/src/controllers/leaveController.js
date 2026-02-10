import prisma from "../prismaClient.js";
import { sendRequestNotificationMail } from "../utils/sendMail.js";
import { getAdminAndManagers } from "../utils/getApprovers.js";
import { creditMonthlyLeaveIfNeeded } from "../utils/leaveCredit.js";
import { emitToAdmins, emitToUsers, emitToUser } from "../socket/socketServer.js";
import { Parser } from "json2csv";
import ExcelJS from "exceljs";

const isHalfDay = (type) => type === "HALF_DAY";
const getDayName = (d) => new Date(d).toLocaleDateString("en-US",{weekday:"long"});
/* ================= HELPERS ================= */
const getLeaveTypeName = (type) => {
  const typeNames = {
    WFH: "WFH",
    HALF_DAY: "Half-day Leave",
    PAID: "Paid Leave",
    UNPAID: "Unpaid Leave",
    SICK: "Sick Leave",
    CASUAL: "Casual Leave",
  };
  return typeNames[type] || "Leave";
};

const toISO = (d) => {
  const x = new Date(d);
  return (
    x.getFullYear() +
    "-" +
    String(x.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(x.getDate()).padStart(2, "0")
  );
};

// 🔥 MAIL DATE FORMATTER (single date vs range)
const formatMailDateRange = (start, end) => {
  const s = toISO(start);
  const e = toISO(end);

  // same date / today
  if (s === e) {
    return `Date: ${s}`;
  }

  // date range
  return `From: ${s} → To: ${e}`;
};
const formatResponsiblePerson = (user) => {
  if (!user) return null;
  return `Responsibility Given To: ${user.firstName} ${user.lastName || ""}`.trim();
};

async function syncAttendanceWithLeave(leave) {
   const user = await prisma.user.findFirst({
    where: { id: leave.userId, isActive: true }
  });

  if (!user) return; // 🚫 silently skip

  const start = new Date(leave.startDate);
  const end = new Date(leave.endDate);

  const weekOff = await prisma.weeklyOff.findFirst({
    where: { userId: leave.userId }
  });

  const holidays = await prisma.holiday.findMany({
    where: {
      date: { gte: start, lte: end }
    }
  });

  let cur = new Date(start);
  cur.setHours(0, 0, 0, 0);

  while (cur <= end) {
    const iso = toISO(cur);
    const dayName = cur.toLocaleDateString("en-US", { weekday: "long" });

    const isHoliday = holidays.some(
      h => toISO(h.date) === iso
    );

    const isWeekOff =
      weekOff &&
      (
        (weekOff.isFixed && weekOff.offDay === dayName) ||
        (!weekOff.isFixed && weekOff.offDate && toISO(weekOff.offDate) === iso)
      );

    // ❌ Skip holiday & weekly off completely
    if (!isHoliday && !isWeekOff) {
      const existing = await prisma.attendance.findFirst({
        where: {
          userId: leave.userId,
          date: cur
        }
      });

      if (existing) {
        await prisma.attendance.update({
          where: { id: existing.id },
          data: {
            status: leave.type,
            lateHalfDayEligible: false
          }
        });
      } else {
        await prisma.attendance.create({
          data: {
            userId: leave.userId,
            date: cur,
            status: leave.type
          }
        });
      }
    }

    cur.setDate(cur.getDate() + 1);
  }
}

/* --------------------------------------------------------
   CREATE LEAVE — Employees only
-------------------------------------------------------- */
export const createLeave = async (req, res) => {
  // 🔄 CREDIT MONTHLY LEAVE (AUTO)
const currentUser = await prisma.user.findFirst({
  where: { id: req.user.id, isActive: true }
});

if (!currentUser) {
  return res.status(403).json({
    success: false,
    message: "Account deactivated. Contact admin.",
  });
}
await creditMonthlyLeaveIfNeeded(currentUser, prisma);

  try {
   const { type, startDate, endDate, reason, responsiblePerson } = req.body;

    if (!type || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: "Missing fields" });
    }
    // ⛔ COMP OFF but balance is zero
if (type === "COMP_OFF") {
  const days =
    startDate === endDate
      ? 1
      : Math.floor(
          (new Date(endDate) - new Date(startDate)) /
          (1000 * 60 * 60 * 24)
        ) + 1;

  const compUser = await prisma.user.findUnique({
    where: { id: req.user.id }
  });

  if (!compUser || compUser.compOffBalance < days) {
    return res.status(400).json({
      success: false,
      message: `Insufficient Comp-Off balance. Available: ${compUser?.compOffBalance ?? 0}`
    });
  }
}

    if (isHalfDay(type) && startDate !== endDate) {
      return res.status(400).json({ success: false, message: "Half Day must be for a single date" });
    }
    
    const requestStart = new Date(startDate);
    const requestEnd = new Date(endDate);
    // 🔥 RULE: 3+ DAYS LEAVE → REASON COMPULSORY
const diffDays =
  Math.floor((requestEnd - requestStart) / (1000 * 60 * 60 * 24)) + 1;

if (diffDays >= 3 && !reason?.trim()) {
  return res.status(400).json({
    success: false,
    message: "Reason is mandatory for leave of 3 days or more",
  });
}
// 🔥 RULE: WFH → reason compulsory (any duration)
if (type === "WFH" && !reason?.trim()) {
  return res.status(400).json({
    success: false,
    message: "Reason is mandatory for Work From Home",
  });
}

    // Prevent overlapping leave
    const overlappingLeaves = await prisma.leave.findMany({
      where: {
        userId: req.user.id,
        status: { in: ["PENDING", "APPROVED"] },
        isAdminDeleted: false, isEmployeeDeleted: false,
        AND: [{ startDate:{lte:requestEnd} },{ endDate:{gte:requestStart} }]
      }
    });

    if (overlappingLeaves.length > 0) {
      return res.status(400).json({
        success:false,
        message:type==="WFH"?"WFH clash":"Leave already exists for this duration"
      });
    }

const isChargeableLeave = !["WFH", "UNPAID", "COMP_OFF"].includes(type);
// 🔐 BALANCE CHECK
const daysRequested =
  !isChargeableLeave
    ? 0
    : type === "HALF_DAY"
    ? 0.5
    : Math.floor(
        (new Date(endDate) - new Date(startDate)) /
          (1000 * 60 * 60 * 24)
      ) + 1;

// ✅ Allow SICK leave even if monthly balance is not enough.
//    - Monthly `leaveBalance` is allowed to go negative
//    - Yearly cap (21) is enforced via yearly stats (remainingLeaves)
if (
  isChargeableLeave &&
  type !== "SICK" && // normal chargeable leaves still require balance
  currentUser.leaveBalance < daysRequested
) {
  return res.status(400).json({
    success: false,
    message: `Insufficient Leave Balance. Available: ${currentUser.leaveBalance}`,
  });
}
    /* Get all managers */
    const employee = await prisma.user.findUnique({
      where:{ id:req.user.id },
      include:{
        departments:{ include:{ department:{ include:{ managers:{ select: { id: true, email: true } }}}}}
      }
    });

    const managers = employee.departments.flatMap(d=>d.department.managers);
    // Remove duplicate managers
    const uniqueManagers = managers.filter((m, index, self) => 
      index === self.findIndex(manager => manager.id === m.id)
    );
    
    if(uniqueManagers.length === 0)
      return res.status(400).json({ success:false,message:"No manager assigned" });

    const admins = await prisma.user.findMany({
    where: { role: "ADMIN", isActive: true },
    select: { id: true, email: true }
    });

let responsiblePersonId = null;

if (responsiblePerson) {
  const userExists = await prisma.user.findUnique({
    where: { id: responsiblePerson }
  });

  if (!userExists) {
    return res.status(400).json({
      success: false,
      message: "Selected responsible person is invalid"
    });
  }
  responsiblePersonId = responsiblePerson;
}
    /* Create leave */
    const leave = await prisma.leave.create({
      data:{
        userId:req.user.id,
        type,
        startDate:requestStart,
        endDate:requestEnd,
        reason: reason||"",
        status:"PENDING",
        responsiblePersonId
      },
      include:{ user:true , responsiblePerson: true   }  // <-- IMPORTANT FIX (mail needs name)
    });

const updatedUser = await prisma.user.findUnique({
  where: { id: req.user.id },
  select: {
    leaveBalance: true,
    lastLeaveCredit: true,
    compOffBalance: true,
  }
});

    /* Create approvals */
    await prisma.leaveApproval.createMany({
      data: uniqueManagers.map(m=>({ leaveId:leave.id, managerId:m.id, status:"PENDING" })),
      skipDuplicates:true              // <-- Avoid P2002 crash
    });

const mailRecipients = [...new Set([
  ...uniqueManagers.map(m => m.email),
  ...admins.map(a => a.email)
])];

    /* Send mail */
    try{
      await sendRequestNotificationMail({
        to: mailRecipients,
        subject:"New Leave Request Submitted",
        title:"Leave / WFH / Half-Day Request",
        employeeName:`${leave.user.firstName} ${leave.user.lastName||""}`,
details:[
  `Type: ${getLeaveTypeName(type)}`,
  formatMailDateRange(requestStart, requestEnd),
  formatResponsiblePerson(leave.responsiblePerson),
  reason && `Reason: ${reason}`
].filter(Boolean)
      });
    }catch(e){ console.log("Mail fail:",e.message); }

    // 🔔 Create database notifications and emit Socket.io notifications to admins and managers
    try {
      const adminIds = admins.map(a => a.id);
      const managerIds = uniqueManagers.map(m => m.id);
      const allRecipientIds = [...new Set([...adminIds, ...managerIds])];

      const notificationTitle = "New Leave Request";
      const notificationBody = `${leave.user.firstName} ${leave.user.lastName || ""} has submitted a ${getLeaveTypeName(type)} request`;

      // Create database notifications for all recipients
      await prisma.notification.createMany({
        data: allRecipientIds.map(userId => ({
          userId,
          title: notificationTitle,
          body: notificationBody,
          meta: {
            type: "leave_request",
            leaveId: leave.id,
            employeeId: leave.userId,
          }
        }))
      });

      const notificationData = {
        type: "leave_request",
        leaveId: leave.id,
        employeeId: leave.userId,
        employeeName: `${leave.user.firstName} ${leave.user.lastName || ""}`,
        leaveType: getLeaveTypeName(type),
        startDate: requestStart,
        endDate: requestEnd,
        reason: reason || "",
        message: notificationBody,
        title: notificationTitle,
        body: notificationBody,
      };

      // Emit to all admins
      emitToAdmins("new_leave_request", notificationData);

      // Emit to managers (only if there are managers)
      if (managerIds.length > 0) {
        emitToUsers(managerIds, "new_leave_request", notificationData);
      }
    } catch (socketError) {
      console.error("Socket notification error:", socketError);
      // Don't fail the request if socket fails
    }

    return res.json({
      success:true,
      message:`Your ${getLeaveTypeName(type)} request submitted successfully`,
      leaveId:leave.id,
      updatedUser 
    });

  } catch (error) {
    console.error("createLeave ERROR:",error);
    return res.status(500).json({success:false,message:"Internal server error"});
  }
};

/* --------------------------------------------------------
   LIST LEAVES — Admin sees all, Employee sees own
-------------------------------------------------------- */
export const listLeaves = async (req, res) => {
  try {
    const where =
  req.user.role === "ADMIN"
    ? { isAdminDeleted: false,
      user: { isActive: true } 
     }
    : { userId: req.user.id, 
      isEmployeeDeleted: false,
      user: { isActive: true }  };

    const leaves = await prisma.leave.findMany({
      where,
    include: {
  user: true,
  approver: true,
  responsiblePerson: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true
    }
  }
},
      orderBy: { createdAt: "desc" },
    });

    // Sort: PENDING first, then rest by date (newest first)
const statusOrder = { PENDING: 0, APPROVED: 1, REJECTED: 2 };
leaves.sort((a, b) => {
  const diff = (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3);
  if (diff !== 0) return diff;
  return new Date(b.createdAt) - new Date(a.createdAt);
});

    return res.json({ success: true, leaves });
  } catch (error) {
    console.error("listLeaves ERROR:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/* --------------------------------------------------------
   VIEW SINGLE LEAVE
-------------------------------------------------------- */
export const getLeaveById = async (req, res) => {
  try {
    const id = req.params.id;

    const leave = await prisma.leave.findUnique({
      where: { id },
      include: { user: true, approver: true,responsiblePerson: true },
    });
    
    if (!leave)
      return res.status(404).json({ success: false, message: "Leave not found" });
    
if (
  (req.user.role === "ADMIN" && leave.isAdminDeleted) ||
  (req.user.role !== "ADMIN" && leave.isEmployeeDeleted)
) {
  return res.status(404).json({
    success:false,
    message:"Leave not found"
  });
}

if (!leave.user?.isActive) {
  return res.status(404).json({
    success: false,
    message: "Leave not found",
  });
}

    if (req.user.role !== "ADMIN" && leave.userId !== req.user.id) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    return res.json({
      success: true,
      leave
    });

  } catch (error) {
    console.error("getLeaveById ERROR:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};


/* --------------------------------------------------------
   UPDATE LEAVE (Employee can edit only PENDING)
-------------------------------------------------------- */
export const updateLeave = async (req, res) => {
  try {
    const id = req.params.id;
    const leave = await prisma.leave.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!leave || !leave.user?.isActive)
      return res.status(404).json({ success: false, message: "Leave not found" });

    if (req.user.role !== "ADMIN") {
      if (leave.userId !== req.user.id)
        return res.status(403).json({ success: false, message: "Access denied" });

      if (leave.status !== "PENDING")
        return res.status(400).json({
          success: false,
          message: "Cannot modify approved/rejected leave"
        });
    }

    const {
      type,
      startDate,
      endDate,
      reason,
      responsiblePerson
    } = req.body;

    // 🔥 SAFE DATA MAPPING (NO DIRECT req.body)
    const data = {};

    if (type) data.type = type;
    
    if (startDate) data.startDate = new Date(startDate);
    if (endDate) data.endDate = new Date(endDate);
    
    if (reason !== undefined) data.reason = reason;
    
    if (responsiblePerson !== undefined) {
      data.responsiblePersonId = responsiblePerson || null;
    }

    // HALF DAY VALIDATION
    if ((type || leave.type) === "HALF_DAY" && startDate && endDate && startDate !== endDate) {
      return res.status(400).json({
        success: false,
        message: "Half Day must be for a single date"
      });
    }

    const updated = await prisma.leave.update({
      where: { id },
      data,
      include: {
        user: true,
        approver: true,
        responsiblePerson: true
      }
    });

    return res.json({
      success: true,
      message: "Leave updated successfully",
      leave: updated
    });

  } catch (error) {
    console.error("🔥 UPDATE LEAVE ERROR:", error); // 👈 THIS WILL SHOW REAL ERROR
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};


/* --------------------------------------------------------
   APPROVE / REJECT LEAVE (ADMIN ONLY)
-------------------------------------------------------- */
export const approveLeave = async (req, res) => {
  try {
    const leaveId = req.params.id;
    let { action, reason } = req.body;
    const managerId = req.user.id;

    if (!["APPROVED", "REJECTED"].includes(action)) {
      return res.status(400).json({ success: false, message: "Invalid action" });
    }

    const leave = await prisma.leave.findUnique({
      where: { id: leaveId },
      include: {
        user: {
          include: {
            departments: {
              include: {
                department: { include: { managers: true } }
              }
            }
          }
        }
      }
    });

    if (!leave) return res.status(404).json({ success: false, message: "Leave not found" });
    
      if (!leave.user.isActive) {
  return res.status(400).json({
    success: false,
    message: "Cannot process leave for deactivated employee",
  });
}

    // ❌ Self approval block
    if (leave.userId === managerId)
      return res.status(403).json({ success:false, message:"You cannot approve your own leave" });

    // 🔐 Permission check
    let allowed = false;
    if (req.user.role === "ADMIN") allowed = true;
    else {
      const managerIds = leave.user.departments.flatMap(d=>d.department.managers).map(m=>m.id);
      if (managerIds.includes(managerId)) allowed = true;
    }

    if (!allowed) return res.status(403).json({ success:false, message:"Not allowed" });

    // =====================================================
    // 🔥 Manager decision update in leaveApproval table
    // =====================================================
    if (req.user.role === "ADMIN") {
  // Admin direct approval entry create/update
  await prisma.leaveApproval.upsert({
    where:{ leaveId_managerId:{ leaveId, managerId } },
    update:{ status:action, reason, actedAt:new Date() },
    create:{ leaveId, managerId, status:action, reason }
  });
} 
else {
    const approval = await prisma.leaveApproval.updateMany({
      where:{ leaveId, managerId },
      data:{ status:action, reason, actedAt:new Date() }
    });

    if (approval.count===0)
      return res.status(403).json({ success:false, message:"You are not approver for this leave" });
  }

    // =====================================================
    // 🔥 Now evaluate group decision
    // =====================================================
    const approvals = await prisma.leaveApproval.findMany({ where:{ leaveId } });

    const allApproved = approvals.every(a=>a.status==="APPROVED") || req.user.role==="ADMIN";
    const anyRejected = approvals.some(a=>a.status==="REJECTED");

    let finalStatus = "PENDING";


    if (anyRejected) {
      finalStatus = "REJECTED";
      // ⭐ Admin approved → final APPROVED directly

    } else if (req.user.role === "ADMIN" && action === "APPROVED") {
      finalStatus = "APPROVED";
      
     } else if (allApproved) {
      // ⭐ Overlap check only at final approval
      const overlapping = await prisma.leave.findMany({
        where:{
          userId: leave.userId,
          status:"APPROVED",
          id:{not:leaveId},
          isAdminDeleted: false,
isEmployeeDeleted: false,
          AND:[
            {startDate:{lte:leave.endDate}},
            {endDate:{gte:leave.startDate}}
          ]
        }
      });

     if (overlapping.length>0){
  finalStatus="REJECTED";
  reason = reason || "Overlapping leave already approved";
} else finalStatus="APPROVED";
    }
    // =====================================================
    // Update final leave status in main table
    // =====================================================
    const updated = await prisma.leave.update({
   where:{ id: leaveId },
  data:{ 
    status: finalStatus,
    rejectReason: finalStatus==="REJECTED" ? reason||"" : null
  },
 include:{
  user: true,
  responsiblePerson: true   // ✅ REQUIRED
}
}); 
// =====================================================
// ✅ DEDUCT LEAVE BALANCE (ONLY ON FINAL APPROVAL)
// =====================================================
if (finalStatus === "APPROVED" && updated.type !== "COMP_OFF") {
  await syncAttendanceWithLeave(updated);
}

if (finalStatus === "APPROVED") {

await prisma.$transaction(async (tx) => {

  const leaveDays =
    updated.type === "HALF_DAY"
      ? 0.5
      : Math.floor(
          (updated.endDate - updated.startDate) /
          (1000 * 60 * 60 * 24)
        ) + 1;

  // NORMAL LEAVE
  if (!["WFH", "UNPAID", "COMP_OFF"].includes(updated.type)) {
    await tx.user.update({
      where: { id: updated.userId },
      data: { leaveBalance: { decrement: leaveDays } }
    });
  }

  // COMP OFF
  if (updated.type === "COMP_OFF") {
    await tx.user.update({
      where: { id: updated.userId },
      data: { compOffBalance: { decrement: leaveDays } }
    });
  }
});

}
  
    // =====================================================
    // 📩 Email Notification
    // =====================================================
    try {
      await sendRequestNotificationMail({
        to:[updated.user.email],
        subject:`Leave Request ${finalStatus}`,
        title:"Leave Status Update",
        employeeName:`${updated.user.firstName} ${updated.user.lastName}`,
details:[
  `Type: ${getLeaveTypeName(updated.type)}`,
  formatMailDateRange(updated.startDate, updated.endDate),
  formatResponsiblePerson(updated.responsiblePerson), // ✅ ADDED
  `Status: ${finalStatus}`,
  finalStatus==="REJECTED" && `Reason: ${reason||"Not specified"}`
].filter(Boolean)
      });
    } catch(e){ console.log("Mail fail:",e.message); }

    // 🔔 Create database notification and emit Socket.io notification to employee
    try {
      const notificationTitle = `Leave Request ${finalStatus}`;
      const notificationBody = `Your ${getLeaveTypeName(updated.type)} request from ${formatMailDateRange(updated.startDate, updated.endDate)} has been ${finalStatus.toLowerCase()}${finalStatus === "REJECTED" ? `. Reason: ${reason || "Not specified"}` : ""}`;

      // Create database notification
      await prisma.notification.create({
        data: {
          userId: updated.userId,
          title: notificationTitle,
          body: notificationBody,
          meta: {
            type: "leave_status_update",
            leaveId: updated.id,
            status: finalStatus,
          }
        }
      });

      const notificationData = {
        type: "leave_status_update",
        leaveId: updated.id,
        status: finalStatus,
        leaveType: getLeaveTypeName(updated.type),
        startDate: updated.startDate,
        endDate: updated.endDate,
        reason: finalStatus === "REJECTED" ? (reason || "Not specified") : null,
        message: `Your leave request has been ${finalStatus.toLowerCase()}`,
        title: notificationTitle,
        body: notificationBody,
      };

      emitToUser(updated.userId, "leave_status_update", notificationData);
    } catch (socketError) {
      console.error("Socket notification error:", socketError);
      // Don't fail the request if socket fails
    }

    return res.json({
      success:true,
      message:`Leave ${finalStatus}`,
      leave:updated
    });

  } catch (error) {
    console.error("approveLeave ERROR:", error);
    return res.status(500).json({ success:false, message:"Internal server error" });
  }
};

/* --------------------------------------------------------
   DELETE LEAVE
-------------------------------------------------------- */
export const deleteLeave = async (req, res) => {
  try {
    const id = req.params.id;

    const leave = await prisma.leave.findUnique({ where: { id }, include: { user: true } });

    if (!leave.user.isActive && req.user.role !== "ADMIN") {
  return res.status(403).json({
    success: false,
    message: "Account deactivated",
  });
}

    if (!leave)
      return res.status(404).json({ success:false, message:"Leave not found" });

    // 👤 EMPLOYEE DELETE
    if (req.user.role !== "ADMIN") {
      if (leave.userId !== req.user.id)
        return res.status(403).json({ success:false, message:"Access denied" });

      if (leave.status !== "PENDING")
        return res.status(400).json({
          success:false,
          message:"Only pending leaves can be deleted"
        });

      await prisma.leave.update({
        where: { id },
        data: { isEmployeeDeleted: true }
      });

      return res.json({
        success:true,
        message:"Leave removed from your list"
      });
    }

    // 👑 ADMIN DELETE
    await prisma.leave.update({
      where: { id },
      data: { isAdminDeleted: true }
    });

    return res.json({
      success:true,
      message:"Leave removed from admin list"
    });

  } catch (error) {
    console.error("deleteLeave ERROR:", error);
    return res.status(500).json({
      success:false,
      message:"Internal server error"
    });
  }
};
/* --------------------------------------------------------
   EXPORT LEAVES (CSV / EXCEL)
-------------------------------------------------------- */
export const exportLeaves = async (req, res) => {
  try {
    const user = req.user;
    let { start, end, userId, format } = req.query;
    if (!format) format = "csv";

    const where = { 
      isAdminDeleted: false, 
      user: { isActive: true } 
    };

    // Role based filter
    if (user.role !== "ADMIN") where.userId = user.id;
    else if (userId) where.userId = userId;

    // Date filter
    if (start && end) {
      where.createdAt = { gte: new Date(start), lte: new Date(end) };
    }

    const rows = await prisma.leave.findMany({
      where,
      include: { 
        user: true, 
        responsiblePerson: true 
      },
      orderBy: { createdAt: "desc" },
    });

    const getLeaveTypeName = (type) => {
      const typeNames = {
        WFH: "WFH",
        HALF_DAY: "Half Day",
        PAID: "Paid Leave",
        UNPAID: "Unpaid Leave",
        SICK: "Sick Leave",
        CASUAL: "Casual Leave",
        COMP_OFF: "Comp Off",
      };
      return typeNames[type] || type;
    };

    /* ================= CSV EXPORT ================= */
    if (format === "csv") {
      const parser = new Parser({
        fields: ["employee", "type", "startDate", "endDate", "days", "status", "reason", "responsiblePerson", "createdAt"]
      });

      const csv = parser.parse(
        rows.map((r) => {
          const days = r.type === "HALF_DAY" 
            ? 0.5 
            : Math.floor((new Date(r.endDate) - new Date(r.startDate)) / (1000 * 60 * 60 * 24)) + 1;

          return {
            employee: `${r.user.firstName} ${r.user.lastName || ""}`.trim(),
            type: getLeaveTypeName(r.type),
            startDate: r.startDate?.toISOString().split("T")[0],
            endDate: r.endDate?.toISOString().split("T")[0],
            days,
            status: r.status,
            reason: r.reason || "",
            responsiblePerson: r.responsiblePerson 
              ? `${r.responsiblePerson.firstName} ${r.responsiblePerson.lastName || ""}`.trim() 
              : "",
            createdAt: r.createdAt.toISOString().split("T")[0]
          };
        })
      );

      res.header("Content-Type", "text/csv");
      res.attachment("leaves.csv");
      return res.send(csv);
    }

    /* ================= EXCEL EXPORT ================= */
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Leaves");

    sheet.columns = [
      { header: "Employee", key: "employee", width: 25 },
      { header: "Leave Type", key: "type", width: 15 },
      { header: "Start Date", key: "startDate", width: 15 },
      { header: "End Date", key: "endDate", width: 15 },
      { header: "Days", key: "days", width: 10 },
      { header: "Status", key: "status", width: 12 },
      { header: "Reason", key: "reason", width: 30 },
      { header: "Responsible Person", key: "responsiblePerson", width: 25 },
      { header: "Created At", key: "createdAt", width: 15 },
    ];

    rows.forEach((r) => {
      const days = r.type === "HALF_DAY" 
        ? 0.5 
        : Math.floor((new Date(r.endDate) - new Date(r.startDate)) / (1000 * 60 * 60 * 24)) + 1;

      sheet.addRow({
        employee: `${r.user.firstName} ${r.user.lastName || ""}`.trim(),
        type: getLeaveTypeName(r.type),
        startDate: r.startDate?.toISOString().split("T")[0],
        endDate: r.endDate?.toISOString().split("T")[0],
        days,
        status: r.status,
        reason: r.reason || "",
        responsiblePerson: r.responsiblePerson 
          ? `${r.responsiblePerson.firstName} ${r.responsiblePerson.lastName || ""}`.trim() 
          : "",
        createdAt: r.createdAt.toISOString().split("T")[0],
      });
    });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=leaves.xlsx");

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error("[exportLeaves ERROR]", err);
    return res.status(500).json({ success: false, message: "Export failed" });
  }
};