// src/models/Composite.ts
import mongoose from 'mongoose';

const compositeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  questions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
    required: true,
  }],
  category: {
    type: String,
    enum: ['room', 'f&b'],
    required: true,
  },
  // ✅ ADDED: Order field
  order: {
    type: Number,
    default: 0,
  },
}, { timestamps: true });

// Optional: Add index for sorting
compositeSchema.index({ category: 1, order: 1 });

export const Composite = mongoose.model('Composite', compositeSchema);