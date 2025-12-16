import express from "express";
import { login, refresh } from "../controllers/authController.js";
import { requireAuth } from "../middlewares/auth.js";
import { revokeRefreshToken } from "../utils/tokenUtils.js";

const router = express.Router();

/* ---------------------------
   LOGIN (sets refresh cookie)
---------------------------- */
router.post("/login", login);

/* ---------------------------
   REFRESH TOKEN (cookie based)
---------------------------- */
router.get("/refresh", refresh);

/* ---------------------------
   LOGOUT (clear refresh cookie)
---------------------------- */
router.post("/logout", async (req, res) => {
  try {
    const token = req.cookies.refreshToken;

    if (token) {
      await revokeRefreshToken(token);
    }

    // Clear cookie from browser
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
    });

    return res.json({ message: "Logged out" });
  } catch (err) {
    return res.status(500).json({ message: "Logout failed" });
  }
});

export default router;
