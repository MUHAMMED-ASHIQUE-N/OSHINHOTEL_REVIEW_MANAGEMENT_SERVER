import express, { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import path from "path";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
// import mongoSanitize from "express-mongo-sanitize";
import connectDB from "./config/db";

// --- ROUTE IMPORTS ---
import authRoutes from "./routes/authRoutes";
import adminRoutes from "./routes/adminRoutes";
import userRoutes from "./routes/userRoutes";
import managementRoutes from "./routes/managementRoutes";
import analyticsRoutes from "./routes/analyticsRoutes";
import reviewRoutes from "./routes/reviewRoutes";
import tokenRoutes from "./routes/tokenRoutes"; 
import publicRoutes from "./routes/publicRoutes"; 
import { protect, restrictTo } from "./middleware/authMiddleware";

// --- 1. Load Environment Variables ---
dotenv.config();

const app = express();

// --- 2. GLOBAL MIDDLEWARE ---
app.use(helmet());
app.use(cors());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP, please try again after 15 minutes.",
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api", limiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// app.use(mongoSanitize());

// --- 3. DATABASE CONNECTION ---
connectDB();

// --- 4. API ROUTES ---
app.use("/api/auth", authRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/users", userRoutes);
app.use("/api/management", managementRoutes);
app.use("/api/analytics", protect, restrictTo("admin", "viewer"), analyticsRoutes);
app.use(
  "/api/reviews",
  protect,
  restrictTo("staff", "admin", "staff_room", "staff_f&b"),
  reviewRoutes
);


app.use(
  "/api/token",
  protect,
  restrictTo("staff", "admin", "staff_room", "staff_f&b"),
  tokenRoutes
);
// --- 5. SERVE FRONTEND (React Build) ---
const __dirname1 = path.resolve(); // ✅ get absolute path safely

app.use(express.static(path.join(__dirname1, "client", "build"))); // adjust if build folder is elsewhere
// ✅ Catch-all route: send index.html for any non-API request
app.get(/.*/, (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname1, "client", "build", "index.html"));
});

// --- 6. ERROR HANDLING ---
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error("ERROR 💥", err);
  res.status(500).send("Something went very wrong!");
});

// --- 7. START SERVER ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});
