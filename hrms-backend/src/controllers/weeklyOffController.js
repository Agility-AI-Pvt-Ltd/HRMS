import prisma from "../prismaClient.js";

/* =====================================================
   GET LOGGED-IN USER WEEKLY-OFF (Employee View)
===================================================== */
export const getMyWeeklyOff = async (req, res) => {
  try {
    const activeUser = await prisma.user.findFirst({
      where: {
        id: req.user.id,
        isActive: true,
      },
    });

    if (!activeUser) {
      return res.status(403).json({
        success: false,
        message: "Account deactivated",
      });
    }

    const data = await prisma.weeklyOff.findFirst({
      where: { userId: req.user.id },
      select: { offDay: true, offDate: true, isFixed: true },
    });

    return res.json({
      success: true,
      weekOff: data || null,
    });
  } catch (e) {
    console.error("My WeeklyOff Fetch Error:", e);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch weekly off",
    });
  }
};

/* =====================================================
   GET WEEKLY-OFF BY USER ID (ADMIN / MANAGER VIEW)
===================================================== */
export const getWeeklyOffByUserId = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        isActive: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found or deactivated",
      });
    }

    const data = await prisma.weeklyOff.findFirst({
      where: { userId },
      select: {
        offDay: true,
        offDate: true,
        isFixed: true,
      },
    });

    return res.json({
      success: true,
      weekOff: data || null,
    });
  } catch (e) {
    console.error("WeeklyOff by UserId Error:", e);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch weekly off",
    });
  }
};

/* =====================================================
   CREATE / ASSIGN WEEKLY-OFF (POST)
===================================================== */
export const assignWeeklyOff = async (req, res) => {
  try {
    const { userId, offDay, offDate, isFixed } = req.body;

    if (!userId) return res.status(400).json({ message: "UserId required" });
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        isActive: true,
      },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Cannot assign weekly off to deactivated user",
      });
    }

    if (!offDay && !offDate)
      return res
        .status(400)
        .json({ message: "Either offDay or offDate required" });

    const existing = await prisma.weeklyOff.findFirst({ where: { userId } });

    // If exists → update old record
    if (existing) {
      const updated = await prisma.weeklyOff.update({
        where: { id: existing.id },
        data: { offDay, offDate: offDate || null, isFixed },
      });
      return res.json({
        success: true,
        message: "Weekly Off Updated",
        data: updated,
      });
    }

    // Create new
    const data = await prisma.weeklyOff.create({
      data: { userId, offDay, offDate: new Date(offDate) || null, isFixed },
    });

    return res.json({ success: true, message: "Weekly Off Assigned", data });
  } catch (e) {
    console.error("WeeklyOff Assign Error:", e);
    return res.status(500).json({
      success: false,
      message: "Server Error while assigning weekly off",
    });
  }
};

/* =====================================================
   GET ALL (GET)
===================================================== */
export const getWeeklyOffs = async (req, res) => {
  try {
    const data = await prisma.weeklyOff.findMany({
      where: { user: { isActive: true } },
      include: {
        user: {
          select: { firstName: true, lastName: true, email: true, role: true },
        },
      },
    });

    return res.json({ success: true, data });
  } catch (e) {
    console.error("WeeklyOff Fetch Error:", e);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch weekly offs" });
  }
};

/* =====================================================
   UPDATE SPECIFIC WEEKLY-OFF BY ID (PUT)
===================================================== */
export const updateWeeklyOff = async (req, res) => {
  try {
    const { id } = req.params;
    const { offDay, offDate, isFixed } = req.body;

    const weeklyOff = await prisma.weeklyOff.findFirst({
      where: {
        id,
        user: {
          isActive: true,
        },
      },
    });

    if (!weeklyOff) {
      return res.status(400).json({
        success: false,
        message: "Cannot update weekly off for deactivated user",
      });
    }

    const updated = await prisma.weeklyOff.update({
      where: { id },
      data: { offDay, offDate: offDate || null, isFixed },
    });

    return res.json({
      success: true,
      message: "Weekly Off Updated Successfully",
      data: updated,
    });
  } catch (e) {
    console.error("Update WeeklyOff Error:", e);
    return res.status(500).json({ success: false, message: "Update failed" });
  }
};

/* =====================================================
   DELETE WEEKLY-OFF (DELETE)
===================================================== */
export const removeWeeklyOff = async (req, res) => {
  try {
    const weeklyOff = await prisma.weeklyOff.findFirst({
      where: {
        id: req.params.id,
        user: {
          isActive: true,
        },
      },
    });

    if (!weeklyOff) {
      return res.status(400).json({
        success: false,
        message: "Cannot remove weekly off for deactivated user",
      });
    }
    await prisma.weeklyOff.delete({ where: { id: req.params.id } });
    return res.json({ success: true, message: "Weekly Off removed" });
  } catch (e) {
    console.error("Delete WeeklyOff Error:", e);
    return res
      .status(500)
      .json({ success: false, message: "Error removing weekly off" });
  }
};
