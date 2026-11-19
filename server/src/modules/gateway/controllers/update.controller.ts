import { createRequestCancellation } from '../../../utils/requestCancellation';
import { beginLoadBalancerOperation, completeLoadBalancerOperation, isLoadBalancerOperationCancelled } from '../../../utils/loadBalancerOperationStore';
import { updateGatewayOrchestrator } from '../orchestrators/update.orchestrator';
import { isCancellationError } from '../../loadbalancer/services/operation.service';
import { getValidatedGatewayId } from '../services/validation.service';
import { getUserPlan } from '../../payment/services/subscription.service';
import { PLANS } from '../../../config/plans';
import { Gateway } from '../../../models/Gateway';
import type { AppRequest as Request, AppResponse as Response, NextFunction } from '../../../types/http';

export async function updateGateway(req: Request, res: Response, next: NextFunction) {
  const operationId = req.header('x-operation-id');
  await beginLoadBalancerOperation(operationId);
  const cancellation = createRequestCancellation(req, res, operationId);

  try {
    const userId = req.user?.userId;
    if (!userId) { res.status(401); throw new Error('Not authenticated'); }

    const id = getValidatedGatewayId(req.params?.id);
    const body = req.body;

    const { plan } = await getUserPlan(userId);
    const config = PLANS[plan];

    const existing = await Gateway.findOne({ _id: id, userId }).lean() as any;
    if (!existing) {
      res.status(404);
      throw new Error('Gateway not found');
    }
    const merged: any = {
      jwtAuth: body.jwtAuth ?? existing.jwtAuth,
      cacheConfig: body.cacheConfig ?? existing.cacheConfig,
      canary: body.canary ?? existing.canary,
      pathRoutes: body.pathRoutes ?? existing.pathRoutes ?? [],
      pathRateLimits: body.pathRateLimits ?? existing.pathRateLimits ?? [],
      headerTransforms: body.headerTransforms ?? existing.headerTransforms,
      ipRules: body.ipRules ?? existing.ipRules ?? [],
      mockRoutes: body.mockRoutes ?? existing.mockRoutes ?? [],
      rateLimitEnabled: body.rateLimitEnabled ?? existing.rateLimitEnabled,
    };
    const mergedHeaderCount =
      (merged.headerTransforms?.request?.set?.length ?? 0) +
      (merged.headerTransforms?.request?.remove?.length ?? 0) +
      (merged.headerTransforms?.response?.set?.length ?? 0) +
      (merged.headerTransforms?.response?.remove?.length ?? 0);

    if (merged.jwtAuth?.enabled && !config.hasJwtAuth) {
      res.status(400); throw new Error('JWT validation requires a paid plan.');
    }
    if (merged.cacheConfig?.enabled && !config.hasCaching) {
      res.status(400); throw new Error('Response caching requires a paid plan.');
    }
    if (merged.canary?.enabled && !config.hasCanary) {
      res.status(400); throw new Error('Canary splitting is a Pro feature.');
    }
    if (config.maxGatewayRoutes !== -1 && merged.pathRoutes.length > config.maxGatewayRoutes) {
      res.status(400); throw new Error(`Your ${config.name} plan allows ${config.maxGatewayRoutes} routing rules per gateway.`);
    }
    if (config.maxGatewayRateLimitRules !== -1 && merged.pathRateLimits.length > config.maxGatewayRateLimitRules) {
      res.status(400); throw new Error(`Your ${config.name} plan allows ${config.maxGatewayRateLimitRules} rate limit rule(s) per gateway.`);
    }
    if (config.maxGatewayHeaderRules !== -1 && mergedHeaderCount > config.maxGatewayHeaderRules) {
      res.status(400); throw new Error(`Your ${config.name} plan allows ${config.maxGatewayHeaderRules} header transform rules per gateway.`);
    }
    if (config.maxGatewayIpRules !== -1 && merged.ipRules.length > config.maxGatewayIpRules) {
      res.status(400); throw new Error(`Your ${config.name} plan allows ${config.maxGatewayIpRules} IP rules per gateway.`);
    }
    if (config.maxGatewayMockRoutes !== -1 && merged.mockRoutes.length > config.maxGatewayMockRoutes) {
      res.status(400); throw new Error(`Your ${config.name} plan allows ${config.maxGatewayMockRoutes} mock routes per gateway.`);
    }
    if (merged.rateLimitEnabled && !config.hasRateLimit) {
      res.status(400); throw new Error('Rate limiting requires an EdgeBalancer Pro subscription');
    }
    const effectiveKeyType = body.rateLimitKeyType ?? existing.rateLimitKeyType;
    if ((effectiveKeyType === 'header' || effectiveKeyType === 'jwt') && !config.hasIdentityRateLimit) {
      res.status(400); throw new Error('Identity-based rate limiting requires a Student or Pro plan.');
    }
    const effectiveBff = body.bffRoutes ?? existing.bffRoutes ?? [];
    if (Array.isArray(effectiveBff) && effectiveBff.length > 0 && !config.hasBffAggregation) {
      res.status(400); throw new Error('BFF Multi-Upstream Aggregation is a Pro feature.');
    }
    const effectiveShadow = body.shadowConfig ?? existing.shadowConfig;
    if (effectiveShadow?.enabled && !config.hasTrafficShadowing) {
      res.status(400); throw new Error('Traffic Shadowing is a Pro feature.');
    }
    if (merged.jwtAuth?.injectHeaders && !config.hasHeaderInjection) {
      res.status(400); throw new Error('Downstream Header Injection is a Pro feature.');
    }
    if (config.maxRbacRules !== -1 && Array.isArray(merged.jwtAuth?.rbacRules) && merged.jwtAuth.rbacRules.length > config.maxRbacRules) {
      res.status(400); throw new Error(`Your ${config.name} plan allows ${config.maxRbacRules} RBAC rule(s).`);
    }
    const effectiveTransforms = body.bodyTransforms ?? existing.bodyTransforms ?? [];
    if (config.maxBodyShapingRules !== -1 && Array.isArray(effectiveTransforms) && effectiveTransforms.length > config.maxBodyShapingRules) {
      res.status(400); throw new Error(`Your ${config.name} plan allows ${config.maxBodyShapingRules} payload transform rule(s).`);
    }
    const effectiveSchemas = body.schemaRules ?? existing.schemaRules ?? [];
    if (config.maxSchemaRules !== -1 && Array.isArray(effectiveSchemas) && effectiveSchemas.length > config.maxSchemaRules) {
      res.status(400); throw new Error(`Your ${config.name} plan allows ${config.maxSchemaRules} schema validation rule(s).`);
    }

    if (!config.canEditPlacement) {
      req.body.placement = existing.placement ?? { smartPlacement: true };
    }

    const result = await updateGatewayOrchestrator({ userId, userEmail: req.user?.email ?? null, gatewayId: id, input: body, cancellation });
    res.json(result);
  } catch (error) {
    if (isCancellationError(error) || cancellation.isCancelled()) {
      if (!res.headersSent) {
        res.status(409).json({
          success: false,
          message: (await isLoadBalancerOperationCancelled(operationId)) ? 'Operation cancelled and rolled back' : 'Request cancelled by client',
          data: null,
        });
      }
      return;
    }
    if ((error as any).statusCode) res.status((error as any).statusCode);
    next(error as Error);
  } finally {
    await completeLoadBalancerOperation(operationId);
  }
}
