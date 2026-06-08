import jwt from 'jsonwebtoken';
import { generateToken, verifyToken } from '../../utils/jwt';

const payload = { userId: 'user123', email: 'test@example.com' };

describe('generateToken', () => {
  it('returns a string', () => {
    const token = generateToken(payload);
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
  });

  it('encodes userId and email in the token', () => {
    const token = generateToken(payload);
    const decoded = jwt.decode(token) as any;
    expect(decoded.userId).toBe('user123');
    expect(decoded.email).toBe('test@example.com');
  });
});

describe('verifyToken', () => {
  it('returns the original payload for a valid token', () => {
    const token = generateToken(payload);
    const result = verifyToken(token);
    expect(result.userId).toBe('user123');
    expect(result.email).toBe('test@example.com');
  });

  it('throws "Invalid or expired token" for a tampered token', () => {
    const token = generateToken(payload);
    expect(() => verifyToken(token + 'x')).toThrow('Invalid or expired token');
  });

  it('throws "Invalid or expired token" for an expired token', () => {
    const secret = process.env.JWT_SECRET!;
    const expired = jwt.sign(payload, secret, { expiresIn: -1 });
    expect(() => verifyToken(expired)).toThrow('Invalid or expired token');
  });

  it('throws "Invalid or expired token" for a token signed with a wrong secret', () => {
    const bad = jwt.sign(payload, 'wrong-secret');
    expect(() => verifyToken(bad)).toThrow('Invalid or expired token');
  });
});
