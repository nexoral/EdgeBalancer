import type { FastifyInstance } from 'fastify';
import mongoose from 'mongoose';
import { buildServer } from '../../app';
import { connectTestDb, clearCollections, closeTestDb } from '../helpers/db';
import { createTestUser, makeTestJwt } from '../helpers/auth';
import { LoadBalancer } from '../../models/LoadBalancer';
import { CloudflareClient } from '../../services/cloudflareClient';

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('../../services/cloudflareClient');
jest.mock('../../services/workerDeployment', () => ({
  deployWorker: jest.fn().mockResolvedValue(undefined),
  getActiveWorkerDeployment: jest.fn().mockResolvedValue({ id: 'deploy-123' }),
  uploadWorkerVersion: jest.fn().mockResolvedValue({ id: 'version-456' }),
  createWorkerDeployment: jest.fn().mockResolvedValue(undefined),
  pruneWorkerHistory: jest.fn().mockResolvedValue(undefined),
  listWorkerDeployments: jest.fn().mockResolvedValue([]),
  listWorkerVersions: jest.fn().mockResolvedValue([]),
  deleteWorkerDeployment: jest.fn().mockResolvedValue(undefined),
  deleteWorkerVersion: jest.fn().mockResolvedValue(undefined),
  pruneWorkerVersions: jest.fn().mockResolvedValue(undefined),
  pruneWorkerDeployments: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../services/workerDeletion', () => ({
  deleteWorker: jest.fn().mockResolvedValue(undefined),
  deleteWorkerScript: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../services/workerDns', () => ({
  resolveIpOrigins: jest.fn().mockImplementation(({ origins }: { origins: any[] }) =>
    Promise.resolve({ resolvedOrigins: origins, ipOriginRecords: [] })
  ),
  provisionIpDnsChanges: jest.fn().mockImplementation(({ newOrigins }: { newOrigins: any[] }) =>
    Promise.resolve({ resolvedOrigins: newOrigins, ipOriginRecords: [], createdRecordIds: [], obsoleteRecords: [] })
  ),
  deleteIpDnsRecord: jest.fn().mockResolvedValue(undefined),
  createIpDnsRecord: jest.fn().mockResolvedValue('dns-rec-123'),
  updateIpDnsRecord: jest.fn().mockResolvedValue(undefined),
  isRawIpOrigin: jest.fn().mockReturnValue(false),
  buildIpOriginHostname: jest.fn().mockReturnValue('lb-o1.example.com'),
}));
jest.mock('../../services/workerDomain', () => ({
  attachDomainToWorker: jest.fn().mockResolvedValue('https://lb.example.com'),
  detachDomainFromWorker: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../services/workerGenerator', () => ({
  generateWorkerCode: jest.fn().mockReturnValue('// mocked worker code'),
  generateScriptName: jest.fn().mockImplementation((name: string) => name),
  toWorkerOrigin: jest.fn().mockImplementation((o: any) => o),
}));
jest.mock('../../modules/loadbalancer/services/credentials.service', () => ({
  getCloudflareCredentialsForUser: jest.fn().mockResolvedValue({
    accountId: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
    apiToken: 'fake-api-token-for-testing-purposes-only-xx',
  }),
}));
jest.mock('../../utils/redisClient', () => ({
  getRedisClient: jest.fn().mockResolvedValue({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
  }),
  closeRedisClient: jest.fn().mockResolvedValue(undefined),
}));

const MockCloudflareClient = CloudflareClient as jest.MockedClass<typeof CloudflareClient>;

// ─── Valid test payload ───────────────────────────────────────────────────────

const VALID_PAYLOAD = {
  name: 'test-lb',
  domain: 'example.com',
  zoneId: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
  origins: [
    { url: 'https://origin1.example.com', weight: 50 },
    { url: 'https://origin2.example.com', weight: 50 },
  ],
  strategy: 'round-robin',
  weightedEnabled: false,
  placement: { smartPlacement: false },
};

let app: FastifyInstance;

beforeAll(async () => {
  await connectTestDb();
  app = await buildServer();
});

beforeEach(() => {
  MockCloudflareClient.mockImplementation(() => ({
    workerNameExists: jest.fn().mockResolvedValue(false),
    getWorkerDomains: jest.fn().mockResolvedValue([]),
    testWorkerScriptsPermission: jest.fn().mockResolvedValue(true),
    testWorkersKVPermission: jest.fn().mockResolvedValue(true),
    testZoneReadPermission: jest.fn().mockResolvedValue(true),
    getZones: jest.fn().mockResolvedValue({ result: [] }),
  } as any));
});

