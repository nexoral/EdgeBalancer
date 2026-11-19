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
    rbacRules?: Array<{ path: string; requiredRoles: string[] }>;
    injectHeaders?: boolean;
  };
  headerTransforms?: {
    request?: { set?: Array<{ name: string; value: string }>; remove?: string[] };
    response?: { set?: Array<{ name: string; value: string }>; remove?: string[] };
  };
  cacheConfig?: { enabled: boolean; ttlSeconds?: number; paths?: string[]; normalizeQuery?: boolean };
  canary?: { enabled: boolean; percentage?: number; upstreamIndex?: number };
  shadowConfig?: { enabled: boolean; percentage?: number; upstreamIndex?: number };
  bffRoutes?: Array<{ path: string; upstreamIndices: number[]; priority: number }>;
  bodyTransforms?: Array<{
    path: string;
    phase: 'request' | 'response';
    stripFields?: string[];
    renameFields?: Array<{ from: string; to: string }>;
  }>;
  schemaRules?: Array<{
    path: string;
    method?: string;
    requiredFields?: string[];
    fieldTypes?: Array<{ field: string; type: 'string' | 'number' | 'boolean' | 'array' }>;
  }>;
  ipRules?: Array<{ value: string; action: 'allow' | 'deny' }>;
  mockRoutes?: Array<{ path: string; method?: string; status: number; body?: string; contentType?: string }>;
  rateLimitEnabled?: boolean;
  rateLimitRequestsPerMinute?: number;
  rateLimitKeyType?: 'ip' | 'header' | 'jwt';
  rateLimitHeaderName?: string;
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
