import express from 'express';
import { body } from 'express-validator';
import * as questionController from '../controllers/questionController';
import * as compositeController from '../controllers/compositeController';

const router = express.Router();

// --- Question Routes ---
const questionValidation = [
  body('text').notEmpty().withMessage('Question text is required'),
  body('category').isIn(['room', 'f&b', 'cfc']).withMessage('Category must be room, f&b, or cfc'),
  body('questionType').optional().isIn(['rating', 'yes_no']).withMessage('Question type must be rating or yes_no'),
  // ✅ ADDED order validation
  body('order').optional().isInt({ min: 0 }).withMessage('Order must be a non-negative number'),
];
router.route('/questions')
    .post(questionValidation, questionController.createQuestion)
    .get(questionController.getAllQuestions);
router.route('/questions/:questionId')
    .put(questionValidation, questionController.updateQuestion)
    .delete(questionController.deleteQuestion);

// --- Composite Routes ---
const compositeValidation = [
  body('name').notEmpty().withMessage('Composite name is required'),
  body('questions').isArray({min: 1}).withMessage('Composites must contain at least one question ID'),
  body('questions.*').isMongoId().withMessage('Invalid question ID in array'),
  body('category').isIn(['room', 'f&b', 'cfc']).withMessage('Category must be room, f&b, or cfc'),
  // ✅ ADDED order validation
  body('order').optional().isInt({ min: 0 }).withMessage('Order must be a non-negative number'),
];
router.route('/composites')
    .post(compositeValidation, compositeController.createComposite)
    .get(compositeController.getAllComposites);
router.route('/composites/:compositeId')
    .put(compositeValidation, compositeController.updateComposite)
    .delete(compositeController.deleteComposite);

export default router;