// src/models/Review.ts

import mongoose from 'mongoose';

// ✅ UPDATED: The answer schema now supports two types of answers
const answerSchema = new mongoose.Schema({
  question: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
    required: true,
  },
  // For 'rating' type questions
  rating: {
    type: Number,
    min: 1,
    max: 10,
    optional: true, // Make optional
  },
  // For 'yes_no' type questions
  answerBoolean: {
    type: Boolean,
    optional: true, // Make optional
  },
}, { _id: false });

const reviewSchema = new mongoose.Schema({
  staff: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // ✅ ADDED: To distinguish the type of review
  category: {
    type: String,
    enum: ['room', 'f&b'],
    required: true,
  },
  answers: [answerSchema],
  
  // ✅ ADDED: Optional text description for the experience
  description: {
    type: String,
    trim: true,
  },
  
  // ✅ ADDED: Specific info required only for 'room' reviews
  roomGuestInfo: {
    name: { type: String },
    phone: { type: String },
    roomNumber: { type: String },
  },
}, { timestamps: true });

// ✅ REMOVED: The old 'guestInfo' is replaced by 'roomGuestInfo'

export const Review = mongoose.model('Review', reviewSchema);