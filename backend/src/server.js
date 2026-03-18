import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import multer from "multer";

import authRoutes from "./routes/authRoutes.js";
import recordRoutes from "./routes/recordRoutes.js";
import accessRoutes from "./routes/accessRoutes.js";
import doctorRoutes from "./routes/doctorRoutes.js";
import { AppError } from "./utils/appError.js";

const app = express();

const isProd = process.env.NODE_ENV === "production";

function getAllowedOrigins() {
  const urls = [];
  const single = process.env.CLIENT_URL;
  const multi = process.env.CLIENT_URLS;

  if (typeof multi === "string" && multi.trim()) {
    urls.push(
      ...multi
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    );
  }

  if (typeof single === "string" && single.trim()) {
    urls.push(single.trim());
  }

  return Array.from(new Set(urls));
}

app.set("trust proxy", 1);
app.use(helmet());
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);

      const allowed = getAllowedOrigins();
      if (allowed.includes(origin)) return cb(null, true);

      if (!isProd) {
        const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
        if (isLocalhost) return cb(null, true);
      }

      return cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));

app.get("/health", (req, res) => res.json({ ok: true }));
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 100 : 5000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === "OPTIONS",
  message: { message: "Too many requests. Please try again in a bit." },
});
app.use("/api", globalLimiter);

app.use(
  "/api/auth",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.method === "OPTIONS",
    message: { message: "Too many login attempts. Please try again later." },
  })
);

app.use("/api/auth", authRoutes);
app.use("/api/records", recordRoutes);
app.use("/api/access", accessRoutes);
app.use("/api/doctors", doctorRoutes);

app.all("*", (req, res, next) => next(new AppError("Route not found.", 404)));

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const msg =
      err.code === "LIMIT_FILE_SIZE"
        ? "File too large. Max upload size is 10MB."
        : "Upload failed. Please try again.";
    return res.status(400).json({ message: msg });
  }

  const statusCode = err.statusCode || 500;
  const message =
    err.isOperational && err.message
      ? err.message
      : "Something went wrong. Please try again.";

  if (process.env.NODE_ENV !== "production" && !err.isOperational) {
    console.error(err);
  }

  res.status(statusCode).json({ message });
});

const PORT = process.env.PORT || 5000;

async function start() {
  const rawUri = process.env.MONGODB_URI;
  if (!rawUri) throw new Error("Missing MONGODB_URI in environment.");

  const mongoUri = String(rawUri).trim();
  if (!mongoUri.startsWith("mongodb://") && !mongoUri.startsWith("mongodb+srv://")) {
    throw new Error('Invalid MONGODB_URI. It must start with "mongodb://" or "mongodb+srv://".');
  }

  try {
    await mongoose.connect(mongoUri);
  } catch (err) {
    const msg = err?.message || String(err);
    if (/whitelist|not\s+whitelisted|IP that isn'?t whitelisted/i.test(msg)) {
      throw new Error(
        "Could not connect to MongoDB Atlas. Your IP is likely not whitelisted. In Atlas: Network Access → Add IP Address → Allow Access From Anywhere (0.0.0.0/0)."
      );
    }
    throw err;
  }

  const server = app.listen(PORT, () => {
    if (process.env.NODE_ENV !== "production") {
      console.log(`MediVault API running on port ${PORT}`);
    }
  });

  server.on("error", (err) => {
    if (err?.code === "EADDRINUSE") {
      console.error(
        `Port ${PORT} is already in use. Stop the other process using it, or change PORT in backend/.env.`
      );
      process.exit(1);
    }
    console.error("Server error:", err?.message || err);
    process.exit(1);
  });

  const shutdown = async () => {
    try {
      await mongoose.disconnect();
    } catch {}
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1500).unref?.();
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start().catch((err) => {
  console.error("Failed to start server:", err?.message || err);
  process.exit(1);
});

