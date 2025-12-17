import prisma from "../prismaClient.js";

/* --------------------------------------------------------
   CREATE LEAVE — Employees only
-------------------------------------------------------- */
export const createLeave = async (req, res) => {
  try {
    const { type, startDate, endDate, reason } = req.body;

    if (!type || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: "Missing fields" });
    }

    // find employee's department and manager
    const employee = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        department: {
          select: { managerId: true }
        }
      }
    });

    const approverId = employee?.department?.managerId || null;

    const leave = await prisma.leave.create({
      data: {
        userId: req.user.id,
        type,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        reason: reason || "",
        status: "PENDING",
        approverId
      },
      include: {
        user: true,
        approver: true
      }
    });

    return res.json({
      success: true,
      message: "Leave created successfully",
      leave
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
    let leaves;

    if (req.user.role === "ADMIN") {
      leaves = await prisma.leave.findMany({
        include: {
          user: true,
          approver: true,
        },
        orderBy: { createdAt: "desc" },
      });
    } else {
      leaves = await prisma.leave.findMany({
        where: { userId: req.user.id },
        include: {
          user: true,
          approver: true,
        },
        orderBy: { createdAt: "desc" },
      });
    }

    return res.json({
      success: true,
      leaves
    });

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

    // Employee rules
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
      delete input.rejectReason; // employee cannot change rejection reason
    }

    const updated = await prisma.leave.update({
      where: { id },
      data: input,
      include: {
        user: true,
        approver: true,
      }
    });

    return res.json({
      success: true,
      message: "Leave updated",
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
    const { action, reason } = req.body; // reason added

    if (!["APPROVED", "REJECTED"].includes(action)) {
      return res.status(400).json({ success: false, message: "Invalid action" });
    }

    const leave = await prisma.leave.update({
      where: { id },
      data: {
        status: action,
        approverId: req.user.id,
        rejectReason: action === "REJECTED" ? reason || "" : null, // save reject reason
      },
      include: {
        user: true,
        approver: true,
      }
    });

    return res.json({
      success: true,
      message: `Leave ${action.toLowerCase()}`,
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

    return res.json({
      success: true,
      message: "Leave deleted"
    });

  } catch (error) {
    console.error("deleteLeave ERROR:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
