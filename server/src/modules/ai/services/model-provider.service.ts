import { ChatOpenAI } from '@langchain/openai';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { ModelDescriptor, ModelProvider } from '../types/ai.types';

const OPENAI_BASE_URLS: Record<ModelProvider, string> = {
  mistral: 'https://api.mistral.ai/v1',
  openrouter: 'https://openrouter.ai/api/v1',
};

export function getApiKey(provider: ModelProvider): string | undefined {
  if (provider === 'mistral') return process.env.MISTRAL_API_KEY;
  if (provider === 'openrouter') return process.env.OPENROUTER_API_KEY;
  return undefined;
}

export function hasAnyProviderConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY || process.env.MISTRAL_API_KEY);
}

// The SDK default is measured in minutes, and an endpoint that accepts then stalls would hold the
// SSE stream for all of it, once per ladder entry.
const CALL_TIMEOUT_MS = 45_000;

export function createChatModel({ provider, model }: ModelDescriptor): BaseChatModel {
  const apiKey = getApiKey(provider);
  if (!apiKey) {
    throw new Error(`No API key configured for provider ${provider}`);
  }

  const config: Record<string, unknown> = {
    model,
    temperature: 0,
    maxTokens: 4096,
    maxRetries: 0,
    timeout: CALL_TIMEOUT_MS,
    configuration: {
      baseURL: OPENAI_BASE_URLS[provider],
    },
  };

  if (apiKey) config.apiKey = apiKey;

  return new ChatOpenAI(config);
}
