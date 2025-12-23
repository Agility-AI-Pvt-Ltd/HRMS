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

const router = express.Router();

/* =====================================================
   EMPLOYEE — CREATE LEAVE
===================================================== */
router.post(
  "/",
  requireAuth(["AGILITY_EMPLOYEE", "LYF_EMPLOYEE"]),
  createLeave
);

/* =====================================================
   LIST LEAVES
   - Employee → own
   - Manager → dept employees (controller handles)
   - Admin → all
===================================================== */
router.get(
  "/",
  requireAuth(["ADMIN", "AGILITY_EMPLOYEE", "LYF_EMPLOYEE"]),
  listLeaves
);

/* =====================================================
   GET SINGLE LEAVE
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
   ⭐ APPROVE / REJECT (ONE SINGLE API)
   - Admin → any leave
   - Manager → only department employees
===================================================== */
router.patch(
  "/:id/approve",
  requireAuth(["ADMIN", "AGILITY_EMPLOYEE", "LYF_EMPLOYEE"]),
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
