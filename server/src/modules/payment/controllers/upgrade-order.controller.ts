import { PaymentHistory } from '../../../models/PaymentHistory';
import { User } from '../../../models/User';
import { PLANS, type PlanType, resolvePlan } from '../../../config/plans';
import { createOrder } from '../services/cashfree.service';
import { activatePlan } from '../services/subscription.service';
import type { AppHandler } from '../../../types/http';

const VALID_TO_PLANS: PlanType[] = ['student', 'pro', 'student-annual', 'pro-annual'];

export const createUpgradeOrder: AppHandler = async (req, res) => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401);
    throw new Error('Authentication required');
  }

  const toPlan = req.body?.toPlan as string;
  if (!toPlan || !VALID_TO_PLANS.includes(toPlan as PlanType)) {
    res.status(400);
    throw new Error('Invalid upgrade plan. Choose: student, student-annual, pro, or pro-annual');
  }

  const to = toPlan as PlanType;
  const toConfig = PLANS[to];

  const user = await User.findById(userId).select('plan planExpiresAt hasEverSubscribed').lean() as any;
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  const from = resolvePlan(user.plan, user.planExpiresAt) as PlanType;

  if (from === 'free') {
    res.status(400);
    throw new Error('No active plan to upgrade. Use the regular checkout instead.');
  }
  if (from === to) {
    res.status(400);
    throw new Error('You are already on this plan');
  }

  const fromConfig = PLANS[from];
  if (!fromConfig) {
    res.status(400);
    throw new Error('Current plan not found');
  }

  const fromPrice = fromConfig.price;
  const toPrice = toConfig.price;
  if (toPrice <= fromPrice) {
    res.status(400);
    throw new Error('Downgrades are not available. Choose a higher priced plan.');
  }

  const payable = toPrice - fromPrice;
  const durationDays = toConfig.durationDays;
  const toLabel = toConfig.name;

  if (payable <= 0) {
    res.status(400);
    throw new Error('Invalid upgrade amount');
  }

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

  // Trial is free but still forfeited — full tenure of new plan from now
  let order;
  try {
    const rawPhone = (req.body?.phone as string)?.trim();
    if (rawPhone && !/^[6-9]\d{9}$/.test(rawPhone) && !/^\+\d{10,15}$/.test(rawPhone)) {
      res.status(400);
      throw new Error('Invalid phone: 10-digit IN or E.164 required');
    }
    const phone = rawPhone || '0000000000';
    const orderNote = `EdgeBalancer Upgrade ${fromConfig.label} → ${toLabel} — ${durationDays} days`;
    order = await createOrder(userId, req.user?.email, phone, payable, orderNote);
  } catch (err: any) {
    const cfMessage = err?.response?.data?.message || err?.message || 'Unknown error';
    console.error('Cashfree upgrade order failed:', cfMessage);
    res.status(502);
    throw new Error(`Payment gateway error: ${cfMessage}`);
  }

  // Record as PENDING with the *target* plan; webhook/verify will activate it
  await PaymentHistory.create({
    userId,
    orderId: order.orderId,
    cfOrderId: order.cfOrderId ?? undefined,
    paymentSessionId: order.paymentSessionId ?? undefined,
    amount: payable,
    currency: 'INR',
    status: 'PENDING',
    plan: to,
    expiresAt: new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000),
  });

  res.json({
    success: true,
    message: 'Upgrade order created',
    data: {
      orderId: order.orderId,
      paymentSessionId: order.paymentSessionId,
      fromPlan: from,
      toPlan: to,
      fromPrice,
      toPrice,
      payable,
      durationDays,
    },
  });
};
