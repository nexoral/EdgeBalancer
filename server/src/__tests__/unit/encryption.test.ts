import { encrypt, decrypt } from '../../utils/encryption';

const PLAINTEXT = 'super-secret-value-1234';

describe('encrypt', () => {
  it('returns encrypted, iv, and tag as non-empty hex strings', () => {
    const result = encrypt(PLAINTEXT);
    expect(typeof result.encrypted).toBe('string');
    expect(typeof result.iv).toBe('string');
    expect(typeof result.tag).toBe('string');
    expect(result.encrypted.length).toBeGreaterThan(0);
    expect(result.iv.length).toBeGreaterThan(0);
    expect(result.tag.length).toBeGreaterThan(0);
  });

  it('does not store plaintext in the encrypted output', () => {
    const { encrypted } = encrypt(PLAINTEXT);
    expect(encrypted).not.toBe(PLAINTEXT);
    expect(encrypted).not.toContain(PLAINTEXT);
  });

  it('uses a random IV so repeated encryptions differ', () => {
    const a = encrypt(PLAINTEXT);
    const b = encrypt(PLAINTEXT);
    expect(a.iv).not.toBe(b.iv);
    expect(a.encrypted).not.toBe(b.encrypted);
  });
});

describe('decrypt', () => {
  it('round-trips to the original plaintext', () => {
    const { encrypted, iv, tag } = encrypt(PLAINTEXT);
    expect(decrypt(encrypted, iv, tag)).toBe(PLAINTEXT);
  });

  it('throws when the auth tag is tampered', () => {
    const { encrypted, iv } = encrypt(PLAINTEXT);
    const badTag = '0'.repeat(32);
    expect(() => decrypt(encrypted, iv, badTag)).toThrow();
  });
});
