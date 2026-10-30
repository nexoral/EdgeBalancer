import { AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import { invokeWithFallback } from './model-router.service';
import type { RouterState } from './model-router.service';
import type { RunLogger } from './log.service';
import type { StructuredToolInterface } from '@langchain/core/tools';
import type { AiEmitter } from '../types/ai.types';

// Bounded by tokens, not message count: one oversized tool result overflows a context that a
// message count still reads as short. ~4 chars per token is close enough to decide when to summarise.
//
// A compaction lands at ~4850 tokens (908 system + up to 504 prompt + ~830 summary + 3000 recent),
// so the budget has to sit well above that or the next tool result re-triggers it and every
// iteration costs a summarizer call. 9000 leaves room for roughly four.
const TOKEN_BUDGET = 9000;
const RECENT_TOKEN_BUDGET = 3000;
const PER_MESSAGE_OVERHEAD = 4;

export interface CompactionResult {
  messages: BaseMessage[];
  summarized: boolean;
  tokensBefore?: number;
  tokensAfter?: number;
  tokensSaved?: number;
}

const SUMMARIZATION_SYSTEM_PROMPT = `You are a conversation summarizer for a load balancer management agent.

STRICT RULES - DO NOT VIOLATE:
1. PRESERVE ALL CRITICAL CONTEXT - zero tolerance for omissions
2. Must include: user's original intent and constraints
3. Must include: EVERY tool called, with arguments and key results
4. Must include: errors, conflicts, validation failures, and their exact details
5. Must include: current state (zones found, load balancers listed, IDs resolved)
6. Must include: any pending confirmations or unresolved decisions
7. DO NOT OMIT: specific domain names, origin URLs, strategy names, zone IDs, load balancer names, error messages
8. FORMAT: Single paragraph, past tense, third-person. No bullet points, no markdown.
9. Target length: approximately 500-600 WORDS.`;

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

/** The only trigger. Checked at the call site so the cost is visible where it is paid. */
export const needsCompaction = (messages: BaseMessage[]): boolean =>
  estimateTokens(messages) > TOKEN_BUDGET;

const requestsTools = (message: BaseMessage | undefined): boolean =>
  message instanceof AIMessage && (message.tool_calls?.length ?? 0) > 0;

function lastHumanIndex(messages: BaseMessage[]): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index] instanceof HumanMessage) return index;
  }
  return -1;
}

/**
 * Providers reject a history where a tool result is detached from its request, or a request is
 * short of results — with a 400 the router then misreads as transient and answers by walking the
 * whole ladder. Returns the first index breaking that, or -1.
 */
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

// A tail may not open with a tool result, nor depend on a request left behind. Worst case it
// advances past everything, which is correct: an unanswerable tail is worse than a shorter one.
const snapToSafeCut = (messages: BaseMessage[], from: number): number => {
  let cut = from;

  while (cut < messages.length && (messages[cut] instanceof ToolMessage || requestsTools(messages[cut - 1]))) {
    cut += 1;
  }

  return cut;
};

function formatMessage(msg: BaseMessage): string {
  if (msg instanceof HumanMessage) return `User: ${msg.content}`;
  if (msg instanceof AIMessage) {
    const toolCalls = msg.tool_calls?.map((tc) => `${tc.name}(${JSON.stringify(tc.args)})`).join(', ');
    return `Assistant${toolCalls ? ` [tools: ${toolCalls}]` : ''}: ${msg.content}`;
  }
  if (msg instanceof ToolMessage) return `Tool(${msg.tool_call_id}): ${msg.content}`;
  return `${msg.constructor.name}: ${msg.content}`;
}

function buildUserPrompt(messages: BaseMessage[]): string {
  const formatted = messages.map(formatMessage).join('\n\n');
  return (
    `Summarize the following conversation history in approximately 500-600 WORDS.\n\n` +
    `Conversation to summarize:\n` +
    formatted
  );
}

/** `state` is the caller's, so the summariser skips models the run already knows are dead. */
export async function compactHistory(
  messages: BaseMessage[],
  log: RunLogger,
  state: RouterState,
  emit?: AiEmitter,
): Promise<CompactionResult> {
  if (!needsCompaction(messages)) {
    return { messages, summarized: false };
  }

  // Called after every tool result, so a parallel batch is seen part-answered. Summarising a
  // request whose remaining replies are still to come would orphan them; the next result retries.
  if (findOrphanIndex(messages) !== -1) {
    return { messages, summarized: false };
  }

  // The prompt the user typed is pinned verbatim — nothing else in the history reconstructs it.
  const system = messages[0];
  const promptIndex = messages.findIndex((message) => message instanceof HumanMessage);

  if (!(system instanceof SystemMessage) || promptIndex === -1) {
    log.warn('History head is not [system, human], skipping compaction');
    return { messages, summarized: false };
  }

  const head = [system, messages[promptIndex]];

  // Largest tail fitting the budget, but never fewer than one message — the newest result is the
  // one the model is reasoning about, however large.
  let cut = messages.length;
  let tail = 0;
  while (cut > promptIndex + 1) {
    const grown = tail + tokensOf(messages[cut - 1]);
    if (cut < messages.length && grown > RECENT_TOKEN_BUDGET) break;
    tail = grown;
    cut -= 1;
  }

  cut = snapToSafeCut(messages, cut);

  // RCA's instruction is a later human message, so pinning the first prompt does not cover it.
  // Summarising it away would leave the model researching a failure with no brief.
  const rcaIndex = lastHumanIndex(messages);
  const pinnedRca = rcaIndex > promptIndex && rcaIndex < cut ? messages[rcaIndex] : null;

  const toSummarize = messages.slice(promptIndex + 1, cut).filter((message) => message !== pinnedRca);
  if (toSummarize.length === 0) {
    return { messages, summarized: false };
  }

  const tokensBefore = estimateTokens(messages);
  emit?.('compaction_start', { tokensBefore });

  try {
    const { response } = await invokeWithFallback({
      messages: [new SystemMessage(SUMMARIZATION_SYSTEM_PROMPT), new HumanMessage(buildUserPrompt(toSummarize))],
      tools: [] as StructuredToolInterface[],
      attempts: [],
      emit: () => undefined,
      log,
      state,
    });

    const summary = String(response.content).trim();
    const compacted = [
      ...head,
      new AIMessage({ content: `[Conversation Summary]: ${summary}` }),
      ...(pinnedRca ? [pinnedRca] : []),
      ...messages.slice(cut),
    ];

    const tokensAfter = estimateTokens(compacted);
    const tokensSaved = Math.max(0, tokensBefore - tokensAfter);

    log.info(`Compacted history: ${toSummarize.length} messages → 1 summary (${summary.split(/\s+/).length} words, ${tokensSaved} tokens saved: ${tokensBefore} → ${tokensAfter})`);

    emit?.('compaction_result', {
      ok: true,
      tokensBefore,
      tokensAfter,
      tokensSaved,
    });

    return { messages: compacted, summarized: true, tokensBefore, tokensAfter, tokensSaved };
  } catch (error: any) {
    log.warn(`Summarization failed, keeping full history: ${error?.message}`);
    emit?.('compaction_result', {
      ok: false,
      tokensBefore,
      tokensAfter: tokensBefore,
      tokensSaved: 0,
    });
    return { messages, summarized: false, tokensBefore, tokensAfter: tokensBefore, tokensSaved: 0 };
  }
}
