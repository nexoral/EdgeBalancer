import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../app';
import { connectTestDb, closeTestDb } from '../helpers/db';

let app: FastifyInstance;

beforeAll(async () => {
  await connectTestDb();
  app = await buildServer();
});

afterAll(async () => {
  await app.close();
  await closeTestDb();
});

describe('GET /health', () => {
  it('200 with status ok when database is connected', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });
});
