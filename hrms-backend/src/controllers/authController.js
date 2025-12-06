import bcrypt from "bcryptjs";
import prisma from "../prismaClient.js";
import {
  signAccessToken,
  signRefreshToken,
  saveRefreshToken,
  revokeRefreshToken,
} from "../utils/tokenUtils.js";
import jwt from "jsonwebtoken";

/**
 * LOGIN CONTROLLER — Production Ready
 * Supports:
 * - ADMIN login
 * - AGILITY AI Employee login
 * - LYFSHILP Academy Employee login
 *
 * Multi-Tenant Validation Based on:
 * Option B: role = company type
 */
export const login = async (req, res) => {
  try {
    console.log("Login request received:", {
      body: req.body,
      headers: req.headers,
      contentType: req.headers["content-type"],
    });
    
    const { email, password, loginType } = req.body;

    if (!email || !password || !loginType) {
      console.log("Missing fields:", { email: !!email, password: !!password, loginType: !!loginType });
      return res.status(400).json({ message: "Missing required fields" });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Block disabled users
    if (!user.isActive) {
      return res.status(403).json({ message: "Your account is disabled. Contact admin." });
    }

    // Verify password
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // ---------------------------
    // ROLE VALIDATION (Option B)
    // ---------------------------
    if (loginType === "ADMIN" && user.role !== "ADMIN") {
      return res.status(403).json({ message: "Unauthorized admin access" });
    }

    if (loginType === "AGILITY" && user.role !== "AGILITY_EMPLOYEE") {
      return res.status(403).json({ message: "Not an Agility AI employee" });
    }

    if (loginType === "LYFSHILP" && user.role !== "LYF_EMPLOYEE") {
      return res.status(403).json({ message: "Not a Lyfshilp Academy employee" });
    }

    // Generate tokens
    const accessToken = signAccessToken(user.id);
    const refreshToken = signRefreshToken(user.id);

    await saveRefreshToken(refreshToken, user.id);

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        role: user.role,
      },
      accessToken,
      refreshToken,
    });

  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
