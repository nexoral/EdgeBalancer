import { tool } from '@langchain/core/tools';
import { CloudflareClient } from '../../../../../services/cloudflareClient';
import { getCloudflareCredentials } from '../../../../../services/credentialsService';
import { Gateway } from '../../../../../models/Gateway';
import { PLANS } from '../../../../../config/plans';
import { getUserPlan } from '../../../../payment/services/subscription.service';
import { createGatewayOrchestrator } from '../../../../gateway/orchestrators/create.orchestrator';
import { fail, ok } from '../shared';
import type { ToolContext } from '../types';
import { GATEWAY_CONFIG_PROPERTIES } from './schemas';

export function createGatewayTool(ctx: ToolContext) {
  return tool(
    async (input: any) => {
      if (input.domain) {
        try {
          const creds = await getCloudflareCredentials(ctx.userId);
          if (creds) {
            const client = new CloudflareClient(creds.apiToken);
            const resp = await client.getZones(creds.accountId);
            const match = (resp.result as any[]).find((z) => z.name === input.domain || input.domain.endsWith(`.${z.name}`));
            if (match) {
              input.zoneId = match.id;
              if (input.domain !== match.name && !input.subdomain) {
                const prefix = input.domain.slice(0, -match.name.length - 1);
                if (prefix) {
                  input.domain = match.name;
                  input.subdomain = prefix;
                }
              }
            }
          }
        } catch {}
      }

      if (input.rateLimitEnabled !== true && input.rateLimitRequestsPerMinute === 0) delete input.rateLimitRequestsPerMinute;

      const { plan } = await getUserPlan(ctx.userId);
      const config = PLANS[plan];

      if (config.maxGateways !== -1 && config.maxGateways > 0) {
        let count = 0;
        try { count = await Gateway.countDocuments({ userId: ctx.userId }); } catch { count = 0; }
        if (count >= config.maxGateways) return fail(`Your ${config.name} plan allows ${config.maxGateways} gateway${config.maxGateways === 1 ? '' : 's'}. Upgrade to create more.`);
      }
      if (input.jwtAuth?.enabled && !config.hasJwtAuth) return fail('JWT validation requires a paid plan.');
      if (input.cacheConfig?.enabled && !config.hasCaching) return fail('Response caching requires a paid plan.');
      if (input.canary?.enabled && !config.hasCanary) return fail('Canary splitting is a Pro feature.');
      if (input.rateLimitEnabled && !config.hasRateLimit) return fail('Rate limiting requires an EdgeBalancer Pro subscription');
      if ((input.rateLimitKeyType === 'header' || input.rateLimitKeyType === 'jwt') && !config.hasIdentityRateLimit) return fail('Identity-based rate limiting requires a Student or Pro plan.');
      if (Array.isArray(input.bffRoutes) && input.bffRoutes.length > 0 && !config.hasBffAggregation) return fail('BFF Multi-Upstream Aggregation is a Pro feature.');
      if (input.shadowConfig?.enabled && !config.hasTrafficShadowing) return fail('Traffic Shadowing is a Pro feature.');
      if (input.jwtAuth?.injectHeaders && !config.hasHeaderInjection) return fail('Downstream Header Injection is a Pro feature.');
      if (config.maxRbacRules !== -1 && Array.isArray(input.jwtAuth?.rbacRules) && input.jwtAuth.rbacRules.length > config.maxRbacRules) return fail(`Your ${config.name} plan allows ${config.maxRbacRules} RBAC rule(s).`);
      if (config.maxBodyShapingRules !== -1 && Array.isArray(input.bodyTransforms) && input.bodyTransforms.length > config.maxBodyShapingRules) return fail(`Your ${config.name} plan allows ${config.maxBodyShapingRules} payload transform rule(s).`);
      if (config.maxSchemaRules !== -1 && Array.isArray(input.schemaRules) && input.schemaRules.length > config.maxSchemaRules) return fail(`Your ${config.name} plan allows ${config.maxSchemaRules} schema validation rule(s).`);
      if (config.maxGatewayRoutes !== -1 && Array.isArray(input.pathRoutes) && input.pathRoutes.length > config.maxGatewayRoutes) return fail(`Your ${config.name} plan allows ${config.maxGatewayRoutes} routing rules per gateway.`);
      if (config.maxGatewayRateLimitRules !== -1 && Array.isArray(input.pathRateLimits) && input.pathRateLimits.length > config.maxGatewayRateLimitRules) return fail(`Your ${config.name} plan allows ${config.maxGatewayRateLimitRules} rate limit rule(s) per gateway.`);
      if (config.maxGatewayHeaderRules !== -1) {
        const hc = (input.headerTransforms?.request?.set?.length ?? 0) + (input.headerTransforms?.request?.remove?.length ?? 0) + (input.headerTransforms?.response?.set?.length ?? 0) + (input.headerTransforms?.response?.remove?.length ?? 0);
        if (hc > config.maxGatewayHeaderRules) return fail(`Your ${config.name} plan allows ${config.maxGatewayHeaderRules} header transform rules per gateway.`);
      }
      if (config.maxGatewayIpRules !== -1 && Array.isArray(input.ipRules) && input.ipRules.length > config.maxGatewayIpRules) return fail(`Your ${config.name} plan allows ${config.maxGatewayIpRules} IP rules per gateway.`);
      if (config.maxGatewayMockRoutes !== -1 && Array.isArray(input.mockRoutes) && input.mockRoutes.length > config.maxGatewayMockRoutes) return fail(`Your ${config.name} plan allows ${config.maxGatewayMockRoutes} mock routes per gateway.`);
      if (!config.canEditPlacement) input.placement = { smartPlacement: true };

      if (!input.name || typeof input.name !== 'string' || input.name.trim().length < 3) return fail('name must be 3-50 lowercase letters, digits and hyphens');
      if (!input.domain) return fail('domain is required');
      if (!input.zoneId) return fail('zoneId is required');
      if (!Array.isArray(input.upstreams) || !input.upstreams.length) return fail('at least one upstream is required');

      const result = await createGatewayOrchestrator({
        userId: ctx.userId, userEmail: ctx.userEmail, operationId: ctx.runId, input, cancellation: ctx.cancellation,
      });

      ctx.touched.push(result.data.gateway);
      return ok(result.data.gateway);
    },
    {
      name: 'create_gateway',
      description: 'Create and deploy a new API gateway immediately. Requires a zoneId from list_zones.',
      verboseParsingErrors: true,
      schema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '3-50 characters, lowercase letters, digits and hyphens only' },
          ...GATEWAY_CONFIG_PROPERTIES,
        },
        required: ['name', 'domain', 'zoneId', 'upstreams'],
      },
    },
  );
}
