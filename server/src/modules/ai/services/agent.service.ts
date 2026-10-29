import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import { SYSTEM_PROMPT, RCA_PROMPT } from '../config/systemPrompt';
import { invokeWithFallback, createRouterState } from './model-router.service';
import { buildTools, MUTATING_TOOL_NAMES } from './tools.service';
import { RESEARCH_TOOL_NAMES } from './research.service';
import { logRun } from './log.service';
import { compactHistory, needsCompaction } from './compaction.service';
import { saveConversation, loadConversation } from './conversation.service';
import type { RequestCancellation } from '../../../utils/requestCancellation';
import type { AiEmitter, AiOutcome, ConversationTurn, ModelAttempt, ToolCallRecord } from '../types/ai.types';

const MAX_ITERATIONS = 12;
// A model that fails the same tool twice is guessing, not converging. Stop and explain instead
// of burning the rate limit on a third identical mistake.
const MAX_FAILURES_PER_TOOL = 2;

// The iteration cap bounds steps, not time: a stalling provider is bounded only by the per-call
// timeout, which the ladder then multiplies.
const RUN_DEADLINE_MS = 6 * 60 * 1000;

// Always bound. Every other bucket tool is sent only once find_tools has loaded it, trading one
// discovery call for not re-sending ~1,500 tokens of schema on every iteration.
const TOOL_FINDER = 'find_tools';

// RCA gets its own budget so a failure at iteration 12 still gets explained.
const MAX_RCA_ITERATIONS = 3;
const RESEARCH_TOOLS = new Set<string>(RESEARCH_TOOL_NAMES);
const MUTATING_TOOLS = new Set<string>(MUTATING_TOOL_NAMES);

/**
 * Accumulated in place so a run that throws mid-way still leaves the caller a complete audit
 * trail of the models tried and the tools already executed.
 */
export interface AgentTrace {
  modelAttempts: ModelAttempt[];
  toolCalls: ToolCallRecord[];
  loadBalancers: unknown[];
  finalModel: string | null;
}

export const createTrace = (): AgentTrace => ({
  modelAttempts: [],
  toolCalls: [],
  loadBalancers: [],
  finalModel: null,
});

export interface AgentRun {
  outcome: AiOutcome;
  message: string;
  loadBalancers: unknown[];
}

const textOf = (message: AIMessage): string =>
  typeof message.content === 'string'
    ? message.content.trim()
    : (message.content as any[])
        .map((part) => (typeof part === 'string' ? part : part?.text ?? ''))
        .join('')
        .trim();

/** Replays the client-side conversation chain under the system prompt. */
const buildHistory = (history: ConversationTurn[]): BaseMessage[] =>
  history
    .filter((turn) => typeof turn?.content === 'string' && turn.content.trim().length > 0)
    .map((turn) => (turn.role === 'user' ? new HumanMessage(turn.content) : new AIMessage(turn.content)));

