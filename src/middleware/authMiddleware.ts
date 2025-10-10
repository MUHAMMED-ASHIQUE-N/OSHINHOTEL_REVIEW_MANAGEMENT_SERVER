import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { User } from '../models/User';
import { IUser } from '../models/User'; // Make sure IUser is exported from your User model

// --- This is the key fix ---
// Define a custom Request interface that includes our 'user' property.
interface RequestWithUser extends Request {
  user?: IUser;
}
// --------------------------

interface JwtPayloadWithId extends JwtPayload {
  id: string;
}

export const protect = async (req: RequestWithUser, res: Response, next: NextFunction) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ message: 'You are not logged in.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayloadWithId;

    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
      return res.status(401).json({ message: 'The user for this token no longer exists.' });
    }

    // This now works because 'req' is of type RequestWithUser
    req.user = currentUser;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
};

export const restrictTo = (...roles: string[]) => {
  // Also apply the custom Request type here
  return (req: RequestWithUser, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        message: 'You do not have permission to perform this action.'
      });
    }
    next();
  };
};