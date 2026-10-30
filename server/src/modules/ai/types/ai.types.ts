export type ModelProvider = 'mistral' | 'openrouter';

export interface ModelDescriptor {
  provider: ModelProvider;
  model: string;
  /** Requests per second this model allows. Omitted where the provider publishes no figure. */
  rps?: number;
}

export type AiEventName =
  | 'run_start'
  | 'model_active'
  | 'model_switch'
  | 'status'
  | 'tool_start'
  | 'tool_result'
  | 'done'
  | 'error';

export type AiEmitter = (event: AiEventName, payload: Record<string, unknown>) => void;

/**
 * How a run settles. Turns that end without tools — questions, answers, refusals — are ordinary
 * prose endings now: the chat input is always available, so they settle as `success` whose
 * message is the reply. Only a broken run is `failure`.
 */
export type AiOutcome = 'success' | 'failure';

/** One turn of the client-side conversation chain replayed into the model on every call. */
export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface ModelAttempt {
  provider: ModelProvider;
  model: string;
  ok: boolean;
  error?: string;
}

export interface ToolCallRecord {
  name: string;
  args: Record<string, unknown>;
  result: string;
  ok: boolean;
  durationMs: number;
}

export interface AgentRunResult {
  outcome: AiOutcome;
  message: string;
  loadBalancers: unknown[];
}
