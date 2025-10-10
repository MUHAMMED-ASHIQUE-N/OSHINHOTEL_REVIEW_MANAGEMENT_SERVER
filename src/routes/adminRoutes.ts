// routes/adminRoutes.ts
import express from 'express';
import { protect, restrictTo } from '../middleware/authMiddleware';

import userRoutes from './userRoutes';
import managementRoutes from './managementRoutes';
import analyticsRoutes from './analyticsRoutes';

const router = express.Router();

// This middleware will be applied to ALL routes in this file
router.use(protect);
router.use(restrictTo('admin'));

// Mount the specific routers
router.use('/users', userRoutes);
router.use('/management', managementRoutes); // Contains questions and composites
router.use('/analytics', analyticsRoutes);

export default router;