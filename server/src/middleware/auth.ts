import { verifyToken } from '../utils/jwt';
import type { AppHandler } from '../types/http';

export const authenticate: AppHandler = async (req, res, next): Promise<void> => {
  try {
    // Get token from httpOnly cookie
    const token = req.cookies?.token;

    if (!token) {
      res.status(401);
      throw new Error('Authentication required');
    }

    // Verify token
    const payload = verifyToken(token);
    req.user = payload;

    next();
  } catch (error) {
    res.status(401);
    next(error as Error);
  }
};

