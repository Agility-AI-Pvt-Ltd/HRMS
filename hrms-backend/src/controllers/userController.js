import prisma from "../prismaClient.js";
import bcrypt from "bcryptjs";
import { sendUserCredentialsMail } from "../utils/sendMail.js";
const TOTAL_YEARLY_LEAVES = 21;

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

        // 🔴 legacy (keep)
        departmentId: true,

        // 🟢 multi-department (employee)
        departments: {
          include: {
            department: {
              select: { id: true, name: true }
            }
          }
        },

        // 🟢 manager departments
        managedDepartments: {
          select: {
            id: true,
            name: true
          }
        },

        position: true,
        salary: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // 🔥 ADD THIS FLAG
    const isManager = user.managedDepartments.length > 0;

    return res.json({
      success: true,
      user: {
        ...user,
        isManager, // 👈 ⭐ IMPORTANT
      },
    });

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
   LIST USERS (Admin gets all info, Employee gets safe info)
============================================================ */
export const listUsers = async (req, res) => {
  try {
    const requester = req.user;

    /* ====================================================
       COMMON SELECT (BACKWARD + FORWARD COMPATIBLE)
    ==================================================== */
    const baseSelect = {
      id: true,
      firstName: true,
      lastName: true,
      role: true,

      // 🔴 legacy (single department support – KEEP)
      departmentId: true,

      // 🟢 new (multi-department support)
      departments: {
        include: {
          department: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    };

    /* ====================================================
       ADMIN → FULL DATA
    ==================================================== */
    if (requester.role === "ADMIN") {
      const users = await prisma.user.findMany({
          where: {
    isActive: true, // 👈 yahin
  },
        select: {
          ...baseSelect,
          email: true,
          position: true,
          salary: true,
          isActive: true,
        },
        orderBy: { firstName: "asc" },
      });

      return res.json({
        success: true,
        users,
      });
    }

    /* ====================================================
       EMPLOYEE → SAFE DATA
    ==================================================== */
    const users = await prisma.user.findMany({
        where: {
    isActive: true, // 👈 yahin
  },
      select: baseSelect,
      orderBy: { firstName: "asc" },
    });

    return res.json({
      success: true,
      users,
    });

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

    let {
      email,
      firstName,
      lastName,
      role,
      departmentId,      // 🔴 legacy (single)
      departmentIds = [],// 🟢 new (multi)
      password = "password123",
    } = req.body;

    /* ===================== VALIDATION ===================== */
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

    /* ===================== PASSWORD ===================== */
    // generate password if admin ne nahi diya
const plainPassword =
  password && password !== "password123"
    ? password
    : Math.random().toString(36).slice(-8);

const hashed = await bcrypt.hash(plainPassword, 10);

    /* ===================== CREATE USER ===================== */
    const user = await prisma.user.create({
      data: {
        email,
        firstName,
        lastName,
        role,
        password: hashed,

        // 🔴 keep legacy support
        departmentId: departmentId || null,
      },
    });
    // 📧 SEND LOGIN CREDENTIALS MAIL
try {
  await sendUserCredentialsMail({
    to: email,
    name: firstName,
    email,
    password: plainPassword,
  });
} catch (mailErr) {
  console.error("Credential mail failed:", mailErr.message);
}

    /* ===================== MULTI-DEPARTMENT LINK ===================== */
    // Priority: departmentIds[] → departmentId
    let finalDepartmentIds = [];

    if (Array.isArray(departmentIds) && departmentIds.length > 0) {
      finalDepartmentIds = departmentIds;
    } else if (departmentId) {
      finalDepartmentIds = [departmentId];
    }

    if (finalDepartmentIds.length > 0) {
      await prisma.userDepartment.createMany({
        data: finalDepartmentIds.map((depId) => ({
          userId: user.id,
          departmentId: depId,
        })),
      });
    }

    const createdUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        departments: {
          include: {
            department: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    return res.json({
      success: true,
      message: "User created successfully",
      user: createdUser,
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

    /* ====================================================
       🔐 PERMISSION RULES
    ==================================================== */

    // Employee cannot update others
    if (requester.role !== "ADMIN") {
      if (requester.id !== targetId) {
        return res.status(403).json({
          success: false,
          message: "You cannot update other users",
        });
      }

      // strip restricted fields
      delete data.role;
      delete data.email;
      delete data.salary;
      delete data.position;
      delete data.departmentId;
      delete data.departmentIds;
      delete data.isActive;
    }

    // Admin cannot change own role
    if (requester.role === "ADMIN" && requester.id === targetId) {
      if (data.role) {
        return res.status(400).json({
          success: false,
          message: "Admin cannot change their own role",
        });
      }
    }

    /* ====================================================
       🔐 PASSWORD
    ==================================================== */
let plainPassword = null;
if (typeof data.password === "string" && data.password.trim() !== "") {
  plainPassword = data.password;              // 👈 store plain
  data.password = await bcrypt.hash(plainPassword, 10);
} else {
  delete data.password; // 🔒 do not touch password
}
    /* ====================================================
       🟢 MULTI-DEPARTMENT SYNC (SAFE + BACKWARD COMPATIBLE)
    ==================================================== */
    if (Array.isArray(data.departmentIds)) {
      // remove old relations
      await prisma.userDepartment.deleteMany({
        where: { userId: targetId },
      });

      // add new relations
      if (data.departmentIds.length > 0) {
        await prisma.userDepartment.createMany({
          data: data.departmentIds.map((depId) => ({
            userId: targetId,
            departmentId: depId,
          })),
        });
      }

      // 🔴 legacy field (keep for old UI / logic)
      data.departmentId = data.departmentIds[0] || null;

      delete data.departmentIds;
    }

    /* ====================================================
       ✅ UPDATE USER
    ==================================================== */
const updated = await prisma.user.update({
  where: { id: targetId },
  data,
  include: {
    departments: {
      include: {
        department: {
          select: { id: true, name: true },
        },
      },
    },
  },
});

// 📧 SEND MAIL ONLY IF PASSWORD WAS CHANGED
if (plainPassword) {
  try {
    await sendUserCredentialsMail({
      to: updated.email,
      name: updated.firstName,
      email: updated.email,
      password: plainPassword,
      isReset: true, // optional flag
    });
  } catch (mailErr) {
    console.error("Password update mail failed:", mailErr.message);
  }
}

return res.json({
  success: true,
  message: "User updated successfully",
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
function getUniqueLeaveUnits(leaves) {
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
}
export const getUserFullDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        department: true, // 🔴 old (safe)
        departments: {    // 🟢 new
          include: {
            department: true
          }
        },
        attendances: true,
        leaves: true,
        payrolls: true,
        notifications: true,
         //  🟢 ADD THIS
 resignations: {
   where: { isEmployeeDeleted: false },
   orderBy: { createdAt: "desc" },
}
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // ==== KPI LOGIC (UNCHANGED) ====
    const currentYear = new Date().getFullYear();
    const yearStart = new Date(`${currentYear}-01-01`);
    const yearEnd = new Date(`${currentYear}-12-31`);

    const yearlyLeaves = user.leaves.filter(
      (l) =>
        new Date(l.startDate) >= yearStart &&
        new Date(l.endDate) <= yearEnd
    );

    const totalLeaves = getUniqueLeaveUnits(
      yearlyLeaves.filter((l) => l.type !== "WFH")
    );

    const approvedLeaves = getUniqueLeaveUnits(
      yearlyLeaves.filter(
        (l) =>
          l.status === "APPROVED" &&
          l.type !== "WFH" &&
          l.type !== "UNPAID"
      )
    );

    const wfhDays = getUniqueLeaveUnits(
      yearlyLeaves.filter(
        (l) => l.status === "APPROVED" && l.type === "WFH"
      )
    );

    const remainingLeaves = Math.max(
      TOTAL_YEARLY_LEAVES - approvedLeaves,
      0
    );

    return res.json({
      success: true,
      user,
      stats: {
        totalLeaves,
        approvedLeaves,
        remainingLeaves,
        wfhDays,
        yearlyQuota: TOTAL_YEARLY_LEAVES,
      },
    });

  } catch (err) {
    console.error("getUserFullDetails ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
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
        message: "Only admin can deactivate users",
      });
    }

    if (requester.id === targetId) {
      return res.status(400).json({
        success: false,
        message: "Admin cannot deactivate themselves",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: targetId },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    await prisma.user.update({
      where: { id: targetId },
      data: {
        isActive: false,
        email: `inactive_${Date.now()}_${user.email}`, // 🔐 avoid unique conflict
      },
    });

    return res.json({
      success: true,
      message: "User deactivated successfully",
    });
  } catch (err) {
    console.error("deleteUser ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
