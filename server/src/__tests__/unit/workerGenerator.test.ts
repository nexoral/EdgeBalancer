import { generateWorkerCode, generateGatewayWorkerCode } from '../../services/workerGenerator';

const BASE_ORIGINS = [{ url: 'https://origin.example.com', weight: 100 }];

const extractConfig = (code: string) => {
  // The template has "const config = __CONFIG__;" — handle spaces around the equals sign.
  const marker = /config\s*=\s*/;
  const match = code.match(marker);
  if (!match || match.index === undefined) throw new Error('Config block not found in generated code');
  const jsonStart = code.indexOf('{', match.index + match[0].length - 1);
  let depth = 0;
  let end = jsonStart;
  for (let i = jsonStart; i < code.length; i++) {
    if (code[i] === '{') depth++;
    if (code[i] === '}') depth--;
    if (depth === 0) { end = i + 1; break; }
  }
  return JSON.parse(code.slice(jsonStart, end));
};

const OPTS = { skipObfuscation: true };

describe('generateWorkerCode — exposeRealOrigin', () => {
  it('injects exposeRealOrigin: true when explicitly set', async () => {
    const code = await generateWorkerCode({ origins: BASE_ORIGINS, strategy: 'round-robin', exposeRealOrigin: true }, OPTS);
    const config = extractConfig(code);
    expect(config.exposeRealOrigin).toBe(true);
  });

  it('injects exposeRealOrigin: false when explicitly set', async () => {
    const code = await generateWorkerCode({ origins: BASE_ORIGINS, strategy: 'round-robin', exposeRealOrigin: false }, OPTS);
    const config = extractConfig(code);
    expect(config.exposeRealOrigin).toBe(false);
  });

  it('defaults exposeRealOrigin to false when omitted', async () => {
    const code = await generateWorkerCode({ origins: BASE_ORIGINS, strategy: 'round-robin' }, OPTS);
    const config = extractConfig(code);
    expect(config.exposeRealOrigin).toBe(false);
  });

  it('exposeRealOrigin: true and false produce different worker code', async () => {
    const withTrue = await generateWorkerCode({ origins: BASE_ORIGINS, strategy: 'round-robin', exposeRealOrigin: true }, OPTS);
    const withFalse = await generateWorkerCode({ origins: BASE_ORIGINS, strategy: 'round-robin', exposeRealOrigin: false }, OPTS);
    expect(withTrue).not.toBe(withFalse);
  });

  it('works correctly for every non-paused strategy', async () => {
    const strategies = [
      'round-robin',
      'weighted-round-robin',
      'ip-hash',
      'cookie-sticky',
      'weighted-cookie-sticky',
      'failover',
      'geo-steering',
    ] as const;

    for (const strategy of strategies) {
      const code = await generateWorkerCode({ origins: BASE_ORIGINS, strategy, exposeRealOrigin: true }, OPTS);
      const config = extractConfig(code);
      expect(config.exposeRealOrigin).toBe(true);
    }
  });
});

// ─── CORS ─────────────────────────────────────────────────────────────────────

describe('generateWorkerCode — CORS', () => {
  it('injects corsEnabled: true when explicitly set', async () => {
    const code = await generateWorkerCode({ origins: BASE_ORIGINS, strategy: 'round-robin', corsEnabled: true }, OPTS);
    const config = extractConfig(code);
    expect(config.corsEnabled).toBe(true);
  });

  it('injects corsEnabled: false when explicitly set', async () => {
    const code = await generateWorkerCode({ origins: BASE_ORIGINS, strategy: 'round-robin', corsEnabled: false }, OPTS);
    const config = extractConfig(code);
    expect(config.corsEnabled).toBe(false);
  });

  it('defaults corsEnabled to false when omitted', async () => {
    const code = await generateWorkerCode({ origins: BASE_ORIGINS, strategy: 'round-robin' }, OPTS);
    const config = extractConfig(code);
    expect(config.corsEnabled).toBe(false);
  });

  it('embeds corsOrigins array in the config', async () => {
    const corsOrigins = ['https://a.com', 'https://b.com'];
    const code = await generateWorkerCode({ origins: BASE_ORIGINS, strategy: 'round-robin', corsEnabled: true, corsOrigins }, OPTS);
    const config = extractConfig(code);
    expect(config.corsOrigins).toEqual(corsOrigins);
  });

  it('corsEnabled: true and corsEnabled: false produce different worker code', async () => {
    const withTrue  = await generateWorkerCode({ origins: BASE_ORIGINS, strategy: 'round-robin', corsEnabled: true }, OPTS);
    const withFalse = await generateWorkerCode({ origins: BASE_ORIGINS, strategy: 'round-robin', corsEnabled: false }, OPTS);
    expect(withTrue).not.toBe(withFalse);
  });

  it('includes corsEnabled in the config for every strategy', async () => {
    const strategies = [
      'round-robin',
      'weighted-round-robin',
      'ip-hash',
      'cookie-sticky',
      'weighted-cookie-sticky',
      'failover',
      'geo-steering',
    ] as const;

    for (const strategy of strategies) {
      const code = await generateWorkerCode({ origins: BASE_ORIGINS, strategy, corsEnabled: true }, OPTS);
      const config = extractConfig(code);
      expect(config.corsEnabled).toBe(true);
    }
  });
});

