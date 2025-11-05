// src/controllers/tokenController.ts

import { Request, Response, NextFunction } from 'express';
import { GuestToken } from '../models/GuestToken';
import { IUser } from '../models/User';

interface RequestWithUser extends Request {
  user?: IUser;
}

export const generateToken = async (req: RequestWithUser, res: Response, next: NextFunction) => {
  try {
    const staffUser = req.user;
    if (!staffUser) {
      return res.status(401).json({ message: 'User not found.' });
    }

    // ✅ ADDED logic for 'staff_cfc'
    let category: 'room' | 'f&b' | 'cfc';
    if (staffUser.role === 'staff_room') {
      category = 'room';
    } else if (staffUser.role === 'staff_f&b') {
      category = 'f&b';
    } else if (staffUser.role === 'staff_cfc') {
      category = 'cfc';
    } else if (staffUser.role === 'admin') {
      category = (req.body.category as 'room' | 'f&b' | 'cfc') || 'room';
    } else {
      return res.status(403).json({ message: 'User role cannot generate tokens.' });
    }

    const guestToken = new GuestToken({
      staff: staffUser._id,
      category: category,
      hotelId: staffUser.hotelId // <-- ADD THIS
    });

    await guestToken.save();

    res.status(201).json({
      status: 'success',
      token: guestToken.token,
    });

  } catch (error) {
    next(error);
  }
};