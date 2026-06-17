/**
 * Cancel Load Balancer Operation Controller
 */

import { cancelLoadBalancerOperation } from '../../../utils/loadBalancerOperationStore';
import type { AppRequest as Request, AppResponse as Response, NextFunction } from '../../../types/http';

export async function cancelLoadBalancerDeployment(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401);
      throw new Error('Not authenticated');
    }

    const rawOperationId = req.params.operationId;
    const operationId = Array.isArray(rawOperationId) ? rawOperationId[0] : rawOperationId;
    if (!operationId) {
      res.status(400);
      throw new Error('Operation id is required');
    }

    const accepted = await cancelLoadBalancerOperation(operationId);

    res.json({
      success: true,
      message: accepted ? 'Cancellation requested' : 'Operation already completed',
      data: {
        accepted,
      },
    });
  } catch (error) {
    next(error as Error);
  }
}
