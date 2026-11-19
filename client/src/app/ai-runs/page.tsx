'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { Sidebar, Topbar } from '@/components/dashboard/Sidebar';
import { Icons } from '@/components/shared/Icons';
import { Modal } from '@/components/ui/Modal';
import type { AiRunListItem, AiRunDetail, AiOutcome } from '@/types/api';
import toast from 'react-hot-toast';

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// Outcomes are success | failure today; older documents may still carry retired values
// ('refused', 'needs_input'), which fall through to the neutral styling.
function outcomeColor(outcome: AiOutcome): string {
  if (outcome === 'success') return 'var(--green)';
  if (outcome === 'failure') return 'var(--red)';
  return 'var(--text-3)';
}

function outcomeLabel(outcome: AiOutcome): string {
  if (outcome === 'success') return 'Success';
  if (outcome === 'failure') return 'Failed';
  return String(outcome);
}

// ─── Detail Modal ──────────────────────────────────────────────────

const runDetailCache = new Map<string, Promise<AiRunDetail> | AiRunDetail>();

async function fetchRunDetail(runId: string): Promise<AiRunDetail> {
  const cached = runDetailCache.get(runId);
  if (cached) {
    return cached;
  }
  const promise = (async () => {
    try {
      const res = await api.getAiRun(runId);
      const data = res.data.run as AiRunDetail;
      runDetailCache.set(runId, data);
      return data;
    } catch (err) {
      runDetailCache.delete(runId);
      throw err;
    }
  })();
  runDetailCache.set(runId, promise);
  return promise;
}

function AiRunDetailModal({ runId, onClose }: { runId: string; onClose: () => void }) {
  const [run, setRun] = useState<AiRunDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const runData = await fetchRunDetail(runId);
        if (!cancelled) setRun(runData);
      } catch (err: any) {
        if (!cancelled) toast.error(err.message || 'Failed to load run details');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [runId]);

  return (
    <Modal isOpen onClose={onClose} title="AI Run Details" size="lg">
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <div style={{
            width: 28, height: 28, border: '3px solid var(--line)',
            borderTopColor: 'var(--accent)', borderRadius: '50%',
            animation: 'spin 0.9s linear infinite',
          }} />
        </div>
      ) : !run ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)' }}>Run not found</div>
      ) : (
        <div className="no-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: 20, maxHeight: '70vh', overflowY: 'auto', scrollBehavior: 'smooth' }}>
          {/* Header */}
          <div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <span style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 4,
                background: `${outcomeColor(run.outcome)}15`, color: outcomeColor(run.outcome),
                fontWeight: 600, fontFamily: 'var(--mono)',
              }}>
                {outcomeLabel(run.outcome)}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{relativeTime(run.createdAt)}</span>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>· {formatDuration(run.durationMs)}</span>
            </div>
            {/* The thread below already opens with this prompt as its first bubble */}
            {(!run.turns || run.turns.length === 0) && (
              <div style={{
                fontSize: 14, lineHeight: 1.6, padding: 14,
                background: 'var(--bg-2)', borderRadius: 'var(--radius)',
                border: '1px solid var(--line)', whiteSpace: 'pre-wrap',
              }}>
                {run.prompt}
              </div>
            )}
          </div>

          {/* Conversation — every clarification round-trip the run went through */}
          {run.turns && run.turns.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-2)' }}>Conversation</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {run.turns.map((turn, i) => (
                  <div
                    key={i}
                    style={{
                      alignSelf: turn.role === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth: '90%',
                      padding: '8px 12px', borderRadius: 'var(--radius)',
                      fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap',
                      ...(turn.role === 'user'
                        ? { background: 'var(--accent-dim)', border: '1px solid var(--accent)' }
                        : { background: 'var(--bg-2)', border: '1px solid var(--line)', color: 'var(--text-2)' }),
                    }}
                  >
                    {turn.content}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Final answer or question, as shown to the user */}
          {run.finalMessage && (
            <div>
              <div style={{
                fontSize: 13.5, lineHeight: 1.65, padding: 14,
                background: 'var(--bg-2)', borderRadius: 'var(--radius)',
                border: `1px solid ${outcomeColor(run.outcome)}`, whiteSpace: 'pre-wrap',
              }}>
                {run.finalMessage}
              </div>
            </div>
          )}

          {/* Error */}
          {run.error && (
            <div style={{
              padding: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--red)',
            }}>
              {run.error}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

// ─── Run Card ──────────────────────────────────────────────────────

function AiRunCard({ run, onClick }: { run: AiRunListItem; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="feature-card feature-card-lift"
      style={{
        display: 'flex', flexDirection: 'column', gap: 12,
        padding: 18, border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)',
        background: 'var(--bg-1)', cursor: 'pointer', textAlign: 'left',
        width: '100%',
        transition: 'border-color 150ms, background 150ms, transform 150ms',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--bg-2)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.background = 'var(--bg-1)'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
        <span style={{
          fontSize: 11, padding: '2px 8px', borderRadius: 4,
          background: `${outcomeColor(run.outcome)}15`, color: outcomeColor(run.outcome),
          fontWeight: 600, fontFamily: 'var(--mono)',
        }}>
          {outcomeLabel(run.outcome)}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
          {relativeTime(run.createdAt)}
        </span>
      </div>
      <div style={{
        fontSize: 13.5, color: 'var(--text)', lineHeight: 1.5,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        minHeight: 40,
      }}>
        {run.prompt}
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: 10, borderTop: '1px solid var(--line)', width: '100%',
        fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--mono)',
      }}>
        <span>Duration</span>
        <span style={{ color: 'var(--text)', fontWeight: 500 }}>{formatDuration(run.durationMs)}</span>
      </div>
    </button>
  );
}

