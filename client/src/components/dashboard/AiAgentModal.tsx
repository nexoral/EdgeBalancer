'use client';

import { useEffect, useRef, useState } from 'react';
import { Icons } from '@/components/shared/Icons';
import type { AiEvent, AiOutcome, AiStep, ConversationTurn, LoadBalancer } from '@/types/api';
import Link from 'next/link';

const MAX_PROMPT_LENGTH = 2000;
const MAX_PROMPT_HEIGHT = 220;

const TOOL_LABELS: Record<string, string> = {
  find_tools: 'Loading capabilities',
  list_zones: 'Reading your Cloudflare zones',
  list_load_balancers: 'Reading your load balancers',
  create_load_balancer: 'Deploying the load balancer',
  update_load_balancer: 'Applying the configuration change',
  delete_load_balancer: 'Deleting the load balancer',
  pause_load_balancer: 'Pausing the load balancer',
  resume_load_balancer: 'Resuming the load balancer',
  web_search: 'Researching an error',
  fetch_url: 'Reading a reference page',
};

const labelFor = (tool: string) => TOOL_LABELS[tool] ?? tool.replace(/_/g, ' ');

export interface AiRunState {
  phase: 'running' | 'done';
  runId: string | null;
  progress: number;
  statusMessage: string;
  steps: AiStep[];
  /** Model currently answering — shown top-left of the modal. */
  activeModel: string | null;
  modelNote: string | null;
  outcome: AiOutcome | null;
  message: string;
  loadBalancers: LoadBalancer[];
  tokensSaved?: number;
}

export const initialAiRunState: AiRunState = {
  phase: 'running',
  runId: null,
  progress: 4,
  statusMessage: 'Connecting to the AI Agent',
  steps: [],
  activeModel: null,
  modelNote: null,
  outcome: null,
  message: '',
  loadBalancers: [],
  tokensSaved: 0,
};

/** Single place mapping the server's SSE contract onto what the modal renders. */
export function applyAiEvent(state: AiRunState, event: AiEvent): AiRunState {
  switch (event.name) {
    case 'run_start':
      return { ...state, runId: event.payload.runId };

    case 'model_active':
      return { ...state, activeModel: event.payload.model };

    case 'model_switch':
      return { ...state, modelNote: `Falling back to ${event.payload.to}` };

    case 'status':
      return { ...state, statusMessage: event.payload.message, progress: event.payload.progress };

    case 'tool_start':
      return {
        ...state,
        statusMessage: labelFor(event.payload.name),
        steps: [...state.steps, { label: labelFor(event.payload.name), state: 'running' }],
      };

    case 'tool_result':
      return { ...state, steps: closeLastStep(state.steps, event.payload.ok, event.payload.summary) };

    case 'compaction_start':
      return {
        ...state,
        statusMessage: 'Compacting conversation history',
        steps: [
          ...state.steps,
          {
            label: 'Compacting conversation history',
            state: 'running',
            detail: event.payload.tokensBefore
              ? `Context reached ~${event.payload.tokensBefore.toLocaleString()} tokens`
              : undefined,
          },
        ],
      };

    case 'compaction_result':
      return {
        ...state,
        tokensSaved: (state.tokensSaved ?? 0) + (event.payload.tokensSaved ?? 0),
        statusMessage: event.payload.ok ? 'Conversation history compacted' : state.statusMessage,
        steps: closeLastStep(
          state.steps,
          event.payload.ok,
          event.payload.ok
            ? `Saved ${event.payload.tokensSaved.toLocaleString()} tokens (~${event.payload.tokensBefore.toLocaleString()} → ~${event.payload.tokensAfter.toLocaleString()})`
            : 'Compaction skipped',
        ),
      };

    case 'done':
      return {
        ...state,
        phase: 'done',
        progress: 100,
        outcome: event.payload.outcome,
        message: event.payload.message,
        loadBalancers: event.payload.loadBalancers ?? [],
      };

    case 'error':
      return {
        ...state,
        phase: 'done',
        outcome: 'failure',
        message: event.payload.message,
        steps: closeLastStep(state.steps, false, event.payload.message),
      };

    default:
      return state;
  }
}


function closeLastStep(steps: AiStep[], ok: boolean, detail: string): AiStep[] {
  const lastRunning = steps.map((s) => s.state).lastIndexOf('running');
  if (lastRunning === -1) return steps;
  const next = [...steps];
  next[lastRunning] = { ...next[lastRunning], state: ok ? 'ok' : 'failed', detail };
  return next;
}

