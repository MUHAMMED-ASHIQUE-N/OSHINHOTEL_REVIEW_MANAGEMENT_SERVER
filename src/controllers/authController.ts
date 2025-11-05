import { User, IUser } from '../models/User';
import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { validationResult } from 'express-validator';
import { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';

// Define the same custom Request type here for the 'getMe' function
interface RequestWithUser extends Request {
  user?: IUser;
}

// Helper interface for the populated hotel object
interface IHotelPopulated {
  _id: mongoose.Schema.Types.ObjectId;
  name: string;
}

const signToken = (
  id: string | mongoose.Types.ObjectId | mongoose.Schema.Types.ObjectId,
  role: string,
  hotelId: mongoose.Schema.Types.ObjectId | null | undefined
): string => {
  const secret: Secret = process.env.JWT_SECRET || 'default_secret_key';
  const expiresIn = (process.env.JWT_EXPIRES_IN?.trim() || '90d') as SignOptions['expiresIn'];

  return jwt.sign({ id, role, hotelId }, secret, { expiresIn });
};

// POST /api/auth/login
export const login = async (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username })
      .select('+password +hotelId')
      .populate('hotelId'); // This gets the hotel name

    if (!user || !user.password || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Incorrect username or password.' });
    }

    // <-- THIS IS THE FIX -->
    // We cast user.hotelId to our populated interface type (IHotelPopulated)
    // so TypeScript understands it's an object with an _id property.
    const populatedHotel = user.hotelId as IHotelPopulated | undefined;

    const token = signToken(user._id, user.role, populatedHotel?._id); 
    
    user.password = undefined;

    res.status(200).json({
      status: 'success',
      token,
      data: { user }, // This 'user' object now contains the full hotelId object
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/auth/me
export const getMe = async (req: RequestWithUser, res: Response, next: NextFunction) => {
  try {
    const user = await User.findById(req.user?._id).populate('hotelId');

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.status(200).json({
      status: 'success',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};