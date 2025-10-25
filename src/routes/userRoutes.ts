// routes/userRoutes.ts
import express from 'express';
import { body } from 'express-validator';
import { createUser, getAllUsers, updateUser, deleteUser,getUserStats } from '../controllers/userController';

const router = express.Router();

const createUserValidation = [
  // ... (fullName, username, password) ...
  body('role').isIn(['staff', 'admin', 'viewer']).withMessage('Role must be staff, admin, or viewer'), // ✅ UPDATED
];

const updateUserValidation = [
  // ... (fullName) ...
  body('role').optional().isIn(['staff', 'admin', 'viewer']).withMessage('Role must be staff, admin, or viewer'), // ✅ UPDATED
];
router.get('/stats', getUserStats); // ✅ Add this line BEFORE the '/:userId' route

router.route('/')
    .post(createUserValidation, createUser)
    .get(getAllUsers);

router.route('/:userId')
    .put(updateUserValidation, updateUser)
    .delete(deleteUser);

export default router;