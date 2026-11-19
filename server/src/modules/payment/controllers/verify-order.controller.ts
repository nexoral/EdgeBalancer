import { PaymentHistory } from '../../../models/PaymentHistory';
import { fetchOrderPayments } from '../services/cashfree.service';
import { activatePlan } from '../services/subscription.service';
import type { AppHandler } from '../../../types/http';
import type { PlanType } from '../../../config/plans';

/** POST /api/payments/verify — Server-side order verification, jitter polling calls this. */
export const verifyPaymentOrder: AppHandler = async (req, res) => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401);
    throw new Error('Authentication required');
  }

  const orderId = (req.body?.orderId as string)?.trim();
  if (!orderId) {
    res.status(400);
    throw new Error('orderId is required');
  }

  const payment = await PaymentHistory.findOne({ orderId, userId });
  if (!payment) {
    res.status(404);
    throw new Error('Order not found');
  }
  if ((payment.status as string) === 'SUCCESS') {
    res.json({ success: true, data: { verified: true, status: 'SUCCESS' }, message: 'Payment verified' });
    return;
  }

  let cfStatus: string | null = null;
  try {
    const data: any = await fetchOrderPayments(orderId);
    const payments: any[] = Array.isArray(data) ? data : data?.payments ?? data?.data ?? [];
    const latest = payments[0];
    cfStatus = latest?.payment_status || latest?.status || data?.order_status || null;
    const success = cfStatus === 'SUCCESS' || cfStatus === 'PAID';
    if (success && payment.status !== 'SUCCESS') {
      payment.status = 'SUCCESS';
      payment.cfPaymentId = String(latest?.cf_payment_id || latest?.payment_id || '');
      const pm = latest?.payment_method;
      if (pm) payment.paymentMethod = typeof pm === 'object' ? Object.keys(pm)[0] : String(pm);
      await payment.save();
      await activatePlan(userId, payment._id);
      res.json({ success: true, data: { verified: true, status: 'SUCCESS' }, message: 'Payment verified' });
      return;
    }
    if (cfStatus === 'FAILED' || cfStatus === 'USER_DROPPED') {
      payment.status = 'FAILED';
      await payment.save();
      res.json({ success: true, data: { verified: false, status: cfStatus }, message: 'Payment failed' });
      return;
    }
  } catch (e: any) {
    console.error('[verify] Cashfree fetch failed:', e?.message);
  }

  res.json({ success: true, data: { verified: false, status: cfStatus ?? payment.status }, message: 'Payment pending' });
};
