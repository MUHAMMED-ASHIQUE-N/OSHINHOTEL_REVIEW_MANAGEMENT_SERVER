// src/models/User.ts

import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser {
  _id: mongoose.Schema.Types.ObjectId;
  fullName: string;
  username: string;
  password?: string;
  // ✅ ADDED 'viewer' to the allowed roles
  role: 'staff' | 'admin' | 'viewer'; 
  isActive: boolean;
}

const userSchema = new Schema<IUser>({
  fullName: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true, select: false },
  role: {
    type: String,
    // ✅ ADDED 'viewer' to the enum
    enum: ['staff', 'admin', 'viewer'],
    required: true,
  },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });
// 3. Hash password before saving. This remains the same.
userSchema.pre('save', async function(next) {
  // Mongoose schemas have their own context, so we can't use an arrow function here.
  // We must cast 'this' to access the password property with type safety.
  const user = this as IUser & Document; 
  if (!user.isModified('password')) return next();
  
  if (user.password) {
      user.password = await bcrypt.hash(user.password, 12);
  }
  next();
});

// 4. Create and export the model.
//    The resulting model will correctly have both IUser properties and Document methods.
export const User = mongoose.model<IUser>('User', userSchema);