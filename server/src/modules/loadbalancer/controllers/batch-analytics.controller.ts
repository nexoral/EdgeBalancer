import { LoadBalancer } from '../../../models/LoadBalancer';
import { getCloudflareCredentialsForUser } from '../services/credentials.service';
import { fetchWorkerAnalytics, type WorkerAnalytics } from '../services/analytics.service';
import type { AppRequest as Request, AppResponse as Response, NextFunction } from '../../../types/http';
import { getRedisClient } from '../../../utils/redisClient';

export async function getBatchLoadBalancerAnalytics(req: Request, res: Response, next: NextFunction) {
  const  redis = await getRedisClient();
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401);
      throw new Error('Not authenticated');
    }

    const rawPeriod = req.query?.period;
    const period: '24h' | '7d' = rawPeriod === '7d' ? '7d' : '24h';

    // Check  Redis for cached analytics data
    const cacheKey = `analytics:${userId}:${period}:batch`;
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      res.json({
        success: true,
        message: 'Analytics retrieved successfully (from cache)',
        data: { analytics: JSON.parse(cachedData) },
      });
      return;
    }


    const { accountId, apiToken } = await getCloudflareCredentialsForUser(userId);

    const loadBalancers = await LoadBalancer.find({ userId, status: 'active' }).select('_id scriptName');

    const settled = await Promise.allSettled(
      loadBalancers.map(lb =>
        fetchWorkerAnalytics({ accountId, apiToken, scriptName: lb.scriptName, period })
      )
    );

    const analytics: Record<string, WorkerAnalytics | null> = {};
    loadBalancers.forEach((lb, i) => {
      const result = settled[i];
      analytics[lb._id.toString()] = result.status === 'fulfilled' ? result.value : null;
    });

    // Cache the analytics data in Redis for 10 minutes
    try {
      const setResult = await redis.set(cacheKey, JSON.stringify(analytics), {
        expiration: { type: 'EX', value: 600 }
      });
      console.log('Cache set result:', setResult); // should be "OK"
    } catch (err) {
      console.error('Cache set FAILED:', err);
    }


    res.json({
      success: true,
      message: 'Analytics retrieved successfully',
      data: { analytics },
    });
  } catch (error) {
    console.error('Error occurred while fetching batch analytics:', error);
    next(error as Error);
  }
}
