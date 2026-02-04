import { Router } from "express";
import { assignFreelanceFaculty, changeFacultyManager, createFreelanceFacultyManager, listFacultyManagers, listFreelanceFaculties, updateFreelanceFacultyStatus } from "../controllers/freelanceFacultyController.js";
import { requireAuth } from "../middlewares/auth.js";
const router=Router();

router.post("/create",requireAuth(["ADMIN"]),createFreelanceFacultyManager);
router.get("/listFacultyMangers",requireAuth(["ADMIN"]),listFacultyManagers);
router.post("/assign",requireAuth(["ADMIN"]),assignFreelanceFaculty);
router.post("/listFacultiesUnderManager",requireAuth(["ADMIN"]),listFreelanceFaculties);
router.post("/updateStatus",requireAuth(["ADMIN"]),updateFreelanceFacultyStatus);
router.post("/updateManager",requireAuth(["ADMIN"]),changeFacultyManager);

export default router;