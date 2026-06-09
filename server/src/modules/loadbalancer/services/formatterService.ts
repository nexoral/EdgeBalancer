import type {
  FormattedLoadBalancer,
  LoadBalancerOrigin,
  LoadBalancerPlacement,
  LoadBalancerSnapshot
} from '../types/loadBalancer.types';
import { getStrategyLabel, isWeightedStrategy, normalizeStoredStrategy } from './strategyService';

export const formatLoadBalancer = (lb: any): FormattedLoadBalancer => ({
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
  placement: lb.placement,
  status: lb.status,
  workerUrl: lb.workerUrl,
  createdAt: lb.createdAt,
  updatedAt: lb.updatedAt,
});

export const snapshotLoadBalancer = (loadBalancer: any): LoadBalancerSnapshot => ({
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
});

export const normalizePlacement = (placement: any): LoadBalancerPlacement => ({
  smartPlacement: placement?.smartPlacement !== false,
  region: placement?.region || undefined,
});

export const configSignature = ({
  origins,
  strategy,
  weightedEnabled,
  placement,
}: {
  origins: Array<{ url: string; weight: number }>;
  strategy: string;
  weightedEnabled: boolean;
  placement: any;
}): string => JSON.stringify({
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
  placement: normalizePlacement(placement),
});
