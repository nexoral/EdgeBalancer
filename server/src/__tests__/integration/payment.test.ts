import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../app';
import { connectTestDb, clearCollections, closeTestDb } from '../helpers/db';
import { createTestUser } from '../helpers/auth';
import { PaymentHistory } from '../../models/PaymentHistory';
import * as cashfreeService from '../../modules/payment/services/cashfree.service';

jest.mock('../../modules/payment/services/cashfree.service', () => ({
  verifyWebhookSignature: jest.fn(),
  createOrder: jest.fn(),
  fetchOrderPayments: jest.fn(),
  getCashfreeEnv: jest.fn(),
}));

let app: FastifyInstance;

beforeAll(async () => {
  await connectTestDb();
  app = await buildServer();
});

afterEach(async () => {
  await clearCollections();
  jest.clearAllMocks();
});

afterAll(async () => {
  await app.close();
  await closeTestDb();
});

describe('Payment Webhook - User Dropped', () => {
  it('deletes pending payment record on USER_DROPPED_PAYMENT', async () => {
    (cashfreeService.verifyWebhookSignature as jest.Mock).mockReturnValue(true);

    const { user } = await createTestUser({ email: 'userdrop@example.com' });
    await PaymentHistory.create({
      userId: user._id,
      orderId: 'order_drop_1',
      amount: 299,
      currency: 'INR',
      status: 'PENDING',
      plan: 'pro',
      expiresAt: new Date(Date.now() + 30 * 86400000),
    });

    const payload = JSON.stringify({
      type: 'USER_DROPPED_PAYMENT',
      data: {
        order: { order_id: 'order_drop_1' },
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/payments/webhook',
      headers: {
        'x-webhook-signature': 'sig',
        'x-webhook-timestamp': '123456789',
        'content-type': 'application/json',
      },
      payload,
    });

    expect(res.statusCode).toBe(200);
    const existing = await PaymentHistory.findOne({ orderId: 'order_drop_1' });
    expect(existing).toBeNull();
  });

  it('deletes pending payment record on PAYMENT_USER_DROPPED_WEBHOOK', async () => {
    (cashfreeService.verifyWebhookSignature as jest.Mock).mockReturnValue(true);

    const { user } = await createTestUser({ email: 'userdrop2@example.com' });
    await PaymentHistory.create({
      userId: user._id,
      orderId: 'order_drop_2',
      amount: 299,
      currency: 'INR',
      status: 'PENDING',
      plan: 'pro',
      expiresAt: new Date(Date.now() + 30 * 86400000),
    });

    const payload = JSON.stringify({
      type: 'PAYMENT_USER_DROPPED_WEBHOOK',
      data: {
        order: { order_id: 'order_drop_2' },
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/payments/webhook',
      headers: {
        'x-webhook-signature': 'sig',
        'x-webhook-timestamp': '123456789',
        'content-type': 'application/json',
      },
      payload,
    });

    expect(res.statusCode).toBe(200);
    const existing = await PaymentHistory.findOne({ orderId: 'order_drop_2' });
    expect(existing).toBeNull();
  });
});

describe('Payment Creation - 409 with UTC Expiry', () => {
  it('returns 409 and data.expiresAt in UTC when pending order exists within 15 min', async () => {
    const { user, cookie } = await createTestUser({ email: 'pending_user@example.com' });
    const createdAt = new Date();
    await PaymentHistory.create({
      userId: user._id,
      orderId: 'order_pending_recent',
      amount: 299,
      currency: 'INR',
      status: 'PENDING',
      plan: 'pro',
      createdAt,
      expiresAt: new Date(Date.now() + 30 * 86400000),
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/payments',
      headers: {
        ...cookie,
        'content-type': 'application/json',
      },
      payload: {
        planType: 'pro',
      },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.message).toContain('A pending order already exists');
    expect(body.data).toBeDefined();
    expect(body.data.expiresAt).toBeDefined();

    const expectedExpiry = new Date(createdAt.getTime() + 15 * 60 * 1000).toISOString();
    expect(body.data.expiresAt).toBe(expectedExpiry);
  });
});

describe('Payment Success - Links paymentId to User', () => {
  it('updates user.paymentId and activates plan when payment succeeds', async () => {
    (cashfreeService.verifyWebhookSignature as jest.Mock).mockReturnValue(true);

    const { user, cookie } = await createTestUser({ email: 'successtest@example.com' });
    const payment = await PaymentHistory.create({
      userId: user._id,
      orderId: 'order_success_1',
      amount: 299,
      currency: 'INR',
      status: 'PENDING',
      plan: 'pro',
      expiresAt: new Date(Date.now() + 30 * 86400000),
    });

    const payload = JSON.stringify({
      type: 'PAYMENT_SUCCESS_WEBHOOK',
      data: {
        order: { order_id: 'order_success_1' },
        payment: { payment_status: 'SUCCESS', cf_payment_id: 'cf_123', payment_method: { upi: {} } },
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/payments/webhook',
      headers: {
        'x-webhook-signature': 'sig',
        'x-webhook-timestamp': '123456789',
        'content-type': 'application/json',
      },
      payload,
    });

    expect(res.statusCode).toBe(200);

    const meRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: cookie,
    });

    expect(meRes.statusCode).toBe(200);
    const meBody = meRes.json();
    expect(meBody.data.user.plan).toBe('pro');
    expect(meBody.data.user.isPro).toBe(true);
    expect(meBody.data.user.planExpiresAt).toBeDefined();

    const { User } = await import('../../models/User');
    const freshUser = await User.findById(user._id);
    expect(freshUser?.paymentId?.toString()).toBe(payment._id.toString());
  });
});
