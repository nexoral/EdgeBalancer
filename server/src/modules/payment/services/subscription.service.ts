import { Types } from 'mongoose';
import { User } from '../../../models/User';
import type { IUser } from '../../../models/User';
import { PaymentHistory } from '../../../models/PaymentHistory';
import {
  getUserPlan as getUserPlanCached,
  setPlanCache,
  removePlanCache,
  isUserPro as isUserProCached,
} from '../../../utils/proCache';
import { PLANS, type PlanType } from '../../../config/plans';
import type { AppHandler } from '../../../types/http';

export async function getUserPlan(userId: string): Promise<{ plan: PlanType; expiresAt: Date | null }> {
  return getUserPlanCached(userId);
}

export async function isUserPro(userId: string): Promise<boolean> {
  return isUserProCached(userId);
}

export async function activatePlan(userId: string, paymentHistoryId: Types.ObjectId | string): Promise<IUser> {
  const user = await User.findById(userId).populate<{ paymentId: any }>('paymentId');
  if (!user) throw new Error('User not found');

  const payment = await PaymentHistory.findById(paymentHistoryId);
  if (!payment) throw new Error('Payment record not found');

  const config = PLANS[payment.plan as PlanType];
  const now = new Date();
  const oldPayment = user.paymentId;
  const oldExpiry = oldPayment?.expiresAt ? new Date(oldPayment.expiresAt) : null;
  const oldPlan = oldPayment?.plan;

  if (config?.durationDays) {
    if (oldPlan === payment.plan && oldExpiry && oldExpiry > now) {
      payment.expiresAt = new Date(oldExpiry.getTime() + config.durationDays * 24 * 60 * 60 * 1000);
    } else {
      payment.expiresAt = new Date(now.getTime() + config.durationDays * 24 * 60 * 60 * 1000);
    }
    await payment.save();
  }

  user.paymentId = payment._id;
  user.hasEverSubscribed = true;
  await user.save();

  await setPlanCache(userId, payment.plan as PlanType, payment.expiresAt ?? null);

  return user;
}

export async function downgradeToFree(userId: string): Promise<void> {
  await User.findByIdAndUpdate(userId, { paymentId: null });
  await removePlanCache(userId);
}

/** Middleware that blocks non-Pro users */
export const requirePro: AppHandler = async (req, res, next) => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401);
    throw new Error('Authentication required');
  }

  if (!(await isUserPro(userId))) {
    res.status(403);
    throw new Error('This feature requires an EdgeBalancer Pro subscription');
  }

  next();
};

/** Middleware that blocks non-subscribed users */
export const requireSubscribed: AppHandler = async (req, res, next) => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401);
    throw new Error('Authentication required');
  }

  const { plan } = await getUserPlan(userId);
  if (plan === 'free') {
    res.status(403);
    throw new Error('This feature requires an active subscription');
  }

  next();
};
