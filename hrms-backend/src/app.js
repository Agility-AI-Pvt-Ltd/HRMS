// src/app.js
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import "express-async-errors";
import path from "path"; 
const __dirname = path.resolve(); 
// Routes
import attendanceRoutes from "./routes/attendanceRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import departmentRoutes from "./routes/deptRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import leaveRoutes from "./routes/leaveRoutes.js";
import payrollRoutes from "./routes/payrollRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import reimbursementRoutes from "./routes/reimbursementRoutes.js";
import managerRoutes from "./routes/managerRoutes.js";
import resignationRoutes from "./routes/resignationRoutes.js";
import weeklyOffRoutes from "./routes/weeklyOffRoutes.js";
import compOffRoutes from "./routes/compOffRoutes.js";   
import holidayRoutes from "./routes/holidayRoutes.js"; 
import attendanceCorrectionRoutes from "./routes/attendanceCorrectionRoutes.js"; 
import freelanceFacultyRoutes from "./routes/facultyManagerRoute.js"

const app = express();

/* ============================================================
   SECURITY MIDDLEWARES
============================================================ */
app.use(helmet());

// Remove useless policies from new Helmet
app.use((req, res, next) => {
  res.setHeader(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=(), picture-in-picture=()"
  );
  next();
});

/* ============================================================
   CORS CONFIG
============================================================ */
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://hrms-xi-neon.vercel.app",
  "http://localhost:4000",
  "https://agilityai.in",
  "https://www.agilityai.in",
  process.env.CLIENT_URL, // optional
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Mobile apps / Postman have no origin
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.warn("❌ Blocked by CORS:", origin);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

/* ============================================================
   STATIC FILE SERVING FOR PDF SLIPS
============================================================ */
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
// Now PDF slips can be accessed via:
// http://localhost:4000/uploads/slips/<filename>.pdf

/* ============================================================
   API ROUTES
============================================================ */
app.use("/api/auth", authRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/leaves", leaveRoutes);
app.use("/api/payroll", payrollRoutes);
app.use("/api/users", userRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/reimbursement", reimbursementRoutes);
app.use("/api/manager", managerRoutes);
app.use("/api/resignation", resignationRoutes);
app.use("/api/weekly-off", weeklyOffRoutes);
app.use("/api/comp-off", compOffRoutes); 
app.use("/api/holidays", holidayRoutes);
app.use( "/api/attendance-corrections", attendanceCorrectionRoutes);
app.use("/api/freelance",freelanceFacultyRoutes);


/* ============================================================
   HEALTH CHECK
============================================================ */
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "HRMS API" });
});

/* ============================================================
   GLOBAL ERROR HANDLER
============================================================ */
app.use((err, req, res, next) => {
  console.error("❌ GLOBAL ERROR:", err);

  return res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

export default app;