describe('generateGatewayWorkerCode — 6 Core API Gateway Features', () => {
  it('correctly injects all 6 core gateway feature configs into the worker code', async () => {
    const gatewayConfig = {
      upstreams: [{ url: 'https://api.example.com', weight: 100 }, { url: 'https://staging.example.com', weight: 100 }],
      pathRoutes: [{ path: '/v1/*', upstreamIndex: 0, priority: 1 }],
      corsEnabled: true,
      corsOrigins: ['https://app.example.com'],
      rateLimitEnabled: true,
      rateLimitRequestsPerMinute: 120,
      rateLimitKeyType: 'header' as const,
      rateLimitHeaderName: 'X-API-Key',
      pathRateLimits: [{ path: '/auth/login', requestsPerMinute: 5, priority: 1 }],
      cacheConfig: {
        enabled: true,
        ttlSeconds: 300,
        paths: ['/public/*'],
        normalizeQuery: true,
      },
      bffRoutes: [
        { path: '/composite/feed', upstreamIndices: [0, 1], priority: 1 },
      ],
      shadowConfig: {
        enabled: true,
        percentage: 15,
        upstreamIndex: 1,
      },
      jwtAuth: {
        enabled: true,
        headerName: 'Authorization',
        algorithms: ['HS256'],
        issuer: null,
        secret: 'super-secret-key-32-chars-long!!',
        rbacRules: [{ path: '/admin/*', requiredRoles: ['admin', 'manager'] }],
        injectHeaders: true,
      },
      bodyTransforms: [
        {
          path: '/api/users',
          phase: 'response' as const,
          stripFields: ['password_hash', 'ssn'],
          renameFields: [{ from: '_id', to: 'id' }],
        },
      ],
      schemaRules: [
        {
          path: '/api/checkout',
          method: 'POST',
          requiredFields: ['cartId', 'amount'],
          fieldTypes: [
            { field: 'cartId', type: 'string' as const },
            { field: 'amount', type: 'number' as const },
          ],
        },
      ],
    };

    const code = await generateGatewayWorkerCode(gatewayConfig, OPTS);
    const config = extractConfig(code);

    // Feature 1: Identity-Based Rate Limiting
    expect(config.rateLimitKeyType).toBe('header');
    expect(config.rateLimitHeaderName).toBe('X-API-Key');
    expect(config.rateLimitRequestsPerMinute).toBe(120);
    expect(config.pathRateLimits).toEqual([{ path: '/auth/login', requestsPerMinute: 5, priority: 1 }]);

    // Feature 2: API Composition & BFF Aggregation
    expect(config.bffRoutes).toEqual([{ path: '/composite/feed', upstreamIndices: [0, 1], priority: 1 }]);

    // Feature 3: Semantic Caching & Asynchronous Traffic Shadowing
    expect(config.cacheConfig.normalizeQuery).toBe(true);
    expect(config.shadowConfig).toEqual({ enabled: true, percentage: 15, upstreamIndex: 1 });

    // Feature 4: Fine-Grained AuthZ & Claim Injection
    expect(config.jwtAuth.rbacRules).toEqual([{ path: '/admin/*', requiredRoles: ['admin', 'manager'] }]);
    expect(config.jwtAuth.injectHeaders).toBe(true);

    // Feature 5: Request & Response Body Shaping
    expect(config.bodyTransforms).toEqual([
      {
        path: '/api/users',
        phase: 'response',
        stripFields: ['password_hash', 'ssn'],
        renameFields: [{ from: '_id', to: 'id' }],
      },
    ]);

    // Feature 6: Contract & Schema Validation
    expect(config.schemaRules).toEqual([
      {
        path: '/api/checkout',
        method: 'POST',
        requiredFields: ['cartId', 'amount'],
        fieldTypes: [
          { field: 'cartId', type: 'string' },
          { field: 'amount', type: 'number' },
        ],
      },
    ]);
  });
});
