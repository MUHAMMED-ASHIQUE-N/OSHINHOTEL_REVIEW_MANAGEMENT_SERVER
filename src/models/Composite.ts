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
    // ✅ ADDED 'cfc'
    enum: ['room', 'f&b', 'cfc'],
    required: true,
  },
  order: {
    type: Number,
    default: 0,
  },
  isActive: { // ✅ ADD THIS
    type: Boolean,
    default: true
  },
}, { timestamps: true });

compositeSchema.index({ category: 1, order: 1 });

export const Composite = mongoose.model('Composite', compositeSchema);