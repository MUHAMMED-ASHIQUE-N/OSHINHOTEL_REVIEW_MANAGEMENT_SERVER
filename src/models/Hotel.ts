// src/models/Hotel.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IHotel extends Document {
  name: string;
}

const hotelSchema = new Schema<IHotel>({
  name: { type: String, required: true, unique: true },
}, { timestamps: true });

export const Hotel = mongoose.model<IHotel>('Hotel', hotelSchema);