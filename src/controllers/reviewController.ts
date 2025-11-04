
// src/controllers/reviewController.ts
import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { Question } from '../models/Question';
import { Review } from '../models/Review';
import { IUser } from '../models/User'; // Import IUser

// Custom Request type to get req.user
interface RequestWithUser extends Request {
  user?: IUser;
}

export const getQuestionsByCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const category = req.params.category;
   if (category !== 'room' && category !== 'f&b' && category !== 'cfc') {
      return res.status(400).json({ message: 'Invalid category.' });
    }
    
    const questions = await Question.find({ isActive: true, category: category }).sort('order');
    res.status(200).json({ status: 'success', data: { questions } });
  } catch (error) { next(error); }
};

// src/controllers/reviewController.ts

export const createReview = async (req: RequestWithUser, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    // ✅ FIX 1: Read 'guestInfo' from the body
    const { category, answers, description, guestInfo } = req.body; 
    
    const newReview = await Review.create({
      staff: req.user?._id,
      category,
      answers,
      description,
      // ✅ FIX 2: Save the 'guestInfo' object.
      // (This assumes your Mongoose model's field is named 'guestInfo')
      guestInfo: guestInfo, 
    });

    res.status(201).json({ status: 'success', data: { review: newReview } });
  } catch (error) { next(error); }
};