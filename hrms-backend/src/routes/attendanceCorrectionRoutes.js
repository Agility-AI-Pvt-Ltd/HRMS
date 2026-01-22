import express from "express";
import {
  requestPresentCorrection,
  getAllAttendanceCorrections,
  decideAttendanceCorrection,
} from "../controllers/attendanceCorrectionController.js";
import { requireAuth } from "../middlewares/auth.js";

const router = express.Router();

// EMPLOYEE
router.post(
  "/",
  requireAuth(["AGILITY_EMPLOYEE", "LYF_EMPLOYEE"]),
  requestPresentCorrection
);

// ADMIN - list
router.get(
  "/",
  requireAuth(["ADMIN"]),
  getAllAttendanceCorrections
);

// ADMIN - decision
router.post(
  "/decision",
  requireAuth(["ADMIN"]),
  decideAttendanceCorrection
);

export default router;
