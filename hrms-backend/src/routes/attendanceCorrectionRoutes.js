import express from "express";
import {
  requestPresentCorrection,
  getAllAttendanceCorrections,
  decideAttendanceCorrection,
} from "../controllers/attendanceCorrectionController.js";
import { requireAuth } from "../middlewares/auth.js";

const router = express.Router();

/* ================= EMPLOYEE ================= */
// Request present correction
router.post(
  "/request",
  requireAuth(["AGILITY_EMPLOYEE", "LYF_EMPLOYEE"]),
  requestPresentCorrection
);

/* ================= ADMIN ================= */
// Get all correction requests
router.get(
  "/all",
  requireAuth(["ADMIN"]),
  getAllAttendanceCorrections
);

// Approve / Reject correction
router.post(
  "/decision",
  requireAuth(["ADMIN"]),
  decideAttendanceCorrection
);

export default router;
