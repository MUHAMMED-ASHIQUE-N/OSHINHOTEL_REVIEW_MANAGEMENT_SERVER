import express from 'express';
import { body } from 'express-validator';
import { validateToken, submitPublicReview } from '../controllers/publicController';

const router = express.Router();

// --- Validation for public review ---
const createReviewValidation = [
  body('category').isIn(['room', 'f&b']).withMessage('Category is required'),
  body('token').isHexadecimal().isLength({ min: 64, max: 64 }).withMessage('Invalid token'),
  body('answers').isArray().withMessage('Answers must be an array'),
  // You can add more validation here if needed
];

// GET /api/public/validate/:token
router.get('/validate/:token', validateToken);

// POST /api/public/review
router.post('/review', createReviewValidation, submitPublicReview);

export default router;