export async function runAgent(params: {
  runId: string;
  userId: string;
  userEmail: string | null;
  history: ConversationTurn[];
  conversationKey?: string | null;
  cancellation: RequestCancellation;
  emit: AiEmitter;
  trace: AgentTrace;
}): Promise<AgentRun> {
  const { runId, userId, userEmail, history, conversationKey, cancellation, emit, trace } = params;
  const { modelAttempts, toolCalls, loadBalancers } = trace;
  const log = logRun(runId);

  log.info(`prompt: ${history[history.length - 1]?.content ?? ''} (${history.length} turn(s))`);

  const unlocked = new Set<string>([TOOL_FINDER]);
  const tools = buildTools({ runId, userId, userEmail, cancellation, emit, log, touched: loadBalancers, unlocked });
  const toolsByName = new Map(tools.map((t) => [t.name, t]));

  const loadInitialMessages = async (): Promise<BaseMessage[]> => {
    if (conversationKey) {
      const saved = await loadConversation(userId, conversationKey);
      if (saved && saved.length > 0) {
        const restored: BaseMessage[] = saved.map((s) => {
          if (s.type === 'system') return new SystemMessage(s.content);
          if (s.type === 'human') return new HumanMessage(s.content);
          if (s.type === 'ai') return new AIMessage({ content: s.content, tool_calls: (s.toolCalls as any) ?? [] });
          if (s.type === 'tool') return new ToolMessage({ content: s.content, tool_call_id: s.toolCallId || 'call_default' });
          return new AIMessage({ content: s.content, tool_calls: (s.toolCalls as any) ?? [] });
        });

        const baseList = restored.some((m) => m instanceof SystemMessage)
          ? restored
          : [new SystemMessage(SYSTEM_PROMPT), ...restored];

        const latestUserPrompt = history[history.length - 1]?.content;
        const tail = baseList[baseList.length - 1];
        const isAlreadyAtTail = tail instanceof HumanMessage && tail.content === latestUserPrompt;

        const combined = isAlreadyAtTail || !latestUserPrompt
          ? baseList
          : [...baseList, new HumanMessage(latestUserPrompt)];

        log.info(`loaded ${combined.length} messages from Redis (${saved.length} restored)`);
        return combined;
      }
    }

    log.info(`initialized from client history (${history.length} turn(s))`);
    return [new SystemMessage(SYSTEM_PROMPT), ...buildHistory(history)];
  };

  let messages: BaseMessage[] = await loadInitialMessages();

  const failuresByTool = new Map<string, number>();
  const routerState = createRouterState();

  const saveCurrentState = async (): Promise<void> => {
    if (!conversationKey) return;
    await saveConversation(userId, conversationKey, messages);
  };

  const finish = async (outcome: AiOutcome, message: string): Promise<AgentRun> => {
    log.info(`outcome=${outcome} — ${message}`);
    const last = messages[messages.length - 1];
    if (!(last instanceof AIMessage) && message) {
      messages.push(new AIMessage(message));
    }
    await saveCurrentState();
    return { outcome, message, loadBalancers };
  };

  const rawError = (): string => {
    const failed = [...toolCalls].reverse().find((call) => !call.ok);
    return failed ? errorTextOf(failed.result) : 'The request could not be completed.';
  };

  let iteration = 0;
  let rcaStep = 0;
  let rcaMode = false;
  let rcaFallback = '';
  const deadline = Date.now() + RUN_DEADLINE_MS;

  // Providers reject an assistant message whose tool_calls are not all answered, so leaving a batch
  // early means answering what will now never run.
  const skipRemaining = (calls: { id?: string; name: string }[], from: number) => {
    for (const pending of calls.slice(from + 1)) {
      messages.push(new ToolMessage({
        content: JSON.stringify({ ok: false, error: 'Skipped — the run stopped after an earlier failure.' }),
        tool_call_id: pending.id ?? pending.name,
      }));
    }
  };

  // Everything that forces a run into RCA:
  //   - one tool fails MAX_FAILURES_PER_TOOL times,
  //   - a 409 conflict (terminal — retrying could only succeed by changing what was asked),
  //   - the model ends its turn after a failed tool call and nothing changed,
  //   - MAX_ITERATIONS pass while the model is still calling tools.
  // The deadline is the exception: no budget remains there for extra model calls, so an
  // over-deadline run finishes as failure immediately instead of entering RCA.
  //
  // Keeps the same chain — the model explains from the tool results already in it.
  const enterRca = () => {
    messages.push(new HumanMessage(RCA_PROMPT));
    rcaMode = true;
    log.info('entering RCA — research tools only');
  };

  while (true) {
    if (!rcaMode && iteration >= MAX_ITERATIONS) enterRca();
    if (rcaMode && rcaStep >= MAX_RCA_ITERATIONS) break;

    if (rcaMode) rcaStep += 1;
    else iteration += 1;

    await cancellation.throwIfCancelled();

    // Finished, not thrown: the client keeps its retry affordance, and RCA — another model call
    // there is no time budget for — is skipped.
    if (Date.now() > deadline) {
      log.warn(`run exceeded ${RUN_DEADLINE_MS}ms — stopping`);
      return finish('failure', 'This run took too long and was stopped. Try a simpler request.');
    }

    emit('status', {
      // The first RCA step announces the transition itself; later ones report ongoing diagnosis.
      message: !rcaMode
        ? iteration === 1 ? 'Interpreting your request' : 'Deciding the next step'
        : rcaStep === 1 ? 'Hit a problem — analysing what went wrong' : 'Working out what went wrong',
      progress: rcaMode ? 95 : progressFor(iteration - 1),
    });

    // Only what the model sees is filtered; toolsByName stays complete. RCA narrows to the
    // read-only web tools so it can research the failure but never retry it.
    const bound = rcaMode
      ? tools.filter((t) => RESEARCH_TOOLS.has(t.name))
      : tools.filter((t) => unlocked.has(t.name));
    log.info(`${rcaMode ? 'rca' : 'iteration'} ${rcaMode ? rcaStep : iteration - 1} — bound ${bound.length}/${tools.length}: ${bound.map((t) => t.name).join(', ')}`);

    let response;
    let model;
    try {
      ({ response, model } = await invokeWithFallback({ messages, tools: bound, attempts: modelAttempts, emit, log, state: routerState }));
    } catch (error: any) {
      // The run has already failed by then, so a dead ladder must not swallow the real error.
      if (!rcaMode) throw error;

      log.warn(`RCA generation failed: ${error?.message}`);
      return finish('failure', rcaFallback || rawError());
    }

    trace.finalModel = model;
    // The modal shows the working model top-left for every call, not only on fallback.
    emit('model_active', { model });
    messages.push(response);

    const calls = response.tool_calls ?? [];
    if (calls.length === 0) {
      const message = textOf(response);
      if (rcaMode) return finish('failure', message || rcaFallback || rawError());

      // A turn that ends without tools is conversational — a question for the user, an answer,
      // or an out-of-scope refusal. ask_user used to mark questions; now the always-visible chat
      // input carries them, so every such ending settles as success with its message.
      //
      // Exception: a tool call actually failed and nothing changed. The model explaining the
      // error in prose must not read as a done deal — send it to RCA for the root-cause write-up.
      // A *successful* mutating call proves the change happened; a delete succeeds by making the
      // balancer disappear, so `touched` stays empty — success there is read off the executed
      // calls, not off what remains.
      const failed = toolCalls.some((call) => !call.ok);
      const changed = toolCalls.some((call) => call.ok && MUTATING_TOOLS.has(call.name));

      if (failed && !changed && loadBalancers.length === 0) {
        log.warn(`model ended without acting after a failure — said: ${message.slice(0, 300)}`);
        rcaFallback = message;
        enterRca();
        continue;
      }

      return finish('success', message || 'Done.');
    }

    // Sequential: a create depends on the zone lookup before it, and serialised Cloudflare
    // writes keep the orchestrators' rollback semantics intact.
    for (const [index, call] of calls.entries()) {
      await cancellation.throwIfCancelled();

      const args = (call.args ?? {}) as Record<string, unknown>;
      emit('tool_start', { name: call.name, args });
      log.info(`tool ${call.name} ← ${JSON.stringify(args)}`);

      const startedAt = Date.now();
      const { result, ok, terminal } = await executeTool(toolsByName, call.name, args);
      const durationMs = Date.now() - startedAt;

      log[ok ? 'info' : 'warn'](`tool ${call.name} → ${ok ? 'ok' : 'failed'} in ${durationMs}ms: ${result.slice(0, 300)}`);

      toolCalls.push({
        name: call.name,
        args,
        result,
        ok,
        durationMs,
      });

      emit('tool_result', { name: call.name, ok, summary: summarize(result) });
      messages.push(new ToolMessage({ content: result, tool_call_id: call.id ?? call.name }));

      if (needsCompaction(messages)) {
        const { messages: compacted, summarized } = await compactHistory(messages, log, routerState);
        if (summarized) {
          messages = compacted;
          log.info(`History compacted: ${messages.length} messages retained`);
        }
      }

      if (ok) {
        failuresByTool.delete(call.name);
        continue;
      }

      // A failed search during RCA is not worth a second RCA — the model writes up what it has.
      if (rcaMode) continue;

      // A conflict is the user's to resolve. Retrying can only "succeed" by silently changing
      // what they asked for — a different name, a different hostname — so stop and explain.
      if (terminal) {
        log.warn(`${call.name} hit a conflict — stopping without retrying`);
        skipRemaining(calls, index);
        enterRca();
        break;
      }

      const failures = (failuresByTool.get(call.name) ?? 0) + 1;
      failuresByTool.set(call.name, failures);

      if (failures >= MAX_FAILURES_PER_TOOL) {
        log.warn(`${call.name} failed ${failures}x — stopping and explaining`);
        skipRemaining(calls, index);
        enterRca();
        break;
      }
    }
  }

  return finish('failure', rcaFallback || rawError());
}

