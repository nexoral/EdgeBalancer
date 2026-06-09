import type { FastifyInstance } from 'fastify';
import mongoose from 'mongoose';
import { buildServer } from '../../app';
import { connectTestDb, clearCollections, closeTestDb } from '../helpers/db';
import { createTestUser, makeTestJwt, authCookieHeader } from '../helpers/auth';
import { createSession } from '../../services/sessionService';

const FAKE_LB_ID = new mongoose.Types.ObjectId().toString();

const BASE_SESSION = {
  email: 'test@example.com',
  content: '// worker script',
  loadBalancerName: 'my-lb',
  domain: 'example.com',
  subdomain: null,
  strategy: 'round-robin',
  placement: { smartPlacement: false },
  actionType: 'create' as const,
  loadBalancerId: FAKE_LB_ID,
};

let app: FastifyInstance;

beforeAll(async () => {
  await connectTestDb();
  app = await buildServer();
});

afterEach(async () => {
  await clearCollections();
});

afterAll(async () => {
  await app.close();
  await closeTestDb();
});

// ─── GET /api/sessions ────────────────────────────────────────────────────────

describe('GET /api/sessions', () => {
  it('401 when not authenticated', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/sessions' });
    expect(res.statusCode).toBe(401);
  });

  it('200 returns empty list for a new user', async () => {
    const { cookie } = await createTestUser();
    const res = await app.inject({ method: 'GET', url: '/api/sessions', headers: cookie });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.sessions).toHaveLength(0);
    expect(body.data.hasMore).toBe(false);
    expect(body.data.nextCursor).toBeNull();
  });

  it('200 returns only sessions belonging to the authenticated user', async () => {
    const { user, cookie } = await createTestUser();
    const otherUserId = new mongoose.Types.ObjectId().toString();

    await createSession({ ...BASE_SESSION, userId: user._id.toString() });
    await createSession({ ...BASE_SESSION, userId: otherUserId });

    const res = await app.inject({ method: 'GET', url: '/api/sessions', headers: cookie });
    const body = res.json();
    expect(body.data.sessions).toHaveLength(1);
  });

  it('200 does not include content field in list response', async () => {
    const { user, cookie } = await createTestUser();
    await createSession({ ...BASE_SESSION, userId: user._id.toString() });

    const res = await app.inject({ method: 'GET', url: '/api/sessions', headers: cookie });
    const body = res.json();
    expect(body.data.sessions[0].content).toBeUndefined();
  });

  it('200 returns sessions sorted newest first', async () => {
    const { user, cookie } = await createTestUser();
    await createSession({ ...BASE_SESSION, userId: user._id.toString(), loadBalancerName: 'first' });
    await createSession({ ...BASE_SESSION, userId: user._id.toString(), loadBalancerName: 'second', actionType: 'edit' });

    const res = await app.inject({ method: 'GET', url: '/api/sessions', headers: cookie });
    const body = res.json();
    expect(body.data.sessions[0].loadBalancerName).toBe('second');
    expect(body.data.sessions[1].loadBalancerName).toBe('first');
  });

  it('200 filter=active returns only active sessions', async () => {
    const { user, cookie } = await createTestUser();
    await createSession({ ...BASE_SESSION, userId: user._id.toString() });
    // deactivate it, then create a new active one
    const { Session } = await import('../../models/Session');
    await Session.updateMany({ userId: user._id }, { $set: { isActive: false, content: '' } });
    await createSession({ ...BASE_SESSION, userId: user._id.toString(), actionType: 'edit' });

    const res = await app.inject({ method: 'GET', url: '/api/sessions?filter=active', headers: cookie });
    const body = res.json();
    expect(body.data.sessions).toHaveLength(1);
    expect(body.data.sessions[0].isActive).toBe(true);
  });

  it('200 filter=inactive returns only inactive sessions', async () => {
    const { user, cookie } = await createTestUser();
    await createSession({ ...BASE_SESSION, userId: user._id.toString() });
    const { Session } = await import('../../models/Session');
    await Session.updateMany({ userId: user._id }, { $set: { isActive: false, content: '' } });
    await createSession({ ...BASE_SESSION, userId: user._id.toString(), actionType: 'edit' });

    const res = await app.inject({ method: 'GET', url: '/api/sessions?filter=inactive', headers: cookie });
    const body = res.json();
    expect(body.data.sessions).toHaveLength(1);
    expect(body.data.sessions[0].isActive).toBe(false);
  });

  it('200 cursor-based pagination returns hasMore=true and valid nextCursor', async () => {
    const { user, cookie } = await createTestUser();
    for (let i = 0; i < 3; i++) {
      await createSession({ ...BASE_SESSION, userId: user._id.toString() });
    }

    const res = await app.inject({ method: 'GET', url: '/api/sessions?limit=2', headers: cookie });
    const body = res.json();
    expect(body.data.sessions).toHaveLength(2);
    expect(body.data.hasMore).toBe(true);
    expect(typeof body.data.nextCursor).toBe('string');
  });

  it('200 second page using cursor returns remaining sessions', async () => {
    const { user, cookie } = await createTestUser();
    for (let i = 0; i < 3; i++) {
      await createSession({ ...BASE_SESSION, userId: user._id.toString() });
    }

    const first = await app.inject({ method: 'GET', url: '/api/sessions?limit=2', headers: cookie });
    const { nextCursor } = first.json().data;

    const second = await app.inject({ method: 'GET', url: `/api/sessions?limit=2&cursor=${nextCursor}`, headers: cookie });
    const body = second.json();
    expect(body.data.sessions).toHaveLength(1);
    expect(body.data.hasMore).toBe(false);
    expect(body.data.nextCursor).toBeNull();
  });

  it('400 when cursor is not a valid ObjectId', async () => {
    const { cookie } = await createTestUser();
    const res = await app.inject({ method: 'GET', url: '/api/sessions?cursor=not-valid', headers: cookie });
    expect(res.statusCode).toBe(400);
  });
});

