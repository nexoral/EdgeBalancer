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
  cloudflareOAuthConnected?: boolean;
  cloudflareAccountId?: string; // masked
  cloudflareApiToken?: string; // masked
  totpEnabled?: boolean;
  totpDevices?: Credential[];
  passkeys?: Credential[];
  preferredSecondFactor?: SecondFactorMethod | null;
  plan?: 'free' | 'trial' | 'student' | 'pro' | 'student-annual' | 'pro-annual';
  planExpiresAt?: string | null;
  isPro?: boolean;
  isSubscribed?: boolean;
  hasEverSubscribed?: boolean;
}

export type SecondFactorMethod = 'totp' | 'passkey';

export interface Credential {
  id: string;
  name: string;
  createdAt: string;
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
  healthPath?: string;
  geoCities?: string[];
  geoSubdivisions?: string[];
  geoCountries?: string[];
  geoContinents?: string[];
  isFallback?: boolean;
}

export interface IpOriginRecord {
  originalUrl: string;
  hostname: string;
  dnsRecordId: string;
}

export interface PlacementConfig {
  smartPlacement?: boolean;
  region?: string;
}

export interface PathRoute {
  path: string;
  originIndex: number;
  priority: number;
}

export interface PathRateLimit {
  path: string;
  requestsPerMinute: number;
  priority: number;
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
  corsEnabled: boolean;
  corsOrigins: string[];
  rateLimitEnabled: boolean;
  rateLimitRequestsPerMinute: number | null;
  pathRoutes: PathRoute[];
  pathRateLimits: PathRateLimit[];
  healthCheckEnabled: boolean;
  healthCheckIntervalSeconds: number | null;
  disabledOriginCount?: number;
  provisioningOriginCount?: number;
  originHealth?: Array<{
    url: string;
    status: string;
    lastCheckedAt: string | null;
    lastStatusCode: number | null;
    lastError: string | null;
  }>;
  ipOriginRecords: IpOriginRecord[];
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
  corsEnabled: boolean;
  corsOrigins: string[];
  rateLimitEnabled: boolean;
  rateLimitRequestsPerMinute: number | null;
  pathRoutes?: PathRoute[];
  pathRateLimits?: PathRateLimit[];
  healthCheckEnabled: boolean;
  healthCheckIntervalSeconds: number;
  placement: PlacementConfig;
}

// --- Gateway types ---
export interface GatewayUpstream {
  url: string;
  weight: number;
}

export interface GatewayHeaderRule {
  name: string;
  value: string;
}

export interface GatewayHeaderTransforms {
  request: { set: GatewayHeaderRule[]; remove: string[] };
  response: { set: GatewayHeaderRule[]; remove: string[] };
}

export interface GatewayCacheConfig {
  enabled: boolean;
  ttlSeconds: number;
  paths: string[];
}

export interface GatewayCanary {
  enabled: boolean;
  percentage: number;
  upstreamIndex: number;
}

export interface GatewayIpRule {
  value: string;
  action: 'allow' | 'deny';
}

export interface GatewayMockRoute {
  path: string;
  method: string;
  status: number;
  body: string;
  contentType: string;
}

export interface GatewayJwtAuth {
  enabled: boolean;
  headerName: string;
  algorithms: string[];
  issuer?: string | null;
}

export interface Gateway {
  id: string;
  name: string;
  scriptName: string;
  domain: string;
  subdomain?: string | null;
  fullDomain: string;
  zoneId: string;
  upstreams: GatewayUpstream[];
  pathRoutes: Array<{ path: string; upstreamIndex: number; priority: number }>;
  corsEnabled: boolean;
  corsOrigins: string[];
  jwtAuthEnabled: boolean;
  jwtHeaderName: string;
  headerTransforms: GatewayHeaderTransforms;
  cacheConfig: GatewayCacheConfig;
  canary: GatewayCanary;
  ipRules: GatewayIpRule[];
  mockRoutes: GatewayMockRoute[];
  rateLimitEnabled: boolean;
  rateLimitRequestsPerMinute: number | null;
  pathRateLimits: PathRateLimit[];
  status: string;
  workerUrl: string;
  createdAt: string;
  updatedAt: string;
}

// --- AI Agent ---

export type AiOutcome = 'success' | 'failure';

/** One turn of the conversation chain replayed to the server on every call. */
export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

export type AiEvent =
  | { name: 'run_start'; payload: { runId: string } }
  | { name: 'model_active'; payload: { model: string } }
  | { name: 'model_switch'; payload: { from: string; to: string; reason: string } }
  | { name: 'status'; payload: { message: string; progress: number } }
  | { name: 'tool_start'; payload: { name: string; args: Record<string, unknown> } }
  | { name: 'tool_result'; payload: { name: string; ok: boolean; summary: string } }
  | { name: 'compaction_start'; payload: { tokensBefore: number } }
  | { name: 'compaction_result'; payload: { ok: boolean; tokensBefore: number; tokensAfter: number; tokensSaved: number } }
  | { name: 'done'; payload: { outcome: AiOutcome; message: string; loadBalancers: LoadBalancer[] } }
  | { name: 'error'; payload: { message: string } };

export interface AiStep {
  label: string;
  state: 'running' | 'ok' | 'failed';
  detail?: string;
}

export interface AiRunToolCallSummary {
  name: string;
}

export interface AiRunListItem {
  _id: string;
  prompt: string;
  outcome: AiOutcome;
  durationMs: number;
  finalModel: string | null;
  toolCalls: AiRunToolCallSummary[];
  createdAt: string;
}

export interface AiRunModelAttempt {
  provider: string;
  model: string;
  ok: boolean;
  error: string | null;
}

export interface AiRunToolCall {
  name: string;
  args: Record<string, unknown>;
  result: string;
  ok: boolean;
  durationMs: number;
}

export interface AiRunTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiRunDetail {
  _id: string;
  userId: string;
  prompt: string;
  turns: AiRunTurn[];
  modelsUsed: AiRunModelAttempt[];
  finalModel: string | null;
  toolCalls: AiRunToolCall[];
  outcome: AiOutcome;
  finalMessage: string | null;
  durationMs: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiRunsResponse {
  runs: AiRunListItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

// --- Payment types ---

export interface PaymentHistory {
  orderId: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED';
  paymentMethod?: string | null;
  expiresAt: string;
  createdAt: string;
}

export interface PaymentHistoryResponse {
  payments: PaymentHistory[];
  nextCursor: string | null;
  hasMore: boolean;
}
