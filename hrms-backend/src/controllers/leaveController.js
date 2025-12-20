import prisma from "../prismaClient.js";

const isHalfDay = (type) => type === "HALF_DAY";

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

/* --------------------------------------------------------
   CREATE LEAVE — Employees only
-------------------------------------------------------- */
export const createLeave = async (req, res) => {
  try {
    const { type, startDate, endDate, reason } = req.body;

    if (!type || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: "Missing fields" });
    }

    // 🔥 HALF DAY VALIDATION
    if (isHalfDay(type) && startDate !== endDate) {
      return res.status(400).json({
        success: false,
        message: "Half Day must be for a single date",
      });
    }

    const requestStart = new Date(startDate);
    const requestEnd = new Date(endDate);

    // ⭐ CHECK OVERLAPPING APPROVED LEAVES
    const overlappingLeaves = await prisma.leave.findMany({
      where: {
        userId: req.user.id,
        status: "APPROVED",
        AND: [
          { startDate: { lte: requestEnd } },
          { endDate: { gte: requestStart } },
        ],
      },
    });

    if (overlappingLeaves.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Already approved leave exists on this date range`,
      });
    }

    /* ================= 🔥 FIXED PART ================= */
    const employee = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        departments: {
          include: {
            department: {
              include: {
                managers: true,
              },
            },
          },
        },
      },
    });

    // First department manager → approver
    const approverId =
      employee.departments
        .flatMap((d) => d.department.managers)
        .map((m) => m.id)[0] || null;
    /* ================================================= */

    const leave = await prisma.leave.create({
      data: {
        userId: req.user.id,
        type,
        startDate: requestStart,
        endDate: requestEnd,
        reason: reason || "",
        status: "PENDING",
        approverId,
      },
      include: {
        user: true,
        approver: true,
      },
    });

    return res.json({
      success: true,
      message: `Your ${getLeaveTypeName(type)} request has been submitted successfully`,
      leave,
    });
  } catch (error) {
    console.error("createLeave ERROR:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/* --------------------------------------------------------
   LIST LEAVES — Admin sees all, Employee sees own
-------------------------------------------------------- */
export const listLeaves = async (req, res) => {
  try {
    const where =
      req.user.role === "ADMIN" ? {} : { userId: req.user.id };

    const leaves = await prisma.leave.findMany({
      where,
      include: {
        user: true,
        approver: true,
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
      include: { user: true, approver: true },
    });

    if (!leave)
      return res.status(404).json({ success: false, message: "Leave not found" });

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

      const overlappingLeaves = await prisma.leave.findMany({
        where: {
          userId: leave.userId,
          status: "APPROVED",
          id: { not: id }, // Exclude current leave
          OR: [
            {
              AND: [
                { startDate: { lte: requestEnd } },
                { endDate: { gte: requestStart } }
              ]
            }
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
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ success: false, message: "Admin only" });
    }

    const id = req.params.id;
    const { action, reason } = req.body;

    if (!["APPROVED", "REJECTED"].includes(action)) {
      return res.status(400).json({ success: false, message: "Invalid action" });
    }

    // Get the leave to check for overlaps before approving
    const leaveToApprove = await prisma.leave.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!leaveToApprove) {
      return res.status(404).json({ success: false, message: "Leave not found" });
    }

    // ⭐ CHECK FOR OVERLAPPING APPROVED LEAVES (only when approving)
    if (action === "APPROVED") {
      const overlappingLeaves = await prisma.leave.findMany({
        where: {
          userId: leaveToApprove.userId,
          status: "APPROVED",
          id: { not: id }, // Exclude current leave
          OR: [
            {
              AND: [
                { startDate: { lte: leaveToApprove.endDate } },
                { endDate: { gte: leaveToApprove.startDate } }
              ]
            }
          ]
        }
      });

      if (overlappingLeaves.length > 0) {
        const leaveTypeName = getLeaveTypeName(leaveToApprove.type);
        return res.status(400).json({
          success: false,
          message: `This employee already has an approved leave on this date range. Cannot approve ${leaveTypeName}.`
        });
      }
    }

    const leave = await prisma.leave.update({
      where: { id },
      data: {
        status: action,
        approverId: req.user.id,
        rejectReason: action === "REJECTED" ? reason || "" : null,
      },
      include: {
        user: true,
        approver: true,
      }
    });

    // ✨ Custom success message based on action and leave type
    const leaveTypeName = getLeaveTypeName(leave.type);
    const actionText = action === "APPROVED" ? "approved" : "rejected";
    const successMessage = `${leaveTypeName} request has been ${actionText}`;

    return res.json({
      success: true,
      message: successMessage,
      leave
    });

  } catch (error) {
    console.error("approveLeave ERROR:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
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
      return res.status(404).json({ success: false, message: "Leave not found" });

    if (req.user.role !== "ADMIN") {
      if (leave.userId !== req.user.id)
        return res.status(403).json({ success: false, message: "Access denied" });

      if (leave.status !== "PENDING")
        return res.status(400).json({
          success: false,
          message: "Only pending leaves can be deleted"
        });
    }

    await prisma.leave.delete({ where: { id } });

    // ✨ Custom success message
    const leaveTypeName = getLeaveTypeName(leave.type);
    const successMessage = `Your ${leaveTypeName} request has been deleted successfully`;

    return res.json({
      success: true,
      message: successMessage
    });

  } catch (error) {
    console.error("deleteLeave ERROR:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};