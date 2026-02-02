import { Router } from "express";
import { assignFreelanceFaculty, createFreelanceFacultyManager, listFacultyManagers, listFreelanceFaculties } from "../controllers/freelanceFacultyController.js";
import { requireAuth } from "../middlewares/auth.js";
const router=Router();

router.post("/create",requireAuth(["ADMIN"]),createFreelanceFacultyManager);
router.get("/listFacultyMangers",requireAuth(["ADMIN"]),listFacultyManagers);
router.post("/assign",requireAuth(["ADMIN"]),assignFreelanceFaculty);
router.post("/listFacultiesUnderManager",requireAuth(["ADMIN"]),listFreelanceFaculties);

export default router;