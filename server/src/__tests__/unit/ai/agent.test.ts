jest.mock('../../../modules/ai/services/compaction.service', () => ({
  needsCompaction: jest.fn(() => false),
  compactHistory: jest.fn(async (messages) => ({ messages, summarized: false })),
}));

jest.mock('../../../modules/ai/services/model-router.service', () => ({
  invokeWithFallback: jest.fn(),
  createRouterState: () => ({ skippedModels: new Set(), deadProviders: new Set(), exhaustedProviders: new Set() }),
}));

jest.mock('../../../modules/ai/services/tools.service', () => ({
  buildTools: jest.fn(),
  MUTATING_TOOL_NAMES: ['create_load_balancer', 'update_load_balancer', 'delete_load_balancer', 'pause_load_balancer', 'resume_load_balancer'],
}));

jest.mock('../../../modules/ai/services/conversation.service', () => ({
  saveConversation: jest.fn(),
  loadConversation: jest.fn(async () => null),
  deleteConversation: jest.fn(),
}));

import { createTrace, runAgent } from '../../../modules/ai/services/agent.service';
import { invokeWithFallback } from '../../../modules/ai/services/model-router.service';
import { buildTools } from '../../../modules/ai/services/tools.service';
import { saveConversation, loadConversation, deleteConversation } from '../../../modules/ai/services/conversation.service';

const mockedInvoke = invokeWithFallback as jest.Mock;
const mockedBuildTools = buildTools as jest.Mock;
const mockedSaveConversation = saveConversation as jest.Mock;
const mockedLoadConversation = loadConversation as jest.Mock;
const mockedDeleteConversation = deleteConversation as jest.Mock;

const aiMessage = (toolCalls: any[] = [], content = '') => ({
  response: { content, tool_calls: toolCalls },
  model: 'test-model',
});

const call = (name: string, args: Record<string, unknown> = {}) => ({ name, args, id: `${name}-1` });

const fakeTool = (name: string, invoke: jest.Mock) => ({ name, invoke });

const execute = (prompt = 'create a load balancer', history: any[] = []) =>
  runAgent({
    runId: 'run-1',
    userId: 'user-1',
    userEmail: null,
    history: [...history, { role: 'user', content: prompt }],
    cancellation: { isCancelled: () => false, throwIfCancelled: async () => undefined } as any,
    emit: jest.fn(),
    trace: createTrace(),
  });

