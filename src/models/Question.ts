// src/models/Question.ts
import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  order: { type: Number, default: 0 }, // ✅ Includes order
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
  isPrimaryIssueIndicator: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

// ✅ ADDED: Index for category and order sorting
questionSchema.index({ category: 1, order: 1 });
questionSchema.index({ category: 1, isPrimaryIssueIndicator: 1 });

export const Question = mongoose.model('Question', questionSchema);