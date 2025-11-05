import express from 'express';
import * as hotelController from '../controllers/hotelController';
import { body } from 'express-validator'; // <-- ADDED

const router = express.Router();

// Validation for hotel name
const hotelValidation = [
  body('name').notEmpty().withMessage('Hotel name is required').trim(),
];

// Routes for creating and listing hotels
router.route('/')
  .post(hotelValidation, hotelController.createHotel)
  .get(hotelController.getAllHotels);

// Routes for updating and deleting a specific hotel
router.route('/:hotelId')
  .put(hotelValidation, hotelController.updateHotel)
  .delete(hotelController.deleteHotel);

export default router;