afterEach(async () => {
  await clearCollections();
});

afterAll(async () => {
  await app.close();
  await closeTestDb();
});

// ─── List ─────────────────────────────────────────────────────────────────────

describe('GET /api/loadbalancers', () => {
  it('200 returns empty list for a new user', async () => {
    const { cookie } = await createTestUser();
    const res = await app.inject({ method: 'GET', url: '/api/loadbalancers', headers: cookie });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.loadBalancers)).toBe(true);
    expect(body.data.loadBalancers).toHaveLength(0);
  });

  it('401 when not authenticated', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/loadbalancers' });
    expect(res.statusCode).toBe(401);
  });
});

// ─── Create ───────────────────────────────────────────────────────────────────

describe('POST /api/loadbalancers', () => {
  it('201 creates a load balancer with valid payload', async () => {
    const { cookie } = await createTestUser();
    const res = await app.inject({
      method: 'POST',
      url: '/api/loadbalancers',
      headers: cookie,
      payload: VALID_PAYLOAD,
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.loadBalancer.name).toBe('test-lb');
  });

  it('400 when name is missing', async () => {
    const { cookie } = await createTestUser();
    const { name: _n, ...rest } = VALID_PAYLOAD;
    const res = await app.inject({
      method: 'POST',
      url: '/api/loadbalancers',
      headers: cookie,
      payload: rest,
    });
    expect(res.statusCode).toBe(400);
  });

  it('400 when origins array is empty', async () => {
    const { cookie } = await createTestUser();
    const res = await app.inject({
      method: 'POST',
      url: '/api/loadbalancers',
      headers: cookie,
      payload: { ...VALID_PAYLOAD, origins: [] },
    });
    expect(res.statusCode).toBe(400);
  });

  it('400 when strategy is unsupported', async () => {
    const { cookie } = await createTestUser();
    const res = await app.inject({
      method: 'POST',
      url: '/api/loadbalancers',
      headers: cookie,
      payload: { ...VALID_PAYLOAD, strategy: 'magic-routing' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('400 when zoneId is not 32 chars', async () => {
    const { cookie } = await createTestUser();
    const res = await app.inject({
      method: 'POST',
      url: '/api/loadbalancers',
      headers: cookie,
      payload: { ...VALID_PAYLOAD, zoneId: 'tooshort' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('401 when not authenticated', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/loadbalancers',
      payload: VALID_PAYLOAD,
    });
    expect(res.statusCode).toBe(401);
  });
});

// ─── Get Single ───────────────────────────────────────────────────────────────

describe('GET /api/loadbalancers/:id', () => {
  it('200 returns the load balancer for the owning user', async () => {
    const { user, cookie } = await createTestUser();
    const lb = await LoadBalancer.create({
      userId: user._id,
      name: 'my-lb',
      scriptName: 'my-lb',
      domain: 'example.com',
      origins: [{ url: 'https://origin.example.com', weight: 100 }],
      strategy: 'round-robin',
      weightedEnabled: false,
      placement: { smartPlacement: false },
      zoneId: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
      status: 'active',
      workerUrl: 'https://my-lb.example.com',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/loadbalancers/${lb._id}`,
      headers: cookie,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.loadBalancer.name).toBe('my-lb');
  });

  it('404 when load balancer does not exist', async () => {
    const { cookie } = await createTestUser();
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await app.inject({
      method: 'GET',
      url: `/api/loadbalancers/${fakeId}`,
      headers: cookie,
    });
    expect(res.statusCode).toBe(404);
  });

  it('403 when load balancer belongs to a different user', async () => {
    const { user: owner } = await createTestUser({ email: 'owner@example.com' });
    // Create a JWT for a second user without inserting into DB (avoids sparse unique index conflict on firebaseUid)
    const otherUserId = new mongoose.Types.ObjectId().toString();
    const otherCookie = { cookie: `token=${makeTestJwt({ userId: otherUserId, email: 'other@example.com' })}` };

    const lb = await LoadBalancer.create({
      userId: owner._id,
      name: 'owners-lb',
      scriptName: 'owners-lb',
      domain: 'example.com',
      origins: [{ url: 'https://origin.example.com', weight: 100 }],
      strategy: 'round-robin',
      weightedEnabled: false,
      placement: { smartPlacement: false },
      zoneId: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
      status: 'active',
      workerUrl: 'https://owners-lb.example.com',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/loadbalancers/${lb._id}`,
      headers: otherCookie,
    });
    expect(res.statusCode).toBe(403);
  });

  it('401 when not authenticated', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await app.inject({ method: 'GET', url: `/api/loadbalancers/${fakeId}` });
    expect(res.statusCode).toBe(401);
  });
});

// ─── Delete ───────────────────────────────────────────────────────────────────

describe('DELETE /api/loadbalancers/:id', () => {
  it('200 deletes the load balancer', async () => {
    const { user, cookie } = await createTestUser();
    const lb = await LoadBalancer.create({
      userId: user._id,
      name: 'to-delete',
      scriptName: 'to-delete',
      domain: 'example.com',
      origins: [{ url: 'https://origin.example.com', weight: 100 }],
      strategy: 'round-robin',
      weightedEnabled: false,
      placement: { smartPlacement: false },
      zoneId: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
      status: 'active',
      workerUrl: 'https://to-delete.example.com',
    });

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/loadbalancers/${lb._id}`,
      headers: cookie,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);

    const deleted = await LoadBalancer.findById(lb._id);
    expect(deleted).toBeNull();
  });

  it('404 when load balancer does not exist', async () => {
    const { cookie } = await createTestUser();
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/loadbalancers/${fakeId}`,
      headers: cookie,
    });
    expect(res.statusCode).toBe(404);
  });

  it('401 when not authenticated', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await app.inject({ method: 'DELETE', url: `/api/loadbalancers/${fakeId}` });
    expect(res.statusCode).toBe(401);
  });
});

// ─── Validate Hostname ────────────────────────────────────────────────────────

describe('POST /api/loadbalancers/validate-hostname', () => {
  it('200 when hostname is available', async () => {
    const { cookie } = await createTestUser();
    const res = await app.inject({
      method: 'POST',
      url: '/api/loadbalancers/validate-hostname',
      headers: cookie,
      payload: { domain: 'example.com', subdomain: 'lb' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.available).toBe(true);
    expect(res.json().data.hostname).toBe('lb.example.com');
  });

  it('409 when hostname is already taken in Cloudflare', async () => {
    MockCloudflareClient.mockImplementationOnce(() => ({
      workerNameExists: jest.fn().mockResolvedValue(false),
      getWorkerDomains: jest.fn().mockResolvedValue([{ hostname: 'lb.example.com' }]),
    } as any));

    const { cookie } = await createTestUser();
    const res = await app.inject({
      method: 'POST',
      url: '/api/loadbalancers/validate-hostname',
      headers: cookie,
      payload: { domain: 'example.com', subdomain: 'lb' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('400 when domain is missing', async () => {
    const { cookie } = await createTestUser();
    const res = await app.inject({
      method: 'POST',
      url: '/api/loadbalancers/validate-hostname',
      headers: cookie,
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('401 when not authenticated', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/loadbalancers/validate-hostname',
      payload: { domain: 'example.com' },
    });
    expect(res.statusCode).toBe(401);
  });
});

// ─── exposeRealOrigin ─────────────────────────────────────────────────────────

describe('exposeRealOrigin — create and retrieve', () => {
  it('stores exposeRealOrigin: true and returns it in the response', async () => {
    const { cookie } = await createTestUser();
    const res = await app.inject({
      method: 'POST',
      url: '/api/loadbalancers',
      headers: cookie,
      payload: { ...VALID_PAYLOAD, exposeRealOrigin: true },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().data.loadBalancer.exposeRealOrigin).toBe(true);
  });

  it('defaults exposeRealOrigin to false when omitted from payload', async () => {
    const { cookie } = await createTestUser();
    const res = await app.inject({
      method: 'POST',
      url: '/api/loadbalancers',
      headers: cookie,
      payload: VALID_PAYLOAD,
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().data.loadBalancer.exposeRealOrigin).toBe(false);
  });

  it('persists exposeRealOrigin: true in the database document', async () => {
    const { cookie } = await createTestUser();
    const res = await app.inject({
      method: 'POST',
      url: '/api/loadbalancers',
      headers: cookie,
      payload: { ...VALID_PAYLOAD, exposeRealOrigin: true },
    });
    expect(res.statusCode).toBe(201);
    const lbId = res.json().data.loadBalancer.id;
    const doc = await LoadBalancer.findById(lbId);
    expect(doc?.exposeRealOrigin).toBe(true);
  });

  it('GET returns exposeRealOrigin: true after create', async () => {
    const { user, cookie } = await createTestUser();
    const lb = await LoadBalancer.create({
      userId: user._id,
      name: 'expose-test',
      scriptName: 'expose-test',
      domain: 'example.com',
      origins: [{ url: 'https://origin.example.com', weight: 100 }],
      strategy: 'round-robin',
      weightedEnabled: false,
      exposeRealOrigin: true,
      placement: { smartPlacement: false },
      zoneId: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
      status: 'active',
      workerUrl: 'https://expose-test.example.com',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/loadbalancers/${lb._id}`,
      headers: cookie,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.loadBalancer.exposeRealOrigin).toBe(true);
  });

  it('GET returns exposeRealOrigin: false for legacy LB without the field', async () => {
    const { user, cookie } = await createTestUser();
    const lb = await LoadBalancer.create({
      userId: user._id,
      name: 'legacy-test',
      scriptName: 'legacy-test',
      domain: 'example.com',
      origins: [{ url: 'https://origin.example.com', weight: 100 }],
      strategy: 'round-robin',
      weightedEnabled: false,
      placement: { smartPlacement: false },
      zoneId: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
      status: 'active',
      workerUrl: 'https://legacy-test.example.com',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/loadbalancers/${lb._id}`,
      headers: cookie,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.loadBalancer.exposeRealOrigin).toBe(false);
  });
});

// ─── Search & Filter ──────────────────────────────────────────────────────────

const LB_SEED = (userId: mongoose.Types.ObjectId, overrides: Partial<{
  name: string; domain: string; status: 'active' | 'paused';
}> = {}) =>
  LoadBalancer.create({
    userId,
    name: overrides.name ?? 'test-lb',
    scriptName: overrides.name ?? 'test-lb',
    domain: overrides.domain ?? 'example.com',
    origins: [{ url: 'https://origin.example.com', weight: 100 }],
    strategy: 'round-robin',
    weightedEnabled: false,
    placement: { smartPlacement: false },
    zoneId: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
    status: overrides.status ?? 'active',
    workerUrl: 'https://test-lb.example.com',
  });

describe('GET /api/loadbalancers — search & filter', () => {
  it('returns all LBs when no filter is applied', async () => {
    const { user, cookie } = await createTestUser();
    await LB_SEED(user._id, { name: 'alpha-lb' });
    await LB_SEED(user._id, { name: 'beta-lb' });

    const res = await app.inject({ method: 'GET', url: '/api/loadbalancers', headers: cookie });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.loadBalancers).toHaveLength(2);
  });

  it('filters by name substring (case-insensitive)', async () => {
    const { user, cookie } = await createTestUser();
    await LB_SEED(user._id, { name: 'alpha-lb' });
    await LB_SEED(user._id, { name: 'beta-lb' });

    const res = await app.inject({
      method: 'GET',
      url: '/api/loadbalancers?search=ALPHA',
      headers: cookie,
    });
    expect(res.statusCode).toBe(200);
    const lbs = res.json().data.loadBalancers;
    expect(lbs).toHaveLength(1);
    expect(lbs[0].name).toBe('alpha-lb');
  });

  it('filters by domain substring', async () => {
    const { user, cookie } = await createTestUser();
    await LB_SEED(user._id, { name: 'lb-one', domain: 'api.company.com' });
    await LB_SEED(user._id, { name: 'lb-two', domain: 'web.other.io' });

    const res = await app.inject({
      method: 'GET',
      url: '/api/loadbalancers?search=company',
      headers: cookie,
    });
    expect(res.statusCode).toBe(200);
    const lbs = res.json().data.loadBalancers;
    expect(lbs).toHaveLength(1);
    expect(lbs[0].name).toBe('lb-one');
  });

  it('returns empty array when search matches nothing', async () => {
    const { user, cookie } = await createTestUser();
    await LB_SEED(user._id, { name: 'alpha-lb' });

    const res = await app.inject({
      method: 'GET',
      url: '/api/loadbalancers?search=zzz-no-match',
      headers: cookie,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.loadBalancers).toHaveLength(0);
  });

  it('filters by status=active', async () => {
    const { user, cookie } = await createTestUser();
    await LB_SEED(user._id, { name: 'live-lb', status: 'active' });
    await LB_SEED(user._id, { name: 'paused-lb', status: 'paused' });

    const res = await app.inject({
      method: 'GET',
      url: '/api/loadbalancers?status=active',
      headers: cookie,
    });
    expect(res.statusCode).toBe(200);
    const lbs = res.json().data.loadBalancers;
    expect(lbs).toHaveLength(1);
    expect(lbs[0].name).toBe('live-lb');
  });

  it('filters by status=paused', async () => {
    const { user, cookie } = await createTestUser();
    await LB_SEED(user._id, { name: 'live-lb', status: 'active' });
    await LB_SEED(user._id, { name: 'paused-lb', status: 'paused' });

    const res = await app.inject({
      method: 'GET',
      url: '/api/loadbalancers?status=paused',
      headers: cookie,
    });
    expect(res.statusCode).toBe(200);
    const lbs = res.json().data.loadBalancers;
    expect(lbs).toHaveLength(1);
    expect(lbs[0].name).toBe('paused-lb');
  });

  it('combines search and status filter', async () => {
    const { user, cookie } = await createTestUser();
    await LB_SEED(user._id, { name: 'api-lb',  domain: 'api.example.com', status: 'active' });
    await LB_SEED(user._id, { name: 'api-paused', domain: 'api.example.com', status: 'paused' });
    await LB_SEED(user._id, { name: 'web-lb',  domain: 'web.example.com', status: 'active' });

    const res = await app.inject({
      method: 'GET',
      url: '/api/loadbalancers?search=api&status=active',
      headers: cookie,
    });
    expect(res.statusCode).toBe(200);
    const lbs = res.json().data.loadBalancers;
    expect(lbs).toHaveLength(1);
    expect(lbs[0].name).toBe('api-lb');
  });

  it('ignores invalid status values (returns all)', async () => {
    const { user, cookie } = await createTestUser();
    await LB_SEED(user._id, { name: 'lb-one' });
    await LB_SEED(user._id, { name: 'lb-two', status: 'paused' });

    const res = await app.inject({
      method: 'GET',
      url: '/api/loadbalancers?status=unknown-value',
      headers: cookie,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.loadBalancers).toHaveLength(2);
  });

  it('does not return another user LBs even when search matches', async () => {
    const { user: u1, cookie: c1 } = await createTestUser({ email: 'u1@example.com' });
    // Use a raw ObjectId for u2 to avoid the firebaseUid sparse unique index conflict.
    // Use distinct scriptNames (globally unique index) while both match the search term.
    const u2Id = new mongoose.Types.ObjectId();
    await LB_SEED(u1._id, { name: 'shared-u1' });
    await LB_SEED(u2Id, { name: 'shared-u2' });

    const res = await app.inject({
      method: 'GET',
      url: '/api/loadbalancers?search=shared',
      headers: c1,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.loadBalancers).toHaveLength(1);
  });

  it('handles regex special characters in search safely', async () => {
    const { user, cookie } = await createTestUser();
    await LB_SEED(user._id, { name: 'safe-lb' });

    const res = await app.inject({
      method: 'GET',
      url: '/api/loadbalancers?search=.*%5B%5D%28%29',
      headers: cookie,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.loadBalancers).toHaveLength(0);
  });
});

// ─── Analytics ────────────────────────────────────────────────────────────────

jest.mock('../../modules/loadbalancer/services/analytics.service', () => ({
  fetchWorkerAnalytics: jest.fn().mockResolvedValue({
    requests: 5000,
    errors: 25,
    errorRate: 0.5,
  }),
}));

import { fetchWorkerAnalytics } from '../../modules/loadbalancer/services/analytics.service';

const mockedFetchAnalytics = fetchWorkerAnalytics as jest.MockedFunction<typeof fetchWorkerAnalytics>;

describe('GET /api/loadbalancers/:id/analytics', () => {
  it('200 returns analytics data for the owning user', async () => {
    const { user, cookie } = await createTestUser();
    const lb = await LB_SEED(user._id, { name: 'analytics-lb' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/loadbalancers/${lb._id}/analytics`,
      headers: cookie,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.analytics.requests).toBe(5000);
    expect(body.data.analytics.errors).toBe(25);
    expect(body.data.analytics.errorRate).toBe(0.5);
  });

  it('200 with analytics: null when CF call fails (graceful)', async () => {
    mockedFetchAnalytics.mockResolvedValueOnce(null);
    const { user, cookie } = await createTestUser();
    const lb = await LB_SEED(user._id, { name: 'cf-fail-lb' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/loadbalancers/${lb._id}/analytics`,
      headers: cookie,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.analytics).toBeNull();
  });

  it('defaults period to 24h when not specified', async () => {
    const { user, cookie } = await createTestUser();
    const lb = await LB_SEED(user._id, { name: 'period-lb' });

    await app.inject({
      method: 'GET',
      url: `/api/loadbalancers/${lb._id}/analytics`,
      headers: cookie,
    });

    expect(mockedFetchAnalytics).toHaveBeenCalledWith(
      expect.objectContaining({ period: '24h' })
    );
  });

  it('passes period=7d when specified in query string', async () => {
    const { user, cookie } = await createTestUser();
    const lb = await LB_SEED(user._id, { name: 'period7d-lb' });

    await app.inject({
      method: 'GET',
      url: `/api/loadbalancers/${lb._id}/analytics?period=7d`,
      headers: cookie,
    });

    expect(mockedFetchAnalytics).toHaveBeenCalledWith(
      expect.objectContaining({ period: '7d' })
    );
  });

  it('passes the correct scriptName to the analytics service', async () => {
    const { user, cookie } = await createTestUser();
    const lb = await LB_SEED(user._id, { name: 'script-check' });

    await app.inject({
      method: 'GET',
      url: `/api/loadbalancers/${lb._id}/analytics`,
      headers: cookie,
    });

    expect(mockedFetchAnalytics).toHaveBeenCalledWith(
      expect.objectContaining({ scriptName: 'script-check' })
    );
  });

  it('404 when load balancer does not exist', async () => {
    const { cookie } = await createTestUser();
    const fakeId = new mongoose.Types.ObjectId().toString();

    const res = await app.inject({
      method: 'GET',
      url: `/api/loadbalancers/${fakeId}/analytics`,
      headers: cookie,
    });

    expect(res.statusCode).toBe(404);
  });

  it('403 when load balancer belongs to a different user', async () => {
    const { user: owner } = await createTestUser({ email: 'owner2@example.com' });
    const otherUserId = new mongoose.Types.ObjectId().toString();
    const otherCookie = { cookie: `token=${makeTestJwt({ userId: otherUserId, email: 'other2@example.com' })}` };
    const lb = await LB_SEED(owner._id, { name: 'protected-lb' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/loadbalancers/${lb._id}/analytics`,
      headers: otherCookie,
    });

    expect(res.statusCode).toBe(403);
  });

  it('401 when not authenticated', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await app.inject({
      method: 'GET',
      url: `/api/loadbalancers/${fakeId}/analytics`,
    });
    expect(res.statusCode).toBe(401);
  });

  it('400 when id is not a valid ObjectId', async () => {
    const { cookie } = await createTestUser();
    const res = await app.inject({
      method: 'GET',
      url: '/api/loadbalancers/not-an-id/analytics',
      headers: cookie,
    });
    expect(res.statusCode).toBe(400);
  });
});

// ─── Rate Limiting ────────────────────────────────────────────────────────────

describe('Rate limiting', () => {
  it('includes x-ratelimit-limit and x-ratelimit-remaining headers on protected routes', async () => {
    const { cookie } = await createTestUser();
    const res = await app.inject({
      method: 'GET',
      url: '/api/loadbalancers',
      headers: cookie,
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['x-ratelimit-limit']).toBeDefined();
    expect(res.headers['x-ratelimit-remaining']).toBeDefined();
  });

  it('x-ratelimit-remaining decrements with each request', async () => {
    const { cookie } = await createTestUser();
    const first  = await app.inject({ method: 'GET', url: '/api/loadbalancers', headers: cookie });
    const second = await app.inject({ method: 'GET', url: '/api/loadbalancers', headers: cookie });

    const remaining1 = Number(first.headers['x-ratelimit-remaining']);
    const remaining2 = Number(second.headers['x-ratelimit-remaining']);
    expect(remaining2).toBeLessThan(remaining1);
  });
});

// ─── CORS ─────────────────────────────────────────────────────────────────────

describe('CORS — create and retrieve', () => {
  it('stores corsEnabled: true and returns it in the response', async () => {
    const { cookie } = await createTestUser();
    const res = await app.inject({
      method: 'POST',
      url: '/api/loadbalancers',
      headers: cookie,
      payload: { ...VALID_PAYLOAD, corsEnabled: true, corsOrigins: ['https://a.com'] },
    });
    expect(res.statusCode).toBe(201);
    const lb = res.json().data.loadBalancer;
    expect(lb.corsEnabled).toBe(true);
    expect(lb.corsOrigins).toEqual(['https://a.com']);
  });

  it('defaults corsEnabled to false and corsOrigins to [] when omitted', async () => {
    const { cookie } = await createTestUser();
    const res = await app.inject({
      method: 'POST',
      url: '/api/loadbalancers',
      headers: cookie,
      payload: VALID_PAYLOAD,
    });
    expect(res.statusCode).toBe(201);
    const lb = res.json().data.loadBalancer;
    expect(lb.corsEnabled).toBe(false);
    expect(lb.corsOrigins).toEqual([]);
  });

  it('GET returns corsEnabled and corsOrigins from DB', async () => {
    const { user, cookie } = await createTestUser();
    const lb = await LoadBalancer.create({
      userId: user._id,
      name: 'cors-test',
      scriptName: 'cors-test',
      domain: 'example.com',
      origins: [{ url: 'https://origin.example.com', weight: 100 }],
      strategy: 'round-robin',
      weightedEnabled: false,
      corsEnabled: true,
      corsOrigins: ['https://app.example.com'],
      placement: { smartPlacement: false },
      zoneId: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
      status: 'active',
      workerUrl: 'https://cors-test.example.com',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/loadbalancers/${lb._id}`,
      headers: cookie,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json().data.loadBalancer;
    expect(body.corsEnabled).toBe(true);
    expect(body.corsOrigins).toEqual(['https://app.example.com']);
  });
});

// ─── ipOriginRecords ──────────────────────────────────────────────────────────

describe('ipOriginRecords — persistence', () => {
  it('GET returns ipOriginRecords stored in the DB', async () => {
    const { user, cookie } = await createTestUser();
    const lb = await LoadBalancer.create({
      userId: user._id,
      name: 'ip-records-test',
      scriptName: 'ip-records-test',
      domain: 'example.com',
      origins: [{ url: 'https://lb-o1.example.com', weight: 100 }],
      strategy: 'round-robin',
      weightedEnabled: false,
      ipOriginRecords: [
        { originalUrl: 'http://1.2.3.4', hostname: 'lb-o1.example.com', dnsRecordId: 'rec-1' },
      ],
      placement: { smartPlacement: false },
      zoneId: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
      status: 'active',
      workerUrl: 'https://ip-records-test.example.com',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/loadbalancers/${lb._id}`,
      headers: cookie,
    });
    expect(res.statusCode).toBe(200);
    const ipRecords = res.json().data.loadBalancer.ipOriginRecords;
    expect(ipRecords).toHaveLength(1);
    expect(ipRecords[0]).toMatchObject({
      originalUrl: 'http://1.2.3.4',
      hostname: 'lb-o1.example.com',
      dnsRecordId: 'rec-1',
    });
  });

  it('GET returns empty ipOriginRecords for LB without the field (backward compat)', async () => {
    const { user, cookie } = await createTestUser();
    const lb = await LoadBalancer.create({
      userId: user._id,
      name: 'legacy-ip-test',
      scriptName: 'legacy-ip-test',
      domain: 'example.com',
      origins: [{ url: 'https://origin.example.com', weight: 100 }],
      strategy: 'round-robin',
      weightedEnabled: false,
      placement: { smartPlacement: false },
      zoneId: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
      status: 'active',
      workerUrl: 'https://legacy-ip-test.example.com',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/loadbalancers/${lb._id}`,
      headers: cookie,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.loadBalancer.ipOriginRecords).toEqual([]);
  });
});

// ─── GET /api/loadbalancers/:id/origin-ip ─────────────────────────────────────

describe('GET /api/loadbalancers/:id/origin-ip', () => {
  it('200 returns originalUrl when hostname matches an ipOriginRecords entry', async () => {
    const { user, cookie } = await createTestUser();
    const lb = await LoadBalancer.create({
      userId: user._id,
      name: 'origin-ip-test',
      scriptName: 'origin-ip-test',
      domain: 'example.com',
      origins: [{ url: 'https://lb-o1.example.com', weight: 100 }],
      strategy: 'round-robin',
      weightedEnabled: false,
      ipOriginRecords: [
        { originalUrl: 'http://1.2.3.4', hostname: 'lb-o1.example.com', dnsRecordId: 'rec-1' },
      ],
      placement: { smartPlacement: false },
      zoneId: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
      status: 'active',
      workerUrl: 'https://origin-ip-test.example.com',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/loadbalancers/${lb._id}/origin-ip?hostname=lb-o1.example.com`,
      headers: cookie,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
    expect(res.json().data.originalUrl).toBe('http://1.2.3.4');
  });

  it('404 when no matching hostname in ipOriginRecords', async () => {
    const { user, cookie } = await createTestUser();
    const lb = await LoadBalancer.create({
      userId: user._id,
      name: 'origin-ip-no-match',
      scriptName: 'origin-ip-no-match',
      domain: 'example.com',
      origins: [{ url: 'https://lb-o1.example.com', weight: 100 }],
      strategy: 'round-robin',
      weightedEnabled: false,
      ipOriginRecords: [
        { originalUrl: 'http://1.2.3.4', hostname: 'lb-o1.example.com', dnsRecordId: 'rec-1' },
      ],
      placement: { smartPlacement: false },
      zoneId: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
      status: 'active',
      workerUrl: 'https://origin-ip-no-match.example.com',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/loadbalancers/${lb._id}/origin-ip?hostname=lb-o99.example.com`,
      headers: cookie,
    });
    expect(res.statusCode).toBe(404);
  });

  it('404 when load balancer not found', async () => {
    const { cookie } = await createTestUser();
    const fakeId = new mongoose.Types.ObjectId().toString();

    const res = await app.inject({
      method: 'GET',
      url: `/api/loadbalancers/${fakeId}/origin-ip?hostname=lb-o1.example.com`,
      headers: cookie,
    });
    expect(res.statusCode).toBe(404);
  });

  it('403 when load balancer belongs to a different user', async () => {
    const { user: owner } = await createTestUser({ email: 'owner3@example.com' });
    const otherUserId = new mongoose.Types.ObjectId().toString();
    const otherCookie = { cookie: `token=${makeTestJwt({ userId: otherUserId, email: 'other3@example.com' })}` };

    const lb = await LoadBalancer.create({
      userId: owner._id,
      name: 'origin-ip-owner',
      scriptName: 'origin-ip-owner',
      domain: 'example.com',
      origins: [{ url: 'https://lb-o1.example.com', weight: 100 }],
      strategy: 'round-robin',
      weightedEnabled: false,
      ipOriginRecords: [
        { originalUrl: 'http://1.2.3.4', hostname: 'lb-o1.example.com', dnsRecordId: 'rec-1' },
      ],
      placement: { smartPlacement: false },
      zoneId: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
      status: 'active',
      workerUrl: 'https://origin-ip-owner.example.com',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/loadbalancers/${lb._id}/origin-ip?hostname=lb-o1.example.com`,
      headers: otherCookie,
    });
    expect(res.statusCode).toBe(403);
  });

  it('401 when not authenticated', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await app.inject({
      method: 'GET',
      url: `/api/loadbalancers/${fakeId}/origin-ip?hostname=lb-o1.example.com`,
    });
    expect(res.statusCode).toBe(401);
  });

  it('400 when hostname query param is missing', async () => {
    const { cookie } = await createTestUser();
    const fakeId = new mongoose.Types.ObjectId().toString();

    const res = await app.inject({
      method: 'GET',
      url: `/api/loadbalancers/${fakeId}/origin-ip`,
      headers: cookie,
    });
    expect(res.statusCode).toBe(400);
  });

  it('400 when id is not a valid ObjectId', async () => {
    const { cookie } = await createTestUser();

    const res = await app.inject({
      method: 'GET',
      url: '/api/loadbalancers/not-an-id/origin-ip?hostname=lb-o1.example.com',
      headers: cookie,
    });
    expect(res.statusCode).toBe(400);
  });
});
