import express from 'express';
import { body } from 'express-validator';
import { validateToken, submitPublicReview } from '../controllers/publicController';

const router = express.Router();

const createReviewValidation = [
  body('category').isIn(['room', 'f&b', 'cfc']).withMessage('Category is required'),
  body('token').isHexadecimal().isLength({ min: 64, max: 64 }).withMessage('Invalid token'),
  body('answers').isArray().withMessage('Answers must be an array'),
  body('description').optional().isString().trim(),

  // --- ✅ START: Correct Guest Info Validation ---

  // 1. The guestInfo object must exist for all categories
  body('guestInfo').exists({ checkFalsy: true }).withMessage('Guest info is required.'),

  // 2. Conditional validation for 'room'
  body('guestInfo.name')
    .if(body('category').equals('room'))
    .notEmpty().withMessage('Guest name is required for room reviews.'),
  body('guestInfo.phone')
    .if(body('category').equals('room'))
    .notEmpty().withMessage('Guest phone is required for room reviews.'),
  body('guestInfo.roomNumber')
    .if(body('category').equals('room'))
    .notEmpty().withMessage('Guest room number is required for room reviews.'),

  // 3. Conditional validation for 'f&b' and 'cfc'
  body('guestInfo.email')
    .if(body('category').isIn(['f&b', 'cfc']))
    .isEmail().withMessage('A valid guest email is required for this category.'),

  // --- ✅ END: Correct Guest Info Validation ---
];

router.get('/validate/:token', validateToken);
router.post('/review', createReviewValidation, submitPublicReview);

export default router;