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
  showAnalytics?: boolean;
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
  isActioning,
  showAnalytics,
}: LoadBalancerCardProps) => {
  const getStatusColor = () => {
    if (lb.status === 'active') return 'live';
    if (lb.status === 'paused') return 'warn';
    return 'down';
  };

  return (
    <div
      onClick={onSelect}
      className="feature-card feature-card-lift text-left w-full p-5 flex flex-col gap-4 cursor-pointer"
    >
      <div className="flex justify-between items-start gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className={`chip ${getStatusColor()}`}>{lb.status}</span>
            <span className="chip mono uppercase">{lb.strategy}</span>
          </div>
          <div className="font-mono text-[15px] font-semibold text-[var(--text)] tracking-tight truncate">
            {lb.name}
          </div>
          <div className="font-mono text-xs text-[var(--text-3)] mt-1 truncate">
            {lb.fullDomain}
          </div>
        </div>
        <div className="text-[var(--text-3)] hover:text-[var(--text)] transition-colors">
          <Icons.MoreV size={16} />
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-4 gap-3 pt-4 border-t border-[var(--line)]">
        {[
          { l: 'Origins', v: lb.originCount, color: 'var(--text)' },
          { l: 'Created', v: new Date(lb.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), color: 'var(--text)' },
          { l: 'Status', v: lb.status, color: lb.status === 'active' ? 'var(--green)' : 'var(--accent)' },
          { l: 'Type', v: lb.strategy.split('-')[0], color: 'var(--text)' },
        ].map((s, i) => (
          <div key={i}>
            <div className="kicker text-[10px]">{s.l}</div>
            <div className="mono text-xs font-semibold mt-1 truncate" style={{ color: s.color }}>
              {s.v}
            </div>
          </div>
        ))}
      </div>

      {lb.healthCheckEnabled && (lb.disabledOriginCount ?? 0) > 0 && (
        <div className="mt-1 p-2.5 rounded-xl bg-[rgba(255,59,48,0.1)] border border-[rgba(255,59,48,0.3)] text-[var(--red)] text-xs flex items-center gap-2 font-medium">
          <Icons.Activity size={14} />
          <span>
            {lb.disabledOriginCount} of {lb.originCount} origin{(lb.originCount ?? 0) === 1 ? '' : 's'} disabled
          </span>
        </div>
      )}

      {/* Analytics row — paid plans only */}
      {!showAnalytics ? (
        <div className="pt-2.5 border-t border-[var(--line)] flex items-center gap-2 font-mono text-[11px] text-[var(--text-3)]">
          <Icons.Lock size={12} />
          <span>Analytics available on paid plans</span>
        </div>
      ) : analytics === 'loading' ? (
        <div className="flex gap-2 pt-3 border-t border-[var(--line)]">
          {[80, 56].map((w, i) => (
            <div
              key={i}
              style={{
                height: 12,
                width: w,
                background: 'var(--bg-3)',
                borderRadius: 4,
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
          ))}
        </div>
      ) : analytics ? (
        <div className="pt-2.5 border-t border-[var(--line)] font-mono text-[11px] text-[var(--text-3)] flex items-center gap-3">
          <span>24h: <span className="text-[var(--text)] font-semibold">{formatRequests(analytics.requests)}</span> req</span>
          <span style={{ color: analytics.errorRate > 5 ? 'var(--red)' : 'var(--text-3)' }}>
            {analytics.errorRate.toFixed(1)}% err
          </span>
        </div>
      ) : null}

      {/* Action buttons */}
      <div className="flex gap-2 pt-2 border-t border-[var(--line)]">
        {lb.status === 'active' && (
          <button
            onClick={(e) => { e.stopPropagation(); onPause(); }}
            disabled={isActioning || isDeleting}
            className="btn btn-ghost btn-sm flex-1"
            style={{ opacity: (isActioning || isDeleting) ? 0.5 : 1 }}
          >
            Pause
          </button>
        )}
        {lb.status === 'paused' && (
          <button
            onClick={(e) => { e.stopPropagation(); onResume(); }}
            disabled={isActioning || isDeleting}
            className="btn btn-ghost btn-sm flex-1"
            style={{ opacity: (isActioning || isDeleting) ? 0.5 : 1 }}
          >
            Resume
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          disabled={isActioning || isDeleting}
          className="btn btn-ghost btn-sm flex-1 text-[var(--red)]"
          style={{ opacity: (isActioning || isDeleting) ? 0.5 : 1 }}
        >
          {isDeleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </div>
  );
};

export const EmptyState = ({ onCreate }: { onCreate: () => void }) => (
  <div className="max-w-lg mx-auto my-16 text-center p-8 sm:p-12 border-2 border-dashed border-[var(--line-2)] rounded-2xl bg-[var(--surface,var(--bg-1))] shadow-sm">
    <div className="w-14 h-14 mx-auto mb-6 rounded-2xl border border-[var(--accent)] bg-[var(--accent-dim)] flex items-center justify-center text-[var(--accent)] shadow-sm">
      <Icons.Layers size={24} />
    </div>
    <h2 className="text-xl font-bold tracking-tight text-[var(--text)]">No load balancers yet</h2>
    <p className="text-sm text-[var(--text-3)] mt-2 leading-relaxed">
      Create your first load balancer to get started distributing traffic across
      your origin servers.
    </p>
    <button className="btn btn-primary btn-lg mt-6" onClick={onCreate}>
      <Icons.Plus size={16} /> <span>Create your first load balancer</span>
    </button>

    <div className="mt-8 grid grid-cols-3 gap-2 font-mono text-[11px] text-[var(--text-3)] uppercase tracking-wider">
      <div>1. name</div>
      <div>2. pick zone</div>
      <div>3. add origins</div>
    </div>
  </div>
);
