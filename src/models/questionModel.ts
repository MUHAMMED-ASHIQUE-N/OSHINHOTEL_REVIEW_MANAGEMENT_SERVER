import mongoose from "mongoose";

const questionSchema = new mongoose.Schema(
  {
    questionText: { type: String, required: true, trim: true },
    rating: { type: Number, min: 0, max: 10, default: 0 },
    isActive: { type: Boolean, default: true },
    order: { type: Number, required: true, default: 1 },
  },
  {
    timestamps: true, // Automatically manages createdAt and updatedAt fields
  }
);

export const Question = mongoose.model("Question", questionSchema);
  
