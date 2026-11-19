import { PaymentHistory } from '../../../models/PaymentHistory';
import { User } from '../../../models/User';
import { PLANS, type PlanType } from '../../../config/plans';
import { createOrder } from '../services/cashfree.service';
import { activatePlan, getUserPlan } from '../services/subscription.service';
import type { AppHandler } from '../../../types/http';
import { resolvePlan } from '../../../config/plans';

const VALID_PLANS: PlanType[] = ['trial', 'student', 'pro', 'student-annual', 'pro-annual'];

/** POST /api/payments — Create a Cashfree order for a subscription plan */
export const createPaymentOrder: AppHandler = async (req, res) => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401);
    throw new Error('Authentication required');
  }

  const planType = req.body?.planType as string;
  if (!planType || !VALID_PLANS.includes(planType as PlanType)) {
    res.status(400);
    throw new Error('Invalid plan type. Must be: trial, student, student-annual, pro, pro-annual');
  }

  const plan = planType as PlanType;
  const config = PLANS[plan];

  const user = await User.findById(userId).select('hasEverSubscribed').lean();
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  const { plan: currentPlan } = await getUserPlan(userId);
  if (currentPlan !== 'free') {
    res.status(400);
    throw new Error('You already have an active subscription');
  }

  // Trial: only for users who never subscribed
  if (plan === 'trial' && user.hasEverSubscribed) {
    res.status(400);
    throw new Error('Trial is only available for first-time subscribers');
  }

  const durationDays = config.durationDays;
  const amount = config.price;

  const PENDING_WINDOW_MS = 15 * 60 * 1000;
  const recentPending = await PaymentHistory.findOne({
    userId,
    status: 'PENDING',
    createdAt: { $gte: new Date(Date.now() - PENDING_WINDOW_MS) },
  }).lean();
  if (recentPending) {
    const expiresAt = new Date(recentPending.createdAt.getTime() + PENDING_WINDOW_MS).toISOString();
    res.status(409).json({
      success: false,
      message: 'A pending order already exists. Please complete or wait for it to expire.',
      data: { expiresAt },
    });
    return;
  }

  // Free trial: skip Cashfree, activate directly
  if (amount === 0) {
    const updated = await User.findOneAndUpdate({ _id: userId, hasEverSubscribed: { $ne: true } }, { $set: { hasEverSubscribed: true } });
    if (!updated) {
      const fresh = await User.findById(userId).select('hasEverSubscribed').lean() as any;
      if (fresh?.hasEverSubscribed) {
        res.status(409);
        throw new Error('Trial is only available for first-time subscribers');
      }
    }
    const trialPayment = await PaymentHistory.create({
      userId,
      orderId: `trial-${userId}-${Date.now()}`,
      amount: 0,
      currency: 'INR',
      status: 'SUCCESS',
      plan,
      expiresAt: new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000),
    });

    await activatePlan(userId, trialPayment._id);

    res.json({
      success: true,
      message: 'Trial activated',
      data: { orderId: null, paymentSessionId: null, plan, amount: 0, trialActivated: true },
    });
    return;
  }

  let order;
  try {
    const rawPhone = (req.body?.phone as string)?.trim();
    if (rawPhone && !/^[6-9]\d{9}$/.test(rawPhone) && !/^\+\d{10,15}$/.test(rawPhone)) {
      res.status(400);
      throw new Error('Invalid phone: 10-digit IN or E.164 required');
    }
    const phone = rawPhone || '0000000000';
    // The note shown on the gateway checkout carries the real plan and duration.
    const planLabel = config.name;
    const orderNote = `EdgeBalancer ${planLabel} - ${durationDays} days pass`;
    order = await createOrder(userId, req.user?.email, phone, amount, orderNote);
  } catch (err: any) {
    const cfMessage = err?.response?.data?.message || err?.message || 'Unknown error';
    console.error('Cashfree createOrder failed:', cfMessage);
    res.status(502);
    throw new Error(`Payment gateway error: ${cfMessage}`);
  }

  await PaymentHistory.create({
    userId,
    orderId: order.orderId,
    cfOrderId: order.cfOrderId ?? undefined,
    paymentSessionId: order.paymentSessionId ?? undefined,
    amount,
    currency: 'INR',
    status: 'PENDING',
    plan,
    expiresAt: new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000),
  });

  res.json({
    success: true,
    message: 'Order created',
    data: { orderId: order.orderId, paymentSessionId: order.paymentSessionId, plan, amount },
  });
};
