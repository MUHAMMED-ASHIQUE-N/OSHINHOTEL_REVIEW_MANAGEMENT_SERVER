// controllers/userController.ts
import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { User } from '../models/User';

// @desc    Create a new user (staff or admin)
// @route   POST /api/admin/users
export const createUser = async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { fullName, username, password, role } = req.body;
        const newUser = await User.create({ fullName, username, password, role });
        
        newUser.password = undefined;

        res.status(201).json({ status: 'success', data: { user: newUser } });
    } catch (error) {
        // Use a type assertion to check the error code for duplicate usernames
        if ((error as { code: number }).code === 11000) { // <-- THIS IS THE FIX
            return res.status(409).json({ message: 'Username already exists.' });
        }
        next(error);
    }
};

// @desc    Get all users
// @route   GET /api/admin/users
export const getAllUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const users = await User.find();
        res.status(200).json({ status: 'success', results: users.length, data: { users } });
    } catch (error) {
        next(error);
    }
};

// @desc    Update a user's details (e.g., name, role, active status)
// @route   PUT /api/admin/users/:userId
export const updateUser = async (req: Request, res: Response, next: NextFunction) => {
    // Do not allow password updates from this endpoint
    const { password, ...updateData } = req.body;

    try {
        const user = await User.findByIdAndUpdate(req.params.userId, updateData, {
            new: true,
            runValidators: true,
        });

        if (!user) {
            return res.status(404).json({ message: 'No user found with that ID' });
        }

        res.status(200).json({ status: 'success', data: { user } });
    } catch (error) {
        next(error);
    }
};

// @desc    Deactivate a user (soft delete)
// @route   DELETE /api/admin/users/:userId
export const deleteUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = await User.findByIdAndUpdate(req.params.userId, { isActive: false });

        if (!user) {
            return res.status(404).json({ message: 'No user found with that ID' });
        }

        res.status(204).json({ status: 'success', data: null });
    } catch (error) {
        next(error);
    }
};

export const getUserStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const totalStaff = await User.countDocuments({ role: 'staff' });
        const activeStaff = await User.countDocuments({ role: 'staff', isActive: true });
        
        res.status(200).json({
            status: 'success',
            data: { totalStaff, activeStaff }
        });
    } catch (error) {
        next(error);
    }
};