import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { McpUserContext } from '../types';
import { Gateway } from '../../models/Gateway';
import { formatGateway } from '../../modules/gateway/services/formatter.service';
import { createGatewayOrchestrator } from '../../modules/gateway/orchestrators/create.orchestrator';
import { updateGatewayOrchestrator } from '../../modules/gateway/orchestrators/update.orchestrator';
import { deleteGatewayOrchestrator } from '../../modules/gateway/orchestrators/delete.orchestrator';
import { pauseGatewayOrchestrator } from '../../modules/gateway/orchestrators/pause.orchestrator';
import { resumeGatewayOrchestrator } from '../../modules/gateway/orchestrators/resume.orchestrator';
import { PLANS } from '../../config/plans';
import { getUserPlan } from '../../modules/payment/services/subscription.service';
import { getCloudflareCredentials } from '../../services/credentialsService';
import { CloudflareClient } from '../../services/cloudflareClient';

async function findOwned(userId: string, id: string) {
  const gw = await Gateway.findById(id);
  if (!gw || gw.userId.toString() !== userId) return null;
  return gw;
}

function noOpCancellation() {
  return {
    isCancelled: () => false,
    throwIfCancelled: async () => {},
  };
}

const text = (data: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(data) }] });

export function registerGatewayTools(server: McpServer, user: McpUserContext) {
  server.registerTool(
    'list_gateways',
    {
      description: "List the user's API gateways with full configuration. Call this to resolve a name to an id before update, delete, pause or resume.",
      inputSchema: {},
    },
    async () => {
      const gateways = await Gateway.find({ userId: user.userId }).sort({ createdAt: -1 });
      return text({ gateways: gateways.map((gw) => formatGateway(gw)) });
    },
  );

  server.registerTool(
    'get_gateway',
    {
      description: 'Get full details of a single API gateway by id.',
      inputSchema: { id: z.string() },
    },
    async ({ id }) => {
      const gw = await findOwned(user.userId, id);
      if (!gw) return text({ error: 'Gateway not found.' });
      return text(formatGateway(gw));
    },
  );

  server.registerTool(
    'create_gateway',
    {
      description: 'Create and deploy a new API gateway. Requires a zoneId from list_zones.',
      inputSchema: {
        name: z.string(),
        domain: z.string(),
        zoneId: z.string(),
        upstreams: z.array(z.object({ url: z.string(), weight: z.number() })),
        subdomain: z.string().optional(),
        pathRoutes: z.array(z.object({ path: z.string(), upstreamIndex: z.number(), priority: z.number() })).optional(),
        corsEnabled: z.boolean().optional(),
        corsOrigins: z.array(z.string()).optional(),
        rateLimitEnabled: z.boolean().optional(),
        rateLimitRequestsPerMinute: z.number().optional(),
        placement: z.object({ smartPlacement: z.boolean(), region: z.string().optional() }).optional(),
      },
    },
    async (input) => {
      const params: Record<string, unknown> = { ...input };

      if (params.domain) {
        try {
          const creds = await getCloudflareCredentials(user.userId);
          if (creds) {
            const client = new CloudflareClient(creds.apiToken);
            const resp = await client.getZones(creds.accountId);
            const match = (resp.result as any[]).find(
              (z) => z.name === params.domain || (params.domain as string).endsWith(`.${z.name}`),
            );
            if (match) {
              params.zoneId = match.id;
              if (params.domain !== match.name && !params.subdomain) {
                const prefix = (params.domain as string).slice(0, -match.name.length - 1);
                if (prefix) {
                  params.domain = match.name;
                  params.subdomain = prefix;
                }
              }
            }
          }
        } catch {}
      }

      if (!params.name || typeof params.name !== 'string' || (params.name as string).trim().length < 3) {
        return text({ error: 'name must be 3-50 lowercase letters, digits and hyphens.' });
      }
      if (!params.domain) return text({ error: 'domain is required.' });
      if (!params.zoneId) return text({ error: 'zoneId is required.' });
      if (!Array.isArray(params.upstreams) || (params.upstreams as any[]).length === 0) {
        return text({ error: 'At least one upstream is required.' });
      }

      const { plan } = await getUserPlan(user.userId);
      const planConfig = PLANS[plan];
      if (planConfig.maxGateways !== -1 && planConfig.maxGateways > 0) {
        const count = await Gateway.countDocuments({ userId: user.userId }).catch(() => 0);
        if (count >= planConfig.maxGateways) return text({ error: `Your ${planConfig.name} plan allows ${planConfig.maxGateways} gateway(s).` });
      }
      if (params.rateLimitEnabled && !planConfig.hasRateLimit) return text({ error: 'Rate limiting requires a Pro subscription.' });
      if (!planConfig.canEditPlacement) params.placement = { smartPlacement: true };

      const result = await createGatewayOrchestrator({
        userId: user.userId,
        userEmail: user.email,
        operationId: undefined,
        input: params as any,
        cancellation: noOpCancellation() as any,
      });

      return text(result.data.gateway);
    },
  );

  server.registerTool(
    'update_gateway',
    {
      description: 'Update an existing API gateway. Send the complete config, not just changed fields. Read current config with list_gateways first. The name cannot be changed.',
      inputSchema: {
        id: z.string(),
        domain: z.string(),
        zoneId: z.string(),
        upstreams: z.array(z.object({ url: z.string(), weight: z.number() })),
        subdomain: z.string().optional(),
        pathRoutes: z.array(z.object({ path: z.string(), upstreamIndex: z.number(), priority: z.number() })).optional(),
        corsEnabled: z.boolean().optional(),
        corsOrigins: z.array(z.string()).optional(),
        rateLimitEnabled: z.boolean().optional(),
        rateLimitRequestsPerMinute: z.number().optional(),
        placement: z.object({ smartPlacement: z.boolean(), region: z.string().optional() }).optional(),
      },
    },
    async (input) => {
      const { id, ...config } = input;
      const existing = await findOwned(user.userId, id);
      if (!existing) return text({ error: 'Gateway not found.' });

      const merged: Record<string, unknown> = {
        name: existing.name,
        domain: config.domain ?? existing.domain,
        subdomain: config.subdomain ?? existing.subdomain,
        zoneId: config.zoneId ?? existing.zoneId,
        upstreams: config.upstreams ?? existing.upstreams,
        pathRoutes: config.pathRoutes ?? (existing as any).pathRoutes ?? [],
        corsEnabled: config.corsEnabled ?? existing.corsEnabled,
        corsOrigins: config.corsOrigins ?? existing.corsOrigins,
        jwtAuth: (existing as any).jwtAuth,
        headerTransforms: (existing as any).headerTransforms,
        cacheConfig: (existing as any).cacheConfig,
        canary: (existing as any).canary,
        ipRules: (existing as any).ipRules ?? [],
        mockRoutes: (existing as any).mockRoutes ?? [],
        rateLimitEnabled: config.rateLimitEnabled ?? existing.rateLimitEnabled,
        rateLimitRequestsPerMinute: config.rateLimitRequestsPerMinute ?? existing.rateLimitRequestsPerMinute,
        pathRateLimits: (existing as any).pathRateLimits ?? [],
        placement: config.placement ?? existing.placement ?? { smartPlacement: true },
      };

      const { plan } = await getUserPlan(user.userId);
      const planConfig = PLANS[plan];
      if (merged.rateLimitEnabled && !planConfig.hasRateLimit) return text({ error: 'Rate limiting requires a Pro subscription.' });
      if (!planConfig.canEditPlacement) merged.placement = existing.placement ?? { smartPlacement: true };

      const result = await updateGatewayOrchestrator({
        userId: user.userId,
        userEmail: user.email,
        gatewayId: id,
        input: merged as any,
        cancellation: noOpCancellation() as any,
      });

      return text(result.data.gateway);
    },
  );

  server.registerTool(
    'delete_gateway',
    {
      description: 'Permanently delete an API gateway and its Cloudflare Worker. Only call after user confirms.',
      inputSchema: { id: z.string() },
    },
    async ({ id }) => {
      const existing = await findOwned(user.userId, id);
      if (!existing) return text({ error: 'Gateway not found.' });

      await deleteGatewayOrchestrator({ userId: user.userId, gatewayId: id });
      const hostname = `${(existing as any).subdomain ? `${(existing as any).subdomain}.` : ''}${existing.domain}`;
      return text({ message: `Deleted "${existing.name}"`, fullDomain: hostname });
    },
  );

  server.registerTool(
    'pause_gateway',
    {
      description: 'Pause an active API gateway. "keep-domain" serves a maintenance page; "release-domain" detaches the hostname. Only call after user confirms.',
      inputSchema: { id: z.string(), mode: z.enum(['keep-domain', 'release-domain']) },
    },
    async ({ id, mode }) => {
      const existing = await findOwned(user.userId, id);
      if (!existing) return text({ error: 'Gateway not found.' });

      await pauseGatewayOrchestrator({ userId: user.userId, gatewayId: id, mode });
      return text({
        message: mode === 'release-domain'
          ? `Paused "${existing.name}" and detached its hostname`
          : `Paused "${existing.name}" — hostname now serves a maintenance page`,
      });
    },
  );

  server.registerTool(
    'resume_gateway',
    {
      description: 'Resume a paused API gateway and restore live traffic. Only call after user confirms.',
      inputSchema: { id: z.string() },
    },
    async ({ id }) => {
      const existing = await findOwned(user.userId, id);
      if (!existing) return text({ error: 'Gateway not found.' });

      await resumeGatewayOrchestrator({ userId: user.userId, gatewayId: id });
      return text({ message: `Resumed "${existing.name}" — live traffic restored` });
    },
  );
}
