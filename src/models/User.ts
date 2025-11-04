import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser {
  _id: mongoose.Schema.Types.ObjectId;
  fullName: string;
  username: string;
  password?: string;
  // ✅ ADDED 'staff_cfc'
  role: 'staff' | 'admin' | 'viewer' | 'staff_room' | 'staff_f&b' | 'staff_cfc';
  isActive: boolean;
}

const userSchema = new Schema<IUser>({
  fullName: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true, select: false },
  role: {
    type: String,
    // ✅ ADDED 'staff_cfc'
    enum: ['staff', 'admin', 'viewer', 'staff_room', 'staff_f&b', 'staff_cfc'],
    required: true,
  },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

// Hash password before saving (no changes)
userSchema.pre('save', async function(next) {
  const user = this as IUser & Document; 
  if (!user.isModified('password')) return next();
  
  if (user.password) {
      user.password = await bcrypt.hash(user.password, 12);
  }
  next();
});

export const User = mongoose.model<IUser>('User', userSchema);