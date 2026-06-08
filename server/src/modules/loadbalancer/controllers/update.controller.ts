/**
 * Update Load Balancer Controller
 */

import { createRequestCancellation } from '../../../utils/requestCancellation';
import { beginLoadBalancerOperation, completeLoadBalancerOperation, isLoadBalancerOperationCancelled } from '../../../utils/loadBalancerOperationStore';
import { updateLoadBalancerOrchestrator } from '../orchestrators/update.orchestrator';
import { getValidatedLoadBalancerId } from '../services/validation.service';
import { isCancellationError } from '../services/operation.service';
import type { AppRequest as Request, AppResponse as Response, NextFunction } from '../../../types/http';

export async function updateLoadBalancer(req: Request, res: Response, next: NextFunction) {
  const operationId = req.header('x-operation-id');
  beginLoadBalancerOperation(operationId);
  const cancellation = createRequestCancellation(req, res, operationId);

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

    const result = await updateLoadBalancerOrchestrator({
      userId,
      userEmail: req.user?.email ?? null,
      loadBalancerId: id,
      input: req.body,
      cancellation,
    });

    res.json(result);
  } catch (error: any) {
    if (isCancellationError(error) || cancellation.isCancelled()) {
      if (!res.headersSent) {
        res.status(409).json({
          success: false,
          message: isLoadBalancerOperationCancelled(operationId)
            ? 'Operation cancelled and rolled back'
            : 'Request cancelled by client',
          data: null,
        });
      }
      return;
    }

    if (error.statusCode) {
      res.status(error.statusCode);
    }
    next(error as Error);
  } finally {
    completeLoadBalancerOperation(operationId);
  }
}
