import express from "express";
import {
  login,
  register,
  logout,
  changePassword,
  getUserProfile,
  refreshToken
} from "../Controllers/userController.js";
import { authMiddleware, authorize, requireVerified } from "../Middlewares/authMiddelware.js";
import rateLimit from "express-rate-limit";

const router = express.Router();

// ✅ Rate limiting for login (prevent brute force)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per IPF
  message: "Too many login attempts. Try again after 15 minutes.",
  standardHeaders: true,
  legacyHeaders: false,
  
});

// ✅ Rate limiting for registration (prevent account creation spam)
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 registrations per IP per hour
  message: "Too many registration attempts. Try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  
});

// ===================== PUBLIC ROUTES ======================

router.post("/login", loginLimiter, login);
router.post("/register", registerLimiter, register);
router.post("/refresh-token", refreshToken);

// ===================== PROTECTED ROUTES ======================

router.get("/profile", authMiddleware, getUserProfile);
router.put("/change-password", authMiddleware, changePassword);
router.post("/logout", authMiddleware, logout);

// ===================== ADMIN-ONLY ROUTES ======================

// Example: Only admins can access
// router.get("/admin/users", authMiddleware, authorize("admin"), getAllUsers);
// router.get("/admin/logs", authMiddleware, authorize("admin"), getLogs);

export default router;