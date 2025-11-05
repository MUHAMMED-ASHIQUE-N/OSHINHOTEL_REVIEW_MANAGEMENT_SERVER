import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { User, IUser } from '../models/User'; // <-- MODIFIED: Import IUser

// <-- ADDED: Define a custom Request type to access req.user
interface RequestWithUser extends Request {
    user?: IUser;
}

// @desc    Create a new user (staff or admin)
// @route   POST /api/admin/users
export const createUser = async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        // <-- MODIFIED: Get hotelId from body
        const { fullName, username, password, role, hotelId } = req.body;
        // <-- ADDED: Get the admin who is creating this user
        const creator = (req as RequestWithUser).user;

        let newUsersHotelId = hotelId; // Default to hotelId from request body

        // <-- ADDED: Security check
        if (creator && creator.hotelId) {
            // If the creator is a Hotel Admin (not Super Admin),
            // force the new user to be in the *same* hotel.
            newUsersHotelId = creator.hotelId;
        }

        const newUser = await User.create({
            fullName,
            username,
            password,
            role,
            hotelId: newUsersHotelId // <-- MODIFIED: Use the new hotelId
        });

        newUser.password = undefined;

        res.status(201).json({ status: 'success', data: { user: newUser } });
    } catch (error) {
        if ((error as { code: number }).code === 11000) {
            return res.status(409).json({ message: 'Username already exists.' });
        }
        next(error);
    }
};

// @desc    Get all users
// @route   GET /api/admin/users
export const getAllUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // <-- ADDED: Get the logged-in user
        const loggedInUser = (req as RequestWithUser).user;

        let queryFilter = {}; // Default: Super Admin sees all

        if (loggedInUser && loggedInUser.hotelId) {
            // <-- ADDED: If user is a Hotel Admin, only find users in their hotel
            queryFilter = { hotelId: loggedInUser.hotelId };
        }

        const users = await User.find(queryFilter); // <-- MODIFIED: Apply filter
        res.status(200).json({ status: 'success', results: users.length, data: { users } });
    } catch (error) {
        next(error);
    }
};

// @desc    Update a user's details
// @route   PUT /api/admin/users/:userId
export const updateUser = async (req: Request, res: Response, next: NextFunction) => {
    const { password, ...updateData } = req.body;
    // <-- ADDED: Get the logged-in user
    const loggedInUser = (req as RequestWithUser).user;

    // <-- ADDED: Base filter for the user ID
    const filter: any = { _id: req.params.userId };

    if (loggedInUser && loggedInUser.hotelId) {
        // <-- ADDED: If Hotel Admin, they can ONLY update users in their hotel
        filter.hotelId = loggedInUser.hotelId;
    }

    try {
        const user = await User.findOneAndUpdate(filter, updateData, { // <-- MODIFIED: Use filter
            new: true,
            runValidators: true,
        });

        if (!user) {
            // <-- MODIFIED: This now protects against editing users in other hotels
            return res.status(404).json({ message: 'No user found with that ID or you do not have permission.' });
        }

        res.status(200).json({ status: 'success', data: { user } });
    } catch (error) {
        next(error);
    }
};

// @desc    Deactivate a user (soft delete)
// @route   DELETE /api/admin/users/:userId
export const deleteUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // <-- ADDED: Get the logged-in user
        const loggedInUser = (req as RequestWithUser).user;

        // <-- ADDED: Base filter for the user ID
        const filter: any = { _id: req.params.userId };

        if (loggedInUser && loggedInUser.hotelId) {
            // <-- ADDED: If Hotel Admin, they can ONLY delete users in their hotel
            filter.hotelId = loggedInUser.hotelId;
        }

        const user = await User.findOneAndUpdate(filter, { isActive: false }); // <-- MODIFIED: Use filter

        if (!user) {
            // <-- MODIFIED: This now protects against deleting users in other hotels
            return res.status(404).json({ message: 'No user found with that ID or you do not have permission.' });
        }

        res.status(204).json({ status: 'success', data: null });
    } catch (error) {
        next(error);
    }
};

export const getUserStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // <-- ADDED: Get the logged-in user
        const loggedInUser = (req as RequestWithUser).user;

        // <-- ADDED: Base filters
        const filter: any = { role: { $ne: 'admin' } }; // Filter for non-admin roles
        const activeFilter: any = { role: { $ne: 'admin' }, isActive: true };

        if (loggedInUser && loggedInUser.hotelId) {
            // <-- ADDED: If Hotel Admin, only count staff in their hotel
            filter.hotelId = loggedInUser.hotelId;
            activeFilter.hotelId = loggedInUser.hotelId;
        }

        const totalStaff = await User.countDocuments(filter); // <-- MODIFIED: Use filter
        const activeStaff = await User.countDocuments(activeFilter); // <-- MODIFIED: Use filter

        res.status(200).json({
            status: 'success',
            data: { totalStaff, activeStaff }
        });
    } catch (error) {
        next(error);
    }
};