'use client';

import { useEffect, useRef, useState } from 'react';
import { Icons } from '@/components/shared/Icons';
import { FormattedMessage } from '@/components/shared/FormattedMessage';
import type { AiEvent, AiOutcome, AiStep, ConversationTurn, LoadBalancer } from '@/types/api';
import Link from 'next/link';

const MAX_PROMPT_LENGTH = 4000;
const MAX_PROMPT_HEIGHT = 220;

const TOOL_LABELS: Record<string, string> = {
  find_tools: 'Looking inside the toolbox',
  search_knowledge_base: 'Reading books so you do not have to',
  list_zones: 'Knocking on Cloudflare door',
  list_load_balancers: 'Counting all your load balancers',
  list_gateways: 'Checking who is guarding your APIs',
  create_load_balancer: 'Cooking up a fresh load balancer',
  update_load_balancer: 'Teaching the load balancer new tricks',
  delete_load_balancer: 'Throwing this load balancer in the trash',
  pause_load_balancer: 'Putting the load balancer to sleep',
  resume_load_balancer: 'Waking up the load balancer with coffee',
  create_gateway: 'Hiring a bouncer for your API',
  update_gateway: 'Giving the gatekeeper new rules',
  delete_gateway: 'Tearing down the front gate',
  pause_gateway: 'Closing the gate for a quick nap',
  resume_gateway: 'Opening the gate back up for traffic',
  web_search: 'Googling the fix like a senior developer',
  fetch_url: 'Reading that webpage line by line',
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
  isChangingModel?: boolean;
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
  isChangingModel: false,
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
      return { ...state, activeModel: event.payload.model, isChangingModel: false };

    case 'model_switch':
      return { ...state, modelNote: `Falling back to ${event.payload.to}`, activeModel: event.payload.to, isChangingModel: true };

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
        statusMessage: 'Tidying up the chat so my brain does not explode',
        steps: [
          ...state.steps,
          {
            label: 'Packing the chat into a smaller suitcase',
            state: 'running',
            detail: event.payload.tokensBefore
              ? `Chat was getting way too noisy (~${event.payload.tokensBefore.toLocaleString()} tokens)`
              : undefined,
          },
        ],
      };

    case 'compaction_result':
      return {
        ...state,
        tokensSaved: (state.tokensSaved ?? 0) + (event.payload.tokensSaved ?? 0),
        statusMessage: event.payload.ok ? 'Chat is clean and light again' : state.statusMessage,
        steps: closeLastStep(
          state.steps,
          event.payload.ok,
          event.payload.ok
            ? `Trimmed ${event.payload.tokensSaved.toLocaleString()} tokens of useless chatter (~${event.payload.tokensBefore.toLocaleString()} down to ~${event.payload.tokensAfter.toLocaleString()})`
            : 'Chat was already clean enough',
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

interface ArchitectureTemplate {
  category: 'lb' | 'gateway';
  badge: string;
  badgeColor?: string;
  title: string;
  summary: string;
  prompt: string;
}

const ARCHITECTURE_TEMPLATES: ArchitectureTemplate[] = [
  // --- Load Balancer Cases (8 Combinations) ---
  {
    category: 'lb',
    badge: 'LB: Failover',
    badgeColor: 'var(--orange)',
    title: 'High-Availability Active-Passive Failover',
    summary: 'Primary + standby origin with 15s health probes, CORS & Smart Placement',
    prompt:
      'Create a failover load balancer named "prod-failover" on domain "mysite.com" with subdomain "api" and strategy "failover". Set primary origin https://primary.mysite.com (weight 100) and backup origin https://backup.mysite.com (weight 0). Enable active health checks every 15s probing path "/health", enable CORS for https://app.mysite.com, and enable Smart Placement.',
  },
  {
    category: 'lb',
    badge: 'LB: Weighted RR',
    badgeColor: 'var(--accent)',
    title: 'Weighted Multi-Origin Traffic Cluster',
    summary: '80/20 split across 2 origins with path routing & 150 req/min rate limit',
    prompt:
      'Create a weighted-round-robin load balancer named "api-cluster" on domain "mysite.com" with subdomain "edge" and strategy "weighted-round-robin". Add origins https://srv-primary.mysite.com (weight 80) and https://srv-secondary.mysite.com (weight 20). Path route "/static/*" to origin 1, enable health checks every 30s on "/status", set rate limit to 150 req/min, and enable CORS.',
  },
  {
    category: 'lb',
    badge: 'LB: Geo-Steering',
    badgeColor: 'var(--green)',
    title: 'Global Multi-Region Geo Steering',
    summary: 'Route NA & EU visitors to regional cloud backends with fallback',
    prompt:
      'Deploy a geo-steering load balancer named "global-fleet" on domain "mysite.com" with subdomain "global" and strategy "geo-steering". Route North America (continent NA) to https://us-east.mysite.com (weight 100), Europe (continent EU) to https://eu-west.mysite.com (weight 100), and designate https://us-east.mysite.com as the fallback origin. Enable Smart Placement and 20s health checks.',
  },
  {
    category: 'lb',
    badge: 'LB: Sticky Session',
    badgeColor: 'var(--accent)',
    title: 'Stateful Cookie Sticky Sessions',
    summary: 'Consistent visitor affinity with CORS & 100 req/min rate limiting',
    prompt:
      'Create a cookie-sticky load balancer named "stateful-app" on domain "mysite.com" with subdomain "portal" and strategy "cookie-sticky". Add origins https://node1.mysite.com (weight 100) and https://node2.mysite.com (weight 100). Enable CORS for https://app.mysite.com, set rate limit to 100 req/min, and enable origin health checks on path "/ready".',
  },
  {
    category: 'lb',
    badge: 'LB: IP Hash',
    badgeColor: 'var(--violet)',
    title: 'Deterministic IP-Hash Sharding',
    summary: 'Consistent client-to-origin routing for distributed cache & websocket clusters',
    prompt:
      'Create an ip-hash load balancer named "cache-shards" on domain "mysite.com" with subdomain "cache" and strategy "ip-hash". Add origins https://cache-a.mysite.com (weight 100), https://cache-b.mysite.com (weight 100), and https://cache-c.mysite.com (weight 100). Enable active health checks every 20s probing "/ping", and enable Smart Placement.',
  },
  {
    category: 'lb',
    badge: 'LB: Path Router',
    badgeColor: 'var(--orange)',
    title: 'Micro-Frontend & Service Path Router',
    summary: 'Route /api/*, /app/*, and /assets/* to independent dedicated backends',
    prompt:
      'Deploy a round-robin load balancer named "mfe-router" on domain "mysite.com" with subdomain "app" and strategy "round-robin". Add origins https://mfe-app.mysite.com (weight 100), https://api-backend.mysite.com (weight 100), and https://cdn-assets.mysite.com (weight 100). Path route "/api/*" to origin 2, path route "/assets/*" to origin 3, and default "/app/*" to origin 1 with CORS enabled.',
  },
  {
    category: 'lb',
    badge: 'LB: A/B Sticky',
    badgeColor: 'var(--green)',
    title: 'Weighted Sticky A/B Release Test',
    summary: '50/50 initial split with persistent cookie stickiness for user journey',
    prompt:
      'Create a weighted-cookie-sticky load balancer named "ab-checkout" on domain "mysite.com" with subdomain "pay" and strategy "weighted-cookie-sticky". Add origins https://checkout-v1.mysite.com (weight 50) and https://checkout-v2.mysite.com (weight 50). Enable CORS for https://mysite.com, set rate limit to 80 req/min, and enable 15s health probes.',
  },
  {
    category: 'lb',
    badge: 'LB: Regional Pin',
    badgeColor: 'var(--accent)',
    title: 'Cloud Region Pinning (Smart Placement)',
    summary: 'Pin edge compute directly adjacent to AWS us-east-1 origin for minimal latency',
    prompt:
      'Deploy a round-robin load balancer named "aws-pinned" on domain "mysite.com" with subdomain "us" and strategy "round-robin". Add origins https://ec2-app-1.internal.com (weight 100) and https://ec2-app-2.internal.com (weight 100). Disable Smart Placement and pin execution directly to region "aws:us-east-1" with 30s health checks and rate limit of 300 req/min.',
  },

  // --- API Gateway Cases (8 Combinations) ---
  {
    category: 'gateway',
    badge: 'Gateway: JWT & RBAC',
    badgeColor: 'var(--violet)',
    title: 'Zero-Trust JWT Auth & Route RBAC',
    summary: 'HMAC verification, 403 role check on /admin/* & header claim injection',
    prompt:
      'Deploy an API gateway named "secure-api" on domain "mysite.com" with subdomain "v1" and upstream https://backend.internal.com (weight 100). Enable JWT authentication with HMAC-SHA256, route-level RBAC requiring role "admin" on path "/admin/*", and downstream claim injection injecting X-User-Id and X-User-Roles headers.',
  },
  {
    category: 'gateway',
    badge: 'Gateway: Rate Limit',
    badgeColor: 'var(--orange)',
    title: 'Identity Rate Limiting & Path Throttling',
    summary: '120 req/min per X-API-Key with strict 10 req/min throttle on /login/*',
    prompt:
      'Create an API gateway named "metered-gw" on domain "mysite.com" with subdomain "api" and upstream https://core-api.internal.com. Enable identity-based rate limiting keyed by header "X-API-Key" with a global cap of 120 req/min, and configure a strict per-path rate limit of 10 req/min on path "/auth/login/*".',
  },
  {
    category: 'gateway',
    badge: 'Gateway: BFF Fan-Out',
    badgeColor: 'var(--accent)',
    title: 'BFF Fan-Out & Semantic Edge Cache',
    summary: 'Parallel multi-upstream aggregation + normalized query cache',
    prompt:
      'Deploy an API gateway named "bff-portal" on domain "mysite.com" with subdomain "bff" and upstreams https://users.internal.com (weight 100) and https://orders.internal.com (weight 100). Add a BFF aggregation route on "/dashboard" fanning out to both upstreams, and enable semantic caching on "/public/*" (TTL 300s) with query parameter normalization.',
  },
  {
    category: 'gateway',
    badge: 'Gateway: Shield & Mask',
    badgeColor: 'var(--red)',
    title: 'Contract Shielding & Response Masking',
    summary: 'Edge 400 rejection for missing fields & sensitive data stripping',
    prompt:
      'Create an API gateway named "shield-gateway" on domain "mysite.com" with subdomain "checkout" and upstream https://orders.internal.com. Add contract schema validation on POST "/api/orders" requiring fields "cartId, amount", and add response body shaping on "/api/users/*" stripping sensitive fields "password_hash, ssn".',
  },
  {
    category: 'gateway',
    badge: 'Gateway: Canary Mirror',
    badgeColor: 'var(--green)',
    title: 'Canary Traffic Shadowing (Mirroring)',
    summary: 'Asynchronously duplicate 15% of live traffic to staging with 0ms latency impact',
    prompt:
      'Deploy an API gateway named "canary-api" on domain "mysite.com" with subdomain "gateway" with upstream 1 https://prod.internal.com (weight 100) and upstream 2 https://staging.internal.com (weight 0). Route primary traffic to upstream 1, and enable asynchronous traffic shadowing mirroring 15% of live requests to upstream 2 with 0ms latency impact.',
  },
  {
    category: 'gateway',
    badge: 'Gateway: Mock Sandbox',
    badgeColor: 'var(--accent)',
    title: 'Synthetic Edge Mocks & Sandbox API',
    summary: 'Serve mock endpoints at edge for instant frontend testing without backend',
    prompt:
      'Deploy an API gateway named "mock-sandbox" on domain "mysite.com" with subdomain "sandbox" and upstream https://dev-null.internal.com. Add mock route GET "/mock/user" returning status 200 with JSON {"id": 1, "status": "active"}, mock route POST "/mock/checkout" returning status 201 with JSON {"orderId": "mock-123"}, and enable CORS for *.',
  },
  {
    category: 'gateway',
    badge: 'Gateway: Public API',
    badgeColor: 'var(--orange)',
    title: 'Public Developer API with Query Caching',
    summary: 'Normalize search queries, strip tracking tags & enforce 60 req/min per IP',
    prompt:
      'Create an API gateway named "dev-api" on domain "mysite.com" with subdomain "public" and upstream https://api-read.internal.com. Enable semantic caching on "/v1/search/*" and "/v1/catalog/*" (TTL 600s) with query parameter sorting and stripping of utm_* and fbclid, rate limit 60 req/min, and enable CORS.',
  },
  {
    category: 'gateway',
    badge: 'Gateway: Full Stack',
    badgeColor: 'var(--violet)',
    title: 'Enterprise All-in-One Shielded Gateway',
    summary: 'RBAC Auth + Identity Rate Limit + BFF Fan-Out + Semantic Cache + Masking',
    prompt:
      'Deploy an API gateway named "enterprise-gw" on domain "mysite.com" with subdomain "api" and upstreams https://core.internal.com and https://analytics.internal.com. Enable JWT auth with RBAC (admin role on "/admin/*"), identity rate limiting by "X-API-Key" (200 req/min), BFF aggregation on "/overview", semantic caching on "/public/*" (TTL 300s), and response body shaping stripping "secret_key, token".',
  },
];

export function AiPromptCard({ value, onChange, onSubmit, disabled, isPro }: AiPromptCardProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'lb' | 'gateway'>('all');
  const [appliedTitle, setAppliedTitle] = useState<string | null>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const next = Math.min(el.scrollHeight, MAX_PROMPT_HEIGHT);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > MAX_PROMPT_HEIGHT ? 'auto' : 'hidden';
  }, [value]);

  const canSubmit = !disabled && value.trim().length > 0;

  const handleApplyTemplate = (tpl: ArchitectureTemplate) => {
    if (disabled) return;
    onChange(tpl.prompt);
    setAppliedTitle(tpl.title);
    setTimeout(() => setAppliedTitle(null), 1800);
    textareaRef.current?.focus();
  };

  const filteredTemplates = ARCHITECTURE_TEMPLATES.filter((tpl) => {
    if (activeTab === 'lb') return tpl.category === 'lb';
    if (activeTab === 'gateway') return tpl.category === 'gateway';
    return true;
  });

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
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>Autonomous Edge Ai</div>
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
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))',
      gap: 'clamp(14px, 2vw, 20px)',
      marginBottom: 'clamp(20px, 3vw, 28px)',
      alignItems: 'stretch',
    }}>
      {/* Left Column: Natural Language Input Studio */}
      <div
        className="feature-card animate-slide-up"
        style={{
          padding: 'clamp(18px, 2.5vw, 22px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          background: 'var(--bg-1)',
          border: '1px solid var(--line-2)',
          boxShadow: 'var(--shadow)',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '3px 8px', borderRadius: 999,
                background: 'var(--bg-2)', border: '1px solid var(--line)',
                fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-2)',
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: disabled ? 'var(--accent)' : 'var(--green)',
                  display: 'inline-block',
                }} className={disabled ? 'animate-pulse' : ''} />
                <span style={{ fontWeight: 600, letterSpacing: '0.04em' }}>EDGE Ai</span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }} className="hide-sm">
                Natural Language Studio
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <kbd className="mono" style={{
                fontSize: 10, padding: '2px 5px', borderRadius: 4,
                background: 'var(--bg-2)', border: '1px solid var(--line)', color: 'var(--text-3)',
              }}>
                ↵ Enter
              </kbd>
            </div>
          </div>

          {/* Textarea Container */}
          <div style={{
            position: 'relative',
            borderRadius: 'var(--radius)',
            border: `1px solid ${isFocused ? 'var(--accent)' : 'var(--line)'}`,
            background: 'var(--bg)',
            boxShadow: isFocused ? '0 0 0 3px var(--accent-dim)' : 'inset 0 1px 2px rgba(0,0,0,0.02)',
            transition: 'border-color 150ms ease, box-shadow 150ms ease',
            padding: '10px 12px',
          }}>
            <textarea
              ref={textareaRef}
              rows={4}
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
              placeholder="Describe your desired fleet in plain English... or select any architecture template on the right to pre-fill a complete production configuration."
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                resize: 'none',
                minHeight: 110,
                lineHeight: 1.6,
                fontSize: 13.5,
                color: 'var(--text)',
              }}
            />
          </div>
        </div>

        {/* Footer controls */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 10, flexWrap: 'wrap', paddingTop: 8, borderTop: '1px solid var(--line)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icons.Shield size={12} style={{ color: 'var(--text-3)' }} />
            <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
              Reversible · Confirmed before mutate
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>
              {value.length}/{MAX_PROMPT_LENGTH}
            </span>
            <button
              className="btn btn-primary btn-sm"
              onClick={onSubmit}
              disabled={!canSubmit}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px' }}
            >
              <Icons.Zap size={13} />
              <span>Deploy</span>
              <span className="mono" style={{ fontSize: 10, opacity: 0.8 }}>↵</span>
            </button>
          </div>
        </div>
      </div>

      {/* Right Column: Pre-Configured Templates Card */}
      <div
        className="feature-card animate-slide-up"
        style={{
          padding: 'clamp(18px, 2.5vw, 22px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          background: 'var(--bg-1)',
          border: '1px solid var(--line-2)',
          boxShadow: 'var(--shadow)',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Header with Filter Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icons.Layers size={14} style={{ color: 'var(--accent)' }} />
              <span className="kicker" style={{ fontSize: 11, color: 'var(--text-2)' }}>ARCHITECTURE TEMPLATES</span>
            </div>

            {/* Filter Tabs */}
            <div style={{ display: 'inline-flex', background: 'var(--bg-2)', padding: 2, borderRadius: 6, border: '1px solid var(--line)' }}>
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                style={{
                  padding: '3px 8px', borderRadius: 4, fontSize: 11, fontFamily: 'var(--mono)',
                  background: activeTab === 'all' ? 'var(--bg)' : 'transparent',
                  color: activeTab === 'all' ? 'var(--text)' : 'var(--text-3)',
                  boxShadow: activeTab === 'all' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  cursor: 'pointer',
                }}
              >
                All (16)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('lb')}
                style={{
                  padding: '3px 8px', borderRadius: 4, fontSize: 11, fontFamily: 'var(--mono)',
                  background: activeTab === 'lb' ? 'var(--bg)' : 'transparent',
                  color: activeTab === 'lb' ? 'var(--text)' : 'var(--text-3)',
                  boxShadow: activeTab === 'lb' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  cursor: 'pointer',
                }}
              >
                LB (8)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('gateway')}
                style={{
                  padding: '3px 8px', borderRadius: 4, fontSize: 11, fontFamily: 'var(--mono)',
                  background: activeTab === 'gateway' ? 'var(--bg)' : 'transparent',
                  color: activeTab === 'gateway' ? 'var(--text)' : 'var(--text-3)',
                  boxShadow: activeTab === 'gateway' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  cursor: 'pointer',
                }}
              >
                Gateway (8)
              </button>
            </div>
          </div>

          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
            Click any template to auto-fill complete parameters into the input studio:
          </div>

          {/* Scrollable Templates List */}
          <div
            className="no-scrollbar"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              maxHeight: 200,
              overflowY: 'auto',
              paddingRight: 2,
            }}
          >
            {filteredTemplates.map((tpl) => {
              const isApplied = appliedTitle === tpl.title;
              return (
                <div
                  key={tpl.title}
                  onClick={() => handleApplyTemplate(tpl)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius)',
                    background: isApplied ? 'var(--accent-dim)' : 'var(--bg)',
                    border: `1px solid ${isApplied ? 'var(--accent)' : 'var(--line)'}`,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                    transition: 'border-color 140ms ease, background 140ms ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isApplied) {
                      e.currentTarget.style.borderColor = 'var(--line-2)';
                      e.currentTarget.style.background = 'var(--bg-2)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isApplied) {
                      e.currentTarget.style.borderColor = 'var(--line)';
                      e.currentTarget.style.background = 'var(--bg)';
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        fontSize: 10, fontFamily: 'var(--mono)', padding: '1px 6px', borderRadius: 4,
                        background: 'var(--bg-3)', color: tpl.badgeColor || 'var(--accent)', fontWeight: 600,
                      }}>
                        {tpl.badge}
                      </span>
                      <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text)' }}>
                        {tpl.title}
                      </span>
                    </div>
                    {isApplied ? (
                      <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--green)', fontWeight: 600 }}>
                        Applied ✓
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                        Use ↵
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.4 }}>
                    {tpl.summary}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Templates Card Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          paddingTop: 8, borderTop: '1px solid var(--line)', fontSize: 11, color: 'var(--text-3)',
        }}>
          <span>All required schemas & parameters included</span>
          <span className="mono" style={{ color: 'var(--accent)' }}>16 templates available</span>
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

