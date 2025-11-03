import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser {
  _id: mongoose.Schema.Types.ObjectId;
  fullName: string;
  username: string;
  password?: string;
  // ✅ CHANGED: Expanded the role enum
  role: 'staff' | 'admin' | 'viewer' | 'staff_room' | 'staff_f&b';
  isActive: boolean;
}

const userSchema = new Schema<IUser>({
  fullName: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true, select: false },
  role: {
    type: String,
    // ✅ CHANGED: Added new roles to the database enum
    enum: ['staff', 'admin', 'viewer', 'staff_room', 'staff_f&b'],
    required: true,
  },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

// Hash password before saving (no changes here)
userSchema.pre('save', async function(next) {
  const user = this as IUser & Document; 
  if (!user.isModified('password')) return next();
  
  if (user.password) {
      user.password = await bcrypt.hash(user.password, 12);
  }
  next();
});

export const User = mongoose.model<IUser>('User', userSchema);