// --- Prompt card ---

interface AiPromptCardProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  isPro?: boolean;
}

const PROMPT_RECIPES = [
  {
    label: 'Failover Cluster',
    icon: '⚡',
    prompt: 'Deploy a high-availability failover load balancer named prod-failover on mysite.com with primary origin https://primary.mysite.com (weight 100) and backup https://backup.mysite.com (weight 0), active health checks every 15s.',
  },
  {
    label: 'API Gateway Shield',
    icon: '🛡️',
    prompt: 'Create an API gateway on api.mysite.com with upstreams https://srv1.internal.com and https://srv2.internal.com, JWT verification with RBAC, and rate limit 120 req/min keyed by X-API-Key.',
  },
  {
    label: 'Geo-Steering Fleet',
    icon: '🌐',
    prompt: 'Configure geo-steering on edge.mysite.com routing US visitors to https://us-origin.mysite.com and EU visitors to https://eu-origin.mysite.com with Smart Placement enabled.',
  },
  {
    label: 'Canary 90/10 Split',
    icon: '🔄',
    prompt: 'Set up canary routing on app.mysite.com with 90% production traffic to https://prod.internal.com and 10% canary traffic to https://staging.internal.com with response caching.',
  },
];

export function AiPromptCard({ value, onChange, onSubmit, disabled, isPro }: AiPromptCardProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const next = Math.min(el.scrollHeight, MAX_PROMPT_HEIGHT);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > MAX_PROMPT_HEIGHT ? 'auto' : 'hidden';
  }, [value]);

  const canSubmit = !disabled && value.trim().length > 0;

  if (!isPro) {
    return (
      <div className="feature-card" style={{
        padding: 'clamp(18px, 3vw, 24px)',
        marginBottom: 'clamp(20px, 3vw, 28px)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 16, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icons.Lock size={15} style={{ color: 'var(--text-3)' }} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>Autonomous Edge Copilot</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Natural language architecture synthesis is available on Pro</div>
          </div>
        </div>
        <Link href="/pro">
          <button className="btn btn-primary btn-sm">Upgrade to Pro</button>
        </Link>
      </div>
    );
  }

  return (
    <div
      className="feature-card animate-slide-up"
      style={{
        padding: 'clamp(18px, 3vw, 24px)',
        marginBottom: 'clamp(20px, 3vw, 28px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        background: 'var(--bg-1)',
        border: '1px solid var(--line-2)',
        boxShadow: 'var(--shadow)',
      }}
    >
      {/* Precision Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '3px 9px', borderRadius: 999,
            background: 'var(--bg-2)', border: '1px solid var(--line)',
            fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-2)',
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: disabled ? 'var(--accent)' : 'var(--green)',
              display: 'inline-block',
            }} className={disabled ? 'animate-pulse' : ''} />
            <span style={{ fontWeight: 600, letterSpacing: '0.04em' }}>EDGE COPILOT</span>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }} className="hide-sm">
            Autonomous multi-model synthesis
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="hide-sm" style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
            Press
          </span>
          <kbd className="mono" style={{
            fontSize: 10, padding: '2px 6px', borderRadius: 4,
            background: 'var(--bg-2)', border: '1px solid var(--line)', color: 'var(--text-3)',
          }}>
            ↵ Enter
          </kbd>
        </div>
      </div>

      {/* Input Container */}
      <div style={{
        position: 'relative',
        borderRadius: 'var(--radius-lg)',
        border: `1px solid ${isFocused ? 'var(--accent)' : 'var(--line)'}`,
        background: 'var(--bg)',
        boxShadow: isFocused ? '0 0 0 3px var(--accent-dim)' : 'inset 0 1px 2px rgba(0,0,0,0.02)',
        transition: 'border-color 150ms ease, box-shadow 150ms ease',
        padding: '12px 14px',
      }}>
        <textarea
          ref={textareaRef}
          rows={3}
          maxLength={MAX_PROMPT_LENGTH}
          value={value}
          disabled={disabled}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (!disabled && value.trim().length > 0) onSubmit();
            }
          }}
          placeholder="Describe your desired fleet topology in plain English... e.g. 'Deploy an API gateway on api.mysite.com with JWT auth, rate limiting at 100 req/min, and 2 upstream microservices'"
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            resize: 'none',
            minHeight: 64,
            lineHeight: 1.6,
            fontSize: 14,
            color: 'var(--text)',
          }}
        />

        {/* Quick Starters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', paddingTop: 8, borderTop: '1px solid var(--line)' }}>
          <span style={{ fontSize: 11, color: 'var(--text-3)', marginRight: 2, fontFamily: 'var(--mono)' }}>Quick starters:</span>
          {PROMPT_RECIPES.map((recipe) => (
            <button
              key={recipe.label}
              type="button"
              disabled={disabled}
              onClick={() => {
                onChange(recipe.prompt);
                textareaRef.current?.focus();
              }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '3px 9px', borderRadius: 999,
                background: 'var(--bg-2)', border: '1px solid var(--line)',
                fontSize: 11, color: 'var(--text-2)', cursor: 'pointer',
                transition: 'background 120ms, border-color 120ms, color 120ms',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-3)';
                e.currentTarget.style.borderColor = 'var(--line-2)';
                e.currentTarget.style.color = 'var(--text)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--bg-2)';
                e.currentTarget.style.borderColor = 'var(--line)';
                e.currentTarget.style.color = 'var(--text-2)';
              }}
            >
              <span>{recipe.icon}</span>
              <span>{recipe.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Footer controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icons.Shield size={13} style={{ color: 'var(--text-3)' }} />
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
            Safe execution · Destructive ops always require approval
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' }}>
          <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {value.length}/{MAX_PROMPT_LENGTH}
          </span>
          <button
            className="btn btn-primary btn-sm"
            onClick={onSubmit}
            disabled={!canSubmit}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 16px' }}
          >
            <Icons.Zap size={13} />
            <span>Deploy Architecture</span>
            <span className="mono" style={{ fontSize: 10, opacity: 0.8 }}>↵</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Agent modal ---

interface AiAgentModalProps {
  isOpen: boolean;
  run: AiRunState;
  /** Full conversation so far — every clarification round-trip stays visible. */
  messages: ConversationTurn[];
  onCancel: () => void;
  onClose: () => void;
  onReply: (text: string) => void;
}

