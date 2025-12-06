// src/server.js
import dotenv from "dotenv";
import prisma from "./prismaClient.js";
import app from "./app.js";

dotenv.config();

const PORT = process.env.PORT || 8080;

async function startServer() {
  try {
    // Start the server first
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running at http://0.0.0.0:${PORT}`);
    });

    // Try to connect to database (non-blocking)
    try {
      await prisma.$connect();
      console.log("✅ Connected to PostgreSQL database");
    } catch (dbErr) {
      console.error("⚠️ Database connection failed, but server is running:", dbErr.message);
      // Server continues running even if DB connection fails initially
    }
  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
}

startServer();
