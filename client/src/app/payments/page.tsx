'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Sidebar, Topbar } from '@/components/dashboard/Sidebar';
import { Icons } from '@/components/shared/Icons';
import { api } from '@/lib/api';
import type { PaymentHistory as Payment } from '@/types/api';

const STATUS_COLORS: Record<string, string> = {
  SUCCESS: 'var(--green)',
  PENDING: 'var(--accent)',
  FAILED: 'var(--red)',
  EXPIRED: 'var(--text-3)',
};

export default function PaymentsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [currentNav, setCurrentNav] = useState('payments');
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  const fetchPayments = useCallback(async (cursor?: string) => {
    try {
      const res = await api.getPaymentHistory({ cursor, limit: 20 });
      if (res.success && res.data) {
        setPayments(prev => cursor ? [...prev, ...res.data.payments] : res.data.payments);
        setNextCursor(res.data.nextCursor);
        setHasMore(res.data.hasMore);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user) fetchPayments();
  }, [user, fetchPayments]);

  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && nextCursor) {
          fetchPayments(nextCursor);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, nextCursor, fetchPayments]);

  const handleNav = (id: string) => {
    if (id === 'overview') router.push('/overview');
    else if (id === 'gateways') router.push('/gateways');
    else if (id === 'balancers') router.push('/loadbalancers');
    else if (id === 'settings') router.push('/settings');
    else if (id === 'sessions') router.push('/sessions');
    else if (id === 'ai-runs') router.push('/ai-runs');
    else if (id === 'payments') router.push('/payments');
    else if (id === 'pro') router.push('/pro');
    else router.push('/loadbalancers');
  };

  if (authLoading || !user) return null;

  return (
    <div className="app-shell">
      <Sidebar
        current={currentNav}
        onNav={handleNav}
        onLogout={() => { }}
        userEmail={user.email}
        hasCloudflareCredentials={user.hasCloudflareCredentials}
        cloudflareOAuthConnected={user.cloudflareOAuthConnected}
        isReady={!!user.hasCloudflareCredentials}
        isPro={user.isPro}
        plan={user.plan}
        planExpiresAt={user.planExpiresAt}
      />
      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Topbar
          crumbs={['Overview', 'Payment History']}
          title="Payment History"
          subtitle="Your EdgeBalancer Pro payment records"
        />
        <div style={{ padding: 'clamp(16px, 4vw, 32px)', overflow: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>Loading...</div>
          ) : payments.length === 0 ? (
            <div style={{
              maxWidth: 480, margin: '80px auto', textAlign: 'center',
              padding: 48, border: '1px dashed var(--line-2)', borderRadius: 'var(--radius-lg)',
              background: 'var(--bg-1)',
            }}>
              <div style={{
                width: 64, height: 64, margin: '0 auto 24px',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--line-2)', background: 'var(--bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icons.CreditCard size={24} stroke="var(--accent)" />
              </div>
              <h2 style={{ fontSize: 20, margin: 0, letterSpacing: '-0.02em' }}>No payments yet</h2>
              <p style={{ color: 'var(--text-3)', fontSize: 14, marginTop: 8, lineHeight: 1.6 }}>
                Your payment history will appear here after you upgrade to Pro.
              </p>
              <button
                onClick={() => router.push('/pro')}
                className="btn btn-primary btn-sm"
                style={{ marginTop: 16 }}
              >
                View Pro Plans
              </button>
            </div>
          ) : (
            <div className="dash-cards" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
              gap: 12,
            }}>
              {payments.map((p) => (
                <div key={p.orderId} style={{
                  background: 'var(--bg-1)', border: '1px solid var(--line)',
                  borderRadius: 'var(--radius-lg)', padding: 20,
                  display: 'flex', flexDirection: 'column', gap: 14,
                }}>
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{
                          fontSize: 11, fontFamily: 'var(--mono)',
                          padding: '2px 8px', borderRadius: 999,
                          background: `${STATUS_COLORS[p.status]}15`,
                          color: STATUS_COLORS[p.status],
                          border: `1px solid ${STATUS_COLORS[p.status]}40`,
                          fontWeight: 600,
                        }}>
                          {p.status}
                        </span>
                      </div>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 500 }}>
                        ₹{p.amount}
                      </div>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                        {p.orderId}
                      </div>
                    </div>
                    <div style={{ color: 'var(--text-3)', flexShrink: 0, fontFamily: 'var(--mono)', fontSize: 11 }}>
                      {new Date(p.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </div>
                  </div>

                  {/* Details grid */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12,
                    paddingTop: 14, borderTop: '1px solid var(--line)',
                  }}>
                    <div>
                      <div className="kicker" style={{ fontSize: 10 }}>Amount</div>
                      <div className="mono" style={{ fontSize: 12, marginTop: 4, fontWeight: 500 }}>₹{p.amount}</div>
                    </div>
                    <div>
                      <div className="kicker" style={{ fontSize: 10 }}>Status</div>
                      <div className="mono" style={{ fontSize: 12, marginTop: 4, fontWeight: 500, color: STATUS_COLORS[p.status] }}>{p.status}</div>
                    </div>
                    <div>
                      <div className="kicker" style={{ fontSize: 10 }}>Date</div>
                      <div className="mono" style={{ fontSize: 12, marginTop: 4, fontWeight: 500 }}>
                        {new Date(p.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                  </div>

                  {/* Pro expiry */}
                  {p.expiresAt && p.status === 'SUCCESS' && (
                    <div style={{ fontSize: 11, color: 'var(--text-3)', paddingTop: 8, borderTop: '1px solid var(--line)' }}>
                      Pro until: {new Date(p.expiresAt).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </div>
                  )}
                </div>
              ))}
              {hasMore && <div ref={sentinelRef} style={{ height: 1 }} />}
              {hasMore && (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 12, color: 'var(--text-3)', fontSize: 12 }}>
                  Loading more...
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
