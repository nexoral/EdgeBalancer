import type { ModelDescriptor } from '../types/ai.types';

// OpenRouter free tier, quality-gated & verified: ordered best-first by reasoning, tool reliability & parameter scale.
export const FREE_MODELS = [
  'nvidia/nemotron-3-ultra-550b-a55b:free', // 550B MoE / 55B active — Frontier reasoning & orchestration (1M context)
  'nvidia/nemotron-3.5-super-vl:free', // 120B MoE / 12B active — Fast, accurate tool calling (1M context)
  'particle-ai/particle-1:free', // DeepSeek V4.1 Flash base — Agentic coding & SWE (1M context)
  'nvidia/nemotron-3.5-lightning:free', // 30B MoE / 3B active — High-throughput fast calls (1M context)
  'dots-studio/dots-3-note-preview:free', // 280B MoE / 16B active — Large MoE fallback (512k context)
  'recursive/flint-v1.0:free', // 40B MoE / 2.5B active — Fallback runner (256k context)
];

export const MISTRAL_MODELS = [
  { model: 'voxtral-small-latest', rps: 1.00 }, // 60 req/min (50k TPM, 32k context)
  { model: 'mistral-code-latest', rps: 0.03 }, // 2 req/min (Codestral 256k)
  { model: 'ministral-8b-latest', rps: 0.03 }, // 2 req/min (262k context)
  { model: 'ministral-14b-latest', rps: 0.03 }, // 2 req/min (262k context)
  { model: 'ministral-3b-latest', rps: 0.03 }, // 2 req/min (131k context)
  { model: 'open-mistral-7b', rps: 0.03 }, // 2 req/min (40k TPM, 32k context)
];

export const MODEL_LADDER: ModelDescriptor[] = [
  ...FREE_MODELS.map((model) => ({ provider: 'openrouter' as const, model })),
  ...MISTRAL_MODELS.map(({ model, rps }) => ({ provider: 'mistral' as const, model, rps })),
];
