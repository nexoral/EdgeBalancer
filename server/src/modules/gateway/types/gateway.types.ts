import type { RequestCancellation } from '../../../utils/requestCancellation';

export interface GatewayUpstreamInput {
  url: string;
  weight: number;
}

export interface CreateGatewayInput {
  name: string;
  domain: string;
  subdomain?: string;
  zoneId: string;
  upstreams: GatewayUpstreamInput[];
  pathRoutes?: Array<{ path: string; upstreamIndex: number; priority: number }>;
  corsEnabled?: boolean;
  corsOrigins?: string[];
  jwtAuth?: {
    enabled: boolean;
    headerName?: string;
    algorithms?: string[];
    issuer?: string | null;
    secret?: string | null;
  };
  headerTransforms?: {
    request?: { set?: Array<{ name: string; value: string }>; remove?: string[] };
    response?: { set?: Array<{ name: string; value: string }>; remove?: string[] };
  };
  cacheConfig?: { enabled: boolean; ttlSeconds?: number; paths?: string[] };
  canary?: { enabled: boolean; percentage?: number; upstreamIndex?: number };
  ipRules?: Array<{ value: string; action: 'allow' | 'deny' }>;
  mockRoutes?: Array<{ path: string; method?: string; status: number; body?: string; contentType?: string }>;
  rateLimitEnabled?: boolean;
  rateLimitRequestsPerMinute?: number;
  pathRateLimits?: Array<{ path: string; requestsPerMinute: number; priority: number }>;
  placement?: { smartPlacement?: boolean; region?: string | null };
}

export interface GatewayOrchestratorResult {
  success: boolean;
  message: string;
  data: {
    gateway: any;
  };
}

export interface GatewayOrchestratorParams {
  userId: string;
  userEmail: string | null;
  input: CreateGatewayInput;
  cancellation: RequestCancellation;
}
