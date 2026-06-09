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
