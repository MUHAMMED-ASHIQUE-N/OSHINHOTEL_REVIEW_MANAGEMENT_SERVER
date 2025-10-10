// models/User.ts
import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

// 1. Define the interface for the user's data properties.
//    It should NOT extend mongoose.Document. This represents the raw object.
export interface IUser {
  _id: mongoose.Schema.Types.ObjectId; // <-- ADD THIS LINE
  fullName: string;
  username: string;
  password?: string;
  role: 'staff' | 'admin';
  isActive: boolean;
}
// 2. Create the Mongoose schema using the IUser interface for type safety.
const userSchema = new Schema<IUser>({
  fullName: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true, select: false },
  role: {
    type: String,
    enum: ['staff', 'admin'],
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