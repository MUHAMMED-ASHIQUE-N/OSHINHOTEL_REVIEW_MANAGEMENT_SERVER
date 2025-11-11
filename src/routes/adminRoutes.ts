import express from 'express';
import { protect, restrictTo } from '../middleware/authMiddleware';
import userRoutes from './userRoutes';
import managementRoutes from './managementRoutes';
import hotelRoutes from './hotelRoutes'; // <-- ADD THIS

const router = express.Router();

// Protect all admin route
router.use(protect);
router.use(restrictTo('admin')); // <-- This correctly protects all routes for 'admin'

// Mount existing routes
router.use('/users', userRoutes);
router.use('/management', managementRoutes);

// Mount hotel management routes at /api/admin/hotels
router.use('/hotels', hotelRoutes); 

export default router;