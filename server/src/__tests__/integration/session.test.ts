import mongoose from 'mongoose';
import { connectTestDb, clearCollections, closeTestDb } from '../helpers/db';
import { createSession, deactivateSessionsForLoadBalancer } from '../../services/sessionService';
import { Session } from '../../models/Session';

const FAKE_USER_ID = new mongoose.Types.ObjectId().toString();
const FAKE_LB_ID = new mongoose.Types.ObjectId().toString();
const FAKE_LB_ID_2 = new mongoose.Types.ObjectId().toString();

const BASE_SESSION = {
  userId: FAKE_USER_ID,
  email: 'test@example.com',
  content: '// worker code here',
  loadBalancerName: 'my-lb',
  domain: 'example.com',
  subdomain: null,
  strategy: 'round-robin',
  placement: { smartPlacement: false },
  actionType: 'create' as const,
  loadBalancerId: FAKE_LB_ID,
};

beforeAll(async () => {
  await connectTestDb();
});

afterEach(async () => {
  await clearCollections();
});

afterAll(async () => {
  await closeTestDb();
});

// ─── createSession ────────────────────────────────────────────────────────────

describe('createSession', () => {
  it('creates a document with isActive=true and correct fields', async () => {
    await createSession(BASE_SESSION);
    const sessions = await Session.find({});
    expect(sessions).toHaveLength(1);
    const s = sessions[0];
    expect(s.isActive).toBe(true);
    expect(s.actionType).toBe('create');
    expect(s.loadBalancerName).toBe('my-lb');
    expect(s.domain).toBe('example.com');
    expect(s.email).toBe('test@example.com');
    expect(s.content).toBe('// worker code here');
    expect(s.strategy).toBe('round-robin');
  });

  it('stores loadBalancerId as an ObjectId matching the input', async () => {
    await createSession(BASE_SESSION);
    const s = await Session.findOne({});
    expect(s!.loadBalancerId!.toString()).toBe(FAKE_LB_ID);
  });

  it('stores userId as an ObjectId matching the input', async () => {
    await createSession(BASE_SESSION);
    const s = await Session.findOne({});
    expect(s!.userId.toString()).toBe(FAKE_USER_ID);
  });

  it('creates with actionType edit', async () => {
    await createSession({ ...BASE_SESSION, actionType: 'edit' });
    const s = await Session.findOne({});
    expect(s!.actionType).toBe('edit');
  });

  it('stores null email when email is null', async () => {
    await createSession({ ...BASE_SESSION, email: null });
    const s = await Session.findOne({});
    expect(s!.email).toBeNull();
  });

  it('stores null subdomain when subdomain is null', async () => {
    await createSession({ ...BASE_SESSION, subdomain: null });
    const s = await Session.findOne({});
    expect(s!.subdomain).toBeNull();
  });

  it('stores subdomain when provided', async () => {
    await createSession({ ...BASE_SESSION, subdomain: 'api' });
    const s = await Session.findOne({});
    expect(s!.subdomain).toBe('api');
  });

  it('creates multiple sessions independently', async () => {
    await createSession(BASE_SESSION);
    await createSession({ ...BASE_SESSION, actionType: 'edit', loadBalancerId: FAKE_LB_ID_2 });
    const sessions = await Session.find({});
    expect(sessions).toHaveLength(2);
  });
});

// ─── deactivateSessionsForLoadBalancer ───────────────────────────────────────

describe('deactivateSessionsForLoadBalancer', () => {
  it('sets isActive=false and loadBalancerId=null on matching active sessions', async () => {
    await createSession(BASE_SESSION);
    await deactivateSessionsForLoadBalancer(FAKE_LB_ID);
    const s = await Session.findOne({});
    expect(s!.isActive).toBe(false);
    expect(s!.loadBalancerId).toBeNull();
  });

  it('deactivates all active sessions for the given LB', async () => {
    await createSession(BASE_SESSION);
    await createSession({ ...BASE_SESSION, actionType: 'edit' });
    await deactivateSessionsForLoadBalancer(FAKE_LB_ID);
    const sessions = await Session.find({});
    expect(sessions).toHaveLength(2);
    expect(sessions.every(s => !s.isActive)).toBe(true);
    expect(sessions.every(s => s.loadBalancerId === null)).toBe(true);
  });

  it('does not affect sessions for a different load balancer', async () => {
    await createSession(BASE_SESSION);                                          // FAKE_LB_ID
    await createSession({ ...BASE_SESSION, loadBalancerId: FAKE_LB_ID_2 });    // FAKE_LB_ID_2

    await deactivateSessionsForLoadBalancer(FAKE_LB_ID);

    const deactivated = await Session.findOne({ isActive: false });
    const stillActive = await Session.findOne({ isActive: true });

    expect(deactivated).not.toBeNull();
    expect(deactivated!.loadBalancerId).toBeNull();

    expect(stillActive).not.toBeNull();
    expect(stillActive!.loadBalancerId!.toString()).toBe(FAKE_LB_ID_2);
  });

  it('does not deactivate already-inactive sessions', async () => {
    await createSession(BASE_SESSION);
    await deactivateSessionsForLoadBalancer(FAKE_LB_ID);   // first deactivation
    await createSession({ ...BASE_SESSION, actionType: 'edit' }); // new active session

    // Deactivate again — only the new one should be affected
    await deactivateSessionsForLoadBalancer(FAKE_LB_ID);

    const sessions = await Session.find({});
    expect(sessions.every(s => !s.isActive)).toBe(true);
  });

  it('resolves without error when no sessions match', async () => {
    await expect(
      deactivateSessionsForLoadBalancer(FAKE_LB_ID)
    ).resolves.not.toThrow();
  });
});

// ─── Full lifecycle ───────────────────────────────────────────────────────────

describe('session lifecycle (create → edit → delete)', () => {
  it('create → edit deactivates old session and creates new one', async () => {
    // create
    await createSession({ ...BASE_SESSION, actionType: 'create' });

    // edit: deactivate old, create new
    await deactivateSessionsForLoadBalancer(FAKE_LB_ID);
    await createSession({ ...BASE_SESSION, actionType: 'edit' });

    const sessions = await Session.find({}).sort({ createdAt: 1 });
    expect(sessions).toHaveLength(2);
    expect(sessions[0].isActive).toBe(false);
    expect(sessions[0].loadBalancerId).toBeNull();
    expect(sessions[1].isActive).toBe(true);
    expect(sessions[1].actionType).toBe('edit');
  });

  it('delete deactivates the active session', async () => {
    await createSession({ ...BASE_SESSION, actionType: 'create' });
    await deactivateSessionsForLoadBalancer(FAKE_LB_ID);

    const s = await Session.findOne({});
    expect(s!.isActive).toBe(false);
    expect(s!.loadBalancerId).toBeNull();
  });
});