// ─── GET /api/sessions/:id/script ────────────────────────────────────────────

describe('GET /api/sessions/:id/script', () => {
  it('401 when not authenticated', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await app.inject({ method: 'GET', url: `/api/sessions/${fakeId}/script` });
    expect(res.statusCode).toBe(401);
  });

  it('200 returns content for an active session owned by the user', async () => {
    const { user, cookie } = await createTestUser();
    await createSession({ ...BASE_SESSION, userId: user._id.toString(), content: '// my worker' });

    const { Session } = await import('../../models/Session');
    const session = await Session.findOne({ userId: user._id });

    const res = await app.inject({ method: 'GET', url: `/api/sessions/${session!._id}/script`, headers: cookie });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.content).toBe('// my worker');
  });

  it('403 when session is inactive', async () => {
    const { user, cookie } = await createTestUser();
    await createSession({ ...BASE_SESSION, userId: user._id.toString() });

    const { Session } = await import('../../models/Session');
    const session = await Session.findOne({ userId: user._id });
    await Session.updateOne({ _id: session!._id }, { $set: { isActive: false, content: '' } });

    const res = await app.inject({ method: 'GET', url: `/api/sessions/${session!._id}/script`, headers: cookie });
    expect(res.statusCode).toBe(403);
  });

  it('404 when session does not exist', async () => {
    const { cookie } = await createTestUser();
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await app.inject({ method: 'GET', url: `/api/sessions/${fakeId}/script`, headers: cookie });
    expect(res.statusCode).toBe(404);
  });

  it('404 when session belongs to a different user', async () => {
    const { user } = await createTestUser();
    const otherUserId = new mongoose.Types.ObjectId().toString();
    const otherCookie = authCookieHeader(makeTestJwt({ userId: otherUserId }));

    await createSession({ ...BASE_SESSION, userId: user._id.toString() });

    const { Session } = await import('../../models/Session');
    const session = await Session.findOne({ userId: user._id });

    const res = await app.inject({ method: 'GET', url: `/api/sessions/${session!._id}/script`, headers: otherCookie });
    expect(res.statusCode).toBe(404);
  });

  it('400 when session id is not a valid ObjectId', async () => {
    const { cookie } = await createTestUser();
    const res = await app.inject({ method: 'GET', url: '/api/sessions/bad-id/script', headers: cookie });
    expect(res.statusCode).toBe(400);
  });
});
