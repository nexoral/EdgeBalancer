import { LoadBalancer } from '../../../models/LoadBalancer';
import { getValidatedLoadBalancerId } from '../services/validation.service';
import { getCloudflareCredentialsForUser } from '../services/credentials.service';
import { fetchWorkerAnalytics } from '../services/analytics.service';
import {getRedisClient} from '../../../utils/redisClient';
import type { AppRequest as Request, AppResponse as Response, NextFunction } from '../../../types/http';

export async function getLoadBalancerAnalytics(req: Request, res: Response, next: NextFunction) {
  const  redis = await getRedisClient();
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401);
      throw new Error('Not authenticated');
    }

    let id: string;
    try {
      id = getValidatedLoadBalancerId(req.params.id);
    } catch (error: any) {
      res.status(400);
      throw error;
    }

    const lb = await LoadBalancer.findById(id);
    if (!lb) {
      res.status(404);
      throw new Error('Load balancer not found');
    }
    if (lb.userId.toString() !== userId) {
      res.status(403);
      throw new Error('You do not have permission to access this load balancer');
    }

    const rawPeriod = req.query?.period;
    const period: '24h' | '7d' = rawPeriod === '7d' ? '7d' : '24h';

    const { accountId, apiToken } = await getCloudflareCredentialsForUser(userId);

    // Check  Redis for cached analytics data
    const cacheKey = `analytics:${lb.scriptName}:${period}`;
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      res.json({
        success: true,
        message: 'Analytics retrieved successfully (from cache)',
        data: { analytics: JSON.parse(cachedData) },
      });
      return;
    }

    const analytics = await fetchWorkerAnalytics({ accountId, apiToken, scriptName: lb.scriptName, period });

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
    if ((error as any).statusCode) {
      res.status((error as any).statusCode);
    }
    next(error as Error);
  }
};;