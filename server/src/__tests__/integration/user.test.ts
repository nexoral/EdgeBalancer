import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../app';
import { connectTestDb, clearCollections, closeTestDb } from '../helpers/db';
import { createTestUser } from '../helpers/auth';

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

// ─── Profile ─────────────────────────────────────────────────────────────────

describe('GET /api/user/profile', () => {
  it('200 returns user profile without password field', async () => {
    const { cookie } = await createTestUser({
      name: 'Alice Smith',
      email: 'alice@example.com',
    });
    const res = await app.inject({
      method: 'GET',
      url: '/api/user/profile',
      headers: cookie,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.user.email).toBe('alice@example.com');
    expect(body.data.user.name).toBe('Alice Smith');
    expect(body.data.user.password).toBeUndefined();
  });

  it('401 when not authenticated', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/user/profile' });
    expect(res.statusCode).toBe(401);
  });
});

// ─── Change Password ──────────────────────────────────────────────────────────

describe('PUT /api/user/password', () => {
  it('200 on correct currentPassword with valid new password', async () => {
    const { cookie } = await createTestUser({ password: 'OldPassword123!' });
    const res = await app.inject({
      method: 'PUT',
      url: '/api/user/password',
      headers: cookie,
      payload: {
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword456!',
        confirmNewPassword: 'NewPassword456!',
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });

  it('400 when currentPassword is wrong', async () => {
    const { cookie } = await createTestUser({ password: 'OldPassword123!' });
    const res = await app.inject({
      method: 'PUT',
      url: '/api/user/password',
      headers: cookie,
      payload: {
        currentPassword: 'WrongCurrentPassword!',
        newPassword: 'NewPassword456!',
        confirmNewPassword: 'NewPassword456!',
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('400 when newPassword is shorter than 8 chars', async () => {
    const { cookie } = await createTestUser({ password: 'OldPassword123!' });
    const res = await app.inject({
      method: 'PUT',
      url: '/api/user/password',
      headers: cookie,
      payload: {
        currentPassword: 'OldPassword123!',
        newPassword: 'short',
        confirmNewPassword: 'short',
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('400 when confirmNewPassword does not match', async () => {
    const { cookie } = await createTestUser({ password: 'OldPassword123!' });
    const res = await app.inject({
      method: 'PUT',
      url: '/api/user/password',
      headers: cookie,
      payload: {
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword456!',
        confirmNewPassword: 'MismatchPass!',
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('401 when not authenticated', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/user/password',
      payload: {
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword456!',
        confirmNewPassword: 'NewPassword456!',
      },
    });
    expect(res.statusCode).toBe(401);
  });
});
