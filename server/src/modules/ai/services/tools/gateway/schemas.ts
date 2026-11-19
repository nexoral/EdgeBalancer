const GATEWAY_UPSTREAM_SCHEMA = {
  type: 'object',
  properties: {
    url: { type: 'string', description: 'Upstream origin URL, must start with http:// or https://' },
    weight: { type: 'integer', minimum: 1, maximum: 100, description: 'Relative load-balancing weight, default 1' },
  },
  required: ['url', 'weight'],
} as const;

export const GATEWAY_CONFIG_PROPERTIES = {
  domain: { type: 'string', description: 'Zone name from list_zones, e.g. example.com' },
  subdomain: { type: 'string', description: 'Optional hostname prefix only, e.g. "api". Never the full hostname.' },
  zoneId: { type: 'string', description: '32-character zone id from list_zones' },
  upstreams: { type: 'array', items: GATEWAY_UPSTREAM_SCHEMA, minItems: 1 },
  pathRoutes: {
    type: 'array',
    description: 'Path-based routing rules. Each maps a URL path pattern to a specific upstream by index. First matching rule wins (by priority). Optional.',
    items: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path pattern, e.g. /api/v2/*, /static/*' },
        upstreamIndex: { type: 'integer', minimum: 0, description: '0-based index into upstreams array' },
        priority: { type: 'integer', minimum: 1, description: 'Lower = checked first' },
      },
      required: ['path', 'upstreamIndex', 'priority'],
    },
  },
  pathRateLimits: {
    type: 'array',
    description: 'Path-based rate limits per gateway. Optional.',
    items: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path pattern, e.g. /login/*' },
        requestsPerMinute: { type: 'integer', minimum: 1, maximum: 100000 },
        priority: { type: 'integer', minimum: 1 },
      },
      required: ['path', 'requestsPerMinute', 'priority'],
    },
  },
  corsEnabled: { type: 'boolean' },
  corsOrigins: { type: 'array', items: { type: 'string' } },
  jwtAuth: {
    type: 'object',
    description: 'JWT validation config. Requires a paid plan. Pass secret as plaintext here; it is encrypted at rest.',
    properties: {
      enabled: { type: 'boolean' },
      headerName: { type: 'string', description: 'Header containing the JWT, default Authorization' },
      algorithms: { type: 'array', items: { type: 'string', enum: ['HS256', 'HS384', 'HS512'] } },
      issuer: { type: 'string', description: 'Expected iss claim, optional' },
      secret: { type: 'string', description: 'HMAC signing secret (shown once, then encrypted at rest)' },
    },
  },
  headerTransforms: {
    type: 'object',
    description: 'Request and response header transforms. Counts are capped per plan.',
    properties: {
      request: {
        type: 'object',
        properties: {
          set: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, value: { type: 'string' } }, required: ['name', 'value'] } },
          remove: { type: 'array', items: { type: 'string' } },
        },
      },
      response: {
        type: 'object',
        properties: {
          set: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, value: { type: 'string' } }, required: ['name', 'value'] } },
          remove: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
  cacheConfig: {
    type: 'object',
    description: 'Response caching (GET only). Requires a paid plan.',
    properties: {
      enabled: { type: 'boolean' },
      ttlSeconds: { type: 'integer', minimum: 1, maximum: 86400 },
      paths: { type: 'array', items: { type: 'string' }, description: 'Path patterns eligible for caching; empty = all GET routes' },
    },
  },
  canary: {
    type: 'object',
    description: 'Canary splitting — deterministic hash of client IP determines routing. Pro only.',
    properties: {
      enabled: { type: 'boolean' },
      percentage: { type: 'integer', minimum: 0, maximum: 100 },
      upstreamIndex: { type: 'integer', minimum: 0 },
    },
  },
  ipRules: {
    type: 'array',
    description: 'IP allow/deny rules. Deny wins; if any allow rule exists, the IP must match one to pass.',
    items: {
      type: 'object',
      properties: {
        value: { type: 'string', description: 'Exact IP, prefix (10.0.*), or CIDR (10.0.0.0/24)' },
        action: { type: 'string', enum: ['allow', 'deny'] },
      },
      required: ['value', 'action'],
    },
  },
  mockRoutes: {
    type: 'array',
    description: 'Mock response rules — return a canned response instead of proxying. Counts are capped per plan.',
    items: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'ANY'] },
        status: { type: 'integer', minimum: 200, maximum: 599 },
        body: { type: 'string' },
        contentType: { type: 'string' },
      },
      required: ['path', 'status'],
    },
  },
  rateLimitEnabled: { type: 'boolean' },
  rateLimitRequestsPerMinute: { type: 'integer', minimum: 0, maximum: 100000 },
  placement: {
    type: 'object',
    properties: {
      smartPlacement: { type: 'boolean' },
      region: { type: 'string', description: 'provider:region, e.g. aws:us-east-1' },
    },
  },
} as const;
