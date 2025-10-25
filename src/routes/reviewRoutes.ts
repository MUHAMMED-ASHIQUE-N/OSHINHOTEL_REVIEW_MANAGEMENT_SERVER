// src/routes/reviewRoutes.ts
import express from 'express';
import { body } from 'express-validator';
import { getQuestionsByCategory, createReview } from '../controllers/reviewController';

const router = express.Router();

// Validation for the new review submission
const createReviewValidation = [
  body('category').isIn(['room', 'f&b']).withMessage('Category is required'),
  body('answers', 'Answers must be a non-empty array').isArray({ min: 1 }),
  body('description', 'Description must be a string').optional().isString().trim(),
  
  // Custom validator to check roomGuestInfo
  body().custom((value, { req }) => {
    if (req.body.category === 'room') {
      if (!req.body.roomGuestInfo) {
        throw new Error('Guest info (name, phone, room) is required for room reviews.');
      }
      if (!req.body.roomGuestInfo.name || !req.body.roomGuestInfo.phone || !req.body.roomGuestInfo.roomNumber) {
        throw new Error('Guest name, phone, and room number are all required.');
      }
    }
    return true;
  }),
];

// GET /api/reviews/questions/room
// GET /api/reviews/questions/f&b
router.get('/questions/:category', getQuestionsByCategory);

// POST /api/reviews/
router.post('/', createReviewValidation, createReview);

export default router;