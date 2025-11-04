import mongoose, { Schema, Document } from 'mongoose';
import crypto from 'crypto';

export interface IGuestToken extends Document {
  token: string;
  staff: mongoose.Schema.Types.ObjectId;
  // ✅ ADDED 'cfc'
  category: 'room' | 'f&b' | 'cfc';
  isUsed: boolean;
  expiresAt: Date;
}

const guestTokenSchema = new Schema<IGuestToken>({
  token: {
    type: String,
    unique: true,
    index: true,
  },
  staff: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  category: {
    type: String,
    // ✅ ADDED 'cfc'
    enum: ['room', 'f&b', 'cfc'],
    required: true,
  },
  isUsed: {
    type: Boolean,
    default: false,
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
  },
}, { timestamps: true });

// TTL Index
guestTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Pre-save hook to generate token
guestTokenSchema.pre<IGuestToken>('save', function(next) {
  if (!this.isNew || this.token) {
    return next();
  }
  this.token = crypto.randomBytes(32).toString('hex');
  next();
});

export const GuestToken = mongoose.model<IGuestToken>('GuestToken', guestTokenSchema);