const THINKING_PHRASES = [
  'Brainstorming routing topology…',
  'Analyzing edge requirements…',
  'Formulating deployment strategy…',
  'Fighting against server latency…',
  'Struggling with edge complexities…',
  'Calibrating origin configurations…',
  'Negotiating with Cloudflare edge…',
  'Synthesizing worker rules…',
  'Fine-tuning health checks…',
  'Optimizing failover paths…',
  'Consulting edge documentation…',
  'Synthesizing response…',
];

function useThinkingPhrase(isRunning: boolean, activeStepLabel?: string): string {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!isRunning) return;
    const interval = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % THINKING_PHRASES.length);
    }, 2400);
    return () => window.clearInterval(interval);
  }, [isRunning]);

  if (!isRunning) return '';
  if (activeStepLabel) return activeStepLabel;
  return THINKING_PHRASES[index];
}

export function AiAgentModal({ isOpen, run, messages, onCancel, onClose, onReply }: AiAgentModalProps) {
  const finished = run.phase === 'done';
  const succeeded = run.outcome === 'success';

  const [followUpUsed, setFollowUpUsed] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (run.phase === 'running') {
      setFollowUpUsed(false);
    }
  }, [run.phase]);

  const activeStep = run.steps.find((s) => s.state === 'running')?.label;
  const isRca = run.statusMessage.toLowerCase().includes('wrong') || run.statusMessage.toLowerCase().includes('problem');
  const thinkingPhrase = useThinkingPhrase(!finished, activeStep || (isRca ? run.statusMessage : undefined));

  const displayStatus = !finished
    ? thinkingPhrase
    : succeeded
      ? 'All tasks completed successfully'
      : 'Run stopped with issues';

  const lastIsAssistant = messages.length > 0 && messages[messages.length - 1].role === 'assistant';
  const historyMessages = lastIsAssistant ? messages.slice(0, -1) : messages;
  const latestAssistantMessage = lastIsAssistant ? messages[messages.length - 1] : null;
  const finalMessageText = latestAssistantMessage?.content || (finished && run.message ? run.message : null);

  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [run.steps.length, messages.length, finalMessageText]);

  if (!isOpen) return null;

  const inputLocked = !finished || run.outcome === 'failure' || followUpUsed;
  const placeholder = !finished
    ? 'AI Agent is executing…'
    : run.outcome === 'failure'
      ? 'Run stopped — start a new conversation to try again.'
      : followUpUsed
        ? 'Follow-up used — start a new conversation to continue.'
        : 'Reply, give new instructions, or close when done… (Enter to send)';

  const handleSendReply = (text: string) => {
    onReply(text);
    setFollowUpUsed(true);
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 90,
        background: 'rgba(8, 10, 14, 0.65)',
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'clamp(12px, 3vw, 32px)',
      }}
      role="dialog"
      aria-modal="true"
    >
      <div style={{
        width: '100%', maxWidth: 760, maxHeight: '88vh', display: 'flex', flexDirection: 'column',
        background: 'var(--bg)', border: '1px solid var(--line-2)', borderRadius: 'var(--radius-lg)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)', overflow: 'hidden',
      }}>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: 'clamp(14px, 2.5vw, 18px) clamp(16px, 3vw, 24px)',
          borderBottom: '1px solid var(--line)',
          background: 'var(--bg)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 'var(--radius-md, 8px)',
              background: 'var(--accent-dim)', border: '1px solid var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Icons.Zap size={16} style={{ color: 'var(--accent)' }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                  AI Agent
                </span>
                <span style={{
                  fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em',
                  padding: '2px 7px', borderRadius: 999,
                  background: finished
                    ? (succeeded ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)')
                    : 'var(--accent-dim)',
                  color: finished
                    ? (succeeded ? 'var(--green)' : 'var(--red)')
                    : 'var(--accent)',
                  border: `1px solid ${finished ? (succeeded ? 'var(--green)' : 'var(--red)') : 'var(--accent)'}`,
                }}>
                  {finished ? (succeeded ? 'Completed' : 'Failed') : 'Active'}
                </span>
                {typeof run.tokensSaved === 'number' && run.tokensSaved > 0 && (
                  <span className="mono animate-fade-in" style={{
                    fontSize: 10, padding: '2px 6px', borderRadius: 'var(--radius-sm, 4px)',
                    background: 'rgba(34, 197, 94, 0.12)', color: 'var(--green)',
                    border: '1px solid rgba(34, 197, 94, 0.25)',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    <Icons.Zap size={10} />
                    {run.tokensSaved.toLocaleString()} tokens saved
                  </span>
                )}
              </div>
              <div style={{
                fontSize: 12, color: 'var(--text-3)', marginTop: 2,
                display: 'flex', alignItems: 'center', gap: 6,
                minHeight: 18,
              }}>
                {!finished && (
                  <span style={{
                    display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                    background: 'var(--accent)',
                    flexShrink: 0,
                  }} className="animate-pulse" />
                )}
                <span key={displayStatus} className="animate-fade-in" style={{
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {displayStatus}
                </span>
              </div>
            </div>
          </div>

          <div style={{ flexShrink: 0, marginLeft: 12 }}>
            {!finished ? (
              <button className="btn btn-ghost btn-sm" onClick={onCancel} style={{ color: 'var(--text-3)' }}>
                Cancel
              </button>
            ) : (
              <button className="btn btn-ghost btn-sm" onClick={onClose}>
                Close
              </button>
            )}
          </div>
        </div>

        {!finished && (
          <div style={{
            height: 2, width: '100%', background: 'var(--bg-2)', overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', width: `${Math.max(run.progress, 12)}%`,
              background: 'linear-gradient(90deg, var(--accent) 0%, var(--green) 100%)',
              transition: 'width 0.4s ease-out',
            }} />
          </div>
        )}

        <div ref={threadRef} style={{ flex: 1, overflowY: 'auto', padding: 'clamp(14px, 2.5vw, 20px) clamp(16px, 3vw, 24px)' }}>
          {historyMessages.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
              {historyMessages.map((turn, i) => (
                <div
                  key={i}
                  className="message-pop"
                  style={{
                    alignSelf: turn.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                    padding: '10px 14px', borderRadius: 'var(--radius-lg)',
                    fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap',
                    userSelect: 'text',
                    WebkitUserSelect: 'text',
                    transformOrigin: turn.role === 'user' ? 'bottom right' : 'bottom left',
                    willChange: 'transform, opacity',
                    ...(turn.role === 'user'
                      ? { background: 'var(--accent-dim)', border: '1px solid var(--accent)', color: 'var(--text)' }
                      : { background: 'var(--bg-2)', border: '1px solid var(--line)', color: 'var(--text-2)' }),
                  }}
                >
                  {turn.content}
                </div>
              ))}
            </div>
          )}

          <StepList steps={run.steps} />

          {finalMessageText && (
            <div
              className="message-pop"
              style={{
                alignSelf: 'flex-start',
                maxWidth: '85%',
                padding: '10px 14px',
                borderRadius: 'var(--radius-lg)',
                fontSize: 13,
                lineHeight: 1.55,
                whiteSpace: 'pre-wrap',
                userSelect: 'text',
                WebkitUserSelect: 'text',
                transformOrigin: 'bottom left',
                willChange: 'transform, opacity',
                background: 'var(--bg-2)',
                border: `1px solid ${finished && !succeeded ? 'var(--red)' : 'var(--line)'}`,
                color: finished && !succeeded ? 'var(--red)' : 'var(--text-2)',
              }}
            >
              {finalMessageText}
            </div>
          )}

          {succeeded && run.loadBalancers.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
              {run.loadBalancers.map((lb) => (
                <div key={lb.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                  padding: '10px 13px', borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--line)', background: 'var(--bg-2)',
                }}>
                  <Icons.Check size={14} style={{ color: 'var(--green)' }} />
                  <span style={{ fontSize: 13, color: 'var(--text)' }}>{lb.name}</span>
                  <span className="mono" style={{ fontSize: 12, color: 'var(--text-3)' }}>{lb.fullDomain}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <AiReplyInput
          inputLocked={inputLocked}
          placeholder={placeholder}
          onSend={handleSendReply}
        />
      </div>
    </div>
  );
}

interface AiReplyInputProps {
  inputLocked: boolean;
  placeholder: string;
  onSend: (text: string) => void;
}

function AiReplyInput({ inputLocked, placeholder, onSend }: AiReplyInputProps) {
  const [reply, setReply] = useState('');
  const canSend = !inputLocked && reply.trim().length > 0;

  const submit = () => {
    if (!canSend) return;
    onSend(reply.trim());
    setReply('');
  };

  return (
    <div style={{
      borderTop: '1px solid var(--line)',
      padding: 'clamp(12px, 2vw, 16px) clamp(16px, 3vw, 24px)',
      display: 'flex', gap: 10, alignItems: 'center',
      background: 'var(--bg)',
    }}>
      <textarea
        className="textarea"
        rows={1}
        autoFocus
        maxLength={MAX_PROMPT_LENGTH}
        value={reply}
        disabled={inputLocked}
        onChange={(e) => setReply(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={placeholder}
        style={{
          flex: 1, resize: 'none', minHeight: 40, maxHeight: 120,
          fontSize: 13, padding: '9px 12px',
        }}
      />
      <button className="btn btn-primary btn-sm" onClick={submit} disabled={!canSend}>
        Send
      </button>
    </div>
  );
}

function StepList({ steps }: { steps: AiStep[] }) {
  if (steps.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
      {steps.map((step, index) => {
        const isOk = step.state === 'ok';
        const isFailed = step.state === 'failed';
        const isRunning = step.state === 'running';

        return (
          <div
            key={`${step.label}-${index}`}
            className="animate-fade-in"
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '8px 12px', borderRadius: 'var(--radius-md, 8px)',
              border: `1px solid ${isRunning ? 'var(--accent)' : 'var(--line)'}`,
              background: isRunning ? 'var(--accent-dim)' : 'var(--bg-2)',
              transition: 'background 0.2s ease, border-color 0.2s ease',
            }}
          >
            <div style={{ marginTop: 2, flexShrink: 0 }}>
              {isOk ? (
                <Icons.Check size={14} style={{ color: 'var(--green)' }} />
              ) : isFailed ? (
                <Icons.X size={14} style={{ color: 'var(--red)' }} />
              ) : (
                <div style={{
                  width: 12, height: 12, borderRadius: '50%',
                  border: '2px solid var(--accent)', borderTopColor: 'transparent',
                }} className="animate-spin" />
              )}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: isRunning ? 500 : 400 }}>
                {step.label}
              </div>
              {step.detail && (
                <div className="mono" style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2, wordBreak: 'break-word' }}>
                  {step.detail}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
