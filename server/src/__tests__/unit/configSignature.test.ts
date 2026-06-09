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
