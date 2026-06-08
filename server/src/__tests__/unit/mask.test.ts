import { maskToken, maskAccountId } from '../../utils/mask';

describe('maskToken', () => {
  it('shows last 4 chars with sk-... prefix', () => {
    expect(maskToken('abcdefghijklmnopqrst')).toBe('sk-...qrst');
  });

  it('returns **** for a token shorter than 4 chars', () => {
    expect(maskToken('abc')).toBe('****');
  });

  it('returns **** for an empty string', () => {
    expect(maskToken('')).toBe('****');
  });
});

describe('maskAccountId', () => {
  it('shows first 4 and last 4 chars with ... in between', () => {
    expect(maskAccountId('abcd1234efgh5678')).toBe('abcd...5678');
  });

  it('returns **** for an accountId shorter than 8 chars', () => {
    expect(maskAccountId('abc')).toBe('****');
  });

  it('returns **** for an empty string', () => {
    expect(maskAccountId('')).toBe('****');
  });
});
