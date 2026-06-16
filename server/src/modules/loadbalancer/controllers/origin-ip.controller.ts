/**
 * Origin IP Lookup Controller
 *
 * Returns the original raw IP URL for a hostname that was auto-converted
 * from a raw IP origin. Looks up ipOriginRecords stored in the LB document.
 */

import { LoadBalancer } from '../../../models/LoadBalancer';
import { getValidatedLoadBalancerId } from '../services/validation.service';
import type { AppRequest as Request, AppResponse as Response, NextFunction } from '../../../types/http';

export async function getOriginIp(req: Request, res: Response, next: NextFunction) {
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

    const hostname = (req.query as Record<string, string>).hostname?.trim();
    if (!hostname) {
      res.status(400);
      throw new Error('hostname query parameter is required');
    }

    const loadBalancer = await LoadBalancer.findById(id);
    if (!loadBalancer) {
      res.status(404);
      throw new Error('Load balancer not found');
    }

    if (loadBalancer.userId.toString() !== userId) {
      res.status(403);
      throw new Error('You do not have permission to access this load balancer');
    }

    const record = (loadBalancer.ipOriginRecords ?? []).find(r => r.hostname === hostname);
    if (!record) {
      res.status(404);
      throw new Error('No IP record found for this hostname');
    }

    res.json({
      success: true,
      message: 'IP record retrieved',
      data: { originalUrl: record.originalUrl },
    });
  } catch (error) {
    if ((error as any).statusCode) {
      res.status((error as any).statusCode);
    }
    next(error as Error);
  }
}
