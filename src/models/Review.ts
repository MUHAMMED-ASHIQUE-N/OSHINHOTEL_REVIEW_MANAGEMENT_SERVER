// src/models/Review.ts
import mongoose from 'mongoose';

// Answer schema (includes 'answerText')
const answerSchema = new mongoose.Schema({
  question: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
    required: true,
  },
  rating: {
    type: Number,
    min: 0,
    max: 10,
    optional: true,
  },
  answerBoolean: {
    type: Boolean,
    optional: true,
  },
  answerText: {
    type: String,
    trim: true,
    optional: true,
  }
}, { _id: false });

const reviewSchema = new mongoose.Schema({
  staff: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  category: {
    type: String,
    enum: ['room', 'f&b', 'cfc'],
    required: true,
  },hotelId: { // <-- ADD THIS
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: true,
    index: true, // Good for performance
  },
  answers: [answerSchema],
  description: {
    type: String,
    trim: true,
  },
  // ✅ UPDATED: Renamed and added email
  guestInfo: {
    name: { type: String },
    phone: { type: String },
    roomNumber: { type: String }, // For Room No. or Table No.
    email: { type: String } // ✅ NEW FIELD for F&B/CFC
  },
}, { timestamps: true });

export const Review = mongoose.model('Review', reviewSchema);
