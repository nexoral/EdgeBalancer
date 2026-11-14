import { PaymentHistory } from '../../../models/PaymentHistory';
import type { AppHandler } from '../../../types/http';

const MAX_LIMIT = 50;

/** GET /api/payments/history — List user's payment records with cursor pagination */
export const listPayments: AppHandler = async (req, res) => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401);
    throw new Error('Authentication required');
  }

  const { cursor, limit: rawLimit } = req.query as { cursor?: string; limit?: string };
  const limit = Math.min(Math.max(Number(rawLimit) || 20, 1), MAX_LIMIT);

  const query: Record<string, any> = { userId, status: { $ne: 'PENDING' } };
  if (cursor) {
    const [createdAt, id] = cursor.split('_');
    query.$or = [
      { createdAt: { $lt: new Date(createdAt) } },
      { createdAt: new Date(createdAt), _id: { $lt: id } },
    ];
  }

  const payments = await PaymentHistory.find(query)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .select('orderId amount currency status paymentMethod expiresAt createdAt');

  const hasMore = payments.length > limit;
  const items = payments.slice(0, limit).map((p) => ({
    orderId: p.orderId,
    amount: p.amount,
    currency: p.currency,
    status: p.status,
    paymentMethod: p.paymentMethod || null,
    expiresAt: p.expiresAt,
    createdAt: p.createdAt,
  }));

  const last = items[items.length - 1];
  const nextCursor = hasMore && last
    ? `${last.createdAt.toISOString()}_${payments[limit - 1]._id}`
    : null;

  res.json({
    success: true,
    message: 'Payment history retrieved',
    data: { payments: items, nextCursor, hasMore },
  });
};
