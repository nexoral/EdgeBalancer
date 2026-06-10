'use client';

import { Icons } from '@/components/shared/Icons';
import type { LoadBalancer, LoadBalancerAnalytics } from '@/types/api';

interface LoadBalancerCardProps {
  lb: LoadBalancer;
  analytics: LoadBalancerAnalytics | null | 'loading';
  onSelect: () => void;
  onDelete: () => void;
  onPause: () => void;
  onResume: () => void;
  isDeleting?: boolean;
  isActioning?: boolean;
}

function formatRequests(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export const LoadBalancerCard = ({
  lb,
  analytics,
  onSelect,
  onDelete,
  onPause,
  onResume,
  isDeleting,
  isActioning
}: LoadBalancerCardProps) => {
  const getStatusColor = () => {
    if (lb.status === 'active') return 'live';
    if (lb.status === 'paused') return 'warn';
    return 'down';
  };

  return (
    <div onClick={onSelect} style={{
      textAlign: 'left', width: '100%',
      background: 'var(--bg-1)', border: '1px solid var(--line)',
      borderRadius: 'var(--radius-lg)', padding: 20,
      display: 'flex', flexDirection: 'column', gap: 16,
      transition: 'all 160ms', cursor: 'pointer',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.borderColor = 'var(--line-2)';
      e.currentTarget.style.background = 'var(--bg-2)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.borderColor = 'var(--line)';
      e.currentTarget.style.background = 'var(--bg-1)';
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span className={`chip ${getStatusColor()}`}>{lb.status}</span>
            <span className="chip mono" style={{ textTransform: 'uppercase' }}>{lb.strategy}</span>
          </div>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 15, fontWeight: 500,
            letterSpacing: '-0.01em',
          }}>{lb.name}</div>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-3)',
            marginTop: 4,
          }}>{lb.fullDomain}</div>
        </div>
        <div style={{ color: 'var(--text-3)' }}>
          <Icons.MoreV size={16} />
        </div>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12,
        paddingTop: 16, borderTop: '1px solid var(--line)',
      }}>
        {[
          { l: 'Origins', v: lb.originCount, color: 'var(--text)' },
          { l: 'Created', v: new Date(lb.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), color: 'var(--text)' },
          { l: 'Status', v: lb.status, color: lb.status === 'active' ? 'var(--green)' : 'var(--accent)' },
          { l: 'Type', v: lb.strategy.split('-')[0], color: 'var(--text)' },
        ].map((s, i) => (
          <div key={i}>
            <div className="kicker" style={{ fontSize: 10 }}>{s.l}</div>
            <div className="mono" style={{ fontSize: 13, color: s.color, marginTop: 4, fontWeight: 500 }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Analytics row */}
      {analytics === 'loading' ? (
        <div style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
          {[80, 56].map((w, i) => (
            <div key={i} style={{
              height: 11, width: w, background: 'var(--bg-3)',
              borderRadius: 4, animation: 'pulse 1.5s ease-in-out infinite',
            }} />
          ))}
        </div>
      ) : analytics ? (
        <div style={{
          paddingTop: 10, borderTop: '1px solid var(--line)',
          fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-3)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span>24h: <span style={{ color: 'var(--text-2)' }}>{formatRequests(analytics.requests)}</span> req</span>
          <span style={{ color: analytics.errorRate > 5 ? 'var(--red)' : 'var(--text-3)' }}>
            {analytics.errorRate.toFixed(1)}% err
          </span>
        </div>
      ) : null}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, paddingTop: 8, borderTop: '1px solid var(--line)' }}>
        {lb.status === 'active' && (
          <button
            onClick={(e) => { e.stopPropagation(); onPause(); }}
            disabled={isActioning || isDeleting}
            className="btn btn-ghost btn-sm"
            style={{ flex: 1, opacity: (isActioning || isDeleting) ? 0.5 : 1 }}>
            Pause
          </button>
        )}
        {lb.status === 'paused' && (
          <button
            onClick={(e) => { e.stopPropagation(); onResume(); }}
            disabled={isActioning || isDeleting}
            className="btn btn-ghost btn-sm"
            style={{ flex: 1, opacity: (isActioning || isDeleting) ? 0.5 : 1 }}>
            Resume
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          disabled={isActioning || isDeleting}
          className="btn btn-ghost btn-sm"
          style={{ flex: 1, color: 'var(--red)', opacity: (isActioning || isDeleting) ? 0.5 : 1 }}>
          {isDeleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </div>
  );
};

export const EmptyState = ({ onCreate }: { onCreate: () => void }) => (
  <div style={{
    maxWidth: 520, margin: '80px auto', textAlign: 'center',
    padding: 48, border: '1px dashed var(--line-2)', borderRadius: 'var(--radius-lg)',
    background: 'var(--bg-1)',
  }}>
    <div style={{
      width: 64, height: 64, margin: '0 auto 24px',
      borderRadius: 'var(--radius)',
      border: '1px solid var(--line-2)', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative',
    }}>
      <Icons.Layers size={24} stroke="var(--accent)" />
      <div style={{
        position: 'absolute', inset: -8,
        border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)',
        pointerEvents: 'none',
      }} />
    </div>
    <h2 style={{ fontSize: 20, margin: 0, letterSpacing: '-0.02em' }}>No load balancers yet</h2>
    <p style={{ color: 'var(--text-3)', fontSize: 14, marginTop: 8, lineHeight: 1.6 }}>
      Create your first load balancer to get started distributing traffic across
      your origin servers.
    </p>
    <button className="btn btn-primary btn-lg" onClick={onCreate} style={{ marginTop: 24 }}>
      <Icons.Plus size={16} /> Create your first load balancer
    </button>

    <div style={{
      marginTop: 32, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 8, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-3)',
      textTransform: 'uppercase', letterSpacing: '0.06em',
    }}>
      <div>1. name</div>
      <div>2. pick zone</div>
      <div>3. add origins</div>
    </div>
  </div>
);
