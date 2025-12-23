import express from "express";

import {
  uploadBills,
  uploadReimbursementFiles,
  createReimbursement,
  myReimbursements,
  getAllReimbursements,
  getManagerReimbursements, 
  updateReimbursementStatus,
  employeeDeleteReimbursement,
  adminDeleteReimbursement,
} from "../controllers/reimbursementController.js";

import { requireAuth } from "../middlewares/auth.js";

const router = express.Router();

/* =====================================================
   UPLOAD BILL FILES
===================================================== */
router.post(
  "/upload",
  requireAuth(["ADMIN", "AGILITY_EMPLOYEE", "LYF_EMPLOYEE"]),
  uploadBills.array("files"),
  uploadReimbursementFiles
);

/* =====================================================
   EMPLOYEE ROUTES
===================================================== */

router.post(
  "/create",
  requireAuth(["AGILITY_EMPLOYEE", "LYF_EMPLOYEE"]),
  createReimbursement
);

router.get(
  "/me",
  requireAuth(["AGILITY_EMPLOYEE", "LYF_EMPLOYEE"]),
  myReimbursements
);

router.get(
  "/manager",
  requireAuth(["ADMIN", "AGILITY_EMPLOYEE", "LYF_EMPLOYEE"]),
  getManagerReimbursements
);


router.delete(
  "/me/:id",
  requireAuth(["AGILITY_EMPLOYEE", "LYF_EMPLOYEE"]),
  employeeDeleteReimbursement
);

/* =====================================================
   ADMIN ROUTES (VIEW)
===================================================== */

router.get(
  "/all",
  requireAuth(["ADMIN"]),
  getAllReimbursements
);

router.delete(
  "/admin/:id",
  requireAuth(["ADMIN"]),
  adminDeleteReimbursement
);

/* =====================================================
   ⭐ ADMIN + MANAGER — APPROVE / REJECT
   Logic controller ke andar hai
===================================================== */

router.patch(
  "/:id/status",
  requireAuth(["ADMIN", "AGILITY_EMPLOYEE", "LYF_EMPLOYEE"]),
  updateReimbursementStatus
);

export default router;
