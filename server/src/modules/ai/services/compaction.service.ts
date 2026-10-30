import { AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import { invokeWithFallback } from './model-router.service';
import type { RouterState } from './model-router.service';
import type { RunLogger } from './log.service';
import type { StructuredToolInterface } from '@langchain/core/tools';
import type { AiEmitter } from '../types/ai.types';

const TOKEN_BUDGET = 3000;
const PER_MESSAGE_OVERHEAD = 4;

export interface CompactionResult {
  messages: BaseMessage[];
  summarized: boolean;
  tokensBefore?: number;
  tokensAfter?: number;
  tokensSaved?: number;
}

const OPTIMIZER_SYSTEM_PROMPT = `You are a conversation memory optimizer.
The current conversation exceeds the token budget. You must reduce its token footprint while preserving critical context, decisions, line numbers, and parameters.

Rules:
1. NEVER prune or summarize [system] prompts, the user's core goal/intent, or the latest active turns. Keep them completely intact.
2. NEVER summarize messages containing parameters, instructions, domain names, origin URLs, IDs, strategy names, credentials, or context needed for subsequent or future tasks.
3. For historical, large, or stale tool outputs that are no longer actively needed, list their IDs in "prune_tools". Their content will be replaced by lightweight pointers.
4. For verbose earlier conversation turns that can be condensed without losing meaning or decisions, provide their ID and a concise summary in "summarize_messages". Never drop any parameters.
5. Respond strictly with a JSON object in this exact format:
{
  "prune_tools": ["id1", "id2"],
  "summarize_messages": [
    { "id": "id3", "summary": "concise summary" }
  ]
}`;

const textLength = (content: unknown): number => {
  if (typeof content === 'string') return content.length;
  if (Array.isArray(content)) return content.reduce<number>((total, part) => total + textLength(typeof part === 'string' ? part : (part as any)?.text ?? ''), 0);
  return 0;
};

const tokensOf = (message: BaseMessage): number => {
  const calls = message instanceof AIMessage ? JSON.stringify(message.tool_calls ?? []).length : 0;
  return Math.ceil((textLength(message.content) + calls) / 4) + PER_MESSAGE_OVERHEAD;
};

export const estimateTokens = (messages: BaseMessage[]): number =>
  messages.reduce((total, message) => total + tokensOf(message), 0);

export const needsCompaction = (messages: BaseMessage[]): boolean =>
  estimateTokens(messages) > TOKEN_BUDGET;

const requestsTools = (message: BaseMessage | undefined): boolean =>
  message instanceof AIMessage && (message.tool_calls?.length ?? 0) > 0;

export const findOrphanIndex = (messages: BaseMessage[]): number => {
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];

    if (message instanceof ToolMessage) {
      const previous = messages[index - 1];
      if (!requestsTools(previous) && !(previous instanceof ToolMessage)) return index;
      continue;
    }

    if (requestsTools(message)) {
      const expected = (message as AIMessage).tool_calls!.length;
      let answered = 0;
      while (messages[index + 1 + answered] instanceof ToolMessage) answered += 1;
      if (answered < expected) return index;
    }
  }

  return -1;
};

function formatIndexedMessages(messages: BaseMessage[]): string {
  return messages.map((msg, index) => {
    const id = `m_${index}`;
    if (msg instanceof SystemMessage) return `[${id}] [system]: ${msg.content}`;
    if (msg instanceof HumanMessage) return `[${id}] [user]: ${msg.content}`;
    if (msg instanceof AIMessage) {
      const toolCalls = msg.tool_calls?.map((tc) => `${tc.name}(id: ${tc.id})`).join(', ');
      return `[${id}] [assistant]: ${msg.content}${toolCalls ? ` [tool_calls: ${toolCalls}]` : ''}`;
    }
    if (msg instanceof ToolMessage) return `[${id}] [tool_result id:${msg.tool_call_id}]: ${msg.content}`;
    return `[${id}] [${msg.constructor.name}]: ${msg.content}`;
  }).join('\n\n');
}

