// models/Review.js
import mongoose from 'mongoose';

const answerSchema = new mongoose.Schema({
  question: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
    required: true,
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 10,
  },
}, { _id: false }); // _id: false prevents subdocuments from getting their own IDs

const reviewSchema = new mongoose.Schema({
  staff: { // The staff member who handled this review
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  answers: [answerSchema],
  guestInfo: { // Optional guest details
    name: { type: String },
    email: { type: String },
    address: { type: String },
  },
}, { timestamps: true }); // `createdAt` is crucial for date-based filtering

export const Review = mongoose.model('Review', reviewSchema);