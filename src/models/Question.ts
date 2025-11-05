// src/models/Question.ts
import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  order: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  category: {
    type: String,
    // ✅ ADDED 'cfc'
    enum: ['room', 'f&b', 'cfc'],
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

questionSchema.index({ category: 1, order: 1 });
questionSchema.index({ category: 1, isPrimaryIssueIndicator: 1 });

export const Question = mongoose.model('Question', questionSchema);