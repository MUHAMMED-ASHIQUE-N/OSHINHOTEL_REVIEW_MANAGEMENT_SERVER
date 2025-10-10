// routes/userRoutes.ts
import express from 'express';
import { body } from 'express-validator';
import { createUser, getAllUsers, updateUser, deleteUser,getUserStats } from '../controllers/userController';

const router = express.Router();

const createUserValidation = [
    body('fullName').notEmpty().withMessage('Full name is required'),
    body('username').notEmpty().withMessage('Username is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
    body('role').isIn(['staff', 'admin']).withMessage('Role must be either staff or admin'),
];

const updateUserValidation = [
    body('fullName').optional().notEmpty().withMessage('Full name cannot be empty'),
    body('role').optional().isIn(['staff', 'admin']).withMessage('Role must be either staff or admin'),
];
router.get('/stats', getUserStats); // ✅ Add this line BEFORE the '/:userId' route

router.route('/')
    .post(createUserValidation, createUser)
    .get(getAllUsers);

router.route('/:userId')
    .put(updateUserValidation, updateUser)
    .delete(deleteUser);

export default router;