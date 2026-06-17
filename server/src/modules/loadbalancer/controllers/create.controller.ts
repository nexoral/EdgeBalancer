/**
 * Create Load Balancer Controller
 */

import { createRequestCancellation } from '../../../utils/requestCancellation';
import { beginLoadBalancerOperation, completeLoadBalancerOperation, isLoadBalancerOperationCancelled } from '../../../utils/loadBalancerOperationStore';
import { createLoadBalancerOrchestrator } from '../orchestrators/create.orchestrator';
import { isCancellationError } from '../services/operation.service';
import type { AppRequest as Request, AppResponse as Response, NextFunction } from '../../../types/http';

export async function createLoadBalancer(req: Request, res: Response, next: NextFunction) {
  const operationId = req.header('x-operation-id');
  await beginLoadBalancerOperation(operationId);
  const cancellation = createRequestCancellation(req, res, operationId);

  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401);
      throw new Error('Not authenticated');
    }

    const result = await createLoadBalancerOrchestrator({
      userId,
      userEmail: req.user?.email ?? null,
      operationId,
      input: req.body,
      cancellation,
    });

    res.status(201).json(result);
  } catch (error) {
    if (isCancellationError(error) || cancellation.isCancelled()) {
      if (!res.headersSent) {
        res.status(409).json({
          success: false,
          message: (await isLoadBalancerOperationCancelled(operationId))
            ? 'Operation cancelled and rolled back'
            : 'Request cancelled by client',
          data: null,
        });
      }
      return;
    }

    if ((error as any).statusCode) {
      res.status((error as any).statusCode);
    }
    next(error as Error);
  } finally {
    await completeLoadBalancerOperation(operationId);
  }
}
