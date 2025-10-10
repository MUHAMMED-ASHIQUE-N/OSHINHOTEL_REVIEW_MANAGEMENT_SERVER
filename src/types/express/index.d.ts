// src/types/express/index.d.ts

// Make sure this import path correctly points to your User model file!
import { IUser } from '../../models/User'; 

// This tells TypeScript to add the 'user' property to the global Express Request type
declare global {
  namespace Express {
    export interface Request {
      user?: IUser; 
    }
  }
}