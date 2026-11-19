'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { Sidebar, Topbar } from '@/components/dashboard/Sidebar';
import { Icons } from '@/components/shared/Icons';
import { AiPromptCard, AiAgentModal, applyAiEvent, initialAiRunState, type AiRunState } from '@/components/dashboard/AiAgentModal';
import { streamAiGeneration } from '@/lib/aiStream';
import type { ConversationTurn, LoadBalancer, Gateway } from '@/types/api';

export default function OverviewPage() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const [loadBalancers, setLoadBalancers] = useState<LoadBalancer[]>([]);
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [loading, setLoading] = useState(true);

  // AI Agent state — the conversation chain lives here and is replayed on every call
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiMessages, setAiMessages] = useState<ConversationTurn[]>([]);
  const [aiRun, setAiRun] = useState<AiRunState | null>(null);
  const aiAbortRef = useRef<AbortController | null>(null);
  // runId of the conversation's first turn — echoed back so the server keeps one history entry
  // per conversation instead of one per turn.
  const aiConversationRef = useRef<string | null>(null);

  useEffect(() => {
    if (!authLoading && user && !user.hasCloudflareCredentials) {
      router.push('/onboarding');
      return;
    }
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
  }, [user, authLoading, router]);

  // Counts only — the fleet stats above the prompt card.
  const fetchLoadBalancers = useCallback(async () => {
    try {
      const [lbRes, gwRes] = await Promise.all([
        api.getLoadBalancers({}),
        api.getGateways().catch(() => ({ success: false } as any)),
      ]);
      if (lbRes.success && lbRes.data?.loadBalancers) {
        setLoadBalancers(lbRes.data.loadBalancers);
      }
      if (gwRes.success && gwRes.data?.gateways) {
        setGateways(gwRes.data.gateways);
      }
    } catch {
      // silent — a failed count must not break the page
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchLoadBalancers();
  }, [user]);

  /**
   * One SSE call of the agent session. `history` is everything said before `prompt` — the server
   * appends the prompt as the newest user message, so clarification round-trips resume with full
   * context. The agent's answer is appended to the visible conversation when the turn settles.
   */
  const streamAiTurn = useCallback(async (prompt: string, history: ConversationTurn[]) => {
    const controller = new AbortController();
    aiAbortRef.current = controller;
    setAiRun(initialAiRunState);

    try {
      await streamAiGeneration(prompt, {
        history,
        conversationId: aiConversationRef.current,
        signal: controller.signal,
        onEvent: (event) => {
          if (event.name === 'run_start' && !aiConversationRef.current) {
            aiConversationRef.current = event.payload.runId;
          }
          setAiRun((current) => applyAiEvent(current ?? initialAiRunState, event));
          if (event.name === 'done' || event.name === 'error') {
            const message = event.payload.message;
            if (message) setAiMessages((prev) => [...prev, { role: 'assistant', content: message }]);
          }
        },
      });
    } catch (error: any) {
      // Aborting closes the request, which the server treats as a cancellation and rolls back.
      const cancelled = controller.signal.aborted;
      setAiRun((current) => {
        const base = current ?? initialAiRunState;
        return cancelled
          ? { ...base, phase: 'done', outcome: 'failure', message: 'You cancelled the run. The step in progress was rolled back; anything already finished was kept.' }
          : applyAiEvent(base, { name: 'error', payload: { message: error.message || 'AI generation failed' } });
      });
    } finally {
      aiAbortRef.current = null;
    }
  }, []);

  const cancelAiGeneration = useCallback(() => aiAbortRef.current?.abort(), []);

  const runAiGeneration = useCallback(() => {
    const prompt = aiPrompt.trim();
    if (!prompt || aiRun?.phase === 'running') return;

    setAiMessages((prev) => [...prev, { role: 'user', content: prompt }]);
    void streamAiTurn(prompt, aiMessages);
    setAiPrompt('');
  }, [aiPrompt, aiMessages, aiRun, streamAiTurn]);

  // The agent asked something — the reply continues the same conversation chain.
  const handleAiReply = useCallback((text: string) => {
    if (aiRun?.phase === 'running') return;
    setAiMessages((prev) => [...prev, { role: 'user', content: text }]);
    void streamAiTurn(text, aiMessages);
  }, [aiMessages, aiRun, streamAiTurn]);

  // A failed run can still have deployed something before it broke, so always resync.
  const closeAiModal = useCallback(() => {
    aiAbortRef.current?.abort();
    aiConversationRef.current = null;
    setAiMessages([]);
    setAiRun(null);
    fetchLoadBalancers();
  }, [fetchLoadBalancers]);

  const handleNav = (id: string) => {
    if (id === 'gateways') router.push('/gateways');
    else if (id === 'balancers') router.push('/loadbalancers');
    else if (id === 'sessions') router.push('/sessions');
    else if (id === 'ai-runs') router.push('/ai-runs');
    else if (id === 'pro') router.push('/pro');
    else if (id === 'payments') router.push('/payments');
    else if (id === 'settings') router.push('/settings');
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  if (authLoading || loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 48, height: 48, margin: '0 auto 16px',
            border: '2px solid var(--line)', borderTopColor: 'var(--accent)',
            borderRadius: '50%', animation: 'spin 0.9s linear infinite',
          }} />
          <p style={{ color: 'var(--text-3)' }}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)', flexDirection: 'column' }}>
      <div className="app-shell">
        <Sidebar
          current="overview"
          onNav={handleNav}
          onLogout={handleLogout}
          userEmail={user?.email}
          hasCloudflareCredentials={user?.hasCloudflareCredentials}
          cloudflareOAuthConnected={user?.cloudflareOAuthConnected}
          isReady={!!user?.hasCloudflareCredentials}
          isPro={user?.isPro}
          plan={user?.plan}
          planExpiresAt={user?.planExpiresAt}
        />
        <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Topbar
            crumbs={['Overview']}
            title="Overview"
            subtitle="Autonomous edge infrastructure orchestration & real-time fleet health"
            actions={
              <button className="btn btn-ghost btn-sm" onClick={fetchLoadBalancers} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icons.Refresh size={13} />
                <span className="hide-sm">Refresh Fleet</span>
              </button>
            }
          />
          <div style={{ padding: 'clamp(16px, 3.5vw, 32px)', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 'clamp(20px, 3vw, 28px)' }}>
            {/* AI Agent Studio Card */}
            <AiPromptCard
              value={aiPrompt}
              onChange={setAiPrompt}
              onSubmit={runAiGeneration}
              disabled={!!aiRun}
              isPro={user?.isPro}
            />

            {/* Unified 4-Column Mission Control Fleet Metrics */}
            <div>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 12, padding: '0 2px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="kicker" style={{ fontSize: 11, color: 'var(--text-3)' }}>FLEET TELEMETRY</span>
                  <span style={{
                    fontSize: 10, padding: '1px 6px', borderRadius: 4,
                    background: 'var(--bg-3)', color: 'var(--text-2)', fontFamily: 'var(--mono)',
                  }}>
                    GLOBAL EDGE
                  </span>
                </div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
                gap: 'clamp(12px, 2vw, 16px)',
              }}>
                {/* Metric 1: Active Balancers */}
                <div
                  onClick={() => router.push('/loadbalancers')}
                  className="feature-card feature-card-lift animate-slide-up"
                  style={{
                    padding: 'clamp(16px, 2.5vw, 20px)', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 6,
                        background: 'var(--accent-dim)', color: 'var(--accent)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Icons.Flow size={15} />
                      </div>
                      <span className="kicker" style={{ fontSize: 10 }}>BALANCERS</span>
                    </div>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      fontSize: 11, fontFamily: 'var(--mono)', color: loadBalancers.some(b => b.status === 'active') ? 'var(--green)' : 'var(--text-3)',
                    }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: loadBalancers.some(b => b.status === 'active') ? 'var(--green)' : 'var(--text-3)',
                      }} />
                      {loadBalancers.filter(b => b.status === 'active').length} live
                    </span>
                  </div>

                  <div className="mono" style={{ fontSize: 'clamp(22px, 3.5vw, 28px)', fontWeight: 600, letterSpacing: '-0.03em', color: 'var(--text)', marginTop: 4 }}>
                    {loadBalancers.filter(b => b.status === 'active').length}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-3)', marginTop: 'auto' }}>
                    <span>of {loadBalancers.length} configured</span>
                    <span style={{ color: 'var(--accent)', fontSize: 11, fontWeight: 500 }}>Manage →</span>
                  </div>
                </div>

                {/* Metric 2: Origins Total */}
                <div
                  onClick={() => router.push('/loadbalancers')}
                  className="feature-card feature-card-lift animate-slide-up"
                  style={{
                    padding: 'clamp(16px, 2.5vw, 20px)', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', gap: 10,
                    animationDelay: '0.06s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 6,
                        background: 'var(--bg-3)', color: 'var(--text-2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Icons.Server size={15} />
                      </div>
                      <span className="kicker" style={{ fontSize: 10 }}>ORIGIN NODES</span>
                    </div>
                    <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--green)' }}>
                      probed
                    </span>
                  </div>

                  <div className="mono" style={{ fontSize: 'clamp(22px, 3.5vw, 28px)', fontWeight: 600, letterSpacing: '-0.03em', color: 'var(--green)', marginTop: 4 }}>
                    {loadBalancers.reduce((a, b) => a + (b.originCount || 0), 0)}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-3)', marginTop: 'auto' }}>
                    <span>health probes passing</span>
                    <span style={{ color: 'var(--text-3)', fontSize: 11 }}>View topology →</span>
                  </div>
                </div>

                {/* Metric 3: Active Gateways */}
                <div
                  onClick={() => router.push('/gateways')}
                  className="feature-card feature-card-lift animate-slide-up"
                  style={{
                    padding: 'clamp(16px, 2.5vw, 20px)', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', gap: 10,
                    animationDelay: '0.12s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 6,
                        background: 'var(--accent-dim)', color: 'var(--accent)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Icons.Shield size={15} />
                      </div>
                      <span className="kicker" style={{ fontSize: 10 }}>API GATEWAYS</span>
                    </div>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      fontSize: 11, fontFamily: 'var(--mono)', color: gateways.some(g => g.status === 'active') ? 'var(--green)' : 'var(--text-3)',
                    }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: gateways.some(g => g.status === 'active') ? 'var(--green)' : 'var(--text-3)',
                      }} />
                      {gateways.filter(g => g.status === 'active').length} live
                    </span>
                  </div>

                  <div className="mono" style={{ fontSize: 'clamp(22px, 3.5vw, 28px)', fontWeight: 600, letterSpacing: '-0.03em', color: 'var(--text)', marginTop: 4 }}>
                    {gateways.filter(g => g.status === 'active').length}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-3)', marginTop: 'auto' }}>
                    <span>of {gateways.length} configured</span>
                    <span style={{ color: 'var(--accent)', fontSize: 11, fontWeight: 500 }}>Manage →</span>
                  </div>
                </div>

                {/* Metric 4: Upstreams Total */}
                <div
                  onClick={() => router.push('/gateways')}
                  className="feature-card feature-card-lift animate-slide-up"
                  style={{
                    padding: 'clamp(16px, 2.5vw, 20px)', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', gap: 10,
                    animationDelay: '0.18s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 6,
                        background: 'var(--bg-3)', color: 'var(--text-2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Icons.Layers size={15} />
                      </div>
                      <span className="kicker" style={{ fontSize: 10 }}>UPSTREAMS</span>
                    </div>
                    <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--green)' }}>
                      ready
                    </span>
                  </div>

                  <div className="mono" style={{ fontSize: 'clamp(22px, 3.5vw, 28px)', fontWeight: 600, letterSpacing: '-0.03em', color: 'var(--green)', marginTop: 4 }}>
                    {gateways.reduce((a, g) => a + (g.upstreams?.length || 0), 0)}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-3)', marginTop: 'auto' }}>
                    <span>BFF & microservices</span>
                    <span style={{ color: 'var(--text-3)', fontSize: 11 }}>View routes →</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Architecture Launchpad */}
            <div>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 12, padding: '0 2px',
              }}>
                <span className="kicker" style={{ fontSize: 11, color: 'var(--text-3)' }}>QUICK LAUNCHPAD</span>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
                gap: 'clamp(12px, 2vw, 16px)',
              }}>
                {/* Launchpad 1: Load Balancer */}
                <div
                  className="feature-card feature-card-lift animate-slide-up"
                  style={{
                    padding: 'clamp(18px, 2.5vw, 22px)',
                    display: 'flex', flexDirection: 'column', gap: 12,
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: 'var(--accent-dim)', color: 'var(--accent)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Icons.Flow size={16} />
                      </div>
                      <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Traffic Balancers</h4>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)', lineHeight: 1.55 }}>
                      Deploy high-performance round-robin, geo-steering, or failover load balancing across your multi-cloud origin nodes with sub-millisecond edge failover.
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <button
                      className="btn btn-dark btn-sm"
                      onClick={() => router.push('/loadbalancers/create')}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <Icons.Plus size={13} />
                      <span>New Balancer</span>
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => router.push('/loadbalancers')}
                    >
                      View All
                    </button>
                  </div>
                </div>

                {/* Launchpad 2: API Gateway */}
                <div
                  className="feature-card feature-card-lift animate-slide-up"
                  style={{
                    padding: 'clamp(18px, 2.5vw, 22px)',
                    display: 'flex', flexDirection: 'column', gap: 12,
                    justifyContent: 'space-between',
                    animationDelay: '0.08s',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: 'var(--accent-dim)', color: 'var(--accent)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Icons.Shield size={16} />
                      </div>
                      <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Edge API Gateways</h4>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)', lineHeight: 1.55 }}>
                      Shield backend microservices with route-level RBAC, identity rate limiting (API key / JWT), BFF fan-out composition, and semantic edge caching.
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <button
                      className="btn btn-dark btn-sm"
                      onClick={() => router.push('/gateways/create')}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <Icons.Plus size={13} />
                      <span>New Gateway</span>
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => router.push('/gateways')}
                    >
                      View All
                    </button>
                  </div>
                </div>

                {/* Launchpad 3: AI Copilot Runs */}
                <div
                  className="feature-card feature-card-lift animate-slide-up"
                  style={{
                    padding: 'clamp(18px, 2.5vw, 22px)',
                    display: 'flex', flexDirection: 'column', gap: 12,
                    justifyContent: 'space-between',
                    animationDelay: '0.16s',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: 'var(--bg-3)', color: 'var(--text-2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Icons.History size={16} />
                      </div>
                      <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Agent Execution Traces</h4>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)', lineHeight: 1.55 }}>
                      Inspect full conversation history, automated tool calls, rollback safety checks, and token compaction metrics across all autonomous deployments.
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => router.push('/ai-runs')}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <Icons.History size={13} />
                      <span>Explore Run History →</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      <AiAgentModal
        isOpen={!!aiRun}
        run={aiRun ?? initialAiRunState}
        messages={aiMessages}
        onCancel={cancelAiGeneration}
        onClose={closeAiModal}
        onReply={handleAiReply}
      />
    </div>
  );
}