// ─── Empty State ───────────────────────────────────────────────────

function AiRunsEmptyState() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '64px 24px', border: '2px dashed var(--line)', borderRadius: 'var(--radius-lg)',
      textAlign: 'center',
    }}>
      <Icons.Zap size={32} style={{ color: 'var(--text-3)', marginBottom: 16 }} />
      <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 8 }}>No AI runs yet</div>
      <div style={{ fontSize: 13, color: 'var(--text-3)', maxWidth: 360 }}>
        Use the AI Agent prompt on the dashboard to create or manage load balancers with natural language. Every run, its steps and its outcome will appear here.
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────

export default function AiRunsPage() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();

  const [runs, setRuns] = useState<AiRunListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [showDetailUpsell, setShowDetailUpsell] = useState(false);

  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  const fetchRuns = useCallback(async (reset = false) => {
    if (reset) setLoading(true);
    else setLoadingMore(true);
    try {
      const res = await api.getAiRuns({
        cursor: reset ? undefined : (nextCursor ?? undefined),
        limit: 20,
      });
      const { runs: fetched, nextCursor: cursor, hasMore: more } = res.data;
      setRuns(prev => reset ? fetched : [...prev, ...fetched]);
      setNextCursor(cursor);
      setHasMore(more);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load AI runs');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [nextCursor]);

  useEffect(() => {
    if (user) fetchRuns(true);
  }, [user]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loadingMore && !loading) {
          fetchRuns(false);
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, fetchRuns]);

  const handleNav = (id: string) => {
    if (id === 'overview') router.push('/overview');
    if (id === 'gateways') router.push('/gateways');
    else if (id === 'balancers') router.push('/loadbalancers');
    else if (id === 'settings') router.push('/settings');
    else if (id === 'sessions') router.push('/sessions');
    else if (id === 'pro') router.push('/pro');
    else if (id === 'payments') router.push('/payments');
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  if (authLoading || !user) return null;

  // Free plan sees the history list; the per-run detail (conversation, outcome) is Pro-only.
  const isPro = !!user?.isPro;
  const openRun = (runId: string) => {
    if (isPro) setSelectedRunId(runId);
    else setShowDetailUpsell(true);
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="app-shell" style={{ height: '100%', minHeight: 0, overflow: 'hidden' }}>
        <Sidebar
          current="ai-runs"
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
        <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100%' }}>
          <Topbar
            crumbs={['Overview', 'AI Runs']}
            title="AI Runs"
            subtitle="History of every AI Agent request, its steps and its outcome"
          />
          <div className="no-scrollbar" style={{ padding: 'clamp(16px, 4vw, 32px)', overflowY: 'auto', flex: 1, minHeight: 0, scrollBehavior: 'smooth' }}>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
                <div style={{
                  width: 28, height: 28, border: '3px solid var(--line)',
                  borderTopColor: 'var(--accent)', borderRadius: '50%',
                  animation: 'spin 0.9s linear infinite',
                }} />
              </div>
            ) : runs.length === 0 ? (
              <AiRunsEmptyState />
            ) : (
              <>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  marginBottom: 'clamp(16px, 3vw, 24px)', fontSize: 13, color: 'var(--text-3)',
                }}>
                  <span style={{ fontFamily: 'var(--mono)' }}>{runs.length} runs</span>
                </div>
                <div
                  className="dash-cards"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))',
                    gap: 16,
                  }}
                >
                  {runs.map(run => (
                    <AiRunCard key={run._id} run={run} onClick={() => openRun(run._id)} />
                  ))}
                </div>
                <div ref={sentinelRef} style={{ height: 1 }} />
                {loadingMore && (
                  <div style={{ textAlign: 'center', padding: 16, fontSize: 13, color: 'var(--text-3)' }}>
                    Loading more…
                  </div>
                )}
                {!hasMore && runs.length > 0 && (
                  <div style={{ textAlign: 'center', padding: 16, fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
                    — end of history —
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {showDetailUpsell && (
        <Modal isOpen onClose={() => setShowDetailUpsell(false)} title="AI Run Details" size="sm">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 0 8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Icons.Lock size={15} style={{ color: 'var(--text-3)' }} />
              <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
                Run details are a Pro feature — the list stays free.
              </span>
            </div>
            <Link href="/pro" style={{ alignSelf: 'flex-end' }}>
              <button className="btn btn-primary btn-sm">Upgrade to Pro</button>
            </Link>
          </div>
        </Modal>
      )}

      {selectedRunId && (
        <AiRunDetailModal runId={selectedRunId} onClose={() => setSelectedRunId(null)} />
      )}
    </div>
  );
}
