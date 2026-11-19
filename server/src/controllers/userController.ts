import { User } from '../models/User';
import { getMaskedCredentials } from '../services/credentialsService';
import { toUserPayload } from '../utils/authSession';
import type { AppRequest as Request, AppResponse as Response, NextFunction } from '../types/http';

export const getProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401);
      throw new Error('Not authenticated');
    }

    const user = await User.findById(userId).populate('paymentId');
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }

    // Get masked Cloudflare credentials
    const maskedCreds = await getMaskedCredentials(userId);

    res.json({
      success: true,
      message: 'Profile retrieved successfully',
      data: {
        user: {
          ...toUserPayload(user),
          cloudflareAccountId: maskedCreds?.accountId || null,
          cloudflareApiToken: maskedCreds?.apiToken || null,
          createdAt: user.createdAt,
        },
      },
    });
  } catch (error) {
    next(error as Error);
  }
};

