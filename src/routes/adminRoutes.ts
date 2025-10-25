// src/routes/adminRoutes.ts
import express from 'express';
import { protect, restrictTo } from '../middleware/authMiddleware';
import userRoutes from './userRoutes';
import managementRoutes from './managementRoutes';
// import analyticsRoutes from './analyticsRoutes'; // 1. REMOVED

const router = express.Router();

router.use(protect);
router.use(restrictTo('admin'));

router.use('/users', userRoutes);
router.use('/management', managementRoutes);
// router.use('/analytics', analyticsRoutes); // 2. REMOVED

export default router;