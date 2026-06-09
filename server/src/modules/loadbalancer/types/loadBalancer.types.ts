export type LoadBalancerStrategy =
  | 'round-robin'
  | 'weighted-round-robin'
  | 'ip-hash'
  | 'cookie-sticky'
  | 'weighted-cookie-sticky'
  | 'failover'
  | 'geo-steering';

export interface LoadBalancerOrigin {
  url: string;
  weight: number;
  geoCities?: string[];
  geoSubdivisions?: string[];
  geoCountries?: string[];
  geoContinents?: string[];
  isFallback?: boolean;
}

export interface LoadBalancerPlacement {
  smartPlacement: boolean;
  region?: string;
}

export interface LoadBalancerSnapshot {
  name: string;
  scriptName: string;
  domain: string;
  subdomain?: string;
  zoneId: string;
  origins: LoadBalancerOrigin[];
  strategy: LoadBalancerStrategy;
  weightedEnabled: boolean;
  exposeRealOrigin: boolean;
  placement: LoadBalancerPlacement;
  workerUrl: string;
  status: string;
}

export interface FormattedLoadBalancer {
  id: string;
  name: string;
  scriptName: string;
  domain: string;
  subdomain: string | null;
  fullDomain: string;
  zoneId: string;
  origins: LoadBalancerOrigin[];
  strategy: string;
  strategyValue: LoadBalancerStrategy;
  weightedEnabled: boolean;
  exposeRealOrigin: boolean;
  placement: LoadBalancerPlacement;
  status: string;
  workerUrl: string;
  createdAt: Date;
  updatedAt: Date;
}
