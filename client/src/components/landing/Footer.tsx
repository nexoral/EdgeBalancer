'use client';

import { useState, useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export function Footer() {
  const [status, setStatus] = useState<'ok' | 'down' | 'loading'>('loading');

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(5000) });
        const data = await res.json();
        setStatus(data.status === 'ok' ? 'ok' : 'down');
      } catch {
        setStatus('down');
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 60000);
    return () => clearInterval(interval);
  }, []);

  const statusText = status === 'loading' ? 'checking...' : status === 'ok' ? '● operational' : '● degraded';
  const statusColor = status === 'ok' ? 'var(--green)' : status === 'down' ? 'var(--red)' : 'var(--text-3)';

  return (
    <footer className="w-full border-t border-[var(--line)] bg-[var(--surface,var(--bg-1))]/50 transition-colors">
      <div className="w-full px-6 sm:px-10 lg:px-16 py-12 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-10">
        <div>
          <div className="font-mono text-sm font-bold text-[var(--text)] tracking-tight">EdgeBalancer</div>
          <div className="text-xs text-[var(--text-3)] mt-2.5 leading-relaxed max-w-sm">
            Control plane for Cloudflare Worker load balancers & API gateways. Deploy across 330+ edge locations in 60 seconds.
          </div>
          <div className="mt-4 font-mono text-xs text-[var(--text-3)]">
            Status: <span style={{ color: statusColor }}>{statusText}</span>
          </div>
        </div>

        <div>
          <div className="font-mono text-xs font-semibold text-[var(--text)] uppercase tracking-wider mb-3">Product</div>
          <div className="flex flex-col gap-2.5 text-xs text-[var(--text-3)]">
            <a href="/features" className="hover:text-[var(--text)] transition-colors">Features</a>
            <a href="/strategies" className="hover:text-[var(--text)] transition-colors">Strategies</a>
            <a href="/pricing" className="hover:text-[var(--text)] transition-colors">Pricing</a>
            <a href="/stats" className="hover:text-[var(--text)] transition-colors">Stats</a>
          </div>
        </div>

        <div>
          <div className="font-mono text-xs font-semibold text-[var(--text)] uppercase tracking-wider mb-3">Resources</div>
          <div className="flex flex-col gap-2.5 text-xs text-[var(--text-3)]">
            <a href="/blog" className="hover:text-[var(--text)] transition-colors">Blog</a>
            <a href="/testimonials" className="hover:text-[var(--text)] transition-colors">Testimonials</a>
            <a href="/faq" className="hover:text-[var(--text)] transition-colors">FAQ</a>
            <a href="/about" className="hover:text-[var(--text)] transition-colors">About</a>
            <a href="/developers" className="hover:text-[var(--text)] transition-colors">Developers</a>
            <a href="/security" className="hover:text-[var(--text)] transition-colors">Security</a>
            <a href="/contact" className="hover:text-[var(--text)] transition-colors">Contact</a>
          </div>
        </div>

        <div>
          <div className="font-mono text-xs font-semibold text-[var(--text)] uppercase tracking-wider mb-3">Legal</div>
          <div className="flex flex-col gap-2.5 text-xs text-[var(--text-3)]">
            <a href="/terms" className="hover:text-[var(--text)] transition-colors">Terms</a>
            <a href="/privacy" className="hover:text-[var(--text)] transition-colors">Privacy</a>
            <a href="/refund" className="hover:text-[var(--text)] transition-colors">Refund</a>
            <a href="/cancellation" className="hover:text-[var(--text)] transition-colors">Cancellation</a>
          </div>
        </div>
      </div>

      <div className="w-full px-6 sm:px-10 lg:px-16 py-4 border-t border-[var(--line)] flex justify-between flex-wrap gap-4 font-mono text-[11px] text-[var(--text-3)] uppercase tracking-wider">
        <div>&copy; 2026 Nexoral — EdgeBalancer</div>
        <div>Built on Cloudflare Workers · 330+ PoPs</div>
      </div>
    </footer>
  );
}
