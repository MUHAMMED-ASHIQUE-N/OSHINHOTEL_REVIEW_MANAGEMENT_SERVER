import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { GuestToken } from '../models/GuestToken';
import { Review } from '../models/Review';
import mongoose from 'mongoose';

/**
 * @desc    Validate a guest review token
 * @route   GET /api/public/validate/:token
 * @access  Public
 */
export const validateToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params;

    if (!token || token.length !== 64) { // 32 bytes = 64 hex chars
       return res.status(400).json({ message: 'Invalid token format.' });
    }
    
    // Find the token
    const guestToken = await GuestToken.findOne({
      token: token,
      isUsed: false,
      // expiresAt check is handled by MongoDB's TTL index,
      // but we can add it for an immediate check
      expiresAt: { $gt: new Date() } 
    });

    if (!guestToken) {
      return res.status(404).json({ message: 'This link is invalid or has expired.' });
    }

    // Token is valid, return the category it's for
    res.status(200).json({
      status: 'success',
      category: guestToken.category,
    });

  } catch (error) {
    next(error);
  }
};


/**
 * @desc    Submit a new review using a public token
 * @route   POST /api/public/review
 * @access  Public
 */
export const submitPublicReview = async (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  // Use a Mongoose session for a transaction
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { token, category, answers, description, roomGuestInfo } = req.body;

    if (!token) {
        return res.status(400).json({ message: 'Token is required.' });
    }

    // 1. Find and validate the token *within the transaction*
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

    // 2. Create the new review
    const newReview = new Review({
      staff: guestToken.staff, // ✅ Link review to the staff member who generated the token
      category,
      answers,
      description,
      roomGuestInfo: category === 'room' ? roomGuestInfo : undefined,
    });
    
    await newReview.save({ session });

    // 3. Invalidate (use) the token
    guestToken.isUsed = true;
    await guestToken.save({ session });

    // 4. Commit the transaction
    await session.commitTransaction();
    session.endSession();

    res.status(201).json({ status: 'success', data: { review: newReview } });

  } catch (error) {
    // If anything fails, abort the transaction
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};