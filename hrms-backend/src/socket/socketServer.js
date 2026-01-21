import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import prisma from "../prismaClient.js";

let io = null;

// Store user socket mappings: userId -> socketId
const userSockets = new Map();

export const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: [
        "http://localhost:5173",
        "https://hrms-xi-neon.vercel.app",
        "http://localhost:4000",
        "https://agilityai.in",
        "https://www.agilityai.in",
        process.env.CLIENT_URL,
      ].filter(Boolean),
      credentials: true,
    },
  });

  // Authentication middleware for Socket.io
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace("Bearer ", "");

      if (!token) {
        return next(new Error("Authentication error: No token provided"));
      }

      // Verify token
      let payload;
      try {
        payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      } catch (err) {
        return next(new Error("Authentication error: Invalid or expired token"));
      }

      const userId = payload.sub || payload.id;

      if (!userId) {
        return next(new Error("Authentication error: Invalid token payload"));
      }

      // Find the user with departments and managed departments
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          departments: {
            include: {
              department: true
            }
          },
          managedDepartments: true
        }
      });

      if (!user || !user.isActive) {
        return next(new Error("Authentication error: User not found or inactive"));
      }

      // Attach user to socket
      socket.userId = userId;
      socket.user = user;

      next();
    } catch (err) {
      console.error("Socket auth error:", err);
      next(new Error("Authentication error"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.userId;
    console.log(`✅ User connected: ${userId} (${socket.user.email})`);

    // Store socket mapping
    userSockets.set(userId, socket.id);

    // Join user-specific room
    socket.join(`user:${userId}`);

    // Join admin room if user is admin
    if (socket.user.role === "ADMIN") {
      socket.join("admin");
      console.log(`👑 Admin joined admin room: ${userId}`);
    }

    // Join manager room if user is manager
    const managerDepartments = socket.user.managedDepartments?.map(d => d.id) || [];
    if (managerDepartments.length > 0) {
      managerDepartments.forEach(deptId => {
        socket.join(`manager:${deptId}`);
      });
      console.log(`👔 Manager joined manager rooms: ${userId}`);
    }

    socket.on("disconnect", () => {
      console.log(`❌ User disconnected: ${userId}`);
      userSockets.delete(userId);
    });
  });

  return io;
};

// Helper function to emit notification to specific user
export const emitToUser = (userId, event, data) => {
  if (!io) return;

  // Try socketId first, then fallback to room-based approach
  const socketId = userSockets.get(userId);
  if (socketId) {
    io.to(socketId).emit(event, data);
    console.log(`📤 Emitted ${event} to user ${userId} (socketId: ${socketId})`);
  } else {
    // Fallback: emit to user room (in case socketId mapping is stale)
    io.to(`user:${userId}`).emit(event, data);
    console.log(`📤 Emitted ${event} to user ${userId} (via room)`);
  }
};

// Helper function to emit notification to all admins
export const emitToAdmins = (event, data) => {
  if (!io) return;
  io.to("admin").emit(event, data);
  console.log(`📤 Emitted ${event} to all admins`);
};

// Helper function to emit notification to managers of a department
export const emitToManagers = (departmentId, event, data) => {
  if (!io) return;
  io.to(`manager:${departmentId}`).emit(event, data);
  console.log(`📤 Emitted ${event} to managers of department ${departmentId}`);
};

// Helper function to emit notification to multiple users
export const emitToUsers = (userIds, event, data) => {
  if (!io) return;
  userIds.forEach(userId => {
    emitToUser(userId, event, data);
  });
};

export default io;
