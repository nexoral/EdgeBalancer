import type { ModelDescriptor } from '../types/ai.types';

// OpenRouter free tier, quality-gated: only large-flagship-class models survive (nano/mini/xs
// variants removed). Ordered fastest-first by P50 latency (openrouter.ai pages, Aug 21 2026).
// `openrouter/free` is the auto-router catch-all and always runs last.
export const FREE_MODELS = [
  'nvidia/nemotron-3-super-120b-a12b:free', // 120B MoE / 12B active — 1.25s / 41 tok/s
  'nvidia/nemotron-3-ultra-550b-a55b:free', // 550B MoE / 55B active — 3.06s / 18 tok/s
  'z-ai/glm-5.2:free', // flagship reasoning — 3.60s / 104 tok/s
];

export const MISTRAL_MODELS = [
  { model: 'mistral-code-latest', rps: 2.08 }, // 125 req/min (Codestral 256k)
  { model: 'ministral-8b-latest', rps: 0.83 }, // 50 req/min (262k context)
  { model: 'ministral-14b-latest', rps: 0.83 }, // 50 req/min (262k context)
  { model: 'ministral-3b-latest', rps: 0.83 }, // 50 req/min (131k context)
  { model: 'mistral-small-latest', rps: 0.83 }, // 50 req/min (262k context)
  { model: 'mistral-medium-latest', rps: 0.83 }, // 50 req/min (262k context)
  { model: 'mistral-large-4', rps: 0.07 }, // 4 req/min (1M context flagship)
];

export const MODEL_LADDER: ModelDescriptor[] = [
  ...FREE_MODELS.map((model) => ({ provider: 'openrouter' as const, model })),
  ...MISTRAL_MODELS.map(({ model, rps }) => ({ provider: 'mistral' as const, model, rps })),
];
