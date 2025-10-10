//authController.ts

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

const signToken = (
  id: string | mongoose.Types.ObjectId | mongoose.Schema.Types.ObjectId,
  role: string
): string => {
  const secret: Secret = process.env.JWT_SECRET || 'default_secret_key';
  const expiresIn = (process.env.JWT_EXPIRES_IN?.trim() || '90d') as SignOptions['expiresIn'];

  return jwt.sign({ id, role }, secret, { expiresIn });
};

// POST /api/auth/login
export const login = async (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username }).select('+password');

    // **FIX 1:** Check for user and user.password before calling bcrypt.
    // This satisfies TypeScript's null/undefined checks.
    if (!user || !user.password || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Incorrect username or password.' });
    }

    // Now TypeScript knows 'user' is not null.
const token = signToken(user._id, user.role);

    user.password = undefined;

    res.status(200).json({
      status: 'success',
      token,
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/auth/me
export const getMe = async (req: RequestWithUser, res: Response, next: NextFunction) => {
  try {
    // **FIX 2:** Access req.user safely because 'req' is now of type RequestWithUser.
    // **FIX 3:** Use '_id' which is the correct property from the Mongoose document.
    const user = await User.findById(req.user?._id);

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