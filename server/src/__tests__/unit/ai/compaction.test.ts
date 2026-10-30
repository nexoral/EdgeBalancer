jest.mock('../../../modules/ai/services/model-router.service', () => ({
  invokeWithFallback: jest.fn(async () => ({ response: { content: 'A summary of what happened.' }, model: 'test-model' })),
}));

import { AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import { compactHistory, estimateTokens, findOrphanIndex } from '../../../modules/ai/services/compaction.service';
import { invokeWithFallback } from '../../../modules/ai/services/model-router.service';

const mockedInvoke = invokeWithFallback as jest.Mock;

const log = { info: jest.fn(), warn: jest.fn() };
const state = () => ({ skippedModels: new Set<string>(), deadProviders: new Set(), exhaustedProviders: new Set() }) as any;

// ~1200 tokens each, so a handful of results crosses the 9000-token budget.
const padding = (chars: number) => 'x'.repeat(chars);

const toolResult = (id: string, chars = 4800) =>
  new ToolMessage({ content: JSON.stringify({ ok: true, data: { id, blob: padding(chars) } }), tool_call_id: id });

const toolRequest = (ids: string[]) =>
  new AIMessage({ content: '', tool_calls: ids.map((id) => ({ id, name: 'list_zones', args: {} })) });

/** Replays the exact order runAgent pushes messages in. */
const buildHistory = (iterations: number, callsPerBatch = 1, chars = 4800): BaseMessage[] => {
  const messages: BaseMessage[] = [new SystemMessage('SYSTEM'), new HumanMessage('create a balancer on example.com')];

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const ids = Array.from({ length: callsPerBatch }, (_, index) => `call-${iteration}-${index}`);
    messages.push(toolRequest(ids));
    ids.forEach((id) => messages.push(toolResult(id, chars)));
  }

  return messages;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedInvoke.mockResolvedValue({ response: { content: 'A summary of what happened.' }, model: 'test-model' });
});

describe('estimateTokens', () => {
  it('is zero for an empty history and grows with content', () => {
    expect(estimateTokens([])).toBe(0);
    expect(estimateTokens([new HumanMessage(padding(400))])).toBeGreaterThan(estimateTokens([new HumanMessage(padding(40))]));
  });

  it('counts the tool_calls payload, not just the text', () => {
    const bare = new AIMessage({ content: '' });
    expect(estimateTokens([toolRequest(['a', 'b', 'c'])])).toBeGreaterThan(estimateTokens([bare]));
  });
});

describe('findOrphanIndex', () => {
  it('accepts a well-formed chain', () => {
    expect(findOrphanIndex(buildHistory(3))).toBe(-1);
    expect(findOrphanIndex(buildHistory(3, 3))).toBe(-1);
  });

  it('catches a tool result whose request was removed', () => {
    const messages = [new SystemMessage('S'), new HumanMessage('H'), toolResult('call-0-0')];
    expect(findOrphanIndex(messages)).toBe(2);
  });

  it('catches a request whose results are missing', () => {
    const messages = [new SystemMessage('S'), new HumanMessage('H'), toolRequest(['a', 'b']), toolResult('a')];
    expect(findOrphanIndex(messages)).toBe(2);
  });
});

