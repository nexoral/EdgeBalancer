const store = new Map<string, { value: string; ex: number }>();
let redisUp = true;

jest.mock('../../../utils/redisClient', () => ({
  getRedisClient: async () => {
    if (!redisUp) throw new Error('Redis unreachable');
    return {
      set: async (key: string, value: string, opts?: { EX: number }) => {
        store.set(key, { value, ex: opts?.EX ?? 0 });
        return 'OK';
      },
      get: async (key: string) => store.get(key)?.value ?? null,
      del: async (key: string) => {
        const existed = store.delete(key);
        return existed ? 1 : 0;
      },
    };
  },
}));

import { HumanMessage, AIMessage, ToolMessage, SystemMessage } from '@langchain/core/messages';
import {
  saveConversation,
  loadConversation,
  deleteConversation,
} from '../../../modules/ai/services/conversation.service';

describe('conversation service', () => {
  beforeEach(() => {
    store.clear();
    redisUp = true;
  });

  it('saves and loads messages with correct key and 30 minute TTL', async () => {
    const messages = [
      new SystemMessage('system instruction'),
      new HumanMessage('create lb'),
      new AIMessage({ content: 'thinking', tool_calls: [{ id: 'call_1', name: 'find_tools', args: {} }] }),
      new ToolMessage({ content: '{"ok":true}', tool_call_id: 'call_1' }),
    ];

    await saveConversation('user-123', 'conv-456', messages);

    const key = 'ai:conversation:user-123:conv-456';
    expect(store.has(key)).toBe(true);
    expect(store.get(key)?.ex).toBe(1800);

    const loaded = await loadConversation('user-123', 'conv-456');
    expect(loaded).toHaveLength(4);
    expect(loaded?.[0]).toEqual({ type: 'system', content: 'system instruction' });
    expect(loaded?.[1]).toEqual({ type: 'human', content: 'create lb' });
    expect(loaded?.[2]).toEqual({
      type: 'ai',
      content: 'thinking',
      toolCalls: [{ id: 'call_1', name: 'find_tools', args: {} }],
      toolCallId: undefined,
    });
    expect(loaded?.[3]).toEqual({
      type: 'tool',
      content: '{"ok":true}',
      toolCalls: undefined,
      toolCallId: 'call_1',
    });
  });

  it('deletes conversation from redis', async () => {
    const messages = [new HumanMessage('hello')];
    await saveConversation('user-1', 'conv-1', messages);
    expect(await loadConversation('user-1', 'conv-1')).not.toBeNull();

    await deleteConversation('user-1', 'conv-1');
    expect(await loadConversation('user-1', 'conv-1')).toBeNull();
  });

  it('fails open when redis is unreachable', async () => {
    redisUp = false;

    await expect(saveConversation('user-1', 'conv-1', [new HumanMessage('test')])).resolves.not.toThrow();
    await expect(loadConversation('user-1', 'conv-1')).resolves.toBeNull();
    await expect(deleteConversation('user-1', 'conv-1')).resolves.not.toThrow();
  });

  it('returns null on invalid JSON payload in redis', async () => {
    store.set('ai:conversation:user-1:corrupt', { value: 'not-valid-json', ex: 7200 });
    const loaded = await loadConversation('user-1', 'corrupt');
    expect(loaded).toBeNull();
  });
});
