import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../app';
import { connectTestDb, clearCollections, closeTestDb } from '../helpers/db';
import { createTestUser } from '../helpers/auth';
import { saveCloudflareCredentials, validateCloudflareCredentials } from '../../services/credentialsService';
import { CloudflareClient } from '../../services/cloudflareClient';

// Keep real save/get/mask — only mock the Cloudflare API hit
jest.mock('../../services/credentialsService', () => {
  const actual = jest.requireActual<typeof import('../../services/credentialsService')>(
    '../../services/credentialsService'
  );
  return {
    ...actual,
    validateCloudflareCredentials: jest.fn(),
  };
});

jest.mock('../../services/cloudflareClient');

const mockValidate = validateCloudflareCredentials as jest.MockedFunction<typeof validateCloudflareCredentials>;
const MockCloudflareClient = CloudflareClient as jest.MockedClass<typeof CloudflareClient>;

// valid-format credentials (accountId = 32 chars, apiToken >= 40 chars)
const FAKE_ACCOUNT_ID = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4';
const FAKE_API_TOKEN = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'; // 40 chars

let app: FastifyInstance;

beforeAll(async () => {
  await connectTestDb();
  app = await buildServer();
});

beforeEach(() => {
  mockValidate.mockResolvedValue({ valid: true, errors: [] });
  MockCloudflareClient.mockImplementation(() => ({
    getZones: jest.fn().mockResolvedValue({ result: [{ id: 'zone1', name: 'example.com', status: 'active' }] }),
    testWorkerScriptsPermission: jest.fn().mockResolvedValue(true),
    testWorkersKVPermission: jest.fn().mockResolvedValue(true),
    testZoneReadPermission: jest.fn().mockResolvedValue(true),
    workerNameExists: jest.fn().mockResolvedValue(false),
    getWorkerDomains: jest.fn().mockResolvedValue([]),
  } as any));
});

afterEach(async () => {
  await clearCollections();
});

afterAll(async () => {
  await app.close();
  await closeTestDb();
});

// ─── Save Credentials ─────────────────────────────────────────────────────────

describe('POST /api/cloudflare/credentials', () => {
  it('200 when credentials are valid', async () => {
    const { cookie } = await createTestUser();
    const res = await app.inject({
      method: 'POST',
      url: '/api/cloudflare/credentials',
      headers: cookie,
      payload: { accountId: FAKE_ACCOUNT_ID, apiToken: FAKE_API_TOKEN },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });

  it('400 when Cloudflare rejects the credentials', async () => {
    mockValidate.mockResolvedValueOnce({ valid: false, errors: ['Invalid API token or account ID'] });
    const { cookie } = await createTestUser();
    const res = await app.inject({
      method: 'POST',
      url: '/api/cloudflare/credentials',
      headers: cookie,
      payload: { accountId: FAKE_ACCOUNT_ID, apiToken: FAKE_API_TOKEN },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().success).toBe(false);
  });

  it('400 when accountId is not 32 chars (validator rejects before controller)', async () => {
    const { cookie } = await createTestUser();
    const res = await app.inject({
      method: 'POST',
      url: '/api/cloudflare/credentials',
      headers: cookie,
      payload: { accountId: 'short', apiToken: FAKE_API_TOKEN },
    });
    expect(res.statusCode).toBe(400);
  });

  it('400 when apiToken is fewer than 40 chars', async () => {
    const { cookie } = await createTestUser();
    const res = await app.inject({
      method: 'POST',
      url: '/api/cloudflare/credentials',
      headers: cookie,
      payload: { accountId: FAKE_ACCOUNT_ID, apiToken: 'tooshort' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('401 when not authenticated', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/cloudflare/credentials',
      payload: { accountId: FAKE_ACCOUNT_ID, apiToken: FAKE_API_TOKEN },
    });
    expect(res.statusCode).toBe(401);
  });
});

// ─── Get Credentials ──────────────────────────────────────────────────────────

describe('GET /api/cloudflare/credentials', () => {
  it('200 returns masked credentials when they exist', async () => {
    const { user, cookie } = await createTestUser();
    await saveCloudflareCredentials(user._id.toString(), FAKE_ACCOUNT_ID, FAKE_API_TOKEN);

    const res = await app.inject({
      method: 'GET',
      url: '/api/cloudflare/credentials',
      headers: cookie,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    // Masked: accountId shows first4...last4, apiToken shows sk-...last4
    expect(body.data.accountId).toMatch(/^.{4}\.\.\..{4}$/);
    expect(body.data.apiToken).toMatch(/^sk-\.\.\..{4}$/);
  });

  it('200 with null credentials when none saved', async () => {
    const { cookie } = await createTestUser();
    const res = await app.inject({
      method: 'GET',
      url: '/api/cloudflare/credentials',
      headers: cookie,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.accountId).toBeNull();
    expect(res.json().data.apiToken).toBeNull();
  });

  it('401 when not authenticated', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/cloudflare/credentials' });
    expect(res.statusCode).toBe(401);
  });
});

// ─── Get Zones ────────────────────────────────────────────────────────────────

describe('GET /api/cloudflare/zones', () => {
  it('200 returns zones list from mocked Cloudflare client', async () => {
    const { user, cookie } = await createTestUser();
    await saveCloudflareCredentials(user._id.toString(), FAKE_ACCOUNT_ID, FAKE_API_TOKEN);

    const res = await app.inject({
      method: 'GET',
      url: '/api/cloudflare/zones',
      headers: cookie,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.zones)).toBe(true);
    expect(body.data.zones[0].name).toBe('example.com');
  });

  it('400 when no Cloudflare credentials are saved', async () => {
    const { cookie } = await createTestUser();
    const res = await app.inject({
      method: 'GET',
      url: '/api/cloudflare/zones',
      headers: cookie,
    });
    expect(res.statusCode).toBe(400);
  });

  it('401 when not authenticated', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/cloudflare/zones' });
    expect(res.statusCode).toBe(401);
  });
});