function formatModelName(model: string | null): string {
  if (!model) return '';
  const clean = model.includes('/') ? model.split('/')[1] : model;
  return clean.replace(/:free$/, '');
}

function CasinoRollText({ text, className, style }: { text: string; className?: string; style?: React.CSSProperties }) {
  const [items, setItems] = useState<{ id: number; text: string; isNew: boolean }[]>([
    { id: 0, text, isNew: false },
  ]);
  const counterRef = useRef(1);

  useEffect(() => {
    setItems((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.text === text) return prev;
      const nextId = counterRef.current++;
      return [
        { id: last ? last.id : 0, text: last ? last.text : text, isNew: false },
        { id: nextId, text, isNew: true },
      ];
    });

    const timer = setTimeout(() => {
      setItems([{ id: counterRef.current, text, isNew: false }]);
    }, 450);

    return () => clearTimeout(timer);
  }, [text]);

  return (
    <span
      style={{
        display: 'inline-grid',
        gridTemplateAreas: '"slot"',
        alignItems: 'center',
        height: '1.25em',
        lineHeight: '1.25em',
        overflow: 'hidden',
        position: 'relative',
        verticalAlign: 'middle',
        ...style,
      }}
      className={className}
    >
      {items.map((item) => (
        <span
          key={item.id}
          style={{
            gridArea: 'slot',
            display: 'inline-flex',
            alignItems: 'center',
            whiteSpace: 'nowrap',
            animation: item.isNew
              ? 'casinoSlotIn 420ms cubic-bezier(0.16, 1, 0.3, 1.15) forwards'
              : items.length > 1
                ? 'casinoSlotOut 420ms cubic-bezier(0.16, 1, 0.3, 1.15) forwards'
                : 'none',
          }}
        >
          {item.text}
        </span>
      ))}
    </span>
  );
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

  const statusLabel = finished
    ? (succeeded ? 'Delivered' : 'Failed')
    : (activeStep ? 'Working' : 'Thinking');

  const statusTheme = finished
    ? (succeeded
        ? { bg: 'rgba(52, 199, 89, 0.12)', color: 'var(--green)', border: '1px solid rgba(52, 199, 89, 0.28)' }
        : { bg: 'rgba(255, 59, 48, 0.12)', color: 'var(--red)', border: '1px solid rgba(255, 59, 48, 0.28)' })
    : (activeStep
        ? { bg: 'rgba(255, 149, 0, 0.12)', color: 'var(--orange)', border: '1px solid rgba(255, 149, 0, 0.28)' }
        : { bg: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--accent)' });

  const rawModel = run.activeModel;
  const isChangingModel = Boolean(run.isChangingModel);
  const formattedModel = formatModelName(rawModel);
  const modelDisplayText = isChangingModel ? 'Changing model…' : formattedModel;

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
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'nowrap', minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', flexShrink: 0 }}>
                  AI Agent
                </span>

                {/* Status Badge: Thinking / Working / Delivered / Failed */}
                <span style={{
                  fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em',
                  padding: '2px 8px', borderRadius: 999,
                  background: statusTheme.bg, color: statusTheme.color, border: statusTheme.border,
                  display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
                  transition: 'background 0.3s ease, color 0.3s ease, border-color 0.3s ease',
                }}>
                  {!finished && (
                    <span style={{
                      width: 5, height: 5, borderRadius: '50%',
                      background: statusTheme.color, flexShrink: 0,
                    }} className="animate-pulse" />
                  )}
                  <CasinoRollText text={statusLabel} />
                </span>

                {/* Model Badge: Real-time model name or "Changing model…" with Casino Roll */}
                {modelDisplayText && (
                  <span
                    title={rawModel ?? ''}
                    className="mono"
                    style={{
                      fontSize: 10, fontWeight: 500, letterSpacing: '0.02em',
                      padding: '2px 7px', borderRadius: 'var(--radius-sm, 4px)',
                      background: isChangingModel ? 'rgba(255, 149, 0, 0.12)' : 'var(--bg-2)',
                      color: isChangingModel ? 'var(--orange)' : 'var(--text-2)',
                      border: `1px solid ${isChangingModel ? 'rgba(255, 149, 0, 0.3)' : 'var(--line-2)'}`,
                      display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 1, minWidth: 0,
                      maxWidth: 160,
                      transition: 'all 0.3s ease',
                    }}
                  >
                    <Icons.Zap size={10} style={{ color: isChangingModel ? 'var(--orange)' : 'var(--accent)', flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <CasinoRollText text={modelDisplayText} />
                    </span>
                  </span>
                )}

                {/* Tokens Saved Badge */}
                {typeof run.tokensSaved === 'number' && run.tokensSaved > 0 && (
                  <span className="mono animate-fade-in" style={{
                    fontSize: 10, padding: '2px 6px', borderRadius: 'var(--radius-sm, 4px)',
                    background: 'rgba(52, 199, 89, 0.12)', color: 'var(--green)',
                    border: '1px solid rgba(52, 199, 89, 0.25)',
                    display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0,
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
                    fontSize: 13, lineHeight: 1.55,
                    whiteSpace: turn.role === 'user' ? 'pre-wrap' : undefined,
                    userSelect: 'text',
                    WebkitUserSelect: 'text',
                    transformOrigin: turn.role === 'user' ? 'bottom right' : 'bottom left',
                    willChange: 'transform, opacity',
                    ...(turn.role === 'user'
                      ? { background: 'var(--accent-dim)', border: '1px solid var(--accent)', color: 'var(--text)' }
                      : { background: 'var(--bg-2)', border: '1px solid var(--line)', color: 'var(--text-2)' }),
                  }}
                >
                  {turn.role === 'user' ? turn.content : <FormattedMessage content={turn.content} />}
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
                userSelect: 'text',
                WebkitUserSelect: 'text',
                transformOrigin: 'bottom left',
                willChange: 'transform, opacity',
                background: 'var(--bg-2)',
                border: `1px solid ${finished && !succeeded ? 'var(--red)' : 'var(--line)'}`,
                color: finished && !succeeded ? 'var(--red)' : 'var(--text-2)',
              }}
            >
              <FormattedMessage content={finalMessageText} />
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
