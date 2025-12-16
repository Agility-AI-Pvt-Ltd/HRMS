import jwt from "jsonwebtoken";
import prisma from "../prismaClient.js";

export const requireAuth = (allowedRoles = []) => {
  return async (req, res, next) => {
    try {
      const header = req.headers.authorization;

      if (!header || !header.startsWith("Bearer ")) {
        return res.status(401).json({ message: "No token provided" });
      }

      const token = header.split(" ")[1];

      // Verify token
      let payload;
      try {
        payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      } catch (err) {
        return res.status(401).json({ message: "Invalid or expired token" });
      }

      // 🟢 Use payload.sub → because tokens were signed with { sub: userId }
      const userId = payload.sub;

      if (!userId) {
        return res.status(401).json({ message: "Invalid token payload" });
      }

      // Find the user
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      if (!user.isActive) {
        return res.status(403).json({ message: "User account is deactivated" });
      }

      // Role Checking
      if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
        return res.status(403).json({ message: "Access forbidden for your role" });
      }

      req.user = user;
      next();
    } catch (err) {
      console.error("Auth Middleware Error:", err);
      return res.status(500).json({ message: "Authentication failed" });
    }
  };
};
