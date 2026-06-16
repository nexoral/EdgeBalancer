import { configSignature } from '../../modules/loadbalancer/services/snapshot.service';

const BASE = {
  origins: [{ url: 'https://origin.example.com', weight: 100 }],
  strategy: 'round-robin',
  weightedEnabled: false,
  placement: { smartPlacement: false },
};

describe('configSignature — exposeRealOrigin', () => {
  it('produces different signatures when exposeRealOrigin changes false → true', () => {
    const sig1 = configSignature({ ...BASE, exposeRealOrigin: false });
    const sig2 = configSignature({ ...BASE, exposeRealOrigin: true });
    expect(sig1).not.toBe(sig2);
  });

  it('treats undefined the same as false', () => {
    const withUndefined = configSignature({ ...BASE });
    const withFalse = configSignature({ ...BASE, exposeRealOrigin: false });
    expect(withUndefined).toBe(withFalse);
  });

  it('produces the same signature for identical configs', () => {
    const sig1 = configSignature({ ...BASE, exposeRealOrigin: true });
    const sig2 = configSignature({ ...BASE, exposeRealOrigin: true });
    expect(sig1).toBe(sig2);
  });

  it('config change in origins still produces different signature regardless of exposeRealOrigin', () => {
    const sig1 = configSignature({ ...BASE, exposeRealOrigin: true, origins: [{ url: 'https://a.example.com', weight: 100 }] });
    const sig2 = configSignature({ ...BASE, exposeRealOrigin: true, origins: [{ url: 'https://b.example.com', weight: 100 }] });
    expect(sig1).not.toBe(sig2);
  });
});

// ─── CORS ─────────────────────────────────────────────────────────────────────

describe('configSignature — CORS', () => {
  it('produces different signatures when corsEnabled changes false → true', () => {
    const sig1 = configSignature({ ...BASE, corsEnabled: false });
    const sig2 = configSignature({ ...BASE, corsEnabled: true });
    expect(sig1).not.toBe(sig2);
  });

  it('produces different signatures for different corsOrigins arrays', () => {
    const sig1 = configSignature({ ...BASE, corsEnabled: true, corsOrigins: ['https://a.com'] });
    const sig2 = configSignature({ ...BASE, corsEnabled: true, corsOrigins: ['https://b.com'] });
    expect(sig1).not.toBe(sig2);
  });

  it('produces the SAME signature when corsOrigins are the same but in different order', () => {
    const sig1 = configSignature({ ...BASE, corsEnabled: true, corsOrigins: ['https://a.com', 'https://b.com'] });
    const sig2 = configSignature({ ...BASE, corsEnabled: true, corsOrigins: ['https://b.com', 'https://a.com'] });
    expect(sig1).toBe(sig2);
  });

  it('treats corsEnabled: undefined the same as corsEnabled: false', () => {
    const withUndefined = configSignature({ ...BASE });
    const withFalse     = configSignature({ ...BASE, corsEnabled: false });
    expect(withUndefined).toBe(withFalse);
  });
});