export async function compactHistory(
  messages: BaseMessage[],
  log: RunLogger,
  state: RouterState,
  emit?: AiEmitter,
): Promise<CompactionResult> {
  if (!needsCompaction(messages)) {
    return { messages, summarized: false };
  }

  if (findOrphanIndex(messages) !== -1) {
    return { messages, summarized: false };
  }

  const system = messages[0];
  const promptIndex = messages.findIndex((message) => message instanceof HumanMessage);
  if (!(system instanceof SystemMessage) || promptIndex === -1) {
    log.warn('History head is not [system, human], skipping compaction');
    return { messages, summarized: false };
  }

  const tokensBefore = estimateTokens(messages);
  emit?.('compaction_start', { tokensBefore });

  const toolNameMap = new Map<string, string>();
  for (const msg of messages) {
    if (msg instanceof AIMessage && msg.tool_calls) {
      for (const call of msg.tool_calls) {
        if (call.id) toolNameMap.set(call.id, call.name);
      }
    }
  }

  try {
    const formatted = formatIndexedMessages(messages);
    const { response } = await invokeWithFallback({
      messages: [
        new SystemMessage(OPTIMIZER_SYSTEM_PROMPT),
        new HumanMessage(`Optimize the following conversation:\n\n${formatted}`),
      ],
      tools: [] as StructuredToolInterface[],
      attempts: [],
      emit: () => undefined,
      log,
      state,
    });

    let pruneTools = new Set<string>();
    const summarizeMap = new Map<string, string>();

    try {
      const raw = String(response.content ?? '').trim();
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);

      if (Array.isArray(parsed.prune_tools)) {
        pruneTools = new Set(parsed.prune_tools.map(String));
      }
      if (Array.isArray(parsed.summarize_messages)) {
        for (const item of parsed.summarize_messages) {
          if (item?.id && typeof item.summary === 'string') {
            summarizeMap.set(String(item.id), item.summary.trim());
          }
        }
      }
    } catch {
      for (const msg of messages) {
        if (msg instanceof ToolMessage) {
          pruneTools.add(msg.tool_call_id);
          break;
        }
      }
    }

    const compacted = messages.map((msg, index) => {
      const id = `m_${index}`;

      if (msg instanceof ToolMessage && (pruneTools.has(id) || pruneTools.has(msg.tool_call_id))) {
        const size = String(msg.content ?? '').length;
        const tool = toolNameMap.get(msg.tool_call_id) ?? 'tool';
        return new ToolMessage({
          content: `[Output pruned by GC (${size} chars). Tool: ${tool}. Re-run tool to inspect again if needed.]`,
          tool_call_id: msg.tool_call_id,
        });
      }

      if (summarizeMap.has(id)) {
        const summary = summarizeMap.get(id)!;
        if (msg instanceof HumanMessage) {
          return new HumanMessage(summary);
        }
        if (msg instanceof AIMessage) {
          return new AIMessage({
            content: summary,
            tool_calls: msg.tool_calls,
          });
        }
      }

      return msg;
    });

    const tokensAfter = estimateTokens(compacted);
    const tokensSaved = Math.max(0, tokensBefore - tokensAfter);

    if (tokensSaved > 0) {
      log.info(`Pruned history: ${tokensSaved} tokens saved (${tokensBefore} → ${tokensAfter})`);
      emit?.('compaction_result', {
        ok: true,
        tokensBefore,
        tokensAfter,
        tokensSaved,
      });
      return { messages: compacted, summarized: true, tokensBefore, tokensAfter, tokensSaved };
    }

    log.warn('Compaction produced zero token savings, keeping full history');
    emit?.('compaction_result', {
      ok: false,
      tokensBefore,
      tokensAfter: tokensBefore,
      tokensSaved: 0,
    });
    return { messages, summarized: false, tokensBefore, tokensAfter: tokensBefore, tokensSaved: 0 };
  } catch (error: any) {
    log.warn(`Compaction failed, keeping full history: ${error?.message}`);
    emit?.('compaction_result', {
      ok: false,
      tokensBefore,
      tokensAfter: tokensBefore,
      tokensSaved: 0,
    });
    return { messages, summarized: false, tokensBefore, tokensAfter: tokensBefore, tokensSaved: 0 };
  }
}
