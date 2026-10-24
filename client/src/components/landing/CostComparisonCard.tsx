'use client';

import { useState } from 'react';
import { Icons } from '@/components/shared/Icons';

export function CostComparisonCard() {
  const [balancerCount, setBalancerCount] = useState<number>(3);

  // Traditional ALB costs ~$25/month base fee per balancer + LCU data costs (~$15/mo) = ~$40/mo per balancer
  const traditionalCost = balancerCount * 40;
  const edgeBalancerCost = 0; // Free tier covers up to 5 balancers with 100k requests/day
  const annualSavings = traditionalCost * 12;

  return (
    <div className="feature-card overflow-hidden shadow-[0_24px_70px_rgba(0,0,0,0.12)] dark:shadow-[0_28px_80px_rgba(0,0,0,0.6)] w-full">
      {/* Top Header Strip */}
      <div className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--bg-2)]/70 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[var(--green)] shadow-[0_0_8px_var(--green)] animate-pulse" />
          <span className="font-mono text-xs font-semibold text-[var(--text)] tracking-tight">INFRASTRUCTURE COST ANALYSIS</span>
        </div>
        <span className="chip live text-[10px] py-0.5 px-2.5 font-mono">BEST FOR STARTUPS</span>
      </div>

      <div className="p-5 sm:p-6 space-y-6">
        {/* Interactive Balancer Scale Selector */}
        <div className="p-4 rounded-xl border border-[var(--line)] bg-[var(--bg-2)]/60 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-[var(--text-3)] font-semibold">Fleet Size Comparison</div>
            <div className="text-sm font-semibold text-[var(--text)] mt-0.5">How many load balancers or gateways?</div>
          </div>
          <div className="flex items-center gap-1.5 bg-[var(--bg-1)] p-1 rounded-xl border border-[var(--line)]">
            {[1, 3, 5].map((count) => (
              <button
                key={count}
                onClick={() => setBalancerCount(count)}
                className={`px-3 py-1 text-xs font-mono font-semibold rounded-lg transition-all ${
                  balancerCount === count
                    ? 'bg-[var(--accent)] text-white shadow-xs'
                    : 'text-[var(--text-3)] hover:text-[var(--text)]'
                }`}
              >
                {count} {count === 1 ? 'Balancer' : 'Balancers'}
              </button>
            ))}
          </div>
        </div>

        {/* Side-by-Side Comparison Bento Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Traditional Cloud Load Balancer (AWS ALB / GCP / DNS) */}
          <div className="p-4 sm:p-5 rounded-2xl border border-[rgba(255,59,48,0.25)] bg-[rgba(255,59,48,0.03)] flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--red)] font-semibold">Traditional Cloud LB</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[rgba(255,59,48,0.12)] text-[var(--red)]">AWS / GCP / DNS</span>
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-bold font-mono text-[var(--text)]">
                  ${traditionalCost}<span className="text-xs font-normal text-[var(--text-3)]">/month</span>
                </div>
                <div className="text-xs text-[var(--text-3)] mt-1 font-mono">Billed 24/7 even at zero traffic</div>
              </div>

              <div className="mt-4 pt-4 border-t border-[rgba(255,59,48,0.15)] space-y-2.5 text-xs">
                <div className="flex items-center gap-2 text-[var(--text-2)]">
                  <span className="text-[var(--red)] font-bold">✕</span>
                  <span><strong>$25/mo base fee</strong> per balancer</span>
                </div>
                <div className="flex items-center gap-2 text-[var(--text-2)]">
                  <span className="text-[var(--red)] font-bold">✕</span>
                  <span>Single region (120ms+ global latency)</span>
                </div>
                <div className="flex items-center gap-2 text-[var(--text-2)]">
                  <span className="text-[var(--red)] font-bold">✕</span>
                  <span>Complex VPC &amp; target group setup</span>
                </div>
                <div className="flex items-center gap-2 text-[var(--text-2)]">
                  <span className="text-[var(--red)] font-bold">✕</span>
                  <span>Per-query DNS lookup charges</span>
                </div>
              </div>
            </div>

            <div className="pt-2 text-[11px] font-mono text-[var(--text-3)]">
              Cost for 1 year: <span className="text-[var(--red)] font-bold">${traditionalCost * 12}</span>
            </div>
          </div>

          {/* EdgeBalancer (Cloudflare Worker Serverless) */}
          <div className="p-4 sm:p-5 rounded-2xl border-2 border-[var(--accent)] bg-[var(--surface,var(--bg-1))] flex flex-col justify-between space-y-4 shadow-md relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-gradient-to-l from-[var(--accent)] to-[var(--green)] text-white text-[9px] font-mono font-bold uppercase tracking-wider px-3 py-1 rounded-bl-xl shadow-xs">
              Recommended
            </div>

            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--accent)] font-semibold">EdgeBalancer</span>
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-bold font-mono text-[var(--green)]">
                  $0<span className="text-xs font-normal text-[var(--text-3)]">/month</span>
                </div>
                <div className="text-xs text-[var(--green)] font-semibold mt-1 font-mono">Free tier includes 5 balancers</div>
              </div>

              <div className="mt-4 pt-4 border-t border-[var(--line)] space-y-2.5 text-xs">
                <div className="flex items-center gap-2 text-[var(--text)] font-medium">
                  <Icons.Check size={14} stroke="var(--green)" />
                  <span><strong>$0 base cost</strong> (100k req/day free)</span>
                </div>
                <div className="flex items-center gap-2 text-[var(--text)] font-medium">
                  <Icons.Check size={14} stroke="var(--green)" />
                  <span><strong>330+ PoPs</strong> edge routing (~14ms)</span>
                </div>
                <div className="flex items-center gap-2 text-[var(--text)] font-medium">
                  <Icons.Check size={14} stroke="var(--green)" />
                  <span><strong>60 seconds</strong> no-code deployment</span>
                </div>
                <div className="flex items-center gap-2 text-[var(--text)] font-medium">
                  <Icons.Check size={14} stroke="var(--green)" />
                  <span>Zero per-query DNS penalty</span>
                </div>
              </div>
            </div>

            <div className="pt-2 text-[11px] font-mono text-[var(--green)] font-semibold">
              You save: <span className="font-bold">${annualSavings}/year</span>
            </div>
          </div>
        </div>

        {/* Why it's the Best Starting Position Callout Banner */}
        <div className="p-4 rounded-xl border border-[var(--line)] bg-[var(--bg-2)]/60 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--green-dim)] text-[var(--green)] flex items-center justify-center shrink-0 mt-0.5">
            <Icons.Zap size={16} />
          </div>
          <div>
            <div className="text-xs font-semibold text-[var(--text)] tracking-tight">The Ideal Starting Position for New Projects</div>
            <div className="text-xs text-[var(--text-2)] mt-1 leading-relaxed">
              Startups and early teams shouldn&apos;t burn budget on idle cloud load balancer base fees. EdgeBalancer deploys serverless Workers that cost nothing when traffic is quiet, and automatically scales across 330+ cities worldwide when traffic surges.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
