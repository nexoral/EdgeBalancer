import { hashPassword, comparePassword } from '../../utils/password';

describe('hashPassword', () => {
  it('returns a bcrypt hash, not the plaintext', async () => {
    const hash = await hashPassword('SecurePass99');
    expect(hash).not.toBe('SecurePass99');
    expect(hash.startsWith('$2b$')).toBe(true);
  });

  it('produces a different hash on each call (salt)', async () => {
    const a = await hashPassword('SecurePass99');
    const b = await hashPassword('SecurePass99');
    expect(a).not.toBe(b);
  });
});

describe('comparePassword', () => {
  it('returns true for a matching password', async () => {
    const hash = await hashPassword('CorrectHorseBattery');
    await expect(comparePassword('CorrectHorseBattery', hash)).resolves.toBe(true);
  });

  it('returns false for a wrong password', async () => {
    const hash = await hashPassword('CorrectHorseBattery');
    await expect(comparePassword('WrongPassword', hash)).resolves.toBe(false);
  });
});
