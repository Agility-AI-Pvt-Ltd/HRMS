import prisma from "../prismaClient.js";
import multer from "multer";
import fs from "fs";
import path from "path";

/* =====================================================
   📦 STORAGE
===================================================== */
const uploadDir = path.join(process.cwd(), "uploads", "reimbursements");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

export const uploadBills = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
      const ext = file.originalname.split(".").pop();
      cb(null, `bill-${Date.now()}.${ext}`);
    },
  }),
});

/* =====================================================
   🔹 HELPERS
===================================================== */
const validateManagerReimbursementAccess = async (reimbursementId, managerId) => {
  const record = await prisma.reimbursement.findFirst({
    where: {
      id: reimbursementId,
      user: {
        departments: {
          some: {
            department: {
              managers: {
                some: { id: managerId },
              },
            },
          },
        },
      },
    },
  });

  if (!record) {
    throw new Error("Manager has no access to this reimbursement");
  }

  return record;
};

const getFullUrl = (file) => {
  const base = process.env.SERVER_URL || "http://localhost:4000";
  return `${base}/${file}`.replace(/([^:]\/)\/+/g, "$1");
};

const calculateTotal = (bills = []) =>
  bills.reduce((sum, b) => sum + Number(b.amount || 0), 0);

const validateOwner = async (id, userId) => {
  const record = await prisma.reimbursement.findFirst({
    where: { id, userId },
  });
  if (!record) throw new Error("Unauthorized access");
  return record;
};

const updateStatus = async ({ id, status, reason = null }) => {
  return prisma.reimbursement.update({
    where: { id },
    data: {
      status,
      rejectReason: status === "REJECTED" ? reason || "" : null,
    },
  });
};

/* =====================================================
   📤 UPLOAD BILL FILES
===================================================== */
export const uploadReimbursementFiles = async (req, res) => {
  try {
    if (!req.files?.length)
      return res
        .status(400)
        .json({ success: false, message: "No files uploaded" });

    const files = req.files.map((f) => ({
      fileUrl: getFullUrl(`uploads/reimbursements/${f.filename}`),
    }));

    res.json({ success: true, files });
  } catch (e) {
    res.status(500).json({ success: false, message: "Upload failed" });
  }
};

/* =====================================================
   👤 EMPLOYEE — CREATE
===================================================== */
export const createReimbursement = async (req, res) => {
  try {
    const { title, description, bills } = req.body;

    if (!title || !bills?.length)
      return res
        .status(400)
        .json({ success: false, message: "Title & bills required" });

    const reimbursement = await prisma.reimbursement.create({
      data: {
        userId: req.user.id,
        title,
        description: description || "",
        totalAmount: calculateTotal(bills),
        bills: {
          create: bills.map((b) => ({
            fileUrl: b.fileUrl,
            amount: Number(b.amount),
            note: b.note || "",
          })),
        },
      },
      include: { bills: true },
    });

    res.json({
      success: true,
      message: "Reimbursement submitted",
      reimbursement,
    });
  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* =====================================================
   👤 EMPLOYEE — MY LIST
===================================================== */
export const myReimbursements = async (req, res) => {
  try {
    const list = await prisma.reimbursement.findMany({
      where: {
        userId: req.user.id,
        isEmployeeDeleted: false,
      },
      include: { bills: true },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, list });
  } catch (e) {
    res.status(500).json({ success: false, message: "Failed" });
  }
};

/* =====================================================
   👤 EMPLOYEE — SOFT DELETE
===================================================== */
export const employeeDeleteReimbursement = async (req, res) => {
  try {
    await validateOwner(req.params.id, req.user.id);

    await prisma.reimbursement.update({
      where: { id: req.params.id },
      data: { isEmployeeDeleted: true },
    });

    res.json({ success: true, message: "Removed from your list" });
  } catch (e) {
    res.status(403).json({ success: false, message: e.message });
  }
};

/* =====================================================
   👑 ADMIN — ALL || Manager-Department
===================================================== */
export const getManagerReimbursements = async (req, res) => {
  try {
    const managerId = req.user.id;

    const reimbursements = await prisma.reimbursement.findMany({
      where: {
        user: {
          departments: {
            some: {
              department: {
                managers: {
                  some: {
                    id: managerId,
                  },
                },
              },
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
        bills: true,          // ✅ bills
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({
      success: true,
      list: reimbursements,
    });
  } catch (err) {
    console.error("MANAGER REIMBURSEMENTS ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export const getAllReimbursements = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN")
      return res.status(403).json({ success: false, message: "Admin only" });

    const list = await prisma.reimbursement.findMany({
      where: { isAdminDeleted: false },
      include: { user: true, bills: true },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, list });
  } catch (e) {
    res.status(500).json({ success: false, message: "Failed" });
  }
};

/* =====================================================
   👑 ADMIN — APPROVE / REJECT
===================================================== */
export const updateReimbursementStatus = async (req, res) => {
  try {
    const { status, reason } = req.body;
    const id = req.params.id;

    if (!["APPROVED", "REJECTED"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    /* ================= ACCESS CONTROL ================= */

    if (req.user.role === "ADMIN") {
      // Admin → full access
    } else {
      // Manager → only department employees
      await validateManagerReimbursementAccess(id, req.user.id);
    }

    /* ================================================= */

const reimbursement = await updateStatus({
  id,
  status,
  reason,
});

    return res.json({
      success: true,
      message: `Reimbursement ${status.toLowerCase()}`,
      reimbursement,
    });
  } catch (e) {
    console.error("updateReimbursementStatus ERROR:", e);
    return res.status(403).json({
      success: false,
      message: e.message,
    });
  }
};


/* =====================================================
   👑 ADMIN — SOFT DELETE
===================================================== */
export const adminDeleteReimbursement = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN")
      return res.status(403).json({ success: false, message: "Admin only" });

    await prisma.reimbursement.update({
      where: { id: req.params.id },
      data: { isAdminDeleted: true },
    });

    res.json({ success: true, message: "Removed from admin list" });
  } catch (e) {
    res.status(500).json({ success: false, message: "Failed" });
  }
};
