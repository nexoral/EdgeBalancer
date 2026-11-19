import { toHostname } from '../../loadbalancer/services/hostname.service';
import type { IGateway } from '../../../models/Gateway';

export function formatGateway(gateway: any) {
  return {
    id: gateway._id?.toString?.() ?? gateway.id,
    name: gateway.name,
    scriptName: gateway.scriptName,
    domain: gateway.domain,
    subdomain: gateway.subdomain ?? null,
    fullDomain: gateway.subdomain ? `${gateway.subdomain}.${gateway.domain}` : gateway.domain,
    zoneId: gateway.zoneId,
    upstreams: Array.isArray(gateway.upstreams) ? gateway.upstreams : [],
    pathRoutes: Array.isArray(gateway.pathRoutes) ? gateway.pathRoutes : [],
    corsEnabled: gateway.corsEnabled ?? false,
    corsOrigins: Array.isArray(gateway.corsOrigins) ? gateway.corsOrigins : [],
    jwtAuthEnabled: gateway.jwtAuth?.enabled ?? false,
    jwtHeaderName: gateway.jwtAuth?.headerName ?? 'Authorization',
    headerTransforms: {
      request: {
        set: gateway.headerTransforms?.request?.set ?? [],
        remove: gateway.headerTransforms?.request?.remove ?? [],
      },
      response: {
        set: gateway.headerTransforms?.response?.set ?? [],
        remove: gateway.headerTransforms?.response?.remove ?? [],
      },
    },
    cacheConfig: {
      enabled: gateway.cacheConfig?.enabled ?? false,
      ttlSeconds: gateway.cacheConfig?.ttlSeconds ?? 60,
      paths: gateway.cacheConfig?.paths ?? [],
    },
    canary: {
      enabled: gateway.canary?.enabled ?? false,
      percentage: gateway.canary?.percentage ?? 10,
      upstreamIndex: gateway.canary?.upstreamIndex ?? 0,
    },
    ipRules: Array.isArray(gateway.ipRules) ? gateway.ipRules : [],
    mockRoutes: Array.isArray(gateway.mockRoutes) ? gateway.mockRoutes : [],
    rateLimitEnabled: gateway.rateLimitEnabled ?? false,
    rateLimitRequestsPerMinute: gateway.rateLimitRequestsPerMinute ?? null,
    pathRateLimits: Array.isArray(gateway.pathRateLimits) ? gateway.pathRateLimits : [],
    ipOriginRecords: Array.isArray(gateway.ipOriginRecords) ? gateway.ipOriginRecords : [],
    placement: {
      smartPlacement: gateway.placement?.smartPlacement !== false,
      region: gateway.placement?.region || undefined,
    },
    status: gateway.status,
    workerUrl: gateway.workerUrl,
    createdAt: gateway.createdAt,
    updatedAt: gateway.updatedAt,
  };
}

export { toHostname as gatewayHostname };
