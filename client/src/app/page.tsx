import { Icons } from '@/components/shared/Icons';
import { WebSiteSchema, SoftwareApplicationSchema, FAQPageSchema, OrganizationSchema } from '@/components/shared/JsonLd';
import { Nav } from '@/components/landing/Nav';
import { Footer } from '@/components/landing/Footer';
import { ScrollAnimator } from '@/components/landing/ScrollAnimator';
import { CTAButton } from '@/components/landing/CTAButton';
import { HeroStats } from '@/components/landing/HeroStats';
import { CostComparisonCard } from '@/components/landing/CostComparisonCard';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'EdgeBalancer — Deploy Cloudflare Load Balancers & API Gateways in 60 Seconds',
  description: 'No-code control plane for Cloudflare Workers: 7 LB strategies, health checks, and 9 gateway features — JWT, caching, canary, IP rules. Live on 330+ PoPs. Free tier.',
  alternates: { canonical: 'https://edge.nexoral.in' },
  keywords: ['cloudflare workers', 'load balancer', 'api gateway', 'cloudflare load balancing alternative', 'edge computing', 'serverless load balancer'],
};

const FAQS = [
  { question: 'How is this different from Cloudflare Load Balancing?', answer: 'Cloudflare Load Balancing is DNS-based ($5/balancer + per-query). EdgeBalancer deploys as a Worker — request-level control, no per-query costs. 100k req/day free on Cloudflare.' },
  { question: 'What happens if EdgeBalancer goes down?', answer: "Your Workers keep running. Once deployed, the script lives in your Cloudflare account. We're only the control plane — the data plane runs on Cloudflare's edge." },
  { question: 'Can I see the generated code?', answer: 'Yes. Every Worker is visible in your Cloudflare dashboard. Generated from strategy-specific templates — download, review, modify.' },
  { question: 'How do updates work?', answer: 'Cloudflare Worker Versions. New version deployed, old version kept as rollback. Zero-downtime.' },
  { question: 'Do you see my traffic?', answer: 'No. We store only metadata (origins, weights, strategy) encrypted in MongoDB. Traffic flows directly from Cloudflare edge to your origins.' },
];

