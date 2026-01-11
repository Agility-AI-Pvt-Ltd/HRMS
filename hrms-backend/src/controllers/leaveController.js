import prisma from "../prismaClient.js";
import { sendRequestNotificationMail } from "../utils/sendMail.js";
import { getAdminAndManagers } from "../utils/getApprovers.js";
import { creditMonthlyLeaveIfNeeded } from "../utils/leaveCredit.js";


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
const currentUser  = await prisma.user.findUnique({
  where: { id: req.user.id }
});

await creditMonthlyLeaveIfNeeded(currentUser, prisma);

  try {
   const { type, startDate, endDate, reason, responsiblePerson } = req.body;

    if (!type || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: "Missing fields" });
    }
    // ⛔ COMP OFF but balance is zero
    if (type === "COMP_OFF") {
     const compUser  = await prisma.user.findUnique({ where: { id: req.user.id } });
     if (!compUser || compUser.compOffBalance <= 0) {
       return res.status(400).json({
         success: false,
         message: "Insufficient Comp-Off balance"
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
  !isChargeableLeave ? 0  : type === "HALF_DAY"  ? 0.5 : Math.floor((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1;

if (currentUser.leaveBalance < daysRequested) {
  return res.status(400).json({
    success: false,
    message: `Insufficient Leave Balance. Available: ${currentUser.leaveBalance}`
  });
}
    /* Get all managers */
    const employee = await prisma.user.findUnique({
      where:{ id:req.user.id },
      include:{
        departments:{ include:{ department:{ include:{ managers:true }}}}
      }
    });

    const managers = employee.departments.flatMap(d=>d.department.managers);
    if(managers.length===0)
      return res.status(400).json({ success:false,message:"No manager assigned" });
    // 🔐 Responsible Person Validation

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
      data: managers.map(m=>({ leaveId:leave.id, managerId:m.id, status:"PENDING" })),
      skipDuplicates:true              // <-- Avoid P2002 crash
    });

    /* Send mail */
    try{
      await sendRequestNotificationMail({
        to: managers.map(m=>m.email),
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
    ? { isAdminDeleted: false }
    : { userId: req.user.id, isEmployeeDeleted: false };

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
    const input = req.body;

    const leave = await prisma.leave.findUnique({ where: { id } });

    if (!leave)
      return res.status(404).json({ success: false, message: "Leave not found" });

    if (req.user.role !== "ADMIN") {
      if (leave.userId !== req.user.id)
        return res.status(403).json({ success: false, message: "Access denied" });

      if (leave.status !== "PENDING")
        return res.status(400).json({
          success: false,
          message: "Cannot modify approved/rejected leave"
        });

delete input.status;
delete input.approverId;
delete input.userId;
delete input.rejectReason;

// 🔥 ALLOW ONLY THIS EXTRA FIELD
if ("responsiblePerson" in input) {
  input.responsiblePersonId = input.responsiblePerson || null;
  delete input.responsiblePerson;
}
 }
   // 🔥 HALF DAY VALIDATION (UPDATE)
    if (
      isHalfDay(input.type || leave.type) &&
      input.startDate &&
      input.endDate &&
      input.startDate !== input.endDate
    ) {
      return res.status(400).json({
        success: false,
        message: "Half Day must be for a single date"
      });
    }

    // ⭐ CHECK FOR OVERLAPPING APPROVED LEAVES (when updating dates)
    if (input.startDate || input.endDate) {
      const requestStart = new Date(input.startDate || leave.startDate);
      const requestEnd = new Date(input.endDate || leave.endDate);

      if (input.startDate || input.endDate) {
  const s = new Date(input.startDate || leave.startDate);
  const e = new Date(input.endDate || leave.endDate);
  const diff =
    Math.floor((e - s) / (1000 * 60 * 60 * 24)) + 1;

  if (diff >= 3 && !input.reason?.trim() && !leave.reason?.trim()) {
    return res.status(400).json({
      success: false,
      message: "Reason is mandatory for leave of 3 days or more",
    });
  }
  // 🔥 RULE: WFH → reason compulsory (update also)
if (
  (input.type || leave.type) === "WFH" &&
  !input.reason?.trim() &&
  !leave.reason?.trim()
) {
  return res.status(400).json({
    success: false,
    message: "Reason is mandatory for Work From Home",
  });
}

}
if ("responsiblePerson" in input) {
  if (input.responsiblePerson) {
    const userExists = await prisma.user.findUnique({
      where: { id: input.responsiblePerson }
    });

    if (!userExists) {
      return res.status(400).json({
        success: false,
        message: "Selected responsible person is invalid"
      });
    }

    input.responsiblePersonId = input.responsiblePerson;
  } else {
    input.responsiblePersonId = null;
  }

  delete input.responsiblePerson;
}

const overlappingLeaves = await prisma.leave.findMany({
where: {
  userId: leave.userId,
  status: "APPROVED",
  id: { not: id },
  isAdminDeleted: false,
  isEmployeeDeleted: false,
  AND: [
    { startDate: { lte: requestEnd } },
    { endDate: { gte: requestStart } }
  ]
}
      });

      if (overlappingLeaves.length > 0) {
        const leaveTypeName = getLeaveTypeName(input.type || leave.type);
        return res.status(400).json({
          success: false,
          message: `You already have an approved leave on this date range. Cannot update ${leaveTypeName}.`
        });
      }
    }

    const updated = await prisma.leave.update({
      where: { id },
      data: input,
      include: {
        user: true,
        approver: true,
        responsiblePerson: true
      }
    });

    // ✨ Custom success message
    const leaveTypeName = getLeaveTypeName(updated.type);
    const successMessage = `Your ${leaveTypeName} request has been updated successfully`;

    return res.json({
      success: true,
      message: successMessage,
      leave: updated
    });

  } catch (error) {
    console.error("updateLeave ERROR:", error);
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
const isChargeableLeave = !["WFH", "UNPAID", "COMP_OFF"].includes(updated.type);
if (finalStatus === "APPROVED") {
  await syncAttendanceWithLeave(updated);
}
if (finalStatus === "APPROVED" && isChargeableLeave) {
  const leaveDays =
    updated.type === "HALF_DAY"
      ? 0.5
      : Math.floor(
          (updated.endDate - updated.startDate) /
            (1000 * 60 * 60 * 24)
        ) + 1;

  await prisma.user.update({
    where: { id: updated.userId },
    data: {
      leaveBalance: {
        decrement: leaveDays
      }
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

    const leave = await prisma.leave.findUnique({ where: { id } });

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