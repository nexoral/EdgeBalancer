/**
 * Formatter Service
 *
 * Handles formatting of load balancer data for API responses.
 */

import { normalizeStoredStrategy, isWeightedStrategy, getStrategyLabel } from './strategy.service';

/**
 * Format load balancer for API response
 */
export function formatLoadBalancer(lb: any) {
  return {
    id: lb._id,
    name: lb.name,
    scriptName: lb.scriptName,
    domain: lb.domain,
    subdomain: lb.subdomain || null,
    fullDomain: lb.subdomain ? `${lb.subdomain}.${lb.domain}` : lb.domain,
    zoneId: lb.zoneId,
    origins: lb.origins,
    strategy: getStrategyLabel(lb.strategy),
    strategyValue: normalizeStoredStrategy(lb.strategy, lb.weightedEnabled),
    weightedEnabled: isWeightedStrategy(lb.strategy),
    exposeRealOrigin: lb.exposeRealOrigin ?? false,
    corsEnabled: lb.corsEnabled ?? false,
    corsOrigins: Array.isArray(lb.corsOrigins) ? lb.corsOrigins : [],
    ipOriginRecords: Array.isArray(lb.ipOriginRecords) ? lb.ipOriginRecords : [],
    placement: lb.placement,
    status: lb.status,
    workerUrl: lb.workerUrl,
    createdAt: lb.createdAt,
    updatedAt: lb.updatedAt,
  };
}