export default function LandingPage() {
  return (
    <div className="w-full min-h-screen bg-[var(--bg)] text-[var(--text)] transition-colors duration-200">
      <WebSiteSchema />
      <SoftwareApplicationSchema />
      <OrganizationSchema />
      <FAQPageSchema faqs={FAQS} />
      <ScrollAnimator />
      <style>{`
        .pricing-layout { grid-template-columns: repeat(3, 1fr); }
        @media (max-width: 900px) { .pricing-layout { grid-template-columns: 1fr !important; } }
        .features-two-col { grid-template-columns: 1fr 1fr; }
        @media (max-width: 900px) { .features-two-col { grid-template-columns: 1fr !important; } }
        .steps-three { grid-template-columns: repeat(3, 1fr); }
        @media (max-width: 900px) { .steps-three { grid-template-columns: 1fr !important; } }
        .hero-two-col { grid-template-columns: 1.1fr 0.9fr; }
        @media (max-width: 1024px) { .hero-two-col { grid-template-columns: 1fr !important; } }
      `}</style>

      <Nav />

      <main className="w-full">
        {/* Full-width Apple Hero */}
        <section className="hero-two-col grid items-center gap-12 sm:gap-16 w-full px-6 sm:px-10 lg:px-16 xl:px-20 py-16 sm:py-24 lg:py-28">
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[var(--line)] bg-[var(--bg-2)] text-xs font-mono text-[var(--text-2)] mb-6 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-[var(--green)] shadow-[0_0_8px_var(--green)]" />
              <span>Deployed on 330+ Cloudflare Edge PoPs</span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-[var(--text)] leading-[1.05]">
              Load balancers<br />
              &amp; gateways<br />
              <span className="text-[var(--accent)]">in 60 seconds.</span>
            </h1>

            <p className="mt-6 text-base sm:text-lg text-[var(--text-2)] leading-relaxed max-w-2xl">
              Pick origins, pick a strategy. We deploy the Worker directly to your Cloudflare account.
              7 routing strategies, 9 gateway features, health checks. Free to start.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <CTAButton />
              <a href="/stats" className="btn btn-ghost btn-sm">
                <Icons.Activity size={14} />
                <span>Live stats</span>
              </a>
              <a href="/developers" className="btn btn-ghost btn-sm">
                <Icons.Server size={14} />
                <span>API docs</span>
              </a>
            </div>

            <HeroStats />
          </div>

          {/* Cost Comparison Showcase — Traditional Cloud LB vs EdgeBalancer */}
          <div className="w-full">
            <CostComparisonCard />
          </div>
        </section>

        {/* Full-width Proof Metrics Strip */}
        <section className="w-full border-y border-[var(--line)] bg-[var(--surface,var(--bg-1))]/50 backdrop-blur-md px-6 sm:px-10 lg:px-16 xl:px-20 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: '330+', label: 'Cloudflare PoPs Worldwide' },
              { value: '~14ms', label: 'Global p50 Edge Latency' },
              { value: '7', label: 'Edge Routing Strategies' },
              { value: '$0', label: 'Free Tier (Up to 5 Balancers)' },
            ].map((stat) => (
              <div key={stat.label} className="p-2">
                <div className="text-3xl sm:text-4xl font-bold tracking-tight text-[var(--accent)]">{stat.value}</div>
                <div className="mt-1.5 text-xs font-mono uppercase tracking-wider text-[var(--text-3)]">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Full-width How it Works */}
        <section className="w-full px-6 sm:px-10 lg:px-16 xl:px-20 py-20 sm:py-28">
          <div className="mb-14">
            <div className="kicker mb-3">how it works</div>
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-[var(--text)]">
              Three steps. No servers to manage.
            </h2>
          </div>

          <div className="steps-three grid gap-6 sm:gap-8 w-full">
            {[
              { num: '01', title: 'Connect Cloudflare', desc: 'Paste a scoped API token. We encrypt it with AES-256-GCM. Your account, your Workers.' },
              { num: '02', title: 'Pick your setup', desc: 'Choose a load balancer strategy or gateway features. Health checks, JWT, caching — all configurable.' },
              { num: '03', title: 'Deploy to the Edge', desc: 'We push a Worker to your account on 330+ PoPs. Delete the token anytime — Workers keep running.' },
            ].map((step) => (
              <div key={step.num} className="feature-card feature-card-lift p-8">
                <div className="font-mono text-xs font-bold text-[var(--accent)] mb-3">{step.num}</div>
                <h3 className="text-lg font-semibold tracking-tight text-[var(--text)] mb-2">{step.title}</h3>
                <p className="text-sm text-[var(--text-2)] leading-relaxed m-0">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Full-width Features Bento */}
        <section className="w-full border-t border-[var(--line)] px-6 sm:px-10 lg:px-16 xl:px-20 py-20 sm:py-28">
          <div className="mb-14">
            <div className="kicker mb-3">features</div>
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-[var(--text)]">
              Everything you need. Nothing you don&apos;t.
            </h2>
          </div>

          <div className="features-two-col grid gap-8 w-full">
            <div className="feature-card p-8 sm:p-10">
              <h3 className="text-xs font-mono uppercase tracking-widest text-[var(--accent)] mb-6 font-bold">Load Balancer Strategies</h3>
              <div className="space-y-4">
                {[
                  { name: 'Round Robin', desc: 'Equal distribution across active origins' },
                  { name: 'Weighted Round Robin', desc: 'Proportional distribution by server capacity' },
                  { name: 'IP Hash', desc: 'Deterministic affinity by visitor IP address' },
                  { name: 'Sticky Sessions', desc: 'Cookie-based session persistence' },
                  { name: 'Weighted Sticky', desc: 'Weighted initial landing, then sticky persistence' },
                  { name: 'Failover', desc: 'Primary origin routing with automatic healthy backup' },
                  { name: 'Geographic Routing', desc: 'Route requests to origins nearest to the visitor' },
                ].map((s) => (
                  <div key={s.name} className="flex items-baseline gap-3 text-sm">
                    <span className="text-[var(--accent)] font-bold">→</span>
                    <div>
                      <span className="font-semibold text-[var(--text)]">{s.name}</span>
                      <span className="text-[var(--text-3)] ml-2">{s.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="feature-card p-8 sm:p-10">
              <h3 className="text-xs font-mono uppercase tracking-widest text-[var(--accent)] mb-6 font-bold">API Gateway Capabilities</h3>
              <div className="space-y-4">
                {[
                  { name: 'JWT Validation', desc: 'HMAC signature verification at the edge' },
                  { name: 'Response Caching', desc: 'Edge caching using Cloudflare Cache API' },
                  { name: 'Canary Splitting', desc: 'Percentage-based deployment verification' },
                  { name: 'IP Rules', desc: 'Allow and deny lists by IPv4/IPv6 CIDR' },
                  { name: 'Mock Routes', desc: 'Instant canned responses without origin round-trips' },
                  { name: 'Rate Limiting', desc: 'Multi-tiered sliding window rate enforcement' },
                  { name: 'Path Routing', desc: 'Prefix and regex path-based upstream targeting' },
                  { name: 'CORS Configuration', desc: 'Automated preflight handling and headers' },
                  { name: 'Header Transforms', desc: 'Inject, strip, or rewrite headers at the edge' },
                ].map((f) => (
                  <div key={f.name} className="flex items-baseline gap-3 text-sm">
                    <span className="text-[var(--accent)] font-bold">→</span>
                    <div>
                      <span className="font-semibold text-[var(--text)]">{f.name}</span>
                      <span className="text-[var(--text-3)] ml-2">{f.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap gap-4">
            <a href="/features" className="btn btn-ghost btn-sm">All features →</a>
            <a href="/strategies" className="btn btn-ghost btn-sm">Strategies in detail →</a>
          </div>
        </section>

        {/* Full-width Pricing Bento */}
        <section className="w-full border-t border-[var(--line)] px-6 sm:px-10 lg:px-16 xl:px-20 py-20 sm:py-28">
          <div className="mb-14">
            <div className="kicker mb-3">pricing</div>
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-[var(--text)]">
              Simple. No surprises.
            </h2>
          </div>

          <div className="pricing-layout grid gap-8 w-full">
            <div className="feature-card feature-card-lift p-8 flex flex-col justify-between">
              <div>
                <div className="kicker mb-2">free</div>
                <div className="text-4xl font-bold text-[var(--text)]">₹0</div>
                <div className="text-xs text-[var(--text-3)] mb-6">forever</div>
                <div className="border-t border-[var(--line)] pt-5 space-y-3 text-sm text-[var(--text-2)]">
                  {['Up to 5 load balancers', 'All 7 strategies', 'Health checks (2 LBs)', 'Deployment history', 'Pause / resume'].map((f) => (
                    <div key={f} className="flex items-center gap-2.5">
                      <span className="text-[var(--green)]">✓</span>
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="feature-card feature-card-lift p-8 border-2 border-[var(--accent)]/50 shadow-md flex flex-col justify-between">
              <div>
                <div className="kicker mb-2 text-[var(--accent)]">student</div>
                <div className="text-4xl font-bold text-[var(--text)]">₹49<span className="text-base font-normal text-[var(--text-3)]">/mo</span></div>
                <div className="text-xs text-[var(--text-3)] mb-6">30 days access</div>
                <div className="border-t border-[var(--line)] pt-5 space-y-3 text-sm text-[var(--text-2)]">
                  {['Up to 10 load balancers', 'All 7 strategies', 'Health checks (5 LBs)', 'Analytics & script download', 'Smart Placement'].map((f) => (
                    <div key={f} className="flex items-center gap-2.5">
                      <span className="text-[var(--accent)] font-bold">✓</span>
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="feature-card feature-card-lift p-8 border-2 border-[var(--accent)] shadow-xl flex flex-col justify-between">
              <div>
                <div className="kicker mb-2 text-[var(--accent)]">pro</div>
                <div className="text-4xl font-bold text-[var(--text)]">₹299<span className="text-base font-normal text-[var(--text-3)]">/mo</span></div>
                <div className="text-xs text-[var(--text-3)] mb-6">30 days access</div>
                <div className="border-t border-[var(--line)] pt-5 space-y-3 text-sm text-[var(--text-2)]">
                  {['Unlimited load balancers', 'All 7 strategies', 'Unlimited health checks', 'AI Agent control plane', 'Advanced Rate Limiting', 'Analytics & script download'].map((f) => (
                    <div key={f} className="flex items-center gap-2.5">
                      <span className="text-[var(--accent)] font-bold">✓</span>
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 text-sm text-[var(--text-3)]">
            Free trial available — <span className="text-[var(--accent)] font-medium">no credit card required</span>.
          </div>
        </section>

        {/* Full-width FAQ Section */}
        <section className="w-full border-t border-[var(--line)] px-6 sm:px-10 lg:px-16 xl:px-20 py-20 sm:py-28">
          <div className="mb-14">
            <div className="kicker mb-3">faq</div>
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-[var(--text)]">
              Frequently asked questions
            </h2>
          </div>

          <div className="space-y-4 w-full">
            {FAQS.map((faq, i) => (
              <details key={i} className="feature-card p-6 group cursor-pointer transition-all w-full">
                <summary className="text-base sm:text-lg font-semibold list-none flex justify-between items-center gap-4 text-[var(--text)]">
                  <span>{faq.question}</span>
                  <Icons.ChevronDown size={18} className="shrink-0 text-[var(--text-3)] transition-transform group-open:rotate-180" />
                </summary>
                <div className="mt-4 pt-4 border-t border-[var(--line)] text-sm text-[var(--text-2)] leading-relaxed">
                  {faq.answer}
                </div>
              </details>
            ))}
          </div>
        </section>

        {/* Full-width Final CTA Strip */}
        <section className="w-full border-t border-[var(--line)] px-6 sm:px-10 lg:px-16 xl:px-20 py-24 sm:py-32 text-center bg-[var(--surface,var(--bg-1))]/30">
          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-[var(--text)]">
            Start free. No credit card required.
          </h2>
          <p className="mt-5 mb-10 text-base sm:text-lg text-[var(--text-2)] max-w-xl mx-auto leading-relaxed">
            Deploy your first edge load balancer in 60 seconds on 330+ Cloudflare PoPs.
          </p>
          <CTAButton />
        </section>
      </main>

      <Footer />
    </div>
  );
}
