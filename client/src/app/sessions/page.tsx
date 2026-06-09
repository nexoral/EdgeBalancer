'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { Sidebar, Topbar } from '@/components/dashboard/Sidebar';
import { SessionCard, SessionsEmptyState } from '@/components/dashboard/SessionCard';
import type { Session } from '@/types/api';
import toast from 'react-hot-toast';

type Filter = 'all' | 'active' | 'inactive';

export default function SessionsPage() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<Filter>('all');
  filterRef.current = filter;

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (!authLoading && user && !user.hasCloudflareCredentials) {
      router.push('/onboarding');
      return;
    }
    if (user) fetchSessions(true);
  }, [user, authLoading]);

  const fetchSessions = useCallback(async (reset = false) => {
    const currentFilter = filterRef.current;
    if (reset) setLoading(true);
    else setLoadingMore(true);

    try {
      const response = await api.getSessions({
        filter: currentFilter,
        cursor: reset ? undefined : (nextCursor ?? undefined),
        limit: 20,
      });

      if (response.success && response.data) {
        const { sessions: fetched, nextCursor: cursor, hasMore: more } = response.data;
        setSessions(prev => reset ? fetched : [...prev, ...fetched]);
        setNextCursor(cursor);
        setHasMore(more);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to fetch sessions');
    } finally {
      if (reset) setLoading(false);
      else setLoadingMore(false);
    }
  }, [nextCursor]);

  // Reset and re-fetch when filter changes
  useEffect(() => {
    if (!user) return;
    setNextCursor(null);
    setHasMore(false);
    setSessions([]);
    fetchSessions(true);
  }, [filter]);

  // Infinite scroll sentinel observer
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loadingMore && !loading) {
          fetchSessions(false);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, fetchSessions]);

  const handleDownload = async (session: Session) => {
    setDownloadingId(session._id);
    try {
      const response = await api.getSessionScript(session._id);
      if (response.success && response.data?.content) {
        const blob = new Blob([response.data.content], { type: 'text/javascript' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `worker-${session.loadBalancerName}.js`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to download script');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleNav = (id: string) => {
    if (id === 'balancers') router.push('/dashboard');
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

  const filterLabels: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'inactive', label: 'Inactive' },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)', flexDirection: 'column' }}>
      <div style={{ display: 'flex', flex: 1, minHeight: 0, flexDirection: 'row' }}>
        <Sidebar
          current="sessions"
          onNav={handleNav}
          onLogout={handleLogout}
          userEmail={user?.email}
        />
        <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Topbar
            crumbs={['Dashboard', 'Sessions']}
            title="Sessions"
            subtitle="History of load balancer deployments and edits"
          />
          <div style={{ padding: 'clamp(16px, 4vw, 32px)', overflow: 'auto', flex: 1 }}>
            {/* Filter row */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 'clamp(16px, 3vw, 24px)', flexWrap: 'wrap' }}>
              {filterLabels.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className="btn btn-sm"
                  style={{
                    background: filter === key ? 'var(--bg-2)' : 'transparent',
                    color: filter === key ? 'var(--text)' : 'var(--text-3)',
                    border: '1px solid var(--line)',
                    fontSize: 'clamp(12px, 2vw, 13px)',
                    padding: 'clamp(6px, 1vw, 8px) clamp(10px, 2vw, 12px)',
                  }}>
                  {label}
                </button>
              ))}
              <div style={{ flex: 1 }} />
              {sessions.length > 0 && (
                <div className="kicker hide-sm" style={{ fontSize: 'clamp(9px, 2vw, 11px)', alignSelf: 'center' }}>
                  {sessions.length} session{sessions.length !== 1 ? 's' : ''} loaded
                </div>
              )}
            </div>

            {/* List */}
            {sessions.length === 0 && !loading ? (
              <SessionsEmptyState />
            ) : (
              <>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))',
                  gap: 'clamp(12px, 2vw, 16px)',
                }}>
                  {sessions.map(session => (
                    <SessionCard
                      key={session._id}
                      session={session}
                      onDownload={() => handleDownload(session)}
                      isDownloading={downloadingId === session._id}
                    />
                  ))}
                </div>

                {/* Infinite scroll sentinel */}
                <div ref={sentinelRef} style={{ height: 1 }} />

                {loadingMore && (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-3)', fontSize: 13 }}>
                    Loading more…
                  </div>
                )}

                {!hasMore && sessions.length > 0 && (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 11 }}>
                    — end of sessions —
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
