'use client';

import { Icons } from '@/components/shared/Icons';
import type { Session } from '@/types/api';
import Link from 'next/link';

interface SessionCardProps {
  session: Session;
  onDownload: () => void;
  isDownloading?: boolean;
  canDownload?: boolean;
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

export const SessionCard = ({ session, onDownload, isDownloading, canDownload }: SessionCardProps) => {
  const fullDomain = session.subdomain
    ? `${session.subdomain}.${session.domain}`
    : session.domain;

  return (
    <div className="feature-card feature-card-lift p-5 flex flex-col gap-3.5">
      <div className="flex justify-between items-start gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span
              className={`chip ${session.isActive ? 'live' : ''}`}
              style={!session.isActive ? { color: 'var(--text-3)', background: 'var(--bg-2)' } : undefined}
            >
              {session.isActive ? 'active' : 'inactive'}
            </span>
            <span className="chip mono uppercase">
              {session.actionType}
            </span>
          </div>
          <div className="font-mono text-[15px] font-semibold text-[var(--text)] tracking-tight truncate">
            {session.loadBalancerName}
          </div>
          <div className="font-mono text-xs text-[var(--text-3)] mt-1 truncate">
            {fullDomain}
          </div>
        </div>
        <div className="text-[var(--text-3)] shrink-0 font-mono text-xs">
          {relativeTime(session.createdAt)}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 pt-3.5 border-t border-[var(--line)]">
        {[
          { l: 'Strategy', v: session.strategy },
          { l: 'Action', v: session.actionType },
          { l: 'Date', v: new Date(session.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) },
        ].map((s, i) => (
          <div key={i}>
            <div className="kicker text-[10px]">{s.l}</div>
            <div className="mono text-xs font-medium mt-1 truncate text-[var(--text)]">{s.v}</div>
          </div>
        ))}
      </div>

      {session.isActive && (
        <div className="pt-2.5 border-t border-[var(--line)]">
          {!canDownload ? (
            <Link href="/pro">
              <button className="btn btn-ghost btn-sm">
                <Icons.Lock size={13} />
                <span>Upgrade to download</span>
              </button>
            </Link>
          ) : (
            <button
              onClick={onDownload}
              disabled={isDownloading}
              className="btn btn-ghost btn-sm"
              style={{ opacity: isDownloading ? 0.5 : 1 }}
            >
              <Icons.Download size={13} />
              <span>{isDownloading ? 'Fetching…' : 'Download Script'}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export const SessionsEmptyState = () => (
  <div className="max-w-lg mx-auto my-16 text-center p-8 sm:p-12 border-2 border-dashed border-[var(--line-2)] rounded-2xl bg-[var(--surface,var(--bg-1))] shadow-sm">
    <div className="w-14 h-14 mx-auto mb-6 rounded-2xl border border-[var(--line-2)] bg-[var(--bg-2)] flex items-center justify-center text-[var(--accent)] shadow-sm">
      <Icons.History size={24} />
    </div>
    <h2 className="text-xl font-bold tracking-tight text-[var(--text)]">No sessions yet</h2>
    <p className="text-sm text-[var(--text-3)] mt-2 leading-relaxed">
      Sessions are recorded automatically when you create or edit a load balancer.
    </p>
  </div>
);
