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

const VALID_REGISTER = {
  name: 'John Doe',
  email: 'john@example.com',
  password: 'Password123!',
  confirmPassword: 'Password123!',
};

// ─── Register ────────────────────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  it('201 creates user with valid payload', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: VALID_REGISTER,
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.email).toBe('john@example.com');
    expect(body.data.userId).toBeDefined();
  });

  it('400 when email is already registered', async () => {
    await app.inject({ method: 'POST', url: '/api/auth/register', payload: VALID_REGISTER });
    const res = await app.inject({ method: 'POST', url: '/api/auth/register', payload: VALID_REGISTER });
    expect(res.statusCode).toBe(400);
    expect(res.json().success).toBe(false);
  });

  it('400 when name is empty', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { ...VALID_REGISTER, name: '' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('400 when name is too short', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { ...VALID_REGISTER, name: 'A' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('400 when email format is invalid', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { ...VALID_REGISTER, email: 'not-an-email' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('400 when password is shorter than 8 chars', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { ...VALID_REGISTER, password: 'short', confirmPassword: 'short' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('400 when passwords do not match', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { ...VALID_REGISTER, confirmPassword: 'DifferentPass!' },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ─── Login ───────────────────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await app.inject({ method: 'POST', url: '/api/auth/register', payload: VALID_REGISTER });
  });

  it('200 with valid credentials and sets an httpOnly cookie', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'john@example.com', password: 'Password123!' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
    const setCookie = String(res.headers['set-cookie'] ?? '');
    expect(setCookie).toContain('token=');
    expect(setCookie).toContain('HttpOnly');
  });

  it('401 with incorrect password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'john@example.com', password: 'WrongPassword!' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('401 with unknown email', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'nobody@example.com', password: 'Password123!' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('400 when email is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { password: 'Password123!' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('400 when password is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'john@example.com' },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ─── Logout ──────────────────────────────────────────────────────────────────

describe('POST /api/auth/logout', () => {
  it('200 and clears the auth cookie', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/auth/logout' });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
    const setCookie = String(res.headers['set-cookie'] ?? '');
    // Clearing the cookie means setting it with an expired date
    expect(setCookie).toContain('token=');
    expect(setCookie.toLowerCase()).toContain('expires=');
  });
});

// ─── Me ──────────────────────────────────────────────────────────────────────

describe('GET /api/auth/me', () => {
  it('200 returns user data when a valid cookie is provided', async () => {
    const { cookie } = await createTestUser({ email: 'me@example.com' });
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: cookie,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.user).toBeDefined();
    expect(body.data.user.password).toBeUndefined();
  });

  it('401 when no cookie is provided', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/auth/me' });
    expect(res.statusCode).toBe(401);
  });

  it('401 when cookie contains an invalid JWT', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: 'token=this.is.not.valid' },
    });
    expect(res.statusCode).toBe(401);
  });
});
