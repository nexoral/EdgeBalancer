import { generateWorkerCode } from '../../services/workerGenerator';

const BASE_ORIGINS = [{ url: 'https://origin.example.com', weight: 100 }];

const extractConfig = (code: string) => {
  // Template produces: const config = {...};
  const match = code.match(/const config = ({[\s\S]*?});/);
  if (!match) throw new Error('Config block not found in generated code');
  return JSON.parse(match[1]);
};

describe('generateWorkerCode — exposeRealOrigin', () => {
  it('injects exposeRealOrigin: true when explicitly set', () => {
    const code = generateWorkerCode({ origins: BASE_ORIGINS, strategy: 'round-robin', exposeRealOrigin: true });
    const config = extractConfig(code);
    expect(config.exposeRealOrigin).toBe(true);
  });

  it('injects exposeRealOrigin: false when explicitly set', () => {
    const code = generateWorkerCode({ origins: BASE_ORIGINS, strategy: 'round-robin', exposeRealOrigin: false });
    const config = extractConfig(code);
    expect(config.exposeRealOrigin).toBe(false);
  });

  it('defaults exposeRealOrigin to false when omitted', () => {
    const code = generateWorkerCode({ origins: BASE_ORIGINS, strategy: 'round-robin' });
    const config = extractConfig(code);
    expect(config.exposeRealOrigin).toBe(false);
  });

  it('exposeRealOrigin: true and false produce different worker code', () => {
    const withTrue = generateWorkerCode({ origins: BASE_ORIGINS, strategy: 'round-robin', exposeRealOrigin: true });
    const withFalse = generateWorkerCode({ origins: BASE_ORIGINS, strategy: 'round-robin', exposeRealOrigin: false });
    expect(withTrue).not.toBe(withFalse);
  });

  it('works correctly for every non-paused strategy', () => {
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
      const code = generateWorkerCode({ origins: BASE_ORIGINS, strategy, exposeRealOrigin: true });
      const config = extractConfig(code);
      expect(config.exposeRealOrigin).toBe(true);
    }
  });
});

// ─── CORS ─────────────────────────────────────────────────────────────────────

describe('generateWorkerCode — CORS', () => {
  it('injects corsEnabled: true when explicitly set', () => {
    const code = generateWorkerCode({ origins: BASE_ORIGINS, strategy: 'round-robin', corsEnabled: true });
    const config = extractConfig(code);
    expect(config.corsEnabled).toBe(true);
  });

  it('injects corsEnabled: false when explicitly set', () => {
    const code = generateWorkerCode({ origins: BASE_ORIGINS, strategy: 'round-robin', corsEnabled: false });
    const config = extractConfig(code);
    expect(config.corsEnabled).toBe(false);
  });

  it('defaults corsEnabled to false when omitted', () => {
    const code = generateWorkerCode({ origins: BASE_ORIGINS, strategy: 'round-robin' });
    const config = extractConfig(code);
    expect(config.corsEnabled).toBe(false);
  });

  it('embeds corsOrigins array in the config', () => {
    const corsOrigins = ['https://a.com', 'https://b.com'];
    const code = generateWorkerCode({ origins: BASE_ORIGINS, strategy: 'round-robin', corsEnabled: true, corsOrigins });
    const config = extractConfig(code);
    expect(config.corsOrigins).toEqual(corsOrigins);
  });

  it('corsEnabled: true and corsEnabled: false produce different worker code', () => {
    const withTrue  = generateWorkerCode({ origins: BASE_ORIGINS, strategy: 'round-robin', corsEnabled: true });
    const withFalse = generateWorkerCode({ origins: BASE_ORIGINS, strategy: 'round-robin', corsEnabled: false });
    expect(withTrue).not.toBe(withFalse);
  });

  it('includes corsEnabled in the config for every strategy', () => {
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
      const code = generateWorkerCode({ origins: BASE_ORIGINS, strategy, corsEnabled: true });
      const config = extractConfig(code);
      expect(config.corsEnabled).toBe(true);
    }
  });
});
