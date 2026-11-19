import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../app';
import { connectTestDb, clearCollections, closeTestDb } from '../helpers/db';
import { createTestUser } from '../helpers/auth';
import { AiRun } from '../../models/AiRun';

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

// ─── GET /api/ai/runs ─────────────────────────────────────────────────────────

describe('GET /api/ai/runs', () => {
  it('401 when not authenticated', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/ai/runs' });
    expect(res.statusCode).toBe(401);
  });

  it('200 returns empty list for a new user', async () => {
    const { cookie } = await createTestUser();
    const res = await app.inject({ method: 'GET', url: '/api/ai/runs', headers: cookie });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.runs).toHaveLength(0);
    expect(body.data.hasMore).toBe(false);
    expect(body.data.nextCursor).toBeNull();
  });

  it('200 returns only runs belonging to the authenticated user', async () => {
    const { user, cookie } = await createTestUser();
    const otherUserId = new (await import('mongoose')).Types.ObjectId().toString();

    await AiRun.create({
      userId: user._id,
      runId: 'run-1',
      prompt: 'test prompt',
      outcome: 'success',
      durationMs: 1000,
    });
    await AiRun.create({
      userId: otherUserId,
      runId: 'run-2',
      prompt: 'other prompt',
      outcome: 'success',
      durationMs: 500,
    });

    const res = await app.inject({ method: 'GET', url: '/api/ai/runs', headers: cookie });
    const body = res.json();
    expect(body.data.runs).toHaveLength(1);
    expect(body.data.runs[0].prompt).toBe('test prompt');
  });

  it('200 returns runs sorted newest first', async () => {
    const { user, cookie } = await createTestUser();

    const first = await AiRun.create({
      userId: user._id,
      runId: 'run-first',
      prompt: 'first',
      outcome: 'success',
      durationMs: 1000,
    });
    const second = await AiRun.create({
      userId: user._id,
      runId: 'run-second',
      prompt: 'second',
      outcome: 'success',
      durationMs: 2000,
    });

    const res = await app.inject({ method: 'GET', url: '/api/ai/runs', headers: cookie });
    const body = res.json();
    expect(body.data.runs[0].prompt).toBe('second');
    expect(body.data.runs[1].prompt).toBe('first');
  });

  it('200 cursor pagination returns hasMore and nextCursor', async () => {
    const { user, cookie } = await createTestUser();

    const ids = [];
    for (let i = 0; i < 3; i++) {
      const run = await AiRun.create({
        userId: user._id,
        runId: `run-${i}`,
        prompt: `prompt-${i}`,
        outcome: 'success',
        durationMs: 1000,
      });
      ids.push(run._id);
    }

    const res = await app.inject({ method: 'GET', url: '/api/ai/runs?limit=2', headers: cookie });
    const body = res.json();
    expect(body.data.runs).toHaveLength(2);
    expect(body.data.hasMore).toBe(true);
    expect(typeof body.data.nextCursor).toBe('string');
  });

  it('200 second page using cursor returns remaining runs', async () => {
    const { user, cookie } = await createTestUser();

    for (let i = 0; i < 3; i++) {
      await AiRun.create({
        userId: user._id,
        runId: `run-${i}`,
        prompt: `prompt-${i}`,
        outcome: 'success',
        durationMs: 1000,
      });
    }

    const first = await app.inject({ method: 'GET', url: '/api/ai/runs?limit=2', headers: cookie });
    const { nextCursor } = first.json().data;

    const second = await app.inject({ method: 'GET', url: `/api/ai/runs?limit=2&cursor=${nextCursor}`, headers: cookie });
    const body = second.json();
    expect(body.data.runs).toHaveLength(1);
    expect(body.data.hasMore).toBe(false);
    expect(body.data.nextCursor).toBeNull();
  });

  it('400 when cursor is not a valid ObjectId', async () => {
    const { cookie } = await createTestUser();
    const res = await app.inject({ method: 'GET', url: '/api/ai/runs?cursor=not-valid', headers: cookie });
    expect(res.statusCode).toBe(400);
  });

  it('200 does not include full args/result in list response', async () => {
    const { user, cookie } = await createTestUser();

    await AiRun.create({
      userId: user._id,
      runId: 'run-with-args',
      prompt: 'create a loadbalancer',
      modelsUsed: [{ provider: 'mistral', model: 'mistral-small', ok: true, error: null }],
      finalModel: 'mistral-small',
      toolCalls: [{
        name: 'list_zones',
        args: { names: ['list_zones'] },
        result: JSON.stringify({ ok: true, data: { zones: [] } }),
        ok: true,
        durationMs: 21,
      }],
      outcome: 'success',
      durationMs: 5000,
    });

    const res = await app.inject({ method: 'GET', url: '/api/ai/runs', headers: cookie });
    const body = res.json();
    expect(body.data.runs[0].toolCalls[0].name).toBe('list_zones');
    // Args and result should NOT be in the list response (select only includes toolCalls.name)
  });
});

