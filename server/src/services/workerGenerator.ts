import { readFileSync } from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import JavaScriptObfuscator from 'javascript-obfuscator';
import { normalizeWorkerScriptName } from '../utils/workerName';

export interface OriginServer {
  url: string;
  weight: number;
  geoCities?: string[];
  geoSubdivisions?: string[];
  geoCountries?: string[];
  geoContinents?: string[];
  isFallback?: boolean;
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

export type WorkerStrategy =
  | 'round-robin'
  | 'weighted-round-robin'
  | 'ip-hash'
  | 'cookie-sticky'
  | 'weighted-cookie-sticky'
  | 'failover'
  | 'geo-steering'
  | 'paused';

export interface GatewayWorkerConfig {
  upstreams: Array<{ url: string; weight: number }>;
  pathRoutes?: Array<{ path: string; upstreamIndex: number; priority: number }>;
  bffRoutes?: Array<{ path: string; upstreamIndices: number[]; priority: number }>;
  corsEnabled?: boolean;
  corsOrigins?: string[];
  jwtAuth?: {
    enabled: boolean;
    headerName: string;
    algorithms: string[];
    issuer: string | null;
    secret: string | null;
    rbacRules?: Array<{ path: string; requiredRoles: string[] }>;
    injectHeaders?: boolean;
  };
  headerTransforms?: {
    request: { set: Array<{ name: string; value: string }>; remove: string[] };
    response: { set: Array<{ name: string; value: string }>; remove: string[] };
  };
  cacheConfig?: { enabled: boolean; ttlSeconds: number; paths: string[]; normalizeQuery?: boolean };
  canary?: { enabled: boolean; percentage: number; upstreamIndex: number };
  shadowConfig?: { enabled: boolean; percentage: number; upstreamIndex: number };
  ipRules?: Array<{ value: string; action: 'allow' | 'deny' }>;
  mockRoutes?: Array<{ path: string; method: string; status: number; body: string; contentType: string }>;
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
  rateLimit?: { enabled: boolean; requestsPerMinute: number };
  rateLimitEnabled?: boolean;
  rateLimitRequestsPerMinute?: number | null;
  rateLimitKeyType?: 'ip' | 'header' | 'jwt';
  rateLimitHeaderName?: string;
  pathRateLimits?: PathRateLimit[];
}

export interface WorkerConfig {
  origins: OriginServer[];
  strategy: WorkerStrategy;
  exposeRealOrigin?: boolean;
  corsEnabled?: boolean;
  corsOrigins?: string[];
  rateLimit?: {
    enabled: boolean;
    requestsPerMinute: number;
  };
  pathRoutes?: PathRoute[];
  pathRateLimits?: PathRateLimit[];
}

const TEMPLATE_MAP: Record<WorkerStrategy, string> = {
  'round-robin': 'roundRobin.js',
  'weighted-round-robin': 'weightedRoundRobin.js',
  'ip-hash': 'ipHash.js',
  'cookie-sticky': 'cookieSticky.js',
  'weighted-cookie-sticky': 'weightedCookieSticky.js',
  'failover': 'failover.js',
  'geo-steering': 'geoSteering.js',
  'paused': 'paused.js',
};

const TEMPLATE_DIR = path.join(__dirname, 'workerTemplates');

const getTemplateContents = (strategy: WorkerStrategy) => {
  return readFileSync(path.join(TEMPLATE_DIR, TEMPLATE_MAP[strategy]), 'utf8');
};

const toWorkerOrigin = (origin: OriginServer, index: number) => ({
  id: `origin_${index}_${createHash('sha1').update(origin.url.trim().toLowerCase()).digest('hex').slice(0, 12)}`,
  url: origin.url.trim(),
  weight: origin.weight,
  geoCities: Array.isArray(origin.geoCities)
    ? origin.geoCities.map((value) => value.trim().toUpperCase()).filter(Boolean)
    : [],
  geoSubdivisions: Array.isArray(origin.geoSubdivisions)
    ? origin.geoSubdivisions.map((value) => value.trim().toUpperCase()).filter(Boolean)
    : [],
  geoCountries: Array.isArray(origin.geoCountries) ? origin.geoCountries : [],
  geoContinents: Array.isArray(origin.geoContinents) ? origin.geoContinents : [],
  isFallback: origin.isFallback === true,
});

export const generateGatewayWorkerCode = async (config: GatewayWorkerConfig, options?: { skipObfuscation?: boolean }): Promise<string> => {
  const template = readFileSync(path.join(TEMPLATE_DIR, 'apiGateway.js'), 'utf8');
  const workerConfig = {
    upstreams: config.upstreams,
    pathRoutes: (config.pathRoutes ?? []).sort((a: any, b: any) => (a.priority ?? 1) - (b.priority ?? 1)),
    corsEnabled: config.corsEnabled ?? false,
    corsOrigins: config.corsOrigins ?? [],
    jwtAuth: config.jwtAuth ?? { enabled: false, headerName: 'Authorization', algorithms: ['HS256'], issuer: null, secret: null, rbacRules: [], injectHeaders: false },
    headerTransforms: config.headerTransforms ?? { request: { set: [], remove: [] }, response: { set: [], remove: [] } },
    cacheConfig: config.cacheConfig ?? { enabled: false, ttlSeconds: 60, paths: [], normalizeQuery: false },
    canary: config.canary ?? { enabled: false, percentage: 10, upstreamIndex: 0 },
    shadowConfig: config.shadowConfig ?? { enabled: false, percentage: 10, upstreamIndex: 0 },
    bffRoutes: (config.bffRoutes ?? []).sort((a: any, b: any) => (a.priority ?? 1) - (b.priority ?? 1)),
    bodyTransforms: config.bodyTransforms ?? [],
    schemaRules: config.schemaRules ?? [],
    ipRules: config.ipRules ?? [],
    mockRoutes: config.mockRoutes ?? [],
    rateLimitEnabled: config.rateLimitEnabled ?? config.rateLimit?.enabled ?? false,
    rateLimitRequestsPerMinute: config.rateLimitRequestsPerMinute ?? config.rateLimit?.requestsPerMinute ?? null,
    rateLimitKeyType: config.rateLimitKeyType ?? 'ip',
    rateLimitHeaderName: config.rateLimitHeaderName ?? 'X-API-Key',
    pathRateLimits: (config.pathRateLimits ?? []).sort((a, b) => a.priority - b.priority),
  };
  const workerCode = template.replace('__CONFIG__', JSON.stringify(workerConfig, null, 2));
  if (options?.skipObfuscation) return workerCode;
  const obfuscationResult = JavaScriptObfuscator.obfuscate(workerCode, {
    compact: true,
    stringArray: true,
    stringArrayEncoding: ['base64'],
    stringArrayThreshold: 0.75,
    renameProperties: false,
    controlFlowFlattening: false,
    deadCodeInjection: false,
    selfDefending: false,
    debugProtection: false,
    target: 'browser',
  });
  return obfuscationResult.getObfuscatedCode();
};

export const generateWorkerCode = async (config: WorkerConfig, options?: { skipObfuscation?: boolean }): Promise<string> => {
  const template = getTemplateContents(config.strategy);
  const workerConfig = {
    origins: config.origins.map(toWorkerOrigin),
    stickyCookieName: 'edgebalancer_origin',
    stickyMaxAge: 86400,
    exposeRealOrigin: config.exposeRealOrigin ?? false,
    corsEnabled: config.corsEnabled ?? false,
    corsOrigins: config.corsOrigins ?? [],
    rateLimitEnabled: config.rateLimit?.enabled ?? false,
    rateLimitRequestsPerMinute: config.rateLimit?.requestsPerMinute ?? null,
    pathRoutes: (config.pathRoutes ?? []).sort((a, b) => a.priority - b.priority),
    pathRateLimits: (config.pathRateLimits ?? []).sort((a, b) => a.priority - b.priority),
  };

  const workerCode = template.replace('__CONFIG__', JSON.stringify(workerConfig, null, 2));

  if (options?.skipObfuscation) {
    return workerCode;
  }

  const obfuscationResult = JavaScriptObfuscator.obfuscate(workerCode, {
    compact: true,
    stringArray: true,
    stringArrayEncoding: ['base64'],
    stringArrayThreshold: 0.75,
    renameProperties: false, // Required for CF Workers API bindings (env.KV, env.DB)
    controlFlowFlattening: false, // Too heavy for CF Workers 30ms CPU limit
    deadCodeInjection: false, // Keeps bundle size small (CF has 1MB-10MB limit)
    selfDefending: false, // Must be false — breaks in V8 isolate strict mode
    debugProtection: false, // Must be false — would consume CPU time
    target: 'browser', // Best compatibility for V8 isolates
  });

  return obfuscationResult.getObfuscatedCode();
};

export const generateScriptName = (name: string): string => {
  return normalizeWorkerScriptName(name);
};
