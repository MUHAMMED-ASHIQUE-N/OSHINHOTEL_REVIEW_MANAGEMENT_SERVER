import express from 'express';
import { body } from 'express-validator';
import { createUser, getAllUsers, updateUser, deleteUser, getUserStats } from '../controllers/userController';

const router = express.Router();

const createUserValidation = [
  body('fullName').notEmpty().withMessage('Full name is required'),
  body('username').notEmpty().withMessage('Username is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  // ✅ CHANGED: Updated the role validation
  body('role').isIn(['staff', 'admin', 'viewer', 'staff_room', 'staff_f&b']).withMessage('Invalid role specified'),
];

const updateUserValidation = [
  body('fullName').optional().notEmpty().withMessage('Full name is required'),
  body('username').optional().notEmpty().withMessage('Username is required'),
  // ✅ CHANGED: Updated the role validation
  body('role').optional().isIn(['staff', 'admin', 'viewer', 'staff_room', 'staff_f&b']).withMessage('Invalid role specified'),
];

router.get('/stats', getUserStats);

router.route('/')
    .post(createUserValidation, createUser)
    .get(getAllUsers);

router.route('/:userId')
    .put(updateUserValidation, updateUser)
    .delete(deleteUser);

export default router;