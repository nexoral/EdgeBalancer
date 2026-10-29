import { randomUUID } from 'crypto';
import { createRequestCancellation } from '../utils/requestCancellation';
import { isCancellationError } from '../modules/loadbalancer/services/operation.service';
import { hasAnyProviderConfigured } from '../modules/ai/services/model-provider.service';
import { openSseChannel } from '../modules/ai/services/sse.service';
import { createTrace, runAgent } from '../modules/ai/services/agent.service';
import { recordAiRun } from '../modules/ai/services/audit.service';
import { AiRun } from '../models/AiRun';
import { isUserPro } from '../utils/proCache';
import mongoose from 'mongoose';
import type { ConversationTurn } from '../modules/ai/types/ai.types';
import type { AppRequest as Request, AppResponse as Response, NextFunction } from '../types/http';

const MAX_PROMPT_LENGTH = 2000;
// The client replays its whole conversation chain on every call; a cap keeps the payload —
// and the tokens re-sent to the model each turn — bounded.
const MAX_HISTORY_TURNS = 30;
const MAX_TURN_LENGTH = 4000;
const MAX_CONVERSATION_ID_LENGTH = 64;

/**
 * Validates the client-side conversation chain. Only plain user/assistant text is accepted —
 * anything else would let a crafted body inject tool output into the model's context.
 */
const parseHistory = (raw: unknown): ConversationTurn[] | null => {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw) || raw.length > MAX_HISTORY_TURNS) return null;

  const turns: ConversationTurn[] = [];
  for (const item of raw) {
    const role = item?.role;
    const content = typeof item?.content === 'string' ? item.content.trim() : '';
    if ((role !== 'user' && role !== 'assistant') || !content || content.length > MAX_TURN_LENGTH) return null;
    turns.push({ role, content });
  }
  return turns;
};

export const generateWithAi = async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401);
    return next(new Error('Not authenticated'));
  }

  // Pro check — gate AI feature
  if (!(await isUserPro(userId))) {
    res.status(403);
    return next(new Error('The AI Agent requires an EdgeBalancer Pro subscription'));
  }

  if (!hasAnyProviderConfigured()) {
    res.status(503);
    return next(new Error('The AI Agent is not configured on this server.'));
  }

  const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
  if (!prompt) {
    res.status(400);
    return next(new Error('A prompt is required'));
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    res.status(400);
    return next(new Error(`Prompt must not exceed ${MAX_PROMPT_LENGTH} characters`));
  }

  const history = parseHistory(req.body?.messages);
  if (!history) {
    res.status(400);
    return next(new Error('Invalid messages chain'));
  }
  // The newest user message is the prompt; earlier turns are context only.
  const conversation: ConversationTurn[] = [...history, { role: 'user', content: prompt }];

  // Groups every turn of one agent session into a single AiRun history entry.
  const rawConversationId = typeof req.body?.conversationId === 'string' ? req.body.conversationId.trim() : '';
  const conversationId = rawConversationId.slice(0, MAX_CONVERSATION_ID_LENGTH) || null;

  const runId = randomUUID();
  const cancellation = createRequestCancellation(req, res, runId);

  // From here the response is a stream: every outcome, including failure, is an SSE frame.
  const stagedHeaders = res.getHeaders();
  res.hijack();
  const { emit, close } = openSseChannel(res.raw, stagedHeaders);
  emit('run_start', { runId });

  const startedAt = Date.now();
  const trace = createTrace();

  const conversationKey = conversationId || runId;

  try {
    const run = await runAgent({
      runId,
      userId,
      userEmail: req.user?.email ?? null,
      history: conversation,
      conversationKey,
      cancellation,
      emit,
      trace,
    });

    emit('done', {
      outcome: run.outcome,
      message: run.message,
      loadBalancers: run.loadBalancers,
    });

    await recordAiRun({
      runId,
      userId,
      prompt,
      trace,
      outcome: run.outcome,
      durationMs: Date.now() - startedAt,
      turns: conversation,
      finalMessage: run.message,
      conversationId,
    });
  } catch (error: any) {
    const message = isCancellationError(error) || cancellation.isCancelled()
      ? 'Request cancelled'
      : error?.message ?? 'AI generation failed';

    emit('error', { message });

    await recordAiRun({
      runId,
      userId,
      prompt,
      trace,
      outcome: 'failure',
      durationMs: Date.now() - startedAt,
      error: message,
      turns: conversation,
      conversationId,
    });
  } finally {
    close();
  }
};

export const listAiRuns = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) { res.status(401); throw new Error('Not authenticated'); }

    const limit = Math.min(Math.max(Number(req.query?.limit) || 20, 1), 50);
    const cursor = typeof req.query?.cursor === 'string' ? req.query.cursor : null;

    const query: any = { userId };
    if (cursor) {
      if (!mongoose.Types.ObjectId.isValid(cursor)) {
        res.status(400);
        throw new Error('Invalid cursor');
      }
      const cursorDoc = await AiRun.findById(cursor).lean();
      if (cursorDoc) {
        query.$or = [
          { createdAt: { $lt: cursorDoc.createdAt } },
          { createdAt: cursorDoc.createdAt, _id: { $lt: cursorDoc._id } },
        ];
      }
    }

    const runs = await AiRun.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .select('runId prompt outcome durationMs finalModel toolCalls.name createdAt')
      .lean();

    const hasMore = runs.length > limit;
    const items = hasMore ? runs.slice(0, limit) : runs;
    const nextCursor = hasMore ? items[items.length - 1]._id.toString() : null;

    res.json({
      success: true,
      message: 'AI runs retrieved',
      data: { runs: items, nextCursor, hasMore },
    });
  } catch (error) {
    next(error as Error);
  }
};

export const getAiRun = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) { res.status(401); throw new Error('Not authenticated'); }

    const runId = req.params?.id;
    if (!runId || !mongoose.Types.ObjectId.isValid(runId)) {
      res.status(400);
      throw new Error('Invalid run ID');
    }

    const run = await AiRun.findOne({ _id: runId, userId }).lean();
    if (!run) {
      res.status(404);
      throw new Error('AI run not found');
    }

    // Free users see limited data — only prompt, time, models used summary
    const pro = await isUserPro(userId);

    if (!pro) {
      res.json({
        success: true,
        message: 'AI run retrieved',
        data: {
          run: {
            _id: run._id,
            prompt: run.prompt,
            outcome: run.outcome,
            durationMs: run.durationMs,
            finalModel: run.finalModel,
            modelsUsed: (run.modelsUsed || []).map((m: any) => ({
              provider: m.provider,
              model: m.model,
              ok: m.ok,
            })),
            createdAt: run.createdAt,
          },
        },
      });
      return;
    }

    res.json({
      success: true,
      message: 'AI run retrieved',
      data: { run },
    });
  } catch (error) {
    next(error as Error);
  }
};
