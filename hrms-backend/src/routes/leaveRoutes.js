import express from "express";
import {
  createLeave,
  listLeaves,
  approveLeave,
  updateLeave,
  deleteLeave,
  getLeaveById
} from "../controllers/leaveController.js";

import { requireAuth } from "../middlewares/auth.js";
import { requireManagerOrAdmin } from "../middlewares/requireManagerOrAdmin.js";

const router = express.Router();

/* =====================================================
   EMPLOYEE: Create Leave
===================================================== */
router.post(
  "/",
  requireAuth(["AGILITY_EMPLOYEE", "LYF_EMPLOYEE"]),
  createLeave
);

/* =====================================================
   ADMIN + EMPLOYEE + MANAGER: List Leaves
   (filter logic controller me hoga)
===================================================== */
router.get(
  "/",
  requireAuth(["ADMIN", "AGILITY_EMPLOYEE", "LYF_EMPLOYEE"]),
  listLeaves
);

/* =====================================================
   ADMIN + EMPLOYEE + MANAGER: Get Single Leave
===================================================== */
router.get(
  "/:id",
  requireAuth(["ADMIN", "AGILITY_EMPLOYEE", "LYF_EMPLOYEE"]),
  getLeaveById
);

/* =====================================================
   UPDATE LEAVE
   - Employee → own pending
   - Admin → any
===================================================== */
router.put(
  "/:id",
  requireAuth(["ADMIN", "AGILITY_EMPLOYEE", "LYF_EMPLOYEE"]),
  updateLeave
);

/* =====================================================
   ⭐ APPROVE / REJECT
   - Admin → any
   - Manager → only department employees
===================================================== */
router.patch(
  "/:id/approve",
  requireAuth(["ADMIN", "AGILITY_EMPLOYEE", "LYF_EMPLOYEE"]),
  requireManagerOrAdmin,
  approveLeave
);

/* =====================================================
   DELETE LEAVE
===================================================== */
router.delete(
  "/:id",
  requireAuth(["ADMIN", "AGILITY_EMPLOYEE", "LYF_EMPLOYEE"]),
  deleteLeave
);

export default router;