interface ToolOutcome {
  result: string;
  ok: boolean;
  /** Retrying cannot help — stop the run and explain instead. */
  terminal?: boolean;
}

async function executeTool(
  toolsByName: Map<string, { invoke: (args: any) => Promise<any> }>,
  name: string,
  args: Record<string, unknown>,
): Promise<ToolOutcome> {
  const selected = toolsByName.get(name);
  if (!selected) {
    return { result: JSON.stringify({ ok: false, error: `Unknown tool "${name}".` }), ok: false };
  }

  try {
    const output = await selected.invoke(args);
    const result = typeof output === 'string' ? output : JSON.stringify(output);
    return { result, ok: resultOk(result) };
  } catch (error: any) {
    // Surfaced back to the model so it can correct itself rather than killing the run.
    // `verboseParsingErrors` on every tool makes LangChain name the offending fields here.
    const statusCode = error?.statusCode;
    return {
      result: JSON.stringify({ ok: false, error: error?.message ?? 'Tool failed', ...(statusCode ? { statusCode } : {}) }),
      ok: false,
      terminal: statusCode === 409,
    };
  }
}

// Reads the flag rather than searching for it: `"ok":false` also occurs inside successful
// payloads — a fetched page, a search snippet — and two false failures divert the run into RCA.
const resultOk = (result: string): boolean => {
  try {
    return (JSON.parse(result) as { ok?: unknown })?.ok !== false;
  } catch {
    return true;
  }
};

const errorTextOf = (result: string): string => {
  try {
    return String(JSON.parse(result)?.error ?? result);
  } catch {
    return result;
  }
};

const summarize = (result: string): string => {
  try {
    const parsed = JSON.parse(result);
    if (parsed?.ok === false) return String(parsed.error);
    if (parsed?.data?.zones) return `${parsed.data.zones.length} zone(s) found`;
    if (parsed?.data?.loadBalancers) return `${parsed.data.loadBalancers.length} load balancer(s) found`;
    if (parsed?.data?.fullDomain) return String(parsed.data.fullDomain);
    if (parsed?.data?.message) return String(parsed.data.message);
    return 'Completed';
  } catch {
    return result.slice(0, 160);
  }
};

// Asymptotic: the loop length is unknown up front, so approach 90% without ever claiming done.
const progressFor = (iteration: number): number => Math.round(90 - 70 / (iteration + 1));
