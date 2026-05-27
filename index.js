import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";

import connectDB from "./Config/ConnectDB.js";
import authRoutes from "./routes/authRoutes.js";
import clientRoutes from "./routes/ClientRoute.js";

dotenv.config();

console.log("🔍 Environment Variables Check:");
console.log("JWT_SECRET:", process.env.JWT_SECRET ? "✅ Loaded" : "❌ Missing");
console.log("JWT_EXPIRY:", process.env.JWT_EXPIRY || "7d (default)");
console.log("PORT:", process.env.PORT);
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log(
  "MONGODB_URL:",
  process.env.MONGODB_URL ? "✅ Loaded" : "❌ Missing",
);

// ==================== ENVIRONMENT VALIDATION ====================
if (!process.env.JWT_SECRET) {
  console.error("❌ ERROR: JWT_SECRET is required in .env file");
  process.exit(1);
}

if (!process.env.MONGODB_URL) {
  console.error("❌ ERROR: MONGODB_URL is required in .env file");
  process.exit(1);
}

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==================== SECURITY MIDDLEWARE ====================

// ✅ Helmet for security headers
app.use(helmet());

// ✅ HTTPS redirect (for production)
app.use((req, res, next) => {
  if (process.env.NODE_ENV === "production") {
    if (req.header("x-forwarded-proto") !== "https") {
      return res.redirect(`https://${req.header("host")}${req.url}`);
    }
  }
  next();
});

// ✅ General rate limiting (all requests)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per IP
  message: "Too many requests. Please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(generalLimiter);

// ✅ Auth-specific rate limiting (stricter)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Only 5 attempts
  message: "Too many login attempts. Please try again later.",
  skipSuccessfulRequests: true, // Don't count successful requests
  standardHeaders: true,
  legacyHeaders: false,
});

// ==================== CORS CONFIGURATION ====================

// ✅ Restrict CORS to known origins
app.use(
  cors({
    origin: (process.env.CORS_ORIGIN || "").split(","),
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400, // 24 hours
  }),
);

// ==================== BODY PARSER ====================

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// ==================== DATABASE ====================

connectDB();

// ==================== ROUTES ====================

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "✅ Backend is running!",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// ✅ Health check endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "✅ API is healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Auth routes (with stricter rate limiting)
app.use("/api/auth", authLimiter, authRoutes);

// Client routes (with Cloudinary uploads)
app.use("/api/clients", clientRoutes);

// ==================== ERROR HANDLING ====================

// ✅ 404 Handler - Must be before global error handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.path}`,
    timestamp: new Date().toISOString(),
  });
});

// ✅ Global error handler
app.use((err, req, res, next) => {
  console.error("❌ Error:", {
    message: err.message,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });

  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  res.status(statusCode).json({
    success: false,
    message: message,
    // ✅ Only expose error details in development
    error:
      process.env.NODE_ENV === "development"
        ? {
            message: err.message,
            stack: err.stack,
          }
        : undefined,
    timestamp: new Date().toISOString(),
  });
});

// ==================== SERVER START ====================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║   ✅ SERVER STARTED SUCCESSFULLY       ║
╚════════════════════════════════════════╝
 URL: http://localhost:${PORT}
 Environment: ${process.env.NODE_ENV}
 Auth: /api/auth (Rate Limited: 5/15min)
 Clients: /api/clients (Cloudinary uploads)
 Health: /api/health
 
 🔒 Security Features:
 ✓ Helmet enabled
 ✓ Rate limiting enabled (100 req/15min general)
 ✓ Auth rate limiting enabled (5 req/15min)
 ✓ CORS restricted
 ✓ HTTPS ${process.env.NODE_ENV === "production" ? "enforced" : "not enforced (dev mode)"}
 ✓ Cloudinary uploads configured
 ✓ Environment validation enabled
  `);
});
