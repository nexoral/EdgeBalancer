// API Response wrapper
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message: string;
}

// User types
export interface User {
  id: string;
  name: string;
  email?: string | null;
  username: string;
  hasCloudflareCredentials: boolean;
  cloudflareAccountId?: string; // masked
  cloudflareApiToken?: string; // masked
}

// Auth types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

// Cloudflare types
export interface CloudflareCredentials {
  accountId: string;
  apiToken: string;
}

export interface CloudflareZone {
  id: string;
  name: string;
  status: string;
}

// Load Balancer types
export interface OriginServer {
  url: string;
  weight: number;
  geoCities?: string[];
  geoSubdivisions?: string[];
  geoCountries?: string[];
  geoContinents?: string[];
  isFallback?: boolean;
}

export interface PlacementConfig {
  smartPlacement?: boolean;
  region?: string;
}

export type LoadBalancerStrategy =
  | 'round-robin'
  | 'weighted-round-robin'
  | 'ip-hash'
  | 'cookie-sticky'
  | 'weighted-cookie-sticky'
  | 'failover'
  | 'geo-steering';

export interface LoadBalancer {
  id: string;
  name: string;
  scriptName: string;
  domain: string;
  subdomain?: string | null;
  fullDomain: string;
  zoneId: string;
  origins: OriginServer[];
  originCount?: number;
  strategy: string;
  strategyValue: LoadBalancerStrategy;
  weightedEnabled: boolean;
  exposeRealOrigin: boolean;
  placement: PlacementConfig;
  status: string;
  workerUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  _id: string;
  loadBalancerName: string;
  domain: string;
  subdomain: string | null;
  strategy: string;
  actionType: 'create' | 'edit';
  isActive: boolean;
  loadBalancerId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SessionsResponse {
  sessions: Session[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface LoadBalancerAnalytics {
  requests: number;
  errors: number;
  errorRate: number;
}

export interface CreateLoadBalancerRequest {
  name: string;
  zoneId: string;
  domain: string;
  subdomain?: string;
  origins: OriginServer[];
  strategy: LoadBalancerStrategy;
  weightedEnabled: boolean;
  exposeRealOrigin: boolean;
  placement: PlacementConfig;
}
