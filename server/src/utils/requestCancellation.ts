import { isLoadBalancerOperationCancelled } from './loadBalancerOperationStore';
import type { AppRequest as Request, AppResponse as Response } from '../types/http';

export class RequestCancelledError extends Error {
  constructor(message = 'Request cancelled by client') {
    super(message);
    this.name = 'RequestCancelledError';
  }
}

export type RequestCancellation = ReturnType<typeof createRequestCancellation>;

export const createRequestCancellation = (req: Request, res: Response, operationId?: string | null) => {
  let cancelled = false;

  const markCancelled = () => {
    if (!res.writableEnded) {
      cancelled = true;
    }
  };

  req.on('aborted', markCancelled);
  req.on('close', () => {
    if (!res.writableEnded && req.destroyed) {
      cancelled = true;
    }
  });

  return {
    isCancelled: () => cancelled,
    throwIfCancelled: async () => {
      if (cancelled) {
        throw new RequestCancelledError('Request cancelled by client');
      }
      const opCancelled = await isLoadBalancerOperationCancelled(operationId);
      if (opCancelled) {
        throw new RequestCancelledError('Operation cancelled and rolled back');
      }
    },
  };
};
