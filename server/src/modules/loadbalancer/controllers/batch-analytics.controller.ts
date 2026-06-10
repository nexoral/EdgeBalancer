import { LoadBalancer } from '../../../models/LoadBalancer';
import { getCloudflareCredentialsForUser } from '../services/credentials.service';
import { fetchWorkerAnalytics, type WorkerAnalytics } from '../services/analytics.service';
import type { AppRequest as Request, AppResponse as Response, NextFunction } from '../../../types/http';

export async function getBatchLoadBalancerAnalytics(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401);
      throw new Error('Not authenticated');
    }

    const rawPeriod = req.query?.period;
    const period: '24h' | '7d' = rawPeriod === '7d' ? '7d' : '24h';

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

    res.json({
      success: true,
      message: 'Analytics retrieved successfully',
      data: { analytics },
    });
  } catch (error) {
    next(error as Error);
  }
}
