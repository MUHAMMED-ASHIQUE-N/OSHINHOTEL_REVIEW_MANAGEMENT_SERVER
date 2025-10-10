// server.ts
import express, { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import connectDB from "./config/db";

// Security Middleware
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';

// Route Imports
import authRoutes from './routes/authRoutes';
import publicRoutes from './routes/publicRoutes'; // 1. Import the new router
import adminRoutes from './routes/adminRoutes'; // Example for admin routes
import userRoutes from './routes/userRoutes'; // Example for user routes
import managementRoutes from './routes/managementRoutes'; // Example for management routes
import analyticsRoutes from './routes/analyticsRoutes'; // Example for analytics routes

// 1. Load Environment Variables FIRST
dotenv.config();

const app = express();

// --- 2. GLOBAL MIDDLEWARE (in order) ---

// Set security HTTP headers
app.use(helmet());

// Enable CORS
app.use(cors()); // Configure with specific options for production

// Rate Limiting to prevent brute-force/DDoS attacks
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests from this IP, please try again after 15 minutes.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
app.use('/api', limiter);

// Body Parsers: To parse req.body. MUST be before routes.
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Data Sanitization against NoSQL Injection. MUST be after body parsers and before routes.
// app.use(mongoSanitize());

// --- 3. DATABASE CONNECTION ---
connectDB();

// --- 4. ROUTES ---
app.use('/api/auth', authRoutes);
app.use('/api/public', publicRoutes); // 2. Add the public routes to the app
app.use('/api/admin', adminRoutes); // Example for admin routes
app.use('/api/users', userRoutes); // Add other routes here, e.g., app.use('/api/users', userRoutes);
app.use('/api/management', managementRoutes); // Add other routes here, e.g., app.use('/api/management', managementRoutes);
app.use('/api/analytics', analyticsRoutes); // Add other routes here, e.g., app.use('/api/analytics', analyticsRoutes);


// Add other routes here, e.g., app.use('/api/reviews', reviewRoutes);

// --- 5. UNHANDLED ROUTE (404) HANDLER ---
// This will catch any request that doesn't match the routes defined above
app.use((req: Request, res: Response) => {
    res.status(404).json({ message: "API route not found" });
});

// --- 6. GLOBAL ERROR HANDLER ---
// This should be the LAST piece of middleware.
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('ERROR 💥', err);
  // Send a generic message for unknown errors to avoid leaking implementation details
  res.status(500).send('Something went very wrong!');
});

// --- 7. START SERVER ---
const PORT = process.env.PORT || 5000; // Added a fallback port

app.listen(PORT, ()=> {
    console.log(`Server is running on port ${PORT}`);
});