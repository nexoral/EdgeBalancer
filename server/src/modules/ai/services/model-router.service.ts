import type { BaseMessage } from '@langchain/core/messages';
import type { AIMessage } from '@langchain/core/messages';
import type { StructuredToolInterface } from '@langchain/core/tools';
import { MODEL_LADDER } from '../config/models';
import { createChatModel, getApiKey } from './model-provider.service';
import {
  isModelExhausted,
  isProviderExhausted,
  markModelExhausted,
  markProviderExhausted,
  modelCooldownFor,
} from './quota.service';
import { tryConsume } from './rate-limit.service';
import type { RunLogger } from './log.service';
import type { AiEmitter, ModelAttempt, ModelDescriptor, ModelProvider } from '../types/ai.types';

const NOOP_LOGGER: RunLogger = { info: () => undefined, warn: () => undefined };

export interface InvokeResult {
  response: AIMessage;
  model: string;
}

// Shared by every call of one run: a model that fails once will fail again a second later.
export interface RouterState {
  skippedModels: Set<string>;
  deadProviders: Set<ModelProvider>;
  exhaustedProviders: Set<ModelProvider>;
}

export const createRouterState = (): RouterState => ({
  skippedModels: new Set(),
  deadProviders: new Set(),
  exhaustedProviders: new Set(),
});

const statusOf = (error: any): number | undefined =>
  error?.status ?? error?.statusCode ?? error?.response?.status;

// Providers bury the useful text at different depths depending on whether the SDK or the HTTP
// layer threw, so check every place it plausibly lands.
const messageOf = (error: any): string =>
  [
    error?.message,
    error?.error?.message,
    error?.response?.data?.error?.message,
    error?.response?.data?.message,
  ]
    .filter(Boolean)
    .join(' ');

// Mistral's per-second cap clears almost immediately while its per-minute token budget takes up
// to a minute, so its own header beats any fixed guess. Only used for Mistral.
const retryAfterSeconds = (error: any): number | undefined => {
  const headers = error?.headers ?? error?.response?.headers;
  if (!headers) return undefined;

  const raw = typeof headers.get === 'function' ? headers.get('retry-after') : headers['retry-after'];
  const seconds = Number(raw);

  return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
};

const isAuthFailure = (error: any): boolean => {
  const status = statusOf(error);
  return status === 401 || status === 403 ||
    /\b(401|403|unauthorized|invalid api key|no api key)\b/i.test(messageOf(error));
};

type Disposition = 'provider-exhausted' | 'model-exhausted' | 'provider-dead' | 'transient';

/**
 * Only the first two are shared with other users. A timeout or a 500 is this run's problem alone
 * and is skipped locally, so one user's bad minute never stands a model down for everybody.
 */
function classify(error: any, provider: ModelProvider): Disposition {
  if (isAuthFailure(error)) return 'provider-dead';

  // OpenRouter free tier is account-wide, so any 429 stands the whole provider down for a day.
  // Mistral publishes per-model limits, so its 429 only cools that model.
  if (statusOf(error) === 429) {
    return provider === 'openrouter' ? 'provider-exhausted' : 'model-exhausted';
  }

  return 'transient';
}

export async function invokeWithFallback(params: {
  messages: BaseMessage[];
  tools: StructuredToolInterface[];
  attempts: ModelAttempt[];
  emit: AiEmitter;
  log?: RunLogger;
  state?: RouterState;
}): Promise<InvokeResult> {
  const { messages, tools, attempts, emit, log = NOOP_LOGGER, state = createRouterState() } = params;
  const { skippedModels, deadProviders, exhaustedProviders } = state;

  let lastError: Error | null = null;
  // Only models actually called — one skipped by a cooldown was never a candidate.
  let lastAttempted: string | null = null;

  for (const descriptor of MODEL_LADDER) {
    const { provider, model, rps } = descriptor;

    if (deadProviders.has(provider) || exhaustedProviders.has(provider)) continue;
    if (!getApiKey(provider)) continue;
    if (skippedModels.has(model)) continue;

    if (await isProviderExhausted(provider)) {
      log.info(`${provider} is in quota cooldown — skipping its models`);
      exhaustedProviders.add(provider);
      continue;
    }

    if (await isModelExhausted(model)) continue;

    // Pacing, not queueing: at capacity we move down the ladder rather than wait.
    if (!(await tryConsume(model, rps))) {
      log.info(`${model} is at its ${rps}/s allowance — trying the next model`);
      continue;
    }

    // Announced before the call so `to` is the replacement — the client renders "Falling back to".
    if (lastAttempted) {
      emit('model_switch', {
        from: lastAttempted,
        to: model,
        reason: lastError?.message ?? 'Previous model unavailable',
      });
    }

    lastAttempted = model;
    const startedAt = Date.now();

    try {
      log.info(`calling ${provider}/${model}…`);
      const response = await invokeOne(descriptor, messages, tools);
      attempts.push({ provider, model, ok: true });
      log.info(`${model} replied in ${Date.now() - startedAt}ms`);
      return { response, model };
    } catch (error: any) {
      lastError = error;
      attempts.push({ provider, model, ok: false, error: error?.message ?? 'Unknown error' });

      const disposition = classify(error, provider);
      log.warn(`${model} failed after ${Date.now() - startedAt}ms (${disposition}): ${error?.message}`);

      const retryAfter = retryAfterSeconds(error);

      if (disposition === 'provider-dead') {
        deadProviders.add(provider);
      } else if (disposition === 'provider-exhausted') {
        exhaustedProviders.add(provider);
        await markProviderExhausted(provider);
        log.warn(`${provider} rate limited — standing the whole provider down for 24h`);
      } else if (disposition === 'model-exhausted') {
        const cooldown = modelCooldownFor(provider);
        await markModelExhausted(model, retryAfter, cooldown);
        log.warn(`${model} rate limited — cooling down for ${retryAfter ?? cooldown}s`);
      } else {
        skippedModels.add(model);
      }
    }
  }

  throw new Error(
    `All AI models are unavailable${lastError ? `: ${lastError.message}` : ''}`,
  );
}

async function invokeOne(
  descriptor: ModelDescriptor,
  messages: BaseMessage[],
  tools: StructuredToolInterface[],
): Promise<AIMessage> {
  const chat = createChatModel(descriptor);

  if (!chat.bindTools) {
    throw new Error(`${descriptor.model} does not support tool calling`);
  }

  return (await chat.bindTools(tools).invoke(messages)) as AIMessage;
}
