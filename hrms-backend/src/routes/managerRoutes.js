import express from "express";
import { requireAuth } from "../middlewares/auth.js";

import {
  managerLeaves,
  managerReimbursements,
  managerEmployees,
  managerAttendance,
  managerSendNotification,
  managerNotifications, // ✅ NEW (LIST FOR TABLE)
  managerTodayAttendance,
  deleteLeaveByManager,           // 🔥 ADD THIS
  deleteReimbursementByManager,
} from "../controllers/managerController.js";

const router = express.Router();

/* =====================================================
   🧑‍💼 MANAGER — LEAVES
===================================================== */
router.get(
  "/leaves",
  requireAuth(["ADMIN", "AGILITY_EMPLOYEE", "LYF_EMPLOYEE"]),
  managerLeaves
);

/* =====================================================
   💰 MANAGER — REIMBURSEMENTS
===================================================== */
router.get(
  "/reimbursements",
  requireAuth(["ADMIN", "AGILITY_EMPLOYEE", "LYF_EMPLOYEE"]),
  managerReimbursements
);

/* =====================================================
   👥 MANAGER — EMPLOYEES
===================================================== */
router.get(
  "/employees",
  requireAuth(["ADMIN", "AGILITY_EMPLOYEE", "LYF_EMPLOYEE"]),
  managerEmployees
);

/* =====================================================
   🕒 MANAGER — ATTENDANCE (P / L / WFH)
===================================================== */
router.get(
  "/attendance",
  requireAuth(["ADMIN", "AGILITY_EMPLOYEE", "LYF_EMPLOYEE"]),
  managerAttendance
);
router.get(
  "/attendance/today",
  requireAuth(["ADMIN", "AGILITY_EMPLOYEE", "LYF_EMPLOYEE"]),
  managerTodayAttendance
);

/* =====================================================
   🔔 MANAGER — SEND NOTIFICATION
===================================================== */
router.post(
  "/notifications",
  requireAuth(["ADMIN", "AGILITY_EMPLOYEE", "LYF_EMPLOYEE"]),
  managerSendNotification
);

/* =====================================================
   🔔 MANAGER — LIST NOTIFICATIONS (TABLE VIEW)
===================================================== */
router.get(
  "/notifications",
  requireAuth(["ADMIN", "AGILITY_EMPLOYEE", "LYF_EMPLOYEE"]),
  managerNotifications
);
router.delete(
  "/leaves/:id",
  requireAuth(["ADMIN", "AGILITY_EMPLOYEE", "LYF_EMPLOYEE"]),
  deleteLeaveByManager
);

router.delete(
  "/reimbursements/:id",
  requireAuth(["ADMIN", "AGILITY_EMPLOYEE", "LYF_EMPLOYEE"]),
  deleteReimbursementByManager
);

export default router;