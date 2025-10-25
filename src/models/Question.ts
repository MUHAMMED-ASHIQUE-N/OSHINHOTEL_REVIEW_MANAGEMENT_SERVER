// src/models/Question.ts
import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  order: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  category: {
    type: String,
    enum: ['room', 'f&b'],
    required: true,
  },
  questionType: {
    type: String,
    enum: ['rating', 'yes_no'],
    default: 'rating',
  },
  // ✅ ADDED: Flag to identify the main problem indicator question
  isPrimaryIssueIndicator: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

// Optional: Add index for faster lookups if you have many questions
questionSchema.index({ category: 1, isPrimaryIssueIndicator: 1 });

export const Question = mongoose.model('Question', questionSchema);