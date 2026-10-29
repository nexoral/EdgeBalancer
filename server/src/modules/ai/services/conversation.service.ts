import { getRedisClient } from '../../../utils/redisClient';
import type { BaseMessage } from '@langchain/core/messages';

const CONVERSATION_TTL_SECONDS = 30 * 60;

export interface SerializedMessage {
  type: string;
  content: string;
  toolCalls?: unknown[];
  toolCallId?: string;
}

const redisKey = (userId: string, conversationKey: string): string =>
  `ai:conversation:${userId}:${conversationKey}`;

export async function saveConversation(
  userId: string,
  conversationKey: string,
  messages: BaseMessage[]
): Promise<void> {
  try {
    const redis = await getRedisClient();
    const serialized = JSON.stringify(
      messages.map((m) => ({
        type: typeof m.getType === 'function' ? m.getType() : ((m as any).type ?? 'ai'),
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
        toolCalls: (m as any).tool_calls,
        toolCallId: (m as any).tool_call_id,
      }))
    );
    await redis.set(redisKey(userId, conversationKey), serialized, { EX: CONVERSATION_TTL_SECONDS });
  } catch (error: any) {
    console.warn(`Failed to save conversation state to Redis: ${error?.message}`);
  }
}

export async function loadConversation(
  userId: string,
  conversationKey: string
): Promise<SerializedMessage[] | null> {
  try {
    const redis = await getRedisClient();
    const data = await redis.get(redisKey(userId, conversationKey));
    if (!data) return null;
    return JSON.parse(data) as SerializedMessage[];
  } catch (error: any) {
    console.warn(`Failed to load conversation state from Redis: ${error?.message}`);
    return null;
  }
}

export async function deleteConversation(
  userId: string,
  conversationKey: string
): Promise<void> {
  try {
    const redis = await getRedisClient();
    await redis.del(redisKey(userId, conversationKey));
  } catch (error: any) {
    console.warn(`Failed to delete conversation state from Redis: ${error?.message}`);
  }
}
