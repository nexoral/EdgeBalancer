/**
 * Snapshot Service
 *
 * Handles load balancer state snapshots and configuration comparison.
 */

import { normalizeStoredStrategy, isWeightedStrategy } from './strategy.service';

/**
 * Create a snapshot of load balancer state for comparison/rollback
 */
export function snapshotLoadBalancer(loadBalancer: any) {
  return {
    name: loadBalancer.name,
    scriptName: loadBalancer.scriptName,
    domain: loadBalancer.domain,
    subdomain: loadBalancer.subdomain || undefined,
    zoneId: loadBalancer.zoneId,
    origins: loadBalancer.origins.map((origin: any) => ({
      url: origin.url,
      weight: origin.weight,
      geoCities: Array.isArray(origin.geoCities) ? origin.geoCities : [],
      geoSubdivisions: Array.isArray(origin.geoSubdivisions) ? origin.geoSubdivisions : [],
      geoCountries: Array.isArray(origin.geoCountries) ? origin.geoCountries : [],
      geoContinents: Array.isArray(origin.geoContinents) ? origin.geoContinents : [],
      isFallback: origin.isFallback === true,
    })),
    strategy: normalizeStoredStrategy(loadBalancer.strategy, loadBalancer.weightedEnabled),
    weightedEnabled: isWeightedStrategy(loadBalancer.strategy),
    exposeRealOrigin: loadBalancer.exposeRealOrigin ?? false,
    placement: {
      smartPlacement: loadBalancer.placement?.smartPlacement !== false,
      region: loadBalancer.placement?.region || undefined,
    },
    workerUrl: loadBalancer.workerUrl,
    status: loadBalancer.status,
  };
}

/**
 * Normalize placement configuration
 */
export function normalizePlacement(placement: any) {
  return {
    smartPlacement: placement?.smartPlacement !== false,
    region: placement?.region || undefined,
  };
}

/**
 * Generate configuration signature for change detection
 */
export function configSignature(params: {
  origins: Array<{ url: string; weight: number }>;
  strategy: string;
  weightedEnabled: boolean;
  exposeRealOrigin?: boolean;
  placement: any;
}): string {
  const { origins, strategy, weightedEnabled, exposeRealOrigin, placement } = params;

  return JSON.stringify({
    origins: origins.map((origin) => ({
      url: origin.url.trim(),
      weight: origin.weight,
      geoCities: Array.isArray((origin as any).geoCities)
        ? (origin as any).geoCities.map((value: string) => value.trim().toUpperCase()).filter(Boolean)
        : [],
      geoSubdivisions: Array.isArray((origin as any).geoSubdivisions)
        ? (origin as any).geoSubdivisions.map((code: string) => code.trim().toUpperCase()).filter(Boolean)
        : [],
      geoCountries: Array.isArray((origin as any).geoCountries)
        ? (origin as any).geoCountries.map((code: string) => code.trim().toUpperCase()).filter(Boolean)
        : [],
      geoContinents: Array.isArray((origin as any).geoContinents)
        ? (origin as any).geoContinents.map((code: string) => code.trim().toUpperCase()).filter(Boolean)
        : [],
      isFallback: (origin as any).isFallback === true,
    })),
    strategy,
    weightedEnabled,
    exposeRealOrigin: exposeRealOrigin ?? false,
    placement: normalizePlacement(placement),
  });
}
