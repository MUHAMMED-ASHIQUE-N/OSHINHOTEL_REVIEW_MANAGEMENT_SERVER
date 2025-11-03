import mongoose, { Schema, Document } from 'mongoose';
import crypto from 'crypto'; // Import crypto for generating the token

export interface IGuestToken extends Document {
  token: string;
  staff: mongoose.Schema.Types.ObjectId; // Staff member who created it
  category: 'room' | 'f&b'; // Category associated with the staff
  isUsed: boolean;
  expiresAt: Date;
}

const guestTokenSchema = new Schema<IGuestToken>({
  token: {
    type: String,
    // required: true, // <-- REMOVE THIS LINE
    unique: true,
    index: true, // Add index for faster lookups
  },
  staff: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  category: {
    type: String,
    enum: ['room', 'f&b'],
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

// TTL Index (no change)
guestTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Pre-save hook to generate token (no change)
guestTokenSchema.pre<IGuestToken>('save', function(next) {
  // Only generate token if it's a new document AND token isn't already set
  if (!this.isNew || this.token) {
    return next();
  }
  
  this.token = crypto.randomBytes(32).toString('hex');
  next();
});


export const GuestToken = mongoose.model<IGuestToken>('GuestToken', guestTokenSchema);