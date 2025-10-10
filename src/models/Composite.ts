// models/Composite.js
import mongoose from 'mongoose';

const compositeSchema = new mongoose.Schema({
  name: { type: String, required: true }, // e.g., "Physical Composite"
  questions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
    required: true,
  }],
}, { timestamps: true });

export const Composite = mongoose.model('Composite', compositeSchema);