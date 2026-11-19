import type { IUser, SecondFactorMethod } from '../models/User';
import { confirmedDevices, hasTotp } from '../services/totpService';
import type { AppResponse } from '../types/http';
import { generateToken } from './jwt';
import { resolvePlan, type PlanType } from '../config/plans';

export const CHALLENGE_COOKIE = 'eb_2fa';
export const PASSKEY_REG_COOKIE = 'eb_pk_reg';

const SESSION_MAX_AGE = 24 * 60 * 60 * 1000;
const CHALLENGE_MAX_AGE = 5 * 60 * 1000;

const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge,
});

export const availableMethods = (user: IUser): SecondFactorMethod[] => {
  const methods: SecondFactorMethod[] = [];
  if (user.passkeys.length > 0) methods.push('passkey');
  if (hasTotp(user)) methods.push('totp');
  return methods;
};

export const hasSecondFactor = (user: IUser): boolean => availableMethods(user).length > 0;

/** The user object every authenticated response returns. Secrets never appear here. */
export const toUserPayload = (user: IUser) => {
  const payment = user.paymentId && typeof user.paymentId === 'object' && 'plan' in user.paymentId
    ? (user.paymentId as any)
    : null;
  const rawPlan = (payment?.plan || 'free') as PlanType;
  const rawExpiresAt = payment?.expiresAt ? new Date(payment.expiresAt) : null;
  const plan: PlanType = resolvePlan(rawPlan, rawExpiresAt);
  const planExpiresAt = plan === 'free' || !rawExpiresAt ? null : rawExpiresAt.toISOString();
  const isSubscribed = plan !== 'free';
  const isPro = plan === 'pro' || plan === 'pro-annual';

  return {
    id: user._id,
    name: user.name,
    email: user.email,
    username: user.username,
    hasCloudflareCredentials: !!(user.cloudflareAccountId && (user.cloudflareApiToken || user.cloudflareOAuthConnected)),
    cloudflareOAuthConnected: !!user.cloudflareOAuthConnected,
    totpEnabled: hasTotp(user),
    totpDevices: confirmedDevices(user).map((device) => ({
      id: device._id.toString(),
      name: device.name,
      createdAt: device.createdAt,
    })),
    passkeys: user.passkeys.map((passkey) => ({
      id: passkey._id.toString(),
      name: passkey.name,
      createdAt: passkey.createdAt,
    })),
    preferredSecondFactor: user.preferredSecondFactor ?? null,
    plan,
    planExpiresAt,
    isPro,
    isSubscribed,
    hasEverSubscribed: !!user.hasEverSubscribed,
  };
};

export const issueSessionCookie = (res: AppResponse, user: IUser): void => {
  const token = generateToken({
    userId: user._id.toString(),
    email: user.email,
    firebaseUid: user.firebaseUid,
  });

  res.cookie('token', token, cookieOptions(SESSION_MAX_AGE));
};

/**
 * Proves the Google step passed without granting access. Deliberately a different cookie name from
 * the session, and marked with `stage` so `authenticate` rejects it if it is ever moved.
 */
export const issueChallengeCookie = (res: AppResponse, user: IUser, challenge?: string): void => {
  const token = generateToken(
    { userId: user._id.toString(), email: user.email, stage: 'pending-2fa', challenge },
    '5m'
  );

  res.cookie(CHALLENGE_COOKIE, token, cookieOptions(CHALLENGE_MAX_AGE));
};

/** Same trick for enrolment: the WebAuthn challenge rides in a signed cookie, not in a store. */
export const issuePasskeyRegCookie = (res: AppResponse, user: IUser, challenge: string): void => {
  const token = generateToken(
    { userId: user._id.toString(), stage: 'passkey-register', challenge },
    '5m'
  );

  res.cookie(PASSKEY_REG_COOKIE, token, cookieOptions(CHALLENGE_MAX_AGE));
};
