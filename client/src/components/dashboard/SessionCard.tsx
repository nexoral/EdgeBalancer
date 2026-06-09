'use client';

import { Icons } from '@/components/shared/Icons';
import type { Session } from '@/types/api';

interface SessionCardProps {
  session: Session;
  onDownload: () => void;
  isDownloading?: boolean;
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export const SessionCard = ({ session, onDownload, isDownloading }: SessionCardProps) => {
  const fullDomain = session.subdomain
    ? `${session.subdomain}.${session.domain}`
    : session.domain;

  return (
    <div style={{
      background: 'var(--bg-1)', border: '1px solid var(--line)',
      borderRadius: 'var(--radius-lg)', padding: 20,
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
            <span className={`chip ${session.isActive ? 'live' : ''}`}
              style={!session.isActive ? { color: 'var(--text-3)', background: 'var(--bg-2)' } : undefined}>
              {session.isActive ? 'active' : 'inactive'}
            </span>
            <span className="chip mono" style={{ textTransform: 'uppercase' }}>
              {session.actionType}
            </span>
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 15, fontWeight: 500, letterSpacing: '-0.01em' }}>
            {session.loadBalancerName}
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
            {fullDomain}
          </div>
        </div>
        <div style={{ color: 'var(--text-3)', flexShrink: 0, fontFamily: 'var(--mono)', fontSize: 11 }}>
          {relativeTime(session.createdAt)}
        </div>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12,
        paddingTop: 14, borderTop: '1px solid var(--line)',
      }}>
        {[
          { l: 'Strategy', v: session.strategy },
          { l: 'Action', v: session.actionType },
          { l: 'Date', v: new Date(session.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) },
        ].map((s, i) => (
          <div key={i}>
            <div className="kicker" style={{ fontSize: 10 }}>{s.l}</div>
            <div className="mono" style={{ fontSize: 12, marginTop: 4, fontWeight: 500 }}>{s.v}</div>
          </div>
        ))}
      </div>

      {session.isActive && (
        <div style={{ paddingTop: 8, borderTop: '1px solid var(--line)' }}>
          <button
            onClick={onDownload}
            disabled={isDownloading}
            className="btn btn-ghost btn-sm"
            style={{ opacity: isDownloading ? 0.5 : 1 }}>
            <Icons.Download size={13} />
            {isDownloading ? 'Fetching…' : 'Download Script'}
          </button>
        </div>
      )}
    </div>
  );
};

export const SessionsEmptyState = () => (
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
      <Icons.History size={24} stroke="var(--accent)" />
    </div>
    <h2 style={{ fontSize: 20, margin: 0, letterSpacing: '-0.02em' }}>No sessions yet</h2>
    <p style={{ color: 'var(--text-3)', fontSize: 14, marginTop: 8, lineHeight: 1.6 }}>
      Sessions are recorded automatically when you create or edit a load balancer.
    </p>
  </div>
);
