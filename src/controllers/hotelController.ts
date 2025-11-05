import { Request, Response, NextFunction } from 'express';
import { Hotel } from '../models/Hotel';
import { validationResult } from 'express-validator'; // <-- ADDED

// @desc    Create a new hotel
// @route   POST /api/admin/hotels
export const createHotel = async (req: Request, res: Response, next: NextFunction) => {
  // <-- ADDED VALIDATION CHECK
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { name } = req.body;
    const newHotel = await Hotel.create({ name });
    res.status(201).json({ status: 'success', data: { hotel: newHotel } });
  } catch (error) {
    if ((error as { code: number }).code === 11000) {
      return res.status(409).json({ message: 'A hotel with this name already exists.' });
    }
    next(error);
  }
};

// @desc    Get all hotels
// @route   GET /api/admin/hotels
export const getAllHotels = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hotels = await Hotel.find().sort({ name: 1 });
    res.status(200).json({ status: 'success', results: hotels.length, data: { hotels } });
  } catch (error) {
    next(error);
  }
};

// @desc    Update a hotel
// @route   PUT /api/admin/hotels/:hotelId
export const updateHotel = async (req: Request, res: Response, next: NextFunction) => {
  // <-- ADDED VALIDATION CHECK
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { name } = req.body;
    const hotel = await Hotel.findByIdAndUpdate(
      req.params.hotelId, 
      { name }, 
      { new: true, runValidators: true }
    );

    if (!hotel) {
      return res.status(404).json({ message: 'No hotel found with that ID' });
    }

    res.status(200).json({ status: 'success', data: { hotel } });
  } catch (error) {
    // <-- ADDED DUPLICATE KEY ERROR HANDLING
    if ((error as { code: number }).code === 11000) {
      return res.status(409).json({ message: 'A hotel with this name already exists.' });
    }
    next(error);
  }
};

// @desc    Delete a hotel
// @route   DELETE /api/admin/hotels/:hotelId
export const deleteHotel = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // You may want to add logic here to check if users are assigned
    // to this hotel before allowing deletion.
    const hotel = await Hotel.findByIdAndDelete(req.params.hotelId);

    if (!hotel) {
      return res.status(404).json({ message: 'No hotel found with that ID' });
    }

    res.status(204).json({ status: 'success', data: null });
  } catch (error) {
    next(error);
  }
};