// src/models/Composite.ts
import mongoose from 'mongoose';

const compositeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  questions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
    required: true,
  }],

  // ✅ ADDED: To distinguish between ROOM and F&B composites
  category: {
    type: String,
    enum: ['room', 'f&b'],
    required: true,
  },
}, { timestamps: true });

export const Composite = mongoose.model('Composite', compositeSchema);