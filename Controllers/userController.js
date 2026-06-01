import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

// Backend env variables — VITE_ prefix nahi (wo sirf frontend ke liye hota hai)
const STATIC_EMAIL = process.env.DEMO_EMAIL || "Famous@gmail.com";
const STATIC_PASSWORD = process.env.DEMO_PASSWORD || "Famous123";
const STATIC_USER_ID = "admin_static_001";

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRY || "7d",
  });
};

const generateRefreshToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET + "_refresh", {
    expiresIn: process.env.JWT_REFRESH_EXPIRY || "30d",
  });
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email",
      });
    }

    if (
      email.toLowerCase().trim() === STATIC_EMAIL.toLowerCase().trim() &&
      password === STATIC_PASSWORD
    ) {
      const accessToken = generateToken(STATIC_USER_ID);
      const refreshToken = generateRefreshToken(STATIC_USER_ID);

      return res.status(200).json({
        success: true,
        message: "Login successful",
        accessToken,
        refreshToken,
        user: {
          id: STATIC_USER_ID,
          name: "Admin User",
          email: STATIC_EMAIL,
          role: "admin",
          isVerified: true,
        },
      });
    } else {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const register = async (req, res) => {
  return res.status(403).json({
    success: false,
    message: "Registration is disabled.",
  });
};

export const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: "Refresh token required",
      });
    }

    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_SECRET + "_refresh",
    );
    const newAccessToken = generateToken(decoded.id);

    return res.status(200).json({
      success: true,
      accessToken: newAccessToken,
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid refresh token",
    });
  }
};

export const changePassword = async (req, res) => {
  return res.status(403).json({
    success: false,
    message: "Cannot change demo credentials",
  });
};

export const logout = async (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
};

export const getUserProfile = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (userId === STATIC_USER_ID) {
      return res.status(200).json({
        success: true,
        user: {
          id: STATIC_USER_ID,
          name: "Admin User",
          email: STATIC_EMAIL,
          role: "admin",
          isVerified: true,
        },
      });
    }

    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  } catch (error) {
    console.error("Get profile error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
