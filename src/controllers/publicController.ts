import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { GuestToken } from '../models/GuestToken';
import { Review } from '../models/Review';
import mongoose from 'mongoose';

export const validateToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params;
    if (!token || token.length !== 64) {
       return res.status(400).json({ message: 'Invalid token format.' });
    }
    
    const guestToken = await GuestToken.findOne({
      token: token,
      isUsed: false,
      expiresAt: { $gt: new Date() } 
    });

    if (!guestToken) {
      return res.status(404).json({ message: 'This link is invalid or has expired.' });
    }

    res.status(200).json({
      status: 'success',
      category: guestToken.category, // Will now also return 'cfc'
    });
  } catch (error) {
    next(error);
  }
};

export const submitPublicReview = async (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // ✅ FIX: Read 'guestInfo' from the body
    const { token, category, answers, description, guestInfo } = req.body;

    if (!token) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ message: 'Token is required.' });
    }

    const guestToken = await GuestToken.findOne({
      token: token,
      isUsed: false,
      expiresAt: { $gt: new Date() }
    }).session(session);

    if (!guestToken) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'This link is invalid, expired, or has already been used.' });
    }

    const newReview = new Review({
      staff: guestToken.staff,
      category,
      answers, 
      description,
      guestInfo: guestInfo, // ✅ FIX: Save the 'guestInfo' object
    });
    
    await newReview.save({ session });

    guestToken.isUsed = true;
    await guestToken.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({ status: 'success', data: { review: newReview } });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};