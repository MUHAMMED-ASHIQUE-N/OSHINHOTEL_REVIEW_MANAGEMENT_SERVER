// controllers/publicController.ts
import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { Question } from '../models/Question'; // Adjust path as needed
import { Review } from '../models/Review';   // Adjust path as needed

// Interface for the createReview request body for improved type safety
interface CreateReviewBody {
  staffId: string;
  answers: {
    questionId: string;
    rating: number;
  }[];
  guestInfo?: {
    name?: string;
    email?: string;
    address?: string;
  };
}

/**
 * @desc    Get all active questions, sorted by display order
 * @route   GET /api/public/questions
 * @access  Public
 */
export const getAllQuestions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Find only active questions and sort them by the 'order' field
    const questions = await Question.find({ isActive: true }).sort('order');

    res.status(200).json({
      status: 'success',
      results: questions.length,
      data: {
        questions,
      },
    });
  } catch (error) {
    next(error); // Pass errors to the global error handler
  }
};

/**
 * @desc    Create a new review
 * @route   POST /api/public/reviews
 * @access  Public
 */
export const createReview = async (
  req: Request<{}, {}, CreateReviewBody>,
  res: Response,
  next: NextFunction
) => {
  // 1. Handle validation errors from the middleware
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { staffId, answers, guestInfo } = req.body;

    // 2. Create a new review document in the database
    const newReview = await Review.create({
      staff: staffId,
      // Map the incoming answers array to match the schema structure
      answers: answers.map(ans => ({ question: ans.questionId, rating: ans.rating })),
      guestInfo,
    });

    // 3. Send a success response with the created data
    res.status(201).json({
      status: 'success',
      data: {
        review: newReview,
      },
    });
  } catch (error) {
    next(error);
  }
};