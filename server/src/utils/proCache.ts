import { getRedisClient } from './redisClient';
import { User } from '../models/User';
import { resolvePlan, PLANS, type PlanType } from '../config/plans';

const KEY_PREFIX = 'plan:';

function redisKey(userId: string): string {
  return `${KEY_PREFIX}${userId}`;
}

export interface UserPlanInfo {
  plan: PlanType;
  expiresAt: Date | null;
}

const DEFAULT_TTL = 2 * 60 * 60;

export async function setPlanCache(userId: string, plan: PlanType, planExpiresAt: Date | null): Promise<void> {
  try {
    const redis = await getRedisClient();
    if (!planExpiresAt || plan === 'free') {
      await redis.set(redisKey(userId), plan, { EX: DEFAULT_TTL });
      return;
    }
    const ttlMs = planExpiresAt.getTime() - Date.now();
    if (ttlMs <= 0) return;
    const ttlSeconds = Math.min(Math.ceil(ttlMs / 1000), DEFAULT_TTL);
    await redis.set(redisKey(userId), plan, { EX: ttlSeconds });
  } catch {
    // Redis down — cache miss is fine
  }
}

/**
 * Remove plan info from Redis.
 */
export async function removePlanCache(userId: string): Promise<void> {
  try {
    const redis = await getRedisClient();
    await redis.del(redisKey(userId));
  } catch {
    // Redis down — key will expire naturally
  }
}

const inflight = new Map<string, Promise<UserPlanInfo>>();

export async function getUserPlan(userId: string): Promise<UserPlanInfo> {
  try {
    const redis = await getRedisClient();
    const cached = await redis.get(redisKey(userId));
    if (cached && cached !== 'free') {
      return { plan: cached as PlanType, expiresAt: null };
    }
    if (cached === 'free') {
      // free is cached for 2hr — still re-validate DB, but coalesce stampede
    }
  } catch {}

  if (inflight.has(userId)) {
    return inflight.get(userId)!;
  }

  const promise = (async (): Promise<UserPlanInfo> => {
    try {
      const user = await User.findById(userId).populate<{ paymentId: any }>('paymentId').lean() as any;
      if (!user || !user.paymentId) {
        void setPlanCache(userId, 'free', null);
        return { plan: 'free', expiresAt: null };
      }

      const payment = user.paymentId;
      const plan = (payment.plan || 'free') as PlanType;
      const expiresAt = payment.expiresAt ? new Date(payment.expiresAt) : null;
      const resolved = resolvePlan(plan, expiresAt);

      if (resolved !== 'free') {
        void setPlanCache(userId, resolved, expiresAt);
      } else {
        void setPlanCache(userId, 'free', null);
      }

      return { plan: resolved, expiresAt: resolved === 'free' ? null : expiresAt };
    } catch {
      return { plan: 'free', expiresAt: null };
    }
  })();

  inflight.set(userId, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(userId);
  }
}

/** Backward-compatible: check if user has Pro plan */
export async function isUserPro(userId: string): Promise<boolean> {
  const { plan } = await getUserPlan(userId);
  return plan === 'pro' || plan === 'pro-annual';
}

/** Check if user has any paid plan (student, trial, or pro) */
export async function isUserSubscribed(userId: string): Promise<boolean> {
  const { plan } = await getUserPlan(userId);
  return plan !== 'free';
}