describe('compactHistory', () => {
  it('leaves a history under the token budget alone', async () => {
    const messages = buildHistory(1, 1, 50);

    const result = await compactHistory(messages, log, state());

    expect(result.summarized).toBe(false);
    expect(result.messages).toBe(messages);
    expect(mockedInvoke).not.toHaveBeenCalled();
  });

  // The regression guard: this produced [system, summary, ToolMessage, …] from the eighth tool
  // call onward, which providers reject with a 400.
  it.each([1, 2, 3])('never breaks the tool-call chain with %i call(s) per batch', async (callsPerBatch) => {
    let messages: BaseMessage[] = [new SystemMessage('SYSTEM'), new HumanMessage('create a balancer on example.com')];

    for (let iteration = 0; iteration < 20; iteration += 1) {
      const ids = Array.from({ length: callsPerBatch }, (_, index) => `call-${iteration}-${index}`);
      messages.push(toolRequest(ids));

      // After every result, as runAgent does — including mid-batch, where the chain is incomplete.
      for (const [index, id] of ids.entries()) {
        messages.push(toolResult(id));

        const before = messages;
        const result = await compactHistory(messages, log, state());
        messages = result.messages;

        if (index < ids.length - 1) {
          expect(result.summarized).toBe(false);
          expect(messages).toBe(before);
          continue;
        }

        // Batch complete — the state the next model call is handed.
        expect(findOrphanIndex(messages)).toBe(-1);
      }
    }

    // It compacted along the way, rather than passing by doing nothing.
    expect(mockedInvoke.mock.calls.length).toBeGreaterThan(0);
  });

  it('keeps the system prompt and the original request verbatim', async () => {
    const messages = buildHistory(8);

    const result = await compactHistory(messages, log, state());

    expect(result.summarized).toBe(true);
    expect(result.messages[0]).toBe(messages[0]);
    expect(result.messages[1]).toBe(messages[1]);
    expect(String(result.messages[1].content)).toBe('create a balancer on example.com');
  });

  it('compacts on one oversized tool result, which a message count cannot see', async () => {
    // Four messages, so any count-based threshold stays asleep — but ~10000 tokens.
    const messages = [
      new SystemMessage('SYSTEM'),
      new HumanMessage('list my load balancers'),
      toolRequest(['big']),
      toolResult('big', 40_000),
    ];

    const result = await compactHistory(messages, log, state());

    expect(result.summarized).toBe(true);
    expect(findOrphanIndex(result.messages)).toBe(-1);
    expect(estimateTokens(result.messages)).toBeLessThan(estimateTokens(messages));
  });

  it('keeps the RCA instruction, which the first-prompt pin does not cover', async () => {
    const messages = buildHistory(4);
    const rca = new HumanMessage('The run has stopped. Write a root-cause analysis.');
    messages.push(rca, ...buildHistory(4).slice(2));

    const result = await compactHistory(messages, log, state());

    expect(result.summarized).toBe(true);
    // Position proves it was pinned, not merely carried along by the recent chunk.
    expect(String(result.messages[2].content)).toContain('[Conversation Summary]');
    expect(result.messages[3]).toBe(rca);
    expect(findOrphanIndex(result.messages)).toBe(-1);
  });

  it('keeps the full history when the summarizer fails', async () => {
    const messages = buildHistory(8);
    mockedInvoke.mockRejectedValueOnce(new Error('all models down'));

    const result = await compactHistory(messages, log, state());

    expect(result.summarized).toBe(false);
    expect(result.messages).toBe(messages);
  });

  it('reuses the run\'s router state instead of rediscovering dead models', async () => {
    const shared = state();
    shared.skippedModels.add('mistral-large-2512');

    await compactHistory(buildHistory(8), log, shared);

    expect(mockedInvoke.mock.calls[0][0].state).toBe(shared);
  });

  it('skips compaction when the history does not start with a system prompt', async () => {
    const messages = buildHistory(8).slice(1);

    const result = await compactHistory(messages, log, state());

    expect(result.summarized).toBe(false);
    expect(log.warn).toHaveBeenCalled();
  });

  it('emits compaction_start and compaction_result with token savings', async () => {
    const messages = buildHistory(8);
    const emit = jest.fn();

    const result = await compactHistory(messages, log, state(), emit);

    expect(result.summarized).toBe(true);
    expect(result.tokensSaved).toBeGreaterThan(0);
    expect(emit).toHaveBeenCalledWith('compaction_start', {
      tokensBefore: expect.any(Number),
    });
    expect(emit).toHaveBeenCalledWith('compaction_result', {
      ok: true,
      tokensBefore: expect.any(Number),
      tokensAfter: expect.any(Number),
      tokensSaved: expect.any(Number),
    });
    expect(result.tokensBefore).toBeGreaterThan(result.tokensAfter!);
  });
});
