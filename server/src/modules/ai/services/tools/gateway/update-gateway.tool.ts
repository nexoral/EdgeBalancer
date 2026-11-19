import { tool } from '@langchain/core/tools';
import { PLANS } from '../../../../../config/plans';
import { getUserPlan } from '../../../../payment/services/subscription.service';
import { updateGatewayOrchestrator } from '../../../../gateway/orchestrators/update.orchestrator';
import { fail, ok } from '../shared';
import type { ToolContext } from '../types';
import { GATEWAY_CONFIG_PROPERTIES } from './schemas';
import { findOwnedGateway } from './find-owned';

export function updateGatewayTool(ctx: ToolContext) {
  return tool(
    async (input: any) => {
      const { id, ...config } = input;
      if (config.rateLimitEnabled !== true && config.rateLimitRequestsPerMinute === 0) delete config.rateLimitRequestsPerMinute;

      const existing = await findOwnedGateway(ctx, id);
      if (!existing) return fail('Gateway not found.');

      const merged: any = {
        name: existing.name,
        domain: config.domain ?? existing.domain,
        subdomain: config.subdomain ?? existing.subdomain,
        zoneId: config.zoneId ?? existing.zoneId,
        upstreams: config.upstreams ?? existing.upstreams,
        pathRoutes: config.pathRoutes ?? existing.pathRoutes ?? [],
        corsEnabled: config.corsEnabled ?? existing.corsEnabled,
        corsOrigins: config.corsOrigins ?? existing.corsOrigins,
        jwtAuth: config.jwtAuth !== undefined ? config.jwtAuth : (existing as any).jwtAuth,
        headerTransforms: config.headerTransforms ?? (existing as any).headerTransforms,
        cacheConfig: config.cacheConfig ?? (existing as any).cacheConfig,
        canary: config.canary ?? (existing as any).canary,
        ipRules: config.ipRules ?? (existing as any).ipRules ?? [],
        mockRoutes: config.mockRoutes ?? (existing as any).mockRoutes ?? [],
        rateLimitEnabled: config.rateLimitEnabled ?? existing.rateLimitEnabled,
        rateLimitRequestsPerMinute: config.rateLimitRequestsPerMinute ?? existing.rateLimitRequestsPerMinute,
        pathRateLimits: config.pathRateLimits ?? existing.pathRateLimits ?? [],
        placement: (config as any).placement ?? existing.placement ?? { smartPlacement: true },
      };

      const { plan: up } = await getUserPlan(ctx.userId);
      const upCfg = PLANS[up];
      if (!upCfg.canEditPlacement) merged.placement = existing.placement ?? { smartPlacement: true };
      if (merged.jwtAuth?.enabled && !upCfg.hasJwtAuth) return fail('JWT validation requires a paid plan.');
      if (merged.cacheConfig?.enabled && !upCfg.hasCaching) return fail('Response caching requires a paid plan.');
      if (merged.canary?.enabled && !upCfg.hasCanary) return fail('Canary splitting is a Pro feature.');
      if (merged.rateLimitEnabled && !upCfg.hasRateLimit) return fail('Rate limiting requires an EdgeBalancer Pro subscription');
      if (upCfg.maxGatewayRoutes !== -1 && merged.pathRoutes.length > upCfg.maxGatewayRoutes) return fail(`Your ${upCfg.name} plan allows ${upCfg.maxGatewayRoutes} routing rules per gateway.`);
      if (upCfg.maxGatewayRateLimitRules !== -1 && merged.pathRateLimits.length > upCfg.maxGatewayRateLimitRules) return fail(`Your ${upCfg.name} plan allows ${upCfg.maxGatewayRateLimitRules} rate limit rule(s) per gateway.`);
      const hc = (merged.headerTransforms?.request?.set?.length ?? 0) + (merged.headerTransforms?.request?.remove?.length ?? 0) + (merged.headerTransforms?.response?.set?.length ?? 0) + (merged.headerTransforms?.response?.remove?.length ?? 0);
      if (upCfg.maxGatewayHeaderRules !== -1 && hc > upCfg.maxGatewayHeaderRules) return fail(`Your ${upCfg.name} plan allows ${upCfg.maxGatewayHeaderRules} header transform rules per gateway.`);
      if (upCfg.maxGatewayIpRules !== -1 && (merged.ipRules?.length ?? 0) > upCfg.maxGatewayIpRules) return fail(`Your ${upCfg.name} plan allows ${upCfg.maxGatewayIpRules} IP rules per gateway.`);
      if (upCfg.maxGatewayMockRoutes !== -1 && (merged.mockRoutes?.length ?? 0) > upCfg.maxGatewayMockRoutes) return fail(`Your ${upCfg.name} plan allows ${upCfg.maxGatewayMockRoutes} mock routes per gateway.`);

      const result = await updateGatewayOrchestrator({
        userId: ctx.userId, userEmail: ctx.userEmail, gatewayId: id, input: merged, cancellation: ctx.cancellation,
      });

      ctx.touched.push(result.data.gateway);
      return ok(result.data.gateway);
    },
    {
      name: 'update_gateway',
      description: 'Apply a configuration change to an existing API gateway. Only call it after the user confirmed the change in the conversation. Send the complete config, not just the changed fields; read the current one with list_gateways first. The name cannot be changed.',
      verboseParsingErrors: true,
      schema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Gateway id from list_gateways' },
          ...GATEWAY_CONFIG_PROPERTIES,
        },
        required: ['id', 'domain', 'zoneId', 'upstreams'],
      },
    },
  );
}
