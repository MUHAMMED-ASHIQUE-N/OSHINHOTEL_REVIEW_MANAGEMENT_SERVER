// models/Question.js
import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
  text: { type: String, required: true }, // e.g., "Cleanliness of Guest room/bath"
  order: { type: Number, default: 0 }, // For sorting questions on the form
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

export const Question = mongoose.model('Question', questionSchema);