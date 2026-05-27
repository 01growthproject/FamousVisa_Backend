import jwt from "jsonwebtoken";
import User from "../Models/userModel.js";

export const authMiddleware = (req, res, next) => {
  try {
    // ✅ Get token from Authorization header ONLY (Bearer scheme)
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "No token provided. Use Bearer token in Authorization header.",
      });
    }

    // Extract token
    const token = authHeader.substring(7); // Remove "Bearer " prefix

    // ✅ Verify token signature and expiry
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ Attach user ID to request
    req.user = {
      id: decoded.id,
    };

    next();

  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired. Please login again.",
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Authentication error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// ✅ Role-based authorization middleware
export const authorize = (...allowedRoles) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      // Fetch user to check role
      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: "You don't have permission to access this resource",
        });
      }

      // Attach user role for downstream handlers
      req.user.role = user.role;
      req.user.userData = user;

      next();

    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Authorization error",
        error: process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  };
};

// ✅ Optional: Verify verified email
export const requireVerified = async (req, res, next) => {
  try {
    const user = req.user?.userData;

    if (!user || !user.isVerified) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email first",
      });
    }

    next();

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Verification check error",
    });
  }
};