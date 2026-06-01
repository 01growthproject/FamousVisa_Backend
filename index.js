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
console.log("MONGODB_URL:", process.env.MONGODB_URL ? "✅ Loaded" : "❌ Missing");

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

// ==================== CORS — SABSE PEHLE ====================
// CORS must be before helmet and HTTPS redirect
// Otherwise preflight OPTIONS requests get redirected → CORS error

const allowedOrigins = [
  "http://localhost:5173",
  "https://famousvisaconsultant.netlify.app",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
  })
);

// Handle preflight requests explicitly

// ==================== SECURITY MIDDLEWARE ====================

app.use(helmet());

// HTTPS redirect — after CORS so preflight isn't redirected
app.use((req, res, next) => {
  if (process.env.NODE_ENV === "production") {
    if (req.header("x-forwarded-proto") !== "https") {
      return res.redirect(`https://${req.header("host")}${req.url}`);
    }
  }
  next();
});

// ==================== RATE LIMITING ====================

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests. Please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(generalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many login attempts. Please try again later.",
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
});

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

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "✅ API is healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/clients", clientRoutes);

// ==================== ERROR HANDLING ====================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.path}`,
    timestamp: new Date().toISOString(),
  });
});

app.use((err, req, res, next) => {
  console.error("❌ Error:", {
    message: err.message,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });

  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  res.status(statusCode).json({
    success: false,
    message,
    error:
      process.env.NODE_ENV === "development"
        ? { message: err.message, stack: err.stack }
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
 ✓ CORS first (preflight fix)
 ✓ Helmet enabled
 ✓ Rate limiting (100 req/15min general)
 ✓ Auth rate limiting (5 req/15min)
 ✓ HTTPS ${process.env.NODE_ENV === "production" ? "enforced" : "not enforced (dev mode)"}
 ✓ Cloudinary uploads configured
  `);
});