import express from "express";
import {
  applyResignation,
  myResignations,
  getManagerResignations,
  getAllResignations,
  updateResignationStatus,
  employeeDeleteResignation,
  adminDeleteResignation,
  exportResignations
} from "../controllers/resignationController.js";

import { requireAuth } from "../middlewares/auth.js";

const router = express.Router();

/* ================= EMPLOYEE APPLY ================= */
router.post(
  "/apply",
  requireAuth(["AGILITY_EMPLOYEE","LYF_EMPLOYEE","ADMIN"]),
  applyResignation
);

/* ================= EMPLOYEE MY LIST ================= */
router.get(
  "/my",
  requireAuth(["AGILITY_EMPLOYEE","LYF_EMPLOYEE","ADMIN"]),
  myResignations
);

/* ================= MANAGER VIEW DEPARTMENT RESIGNATIONS ================= */
router.get(
  "/manager",
  requireAuth(["ADMIN","AGILITY_EMPLOYEE","LYF_EMPLOYEE"]),
  getManagerResignations
);

/* ================= ADMIN ALL ================= */
router.get(
  "/admin",
  requireAuth(["ADMIN"]),
  getAllResignations
);

/* ================= APPROVE / REJECT ================= 
   send body => { status:"APPROVED" }  or  { status:"REJECTED", reason:"..." }
====================================================== */
router.put(
  "/status/:id",
  requireAuth(["ADMIN","AGILITY_EMPLOYEE"]),  // Manager via dept access, Admin full
  updateResignationStatus
);

/* ================= EMPLOYEE DELETE OWN ================= */
router.delete(
  "/me/:id",
  requireAuth(["AGILITY_EMPLOYEE","LYF_EMPLOYEE","ADMIN"]),
  employeeDeleteResignation
);

/* ================= ADMIN DELETE ANY ================= */
router.delete(
  "/admin/:id",
  requireAuth(["ADMIN"]),
  adminDeleteResignation
);

/* ================= EXPORT CSV/EXCEL ================= */
router.get(
  "/export",
  requireAuth(["ADMIN"]),
  exportResignations
);

export default router;
