import mongoose from 'mongoose';
import { Session } from '../../../models/Session';
import type { AppRequest as Request, AppResponse as Response, NextFunction } from '../../../types/http';

export async function listSessions(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401);
      throw new Error('Not authenticated');
    }

    const { cursor, limit: limitStr, filter } = req.query as Record<string, string>;
    const limit = Math.min(parseInt(limitStr || '20', 10), 50);

    const query: Record<string, any> = { userId: new mongoose.Types.ObjectId(userId) };

    if (filter === 'active') query.isActive = true;
    else if (filter === 'inactive') query.isActive = false;

    if (cursor) {
      if (!mongoose.Types.ObjectId.isValid(cursor)) {
        res.status(400);
        throw new Error('Invalid cursor');
      }
      query._id = { $lt: new mongoose.Types.ObjectId(cursor) };
    }

    const sessions = await Session.find(query)
      .select('-content')
      .sort({ _id: -1 })
      .limit(limit + 1);

    const hasMore = sessions.length > limit;
    if (hasMore) sessions.pop();

    const nextCursor = hasMore ? sessions[sessions.length - 1]._id.toString() : null;

    res.json({
      success: true,
      message: 'Sessions retrieved successfully',
      data: { sessions, nextCursor, hasMore },
    });
  } catch (error) {
    if ((error as any).statusCode) res.status((error as any).statusCode);
    next(error as Error);
  }
}

