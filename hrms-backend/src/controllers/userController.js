import prisma from "../prismaClient.js";
import bcrypt from "bcryptjs";

/* ============================================================
   GET LOGGED-IN USER INFO
============================================================ */
export const getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        departmentId: true,
        position: true,
        salary: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.json({ success: true, user });
  } catch (err) {
    console.error("getMe ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/* ============================================================
   UPDATE *MY* PROFILE (PROFILE PAGE SAFE ENDPOINT)
============================================================ */
export const updateMyProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { firstName, lastName, position } = req.body;

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        firstName,
        lastName,
        position,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        departmentId: true,
        position: true,
        salary: true,
      },
    });

    return res.json({
      success: true,
      message: "Profile updated successfully",
      user: updated,
    });
  } catch (err) {
    console.error("updateMyProfile ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update profile",
    });
  }
};

/* ============================================================
   LIST USERS
============================================================ */
/* ============================================================
   LIST USERS (Admin gets all info, Employee gets safe info)
============================================================ */
export const listUsers = async (req, res) => {
  try {
    const requester = req.user;

    if (requester.role === "ADMIN") {
      // ADMIN → full access
      const users = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          departmentId: true,
          position: true,
          salary: true,
          isActive: true,
        },
        orderBy: { firstName: "asc" },
      });

      return res.json({ success: true, users });
    }

    // EMPLOYEE → needs all users (for dropdown), but safe fields only
    const users = await prisma.user.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
        departmentId: true,
      },
      orderBy: { firstName: "asc" },
    });

    return res.json({ success: true, users });

  } catch (err) {
    console.error("listUsers ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


/* ============================================================
   CREATE USER (ADMIN ONLY)
============================================================ */
export const createUser = async (req, res) => {
  try {
    const requester = req.user;

    if (requester.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Only admin can create users",
      });
    }

    const {
      email,
      firstName,
      lastName,
      role,
      departmentId,
      password = "password123",
    } = req.body;

    if (!email || !firstName || !role) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    const validRoles = ["ADMIN", "AGILITY_EMPLOYEE", "LYF_EMPLOYEE"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role",
      });
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        firstName,
        lastName,
        role,
        departmentId: departmentId || null,
          password: hashed,
      },
    });

    return res.json({
      success: true,
      message: "User created successfully",
      user,
    });
  } catch (err) {
    console.error("createUser ERROR:", err);

    if (err.code === "P2002") {
      return res.status(400).json({
        success: false,
        message: "Email already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/* ============================================================
   UPDATE USER
============================================================ */
export const updateUser = async (req, res) => {
  try {
    const requester = req.user;
    const targetId = req.params.id;
    const data = { ...req.body };

    const targetUser = await prisma.user.findUnique({
      where: { id: targetId },
    });

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // employees cannot update others / role / email
    if (requester.role !== "ADMIN") {
      if (requester.id !== targetId) {
        return res.status(403).json({
          success: false,
          message: "You cannot update other users",
        });
      }

      delete data.role;
      delete data.email;
      delete data.salary;
      delete data.position;
      delete data.departmentId;
      delete data.isActive;
    }

    if (requester.role === "ADMIN" && requester.id === targetId) {
      if (data.role) {
        return res.status(400).json({
          success: false,
          message: "Admin cannot change their own role",
        });
      }
    }

    if (data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    }

    const updated = await prisma.user.update({
      where: { id: targetId },
      data,
    });

    return res.json({
      success: true,
      message: "User updated",
      user: updated,
    });
  } catch (err) {
    console.error("updateUser ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
export const getUserFullDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        department: true,
        attendances: true,
        leaves: true,
        payrolls: true,
        notifications: true,
      },
    });

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/* ============================================================
   DELETE USER (ADMIN ONLY)
============================================================ */
export const deleteUser = async (req, res) => {
  try {
    const requester = req.user;
    const targetId = req.params.id;

    if (requester.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Only admin can delete users",
      });
    }

    if (requester.id === targetId) {
      return res.status(400).json({
        success: false,
        message: "Admin cannot delete themselves",
      });
    }

    await prisma.user.delete({
      where: { id: targetId },
    });

    return res.json({
      success: true,
      message: "User deleted",
    });
  } catch (err) {
    console.error("deleteUser ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
