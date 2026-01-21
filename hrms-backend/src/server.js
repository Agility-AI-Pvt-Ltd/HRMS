// src/server.js
import dotenv from "dotenv";
import http from "http";
import prisma from "./prismaClient.js";
import app from "./app.js";
import { initializeSocket } from "./socket/socketServer.js";

dotenv.config();

const PORT = process.env.PORT || 8080;

async function startServer() {
  try {
    // Create HTTP server
    const server = http.createServer(app);

    // Initialize Socket.io
    initializeSocket(server);

    // Start the server
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running at http://0.0.0.0:${PORT}`);
      console.log(`🔌 Socket.io initialized`);
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
