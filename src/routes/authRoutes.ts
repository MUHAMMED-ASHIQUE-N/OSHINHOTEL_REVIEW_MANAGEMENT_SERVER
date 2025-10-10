// routes/authRoutes.js
import express from 'express';
import { body } from 'express-validator';
import { login, getMe } from '../controllers/authController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

// Input validation for the login route
const loginValidation = [
  body('username', 'Username is required').not().isEmpty().trim(),
  body('password', 'Password is required').exists(),
];

// POST /api/auth/login
router.post('/login', loginValidation, login);

// GET /api/auth/me
// The 'protect' middleware runs first. If the token is valid, it calls getMe.
router.get('/me', protect, getMe);

export default router;