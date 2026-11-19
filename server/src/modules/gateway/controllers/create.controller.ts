import { createRequestCancellation } from '../../../utils/requestCancellation';
import { beginLoadBalancerOperation, completeLoadBalancerOperation, isLoadBalancerOperationCancelled } from '../../../utils/loadBalancerOperationStore';
import { createGatewayOrchestrator } from '../orchestrators/create.orchestrator';
import { isCancellationError } from '../../loadbalancer/services/operation.service';
import { Gateway } from '../../../models/Gateway';
import { getUserPlan } from '../../payment/services/subscription.service';
import { PLANS } from '../../../config/plans';
import type { AppRequest as Request, AppResponse as Response, NextFunction } from '../../../types/http';

function gatewayValidationErrors(body: any, plan: string): string[] {
  const errors: string[] = [];
  if (!body.name || typeof body.name !== 'string' || body.name.trim().length < 3) errors.push('name must be 3-50 lowercase letters, digits and hyphens');
  if (!body.domain || typeof body.domain !== 'string') errors.push('domain is required');
  if (!body.zoneId || typeof body.zoneId !== 'string') errors.push('zoneId is required');
  if (!Array.isArray(body.upstreams) || body.upstreams.length === 0) errors.push('at least one upstream is required');
  if (Array.isArray(body.upstreams)) {
    for (const u of body.upstreams) {
      if (!u.url || !/^https?:\/\//.test(u.url)) errors.push(`upstream url "${u.url}" must start with http:// or https://`);
    }
  }
  if (Array.isArray(body.pathRoutes)) {
    for (const r of body.pathRoutes) {
      if (!r.path || typeof r.path !== 'string') errors.push('each pathRoute must have a path');
      if (typeof r.upstreamIndex !== 'number' || r.upstreamIndex < 0) errors.push('each pathRoute must have a valid upstreamIndex');
    }
  }
  if (Array.isArray(body.mockRoutes)) {
    for (const m of body.mockRoutes) {
      if (!m.path || typeof m.path !== 'string') errors.push('each mockRoute must have a path');
      if (typeof m.status !== 'number' || m.status < 200 || m.status > 599) errors.push('each mockRoute must have a valid status');
    }
  }
  if (Array.isArray(body.ipRules)) {
    for (const r of body.ipRules) {
      if (!r.value || typeof r.value !== 'string') errors.push('each ipRule must have a value');
      if (!['allow', 'deny'].includes(r.action)) errors.push('each ipRule action must be allow or deny');
    }
  }
  if (body.placement !== undefined && body.placement !== null) {
    if (typeof body.placement !== 'object') {
      errors.push('placement must be an object');
    } else {
      if (body.placement.smartPlacement !== undefined && typeof body.placement.smartPlacement !== 'boolean') {
        errors.push('smartPlacement must be a boolean');
      }
      if (body.placement.region !== undefined && body.placement.region !== null && typeof body.placement.region !== 'string') {
        errors.push('region must be a string');
      }
    }
  }
  return errors;
}

export async function createGateway(req: Request, res: Response, next: NextFunction) {
  const operationId = req.header('x-operation-id');
  await beginLoadBalancerOperation(operationId);
  const cancellation = createRequestCancellation(req, res, operationId);

  try {
    const userId = req.user?.userId;
    if (!userId) { res.status(401); throw new Error('Not authenticated'); }

    const { plan } = await getUserPlan(userId);
    const config = PLANS[plan];

    if (config.maxGateways !== -1 && config.maxGateways > 0) {
      const count = await Gateway.countDocuments({ userId });
      if (count >= config.maxGateways) {
        res.status(400);
        throw new Error(`Your ${config.name} plan allows ${config.maxGateways} gateway${config.maxGateways === 1 ? '' : 's'}. Upgrade to create more.`);
      }
    }

    const body = req.body;
    if (body.jwtAuth?.enabled && !config.hasJwtAuth) {
      res.status(400); throw new Error('JWT validation requires a paid plan.');
    }
    if (body.cacheConfig?.enabled && !config.hasCaching) {
      res.status(400); throw new Error('Response caching requires a paid plan.');
    }
    if (body.canary?.enabled && !config.hasCanary) {
      res.status(400); throw new Error('Canary splitting is a Pro feature.');
    }

    if (config.maxGatewayRoutes !== -1 && Array.isArray(body.pathRoutes) && body.pathRoutes.length > config.maxGatewayRoutes) {
      res.status(400); throw new Error(`Your ${config.name} plan allows ${config.maxGatewayRoutes} routing rules per gateway.`);
    }
    if (config.maxGatewayRateLimitRules !== -1 && Array.isArray(body.pathRateLimits) && body.pathRateLimits.length > config.maxGatewayRateLimitRules) {
      res.status(400); throw new Error(`Your ${config.name} plan allows ${config.maxGatewayRateLimitRules} rate limit rule(s) per gateway.`);
    }
    if (config.maxGatewayHeaderRules !== -1) {
      const headerCount = (body.headerTransforms?.request?.set?.length ?? 0) + (body.headerTransforms?.request?.remove?.length ?? 0) + (body.headerTransforms?.response?.set?.length ?? 0) + (body.headerTransforms?.response?.remove?.length ?? 0);
      if (headerCount > config.maxGatewayHeaderRules) {
        res.status(400); throw new Error(`Your ${config.name} plan allows ${config.maxGatewayHeaderRules} header transform rules per gateway.`);
      }
    }
    if (config.maxGatewayIpRules !== -1 && Array.isArray(body.ipRules) && body.ipRules.length > config.maxGatewayIpRules) {
      res.status(400); throw new Error(`Your ${config.name} plan allows ${config.maxGatewayIpRules} IP rules per gateway.`);
    }
    if (config.maxGatewayMockRoutes !== -1 && Array.isArray(body.mockRoutes) && body.mockRoutes.length > config.maxGatewayMockRoutes) {
      res.status(400); throw new Error(`Your ${config.name} plan allows ${config.maxGatewayMockRoutes} mock routes per gateway.`);
    }

    if (body.rateLimitEnabled && !config.hasRateLimit) {
      res.status(400); throw new Error('Rate limiting requires an EdgeBalancer Pro subscription');
    }
    if ((body.rateLimitKeyType === 'header' || body.rateLimitKeyType === 'jwt') && !config.hasIdentityRateLimit) {
      res.status(400); throw new Error('Identity-based rate limiting requires a Student or Pro plan.');
    }
    if (Array.isArray(body.bffRoutes) && body.bffRoutes.length > 0 && !config.hasBffAggregation) {
      res.status(400); throw new Error('BFF Multi-Upstream Aggregation is a Pro feature.');
    }
    if (body.shadowConfig?.enabled && !config.hasTrafficShadowing) {
      res.status(400); throw new Error('Traffic Shadowing is a Pro feature.');
    }
    if (body.jwtAuth?.injectHeaders && !config.hasHeaderInjection) {
      res.status(400); throw new Error('Downstream Header Injection is a Pro feature.');
    }
    if (config.maxRbacRules !== -1 && Array.isArray(body.jwtAuth?.rbacRules) && body.jwtAuth.rbacRules.length > config.maxRbacRules) {
      res.status(400); throw new Error(`Your ${config.name} plan allows ${config.maxRbacRules} RBAC rule(s).`);
    }
    if (config.maxBodyShapingRules !== -1 && Array.isArray(body.bodyTransforms) && body.bodyTransforms.length > config.maxBodyShapingRules) {
      res.status(400); throw new Error(`Your ${config.name} plan allows ${config.maxBodyShapingRules} payload transform rule(s).`);
    }
    if (config.maxSchemaRules !== -1 && Array.isArray(body.schemaRules) && body.schemaRules.length > config.maxSchemaRules) {
      res.status(400); throw new Error(`Your ${config.name} plan allows ${config.maxSchemaRules} schema validation rule(s).`);
    }

    if (!config.canEditPlacement) {
      req.body.placement = { smartPlacement: true };
    }

    const errors = gatewayValidationErrors(body, plan);
    if (errors.length) { res.status(400); throw new Error(errors.join('; ')); }

    const result = await createGatewayOrchestrator({ userId, userEmail: req.user?.email ?? null, operationId, input: body, cancellation });
    res.status(201).json(result);
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
