import jwt from 'jsonwebtoken';
import { User } from '../../models/User';
import { PaymentHistory } from '../../models/PaymentHistory';
import type { JwtPayload } from '../../utils/jwt';

const secret = () => process.env.JWT_SECRET!;

export function makeTestJwt(payload: JwtPayload): string {
  return jwt.sign(payload, secret(), { expiresIn: '1h' });
}

export function authCookieHeader(token: string): Record<string, string> {
  return { cookie: `token=${token}` };
}

export async function createTestUser(overrides: {
  name?: string;
  email?: string;
  firebaseUid?: string;
  plan?: 'free' | 'trial' | 'student' | 'pro' | 'student-annual' | 'pro-annual';
  planExpiresAt?: Date | null;
} = {}) {
  const name = overrides.name ?? 'Test User';
  const rawEmail = overrides.email ?? `testuser${Date.now()}@example.com`;
  const planExpiresAt = overrides.plan === 'free'
    ? null
    : overrides.planExpiresAt ?? (overrides.plan ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : undefined);

  let paymentId = null;
  if (overrides.plan && overrides.plan !== 'free') {
    const payment = await PaymentHistory.create({
      userId: new (User.base.Types.ObjectId)(),
      orderId: `test-order-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      amount: 299,
      currency: 'INR',
      status: 'SUCCESS',
      plan: overrides.plan,
      expiresAt: planExpiresAt ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
    paymentId = payment._id;
  }

  const user = await User.create({
    name,
    email: rawEmail.toLowerCase(),
    username: `u${Date.now()}${Math.floor(Math.random() * 9999)}`,
    ...(overrides.firebaseUid ? { firebaseUid: overrides.firebaseUid } : {}),
    ...(paymentId ? { paymentId, hasEverSubscribed: true } : {}),
  });

  if (paymentId) {
    await PaymentHistory.findByIdAndUpdate(paymentId, { userId: user._id });
    await user.populate('paymentId');
  }

  const token = makeTestJwt({
    userId: user._id.toString(),
    email: user.email ?? undefined,
  });

  return {
    user,
    token,
    cookie: authCookieHeader(token),
  };
}
