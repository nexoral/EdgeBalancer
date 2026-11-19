import { PaymentHistory } from '../../../models/PaymentHistory';
import { activatePlan } from '../services/subscription.service';
import { verifyWebhookSignature } from '../services/cashfree.service';
import type { AppHandler } from '../../../types/http';
import type { PlanType } from '../../../config/plans';

/**
 * POST /api/payments/webhook — Cashfree webhook handler.
 * No auth — Cashfree calls this externally. We verify the signature instead.
 * This is the source of truth for payment success (not the frontend redirect).
 *
 * Cashfree webhook payload structure:
 * {
 *   type: "PAYMENT_SUCCESS_WEBHOOK" | "PAYMENT_FAILED_WEBHOOK" | ...,
 *   data: {
 *     order: { order_id, order_amount, order_currency },
 *     payment: { payment_status: "SUCCESS"|"FAILED"|..., cf_payment_id, payment_method },
 *     customer_details: { customer_id, customer_email }
 *   }
 * }
 */
export const handleWebhook: AppHandler = async (req, res) => {
  const signature = req.headers['x-webhook-signature'] as string;
  const timestamp = req.headers['x-webhook-timestamp'] as string;
  const rawBody = (req as any).rawBody;

  if (!signature || !timestamp || !rawBody) {
    res.status(200).json({ received: true });
    return;
  }

  if (!verifyWebhookSignature(timestamp, rawBody, signature)) {
    console.error('[Webhook] Signature verification failed');
    res.status(401);
    throw new Error('Invalid webhook signature');
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    res.status(200).json({ received: true });
    return;
  }

  // Extract from Cashfree's actual payload structure
  const orderId = payload?.data?.order?.order_id;
  const paymentStatus = payload?.data?.payment?.payment_status;
  const eventType = payload?.type;
  const paymentMethodRaw = payload?.data?.payment?.payment_method || null;
  // Extract just the type: "netbanking", "upi", "card", etc.
  const paymentMethod = paymentMethodRaw && typeof paymentMethodRaw === 'object'
    ? Object.keys(paymentMethodRaw)[0] || null
    : typeof paymentMethodRaw === 'string' ? paymentMethodRaw : null;
  const cfPaymentId = payload?.data?.payment?.cf_payment_id || null;

  if (!orderId) {
    res.status(200).json({ received: true });
    return;
  }

  const payment = await PaymentHistory.findOne({ orderId });
  if (!payment) {
    res.status(200).json({ received: true });
    return;
  }

  // payment_status from Cashfree: "SUCCESS", "FAILED", "PENDING"
  // eventType: "PAYMENT_SUCCESS_WEBHOOK", "PAYMENT_FAILED_WEBHOOK", "USER_DROPPED_PAYMENT"
  if ((payment.status as string) === 'SUCCESS') {
    res.status(200).json({ received: true });
    return;
  }
  if (paymentStatus === 'SUCCESS' && (payment.status as string) !== 'SUCCESS') {
    payment.status = 'SUCCESS';
    payment.paymentMethod = paymentMethod ?? undefined;
    if (cfPaymentId) payment.cfPaymentId = String(cfPaymentId);
    await payment.save();
    try {
      await activatePlan(payment.userId.toString(), payment.plan as PlanType);
    } catch (e) {
      payment.status = 'PENDING';
      await payment.save();
      throw e;
    }
    console.log('[Webhook] Payment SUCCESS, plan activated:', payment.plan, 'for user:', payment.userId);
  } else if ((paymentStatus === 'FAILED' || eventType === 'PAYMENT_FAILED_WEBHOOK') && payment.status === 'PENDING') {
    payment.status = 'FAILED';
    await payment.save();
    console.log('[Webhook] Payment FAILED for order:', orderId);
  } else if (
    (eventType === 'USER_DROPPED_PAYMENT' ||
      eventType === 'PAYMENT_USER_DROPPED_WEBHOOK' ||
      paymentStatus === 'USER_DROPPED') &&
    payment.status === 'PENDING'
  ) {
    await PaymentHistory.deleteOne({ _id: payment._id, status: 'PENDING' });
    console.log('[Webhook] User dropped payment, deleted pending order:', orderId);
  }

  res.status(200).json({ received: true });
};
