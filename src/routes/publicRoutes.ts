// routes/publicRoutes.ts
import express from 'express';
import { body } from 'express-validator';
import { getAllQuestions, createReview } from '../controllers/publicController';

const router = express.Router();

// Validation rules for the review submission POST request
const createReviewValidation = [
  // staffId must be a non-empty, valid MongoDB ObjectId string
  body('staffId', 'Staff ID is required').notEmpty().isMongoId().withMessage('Invalid Staff ID format'),

  // answers must be an array with at least one item
  body('answers', 'Answers must be a non-empty array').isArray({ min: 1 }),

  // Validate each object inside the 'answers' array
  body('answers.*.questionId', 'Each answer must have a valid question ID').notEmpty().isMongoId(),
  body('answers.*.rating', 'Each rating must be a whole number between 1 and 10').isInt({ min: 1, max: 10 }),

  // Optional validation for guestInfo
  body('guestInfo.name', 'Guest name must be a string').optional().isString().trim(),
  body('guestInfo.email', 'Please provide a valid email address').optional({ checkFalsy: true }).isEmail().normalizeEmail(),
  body('guestInfo.address', 'Guest address must be a string').optional().isString().trim(),
];

// --- ROUTES ---

// Route to get all active questions
router.get('/questions', getAllQuestions);

// Route to post a new review, protected by the validation middleware
router.post('/reviews', createReviewValidation, createReview);

export default router;