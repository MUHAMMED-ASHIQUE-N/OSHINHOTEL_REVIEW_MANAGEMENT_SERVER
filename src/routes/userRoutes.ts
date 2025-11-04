import express from 'express';
import { body } from 'express-validator';
import { createUser, getAllUsers, updateUser, deleteUser, getUserStats } from '../controllers/userController';
import { IUser } from '../models/User';

const router = express.Router();

const roles: IUser['role'][] = ['staff', 'admin', 'viewer', 'staff_room', 'staff_f&b', 'staff_cfc'];

const createUserValidation = [
  body('fullName').notEmpty().withMessage('Full name is required'),
  body('username').notEmpty().withMessage('Username is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  // ✅ UPDATED
  body('role').isIn(roles).withMessage('Invalid role specified'),
];

const updateUserValidation = [
  body('fullName').optional().notEmpty().withMessage('Full name is required'),
  body('username').optional().notEmpty().withMessage('Username is required'),
  // ✅ UPDATED
  body('role').optional().isIn(roles).withMessage('Invalid role specified'),
];

router.get('/stats', getUserStats);
router.route('/').post(createUserValidation, createUser).get(getAllUsers);
router.route('/:userId').put(updateUserValidation, updateUser).delete(deleteUser);

export default router;