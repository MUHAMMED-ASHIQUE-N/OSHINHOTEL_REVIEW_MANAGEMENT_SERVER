// routes/managementRoutes.ts
import express from 'express';
import { body } from 'express-validator';
import * as questionController from '../controllers/questionController';
import * as compositeController from '../controllers/compositeController';

const router = express.Router();

// --- Question Routes ---
const questionValidation = [
  body('text').notEmpty().withMessage('Question text is required'),
  // ✅ ADDED validation for new fields
  body('category').isIn(['room', 'f&b']).withMessage('Category must be room or f&b'),
  body('questionType').optional().isIn(['rating', 'yes_no']).withMessage('Question type must be rating or yes_no'),
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
  // ✅ ADDED validation for new field
  body('category').isIn(['room', 'f&b']).withMessage('Category must be room or f&b'),
];
router.route('/composites')
    .post(compositeValidation, compositeController.createComposite)
    .get(compositeController.getAllComposites);
router.route('/composites/:compositeId')
    .put(compositeValidation, compositeController.updateComposite)
    .delete(compositeController.deleteComposite);

export default router;