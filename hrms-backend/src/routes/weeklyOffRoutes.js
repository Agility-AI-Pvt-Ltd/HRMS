import express from "express";
import { 
  assignWeeklyOff, 
  getWeeklyOffs, 
  removeWeeklyOff,
  updateWeeklyOff,
  getMyWeeklyOff, 
  getWeeklyOffByUserId,
} from "../controllers/weeklyOffController.js";
import { requireAuth } from "../middlewares/auth.js";

const router = express.Router();

// Create or Update if exists (Auto)
router.post(
  "/assign",
  requireAuth(["ADMIN"]),
  assignWeeklyOff
);

// Get all Weekly Off records
router.get(
  "/all",
  requireAuth(["ADMIN"]),
  getWeeklyOffs
);
router.get("/me", requireAuth(), getMyWeeklyOff);
// Update specific Weekly Off by ID
router.put(
  "/update/:id",
  requireAuth(["ADMIN"]),
  updateWeeklyOff
);

// routes/weeklyOffRoutes.js
router.get("/weekly-off/:userId",requireAuth(["ADMIN"]), getWeeklyOffByUserId);

// Delete weekly off record
router.delete(
  "/remove/:id",
  requireAuth(["ADMIN"]),
  removeWeeklyOff
);

export default router;