// ─── GET /api/ai/runs/:id ─────────────────────────────────────────────────────

describe('GET /api/ai/runs/:id', () => {
  it('401 when not authenticated', async () => {
    const fakeId = new (await import('mongoose')).Types.ObjectId().toString();
    const res = await app.inject({ method: 'GET', url: `/api/ai/runs/${fakeId}` });
    expect(res.statusCode).toBe(401);
  });

  it('200 returns full run details for an owned run', async () => {
    const { user, cookie } = await createTestUser({ plan: 'pro' });

    await AiRun.create({
      userId: user._id,
      runId: 'run-detail-test',
      prompt: 'create a loadbalancer named test with origin https://example.com',
      modelsUsed: [{ provider: 'openrouter', model: 'nvidia/nemotron:free', ok: true, error: null }],
      finalModel: 'nvidia/nemotron:free',
      toolCalls: [{
        name: 'create_load_balancer',
        args: { name: 'test', domain: 'example.com', origins: [{ url: 'https://example.com', weight: 1 }] },
        result: JSON.stringify({ ok: true, data: { loadBalancer: { id: 'lb-1' } } }),
        ok: true,
        durationMs: 1200,
      }],
      outcome: 'success',
      durationMs: 15000,
      error: null,
    });

    const { AiRun: AiRunModel } = await import('../../models/AiRun');
    const run = await AiRunModel.findOne({ userId: user._id });

    const res = await app.inject({ method: 'GET', url: `/api/ai/runs/${run!._id}`, headers: cookie });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.run.prompt).toBe('create a loadbalancer named test with origin https://example.com');
    expect(body.data.run.finalModel).toBeUndefined();
    expect(body.data.run.modelsUsed).toBeUndefined();
    expect(body.data.run.outcome).toBe('success');
    expect(body.data.run.toolCalls).toHaveLength(1);
    expect(body.data.run.toolCalls[0].args).toEqual({
      name: 'test',
      domain: 'example.com',
      origins: [{ url: 'https://example.com', weight: 1 }],
    });
  });

  it('404 when run does not exist', async () => {
    const { cookie } = await createTestUser();
    const fakeId = new (await import('mongoose')).Types.ObjectId().toString();
    const res = await app.inject({ method: 'GET', url: `/api/ai/runs/${fakeId}`, headers: cookie });
    expect(res.statusCode).toBe(404);
  });

  it('404 when run belongs to a different user', async () => {
    const { user } = await createTestUser();
    const otherUserId = new (await import('mongoose')).Types.ObjectId().toString();
    const otherCookieHeader = { cookie: `token=${require('jsonwebtoken').sign({ userId: otherUserId }, process.env.JWT_SECRET!) }` };

    await AiRun.create({
      userId: user._id,
      runId: 'run-other-user',
      prompt: 'test prompt',
      outcome: 'success',
      durationMs: 1000,
    });

    const { AiRun: AiRunModel } = await import('../../models/AiRun');
    const run = await AiRunModel.findOne({ userId: user._id });

    const res = await app.inject({ method: 'GET', url: `/api/ai/runs/${run!._id}`, headers: otherCookieHeader });
    expect(res.statusCode).toBe(404);
  });

  it('400 when run id is not a valid ObjectId', async () => {
    const { cookie } = await createTestUser();
    const res = await app.inject({ method: 'GET', url: '/api/ai/runs/bad-id', headers: cookie });
    expect(res.statusCode).toBe(400);
  });
});