describe('runAgent failure handling', () => {
  // A test whose flow short-circuits would otherwise leave unconsumed `mockResolvedValueOnce`
  // responses queued, poisoning every later test in the file.
  beforeEach(() => {
    mockedInvoke.mockReset();
    mockedBuildTools.mockReset();
  });

  it('stops after the same tool fails twice instead of looping', async () => {
    const failing = jest.fn(async () => JSON.stringify({ ok: false, error: 'zoneId must be 32 characters' }));
    mockedBuildTools.mockReturnValue([fakeTool('create_load_balancer', failing)]);

    mockedInvoke
      .mockResolvedValueOnce(aiMessage([call('create_load_balancer')]))
      .mockResolvedValueOnce(aiMessage([call('create_load_balancer')]))
      // The RCA call that follows the second failure.
      .mockResolvedValueOnce(aiMessage([], 'The zone id you gave was too short.'));

    const result = await execute();

    expect(failing).toHaveBeenCalledTimes(2);
    expect(result.outcome).toBe('failure');
    expect(result.message).toBe('The zone id you gave was too short.');
  });

  it('stops on the first conflict instead of letting the model rename around it', async () => {
    const conflicting = jest.fn(async () => {
      throw Object.assign(new Error('A Worker with this name already exists in your Cloudflare account.'), { statusCode: 409 });
    });
    mockedBuildTools.mockReturnValue([fakeTool('create_load_balancer', conflicting)]);

    mockedInvoke
      .mockResolvedValueOnce(aiMessage([call('create_load_balancer', { name: 'ankan-in' })]))
      .mockResolvedValueOnce(aiMessage([], 'That Worker name is already taken.'));

    const result = await execute();

    expect(conflicting).toHaveBeenCalledTimes(1);
    expect(result.outcome).toBe('failure');
    expect(result.message).toBe('That Worker name is already taken.');
  });

  it('still retries a non-conflict failure once', async () => {
    const failing = jest.fn(async () => {
      throw Object.assign(new Error('Cloudflare timed out'), { statusCode: 504 });
    });
    mockedBuildTools.mockReturnValue([fakeTool('create_load_balancer', failing)]);

    mockedInvoke
      .mockResolvedValueOnce(aiMessage([call('create_load_balancer')]))
      .mockResolvedValueOnce(aiMessage([call('create_load_balancer')]))
      .mockResolvedValueOnce(aiMessage([], 'Cloudflare was unreachable.'));

    await execute();

    expect(failing).toHaveBeenCalledTimes(2);
  });

  it('falls back to the raw tool error when the RCA call fails', async () => {
    const failing = jest.fn(async () => JSON.stringify({ ok: false, error: 'Hostname already assigned' }));
    mockedBuildTools.mockReturnValue([fakeTool('create_load_balancer', failing)]);

    mockedInvoke
      .mockResolvedValueOnce(aiMessage([call('create_load_balancer')]))
      .mockResolvedValueOnce(aiMessage([call('create_load_balancer')]))
      .mockRejectedValueOnce(new Error('all models down'));

    const result = await execute();

    expect(result.outcome).toBe('failure');
    expect(result.message).toBe('Hostname already assigned');
  });

  it('does not report success when every tool failed and nothing was created', async () => {
    const failing = jest.fn(async () => JSON.stringify({ ok: false, error: 'nope' }));
    mockedBuildTools.mockReturnValue([fakeTool('create_load_balancer', failing)]);

    mockedInvoke
      .mockResolvedValueOnce(aiMessage([call('create_load_balancer')]))
      .mockResolvedValueOnce(aiMessage([], 'I could not do it.'))
      .mockResolvedValueOnce(aiMessage([], 'The domain was already taken.'));

    const result = await execute();

    expect(result.outcome).toBe('failure');
  });

  it('resets a tool failure count once it succeeds', async () => {
    const flaky = jest
      .fn()
      .mockResolvedValueOnce(JSON.stringify({ ok: false, error: 'transient' }))
      .mockResolvedValueOnce(JSON.stringify({ ok: true, data: { fullDomain: 'api.example.com' } }))
      .mockResolvedValueOnce(JSON.stringify({ ok: false, error: 'transient' }));
    mockedBuildTools.mockReturnValue([fakeTool('list_zones', flaky)]);

    mockedInvoke
      .mockResolvedValueOnce(aiMessage([call('list_zones')]))
      .mockResolvedValueOnce(aiMessage([call('list_zones')]))
      .mockResolvedValueOnce(aiMessage([call('list_zones')]))
      .mockResolvedValueOnce(aiMessage([], 'Done.'))
      .mockResolvedValue(aiMessage([], 'RCA text.'));

    await execute();

    // Three calls means the success in between cleared the counter — otherwise it stops at two.
    expect(flaky).toHaveBeenCalledTimes(3);
  });

  it('treats a plain-text confirmation question as a finished success turn', async () => {
    // Destructive steps now pause in prose: the model ends its turn with a question and no tool
    // call. That is not a silent failure — no RCA, outcome success, message is the question.
    mockedBuildTools.mockReturnValue([fakeTool('delete_load_balancer', jest.fn())]);

    mockedInvoke.mockResolvedValueOnce(aiMessage([], 'Delete "edge-api"? This cannot be undone.'));

    const result = await execute('delete my balancer');

    expect(result.outcome).toBe('success');
    expect(result.message).toBe('Delete "edge-api"? This cannot be undone.');
    // One model call only — nothing runs after the question.
    expect(mockedInvoke).toHaveBeenCalledTimes(1);
  });

  it('replays the conversation chain before the newest message', async () => {
    mockedBuildTools.mockReturnValue([]);
    mockedInvoke.mockResolvedValueOnce(aiMessage([], 'Yes, deleting it now.'));

    await execute('yes, go ahead', [
      { role: 'user', content: 'delete my balancer' },
      { role: 'assistant', content: 'Delete "edge-api"?' },
    ]);

    const sent = mockedInvoke.mock.calls[0][0].messages;
    const text = sent.map((m: any) => m.content);
    expect(text).toContain('delete my balancer');
    expect(text).toContain('Delete "edge-api"?');
    // The newest user message comes after every earlier turn.
    expect(text.indexOf('yes, go ahead')).toBeGreaterThan(text.indexOf('Delete "edge-api"?'));
  });

  it('settles a zero-tool-call ending as success — questions are ordinary turns now', async () => {
    mockedBuildTools.mockReturnValue([]);
    mockedInvoke.mockResolvedValueOnce(aiMessage([], 'I need the domain and at least one origin URL.'));

    const result = await execute('make me a load balancer');

    expect(result.outcome).toBe('success');
    expect(result.message).toBe('I need the domain and at least one origin URL.');
  });

  it('binds only find_tools until it has loaded something', async () => {
    const finder = jest.fn(async () => JSON.stringify({ ok: true, data: 'ready' }));
    const creating = jest.fn(async () => JSON.stringify({ ok: true, data: { fullDomain: 'api.example.com' } }));
    mockedBuildTools.mockImplementation((ctx: any) => [
      fakeTool('find_tools', jest.fn(async () => {
        ctx.unlocked.add('create_load_balancer');
        return finder();
      })),
      fakeTool('create_load_balancer', creating),
    ]);

    mockedInvoke
      .mockResolvedValueOnce(aiMessage([call('find_tools', { names: ['create_load_balancer'] })]))
      .mockResolvedValueOnce(aiMessage([call('create_load_balancer')]))
      .mockResolvedValueOnce(aiMessage([], 'Deployed api.example.com.'));

    await execute();

    const boundNames = mockedInvoke.mock.calls.map((c: any[]) => c[0].tools.map((t: any) => t.name));
    expect(boundNames[0]).toEqual(['find_tools']);
    expect(boundNames[1]).toEqual(['find_tools', 'create_load_balancer']);
  });

  it('lets RCA research a conflict, with only the web tools bound', async () => {
    const conflicting = jest.fn(async () => {
      throw Object.assign(new Error('A Worker with this name already exists.'), { statusCode: 409 });
    });
    const searching = jest.fn(async () => JSON.stringify({ ok: true, data: { results: [{ title: 'CF docs' }] } }));
    mockedBuildTools.mockReturnValue([
      fakeTool('create_load_balancer', conflicting),
      fakeTool('web_search', searching),
      fakeTool('fetch_url', jest.fn()),
    ]);

    mockedInvoke
      .mockResolvedValueOnce(aiMessage([call('create_load_balancer')]))
      // RCA step 1: research the conflict rather than answering straight away.
      .mockResolvedValueOnce(aiMessage([call('web_search', { query: 'worker name already exists' })]))
      .mockResolvedValueOnce(aiMessage([], 'That Worker name is taken in your Cloudflare account.'));

    const result = await execute();

    expect(searching).toHaveBeenCalledTimes(1);
    expect(result.outcome).toBe('failure');
    expect(result.message).toBe('That Worker name is taken in your Cloudflare account.');

    // The create tool must not be reachable once RCA starts — it could only be used to retry.
    const rcaBound = mockedInvoke.mock.calls[1][0].tools.map((t: any) => t.name);
    expect(rcaBound.sort()).toEqual(['fetch_url', 'web_search']);
  });

  it('gives RCA its own budget when the main loop runs out', async () => {
    const looping = jest.fn(async () => JSON.stringify({ ok: true, data: {} }));
    mockedBuildTools.mockReturnValue([fakeTool('list_zones', looping), fakeTool('web_search', jest.fn())]);

    // The model never stops calling tools, so the run exhausts MAX_ITERATIONS and RCA still runs.
    mockedInvoke.mockResolvedValue(aiMessage([call('list_zones')]));
    mockedInvoke.mockResolvedValueOnce(aiMessage([call('list_zones')]));

    const result = await execute();

    expect(result.outcome).toBe('failure');
    // 12 main iterations + 3 RCA steps, and RCA was bound to the web tools only.
    expect(mockedInvoke).toHaveBeenCalledTimes(15);
    expect(mockedInvoke.mock.calls[14][0].tools.map((t: any) => t.name)).toEqual(['web_search']);
  });

  it('treats a loaded-but-uncalled mutating tool as a confirmation pause, not a failure', async () => {
    const zones = jest.fn(async () => JSON.stringify({ ok: true, data: { zones: [] } }));
    const creating = jest.fn();
    mockedBuildTools.mockImplementation((ctx: any) => [
      fakeTool('find_tools', jest.fn(async () => {
        ctx.unlocked.add('list_zones');
        ctx.unlocked.add('create_load_balancer');
        return JSON.stringify({ ok: true, data: 'ready' });
      })),
      fakeTool('list_zones', zones),
      fakeTool('create_load_balancer', creating),
    ]);

    mockedInvoke
      .mockResolvedValueOnce(aiMessage([call('find_tools', { names: ['list_zones', 'create_load_balancer'] })]))
      .mockResolvedValueOnce(aiMessage([call('list_zones')]))
      // Research done, then the model pauses for agreement in plain text.
      .mockResolvedValueOnce(aiMessage([], 'Create your-lb on example.com round-robin — shall I deploy?'));

    const result = await execute();

    // The pause is a legitimate ending: no RCA detour, nothing deployed behind the user's back.
    expect(result.outcome).toBe('success');
    expect(result.message).toBe('Create your-lb on example.com round-robin — shall I deploy?');
    expect(creating).not.toHaveBeenCalled();
    expect(mockedInvoke).toHaveBeenCalledTimes(3);
  });

  it('reports success when a mutating tool actually ran — a delete leaves nothing touched', async () => {
    mockedBuildTools.mockImplementation((ctx: any) => [
      fakeTool('find_tools', jest.fn(async () => {
        ctx.unlocked.add('delete_load_balancer');
        return JSON.stringify({ ok: true, data: 'ready' });
      })),
      fakeTool('delete_load_balancer', jest.fn(async () =>
        JSON.stringify({ ok: true, data: { message: 'Deleted "ankanlb"' } }))),
      fakeTool('web_search', jest.fn()),
    ]);

    mockedInvoke
      .mockResolvedValueOnce(aiMessage([call('find_tools', { names: ['delete_load_balancer'] })]))
      .mockResolvedValueOnce(aiMessage([call('delete_load_balancer', { id: 'x' })]))
      .mockResolvedValueOnce(aiMessage([], 'Deleted ankanlb at ls.dhorbo.in.'));

    const result = await execute('delete this one');

    expect(result.outcome).toBe('success');
    expect(result.message).toBe('Deleted ankanlb at ls.dhorbo.in.');
  });

  it('still reports success for a read-only run that changes nothing', async () => {
    mockedBuildTools.mockImplementation((ctx: any) => [
      fakeTool('find_tools', jest.fn(async () => {
        ctx.unlocked.add('list_load_balancers');
        return JSON.stringify({ ok: true, data: 'ready' });
      })),
      fakeTool('list_load_balancers', jest.fn(async () => JSON.stringify({ ok: true, data: { loadBalancers: [] } }))),
    ]);

    mockedInvoke
      .mockResolvedValueOnce(aiMessage([call('find_tools', { names: ['list_load_balancers'] })]))
      .mockResolvedValueOnce(aiMessage([call('list_load_balancers')]))
      .mockResolvedValueOnce(aiMessage([], 'You have no load balancers yet.'));

    const result = await execute('list my load balancers');

    expect(result.outcome).toBe('success');
    expect(result.message).toBe('You have no load balancers yet.');
  });

  it('answers every tool call in a batch before the next model call', async () => {
    const conflicting = jest.fn(async () => {
      throw Object.assign(new Error('Hostname already assigned'), { statusCode: 409 });
    });
    mockedBuildTools.mockReturnValue([
      fakeTool('create_load_balancer', conflicting),
      fakeTool('list_zones', jest.fn(async () => JSON.stringify({ ok: true, data: { zones: [] } }))),
      fakeTool('web_search', jest.fn()),
    ]);

    mockedInvoke
      .mockResolvedValueOnce(aiMessage([call('create_load_balancer'), call('list_zones')]))
      .mockResolvedValueOnce(aiMessage([], 'That hostname is already in use.'));

    await execute();

    const rcaMessages = mockedInvoke.mock.calls[1][0].messages;
    const answered = rcaMessages.filter((m: any) => m.tool_call_id).map((m: any) => m.tool_call_id);

    expect(answered).toEqual(['create_load_balancer-1', 'list_zones-1']);
    // The second tool was answered, not executed.
    expect(conflicting).toHaveBeenCalledTimes(1);
  });

  it('stops the run when it outlives the deadline', async () => {
    const slow = jest.fn(async () => JSON.stringify({ ok: true, data: {} }));
    mockedBuildTools.mockReturnValue([fakeTool('list_zones', slow)]);
    mockedInvoke.mockResolvedValue(aiMessage([call('list_zones')]));

    const realNow = Date.now;
    let clock = realNow();
    // Two calls set the deadline, then every later read is past it.
    jest.spyOn(Date, 'now').mockImplementation(() => {
      clock += 60_000;
      return clock;
    });

    try {
      const result = await execute();

      expect(result.outcome).toBe('failure');
      expect(result.message).toMatch(/took too long/);
    } finally {
      (Date.now as jest.Mock).mockRestore();
    }
  });

  it('does not mistake "ok":false inside a successful payload for a failure', async () => {
    const quoting = jest.fn(async () =>
      JSON.stringify({ ok: true, data: { text: 'the server replied {"ok":false,"error":"nope"}' } }),
    );
    mockedBuildTools.mockReturnValue([fakeTool('fetch_url', quoting)]);

    mockedInvoke
      .mockResolvedValueOnce(aiMessage([call('fetch_url')]))
      .mockResolvedValueOnce(aiMessage([], 'Read the page.'));

    const trace = createTrace();
    await runAgent({
      runId: 'run-1',
      userId: 'user-1',
      userEmail: null,
      history: [{ role: 'user', content: 'read that page' }],
      cancellation: { isCancelled: () => false, throwIfCancelled: async () => undefined } as any,
      emit: jest.fn(),
      trace,
    });

    expect(trace.toolCalls[0].ok).toBe(true);
    // A false failure here would have been retried, then diverted into RCA.
    expect(quoting).toHaveBeenCalledTimes(1);
  });

  it('reports success when a tool actually created something', async () => {
    const creating = jest.fn(async () => JSON.stringify({ ok: true, data: { fullDomain: 'api.example.com' } }));
    mockedBuildTools.mockReturnValue([fakeTool('create_load_balancer', creating)]);

    mockedInvoke
      .mockResolvedValueOnce(aiMessage([call('create_load_balancer')]))
      .mockResolvedValueOnce(aiMessage([], 'Deployed api.example.com.'));

    const result = await execute();

    expect(result.outcome).toBe('success');
    expect(result.message).toBe('Deployed api.example.com.');
  });

  it('prefers saved messages from Redis when conversationKey is provided and saves on finish', async () => {
    mockedBuildTools.mockReturnValue([]);
    mockedLoadConversation.mockResolvedValueOnce([
      { type: 'human', content: 'previous turn' },
      { type: 'ai', content: 'prior reply', toolCalls: [{ id: 'call_old', name: 'find_tools', args: {} }] },
      { type: 'tool', content: '{"ok":true}', toolCallId: 'call_old' },
    ]);
    mockedInvoke.mockResolvedValueOnce(aiMessage([], 'All done.'));

    const result = await runAgent({
      runId: 'run-1',
      userId: 'user-1',
      userEmail: null,
      history: [{ role: 'user', content: 'client-stale-history' }, { role: 'user', content: 'new message' }],
      conversationKey: 'conv-123',
      cancellation: { isCancelled: () => false, throwIfCancelled: async () => undefined } as any,
      emit: jest.fn(),
      trace: createTrace(),
    });

    expect(result.outcome).toBe('success');
    expect(mockedLoadConversation).toHaveBeenCalledWith('user-1', 'conv-123');
    expect(mockedSaveConversation).toHaveBeenCalledWith('user-1', 'conv-123', expect.any(Array));
  });

  it('saves conversation state to Redis only once when loop exits in finish', async () => {
    const listZones = jest.fn(async () => JSON.stringify({ ok: true, zones: [] }));
    mockedBuildTools.mockReturnValue([fakeTool('list_zones', listZones)]);

    mockedInvoke
      .mockResolvedValueOnce(aiMessage([call('list_zones')]))
      .mockResolvedValueOnce(aiMessage([], 'Finished listing zones.'));

    await runAgent({
      runId: 'run-1',
      userId: 'user-1',
      userEmail: null,
      history: [{ role: 'user', content: 'list zones' }],
      conversationKey: 'conv-xyz',
      cancellation: { isCancelled: () => false, throwIfCancelled: async () => undefined } as any,
      emit: jest.fn(),
      trace: createTrace(),
    });

    expect(mockedSaveConversation).toHaveBeenCalledTimes(1);
    expect(mockedSaveConversation).toHaveBeenCalledWith('user-1', 'conv-xyz', expect.any(Array));
  });
});
