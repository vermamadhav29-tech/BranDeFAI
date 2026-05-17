import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";

import authRoutes from "./routes/auth";
import brandRoutes from "./routes/brand";
import strategyRoutes from "./routes/strategy";
import contentRoutes from "./routes/content";
import imagesRoutes from "./routes/images";
import videosRoutes from "./routes/videos";
import calendarRoutes from "./routes/calendar";
import paymentsRoutes from "./routes/payments";
import creditsRoutes from "./routes/credits";
import uploadsRoutes from "./routes/uploads";
import instagramRoutes from "./routes/instagram";
import { errorHandler } from "./middleware/errorHandler";

const app = express();
const PORT = process.env.PORT || 5000;

// Security & parsing middleware
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(morgan("dev"));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiter: 100 requests per 15 minutes per IP
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, data: null, error: "Too many requests, please try again later." },
  })
);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/brand", brandRoutes);
app.use("/api/strategy", strategyRoutes);
app.use("/api/content", contentRoutes);
app.use("/api/images", imagesRoutes);
app.use("/api/videos", videosRoutes);
app.use("/api/calendar", calendarRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/credits", creditsRoutes);
app.use("/api/uploads", uploadsRoutes);
app.use("/api/instagram", instagramRoutes);

// Global error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
