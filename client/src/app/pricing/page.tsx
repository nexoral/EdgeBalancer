import { Nav } from '@/components/landing/Nav';
import { Footer } from '@/components/landing/Footer';
import { CTAButton } from '@/components/landing/CTAButton';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing — EdgeBalancer',
  description: 'EdgeBalancer pricing: Free tier with 5 load balancers, Student plan at ₹49/mo, Pro at ₹299/mo with unlimited LBs, AI agent, and rate limiting. No credit card required to start.',
  alternates: { canonical: 'https://edge.nexoral.in/pricing' },
};

const PLANS = [
  {
    name: 'Free',
    price: '₹0',
    period: 'forever',
    description: 'For hobby projects and testing.',
    features: [
      'Up to 5 load balancers',
      '1 API Gateway (5 routes, basic body stripping)',
      'All 7 traffic strategies',
      'Health Checks (up to 2 LBs)',
      'Pause / resume load balancers',
      'Deployment history & rollback',
      'AES-256-GCM encrypted credentials',
    ],
    highlighted: false,
  },
  {
    name: "Student's Support",
    price: '₹49',
    period: '/mo',
    description: 'For students and indie hackers.',
    features: [
      'Up to 10 load balancers',
      'Up to 3 API Gateways (JWT, RBAC, Semantic Cache)',
      'Identity rate limiting (X-API-Key / JWT)',
      'All 7 traffic strategies',
      'Health Checks (up to 5 LBs)',
      'Custom Smart Placement',
      'Cloudflare analytics per card',
      'Download Worker scripts',
    ],
    highlighted: true,
    badge: 'popular',
  },
  {
    name: 'Pro',
    price: '₹299',
    period: '/mo',
    description: 'For teams and production workloads.',
    features: [
      'Unlimited load balancers & API Gateways',
      'BFF Multi-Upstream Fan-Out & Aggregation',
      'Asynchronous Traffic Shadowing & Dark Launches',
      'JWT RBAC + Downstream Header Injection',
      'All 7 traffic strategies',
      'Unlimited Health Checks',
      'Custom Smart Placement',
      'AI Agent',
      'Rate Limiting & IP Firewall',
      'Cloudflare analytics per card',
      'Download Worker scripts',
    ],
    highlighted: false,
  },
];

const FAQS = [
  { q: 'What is included in the free tier?', a: 'You get up to 5 load balancers, all 7 routing strategies, health checks for up to 2 balancers, and deployment history. No credit card required.' },
  { q: 'Can I try Pro before buying?', a: 'Yes. First-time users get a 14-day free trial of all Pro features (except AI Agent). No credit card required.' },
  { q: 'What happens when my subscription expires?', a: 'Your account automatically reverts to the Free plan. Your load balancers keep running. You can re-subscribe anytime.' },
  { q: 'Do you charge per request?', a: 'No. EdgeBalancer charges a flat monthly fee per plan. You also pay Cloudflare for Worker requests separately (100k/day free, then $0.30/M).' },
  { q: 'Is there auto-renewal?', a: 'No. All subscriptions are one-time payments. No auto-renewal, no hidden charges.' },
  { q: 'Do annual plans save money?', a: 'Yes. Annual plans save 20% compared to paying monthly. Student annual is ₹470/yr (₹39/mo) and Pro annual is ₹2,870/yr (₹239/mo).' },
  { q: 'Can I switch plans?', a: 'Yes. You can upgrade or downgrade anytime. When you upgrade, the new plan starts immediately. When you downgrade, it takes effect at the end of your current billing period.' },
];

export default function PricingPage() {
  return (
    <div style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
      <Nav />

      <main style={{ position: 'relative', zIndex: 5 }}>
        {/* Header */}
        <section style={{
          padding: 'clamp(48px, 8vh, 80px) clamp(16px, 4vw, 48px)',
        }}>
          <div className="kicker" style={{ marginBottom: 12 }}>// pricing</div>
          <h1 style={{ fontSize: 'clamp(32px, 5vw, 56px)', margin: 0, letterSpacing: '-0.035em', fontWeight: 600, lineHeight: 1.05 }}>
            Simple pricing. No surprises.<span style={{ color: 'var(--accent)' }}>.</span>
          </h1>
          <p style={{ fontSize: 'clamp(15px, 2.5vw, 18px)', color: 'var(--text-2)', maxWidth: 720, marginTop: 24, lineHeight: 1.6 }}>
            Start free, upgrade when you need more. All plans include 7 routing strategies and health checks.
            No credit card required to start.
          </p>
        </section>

        {/* Pricing cards */}
        <section style={{
          borderTop: '1px solid var(--line)',
          padding: 'clamp(48px, 8vh, 80px) clamp(16px, 4vw, 48px)',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(clamp(280px, 30vw, 340px), 1fr))', gap: 'clamp(16px, 3vw, 24px)' }}>
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className="feature-card"
                style={{
                  padding: 'clamp(24px, 3vw, 32px)',
                  border: plan.highlighted ? '2px solid #3b82f6' : '1px solid var(--line)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {plan.highlighted && (
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                    background: 'linear-gradient(90deg, #3b82f6, #6366f1)',
                  }} />
                )}
                <div className="kicker" style={{ color: plan.highlighted ? '#3b82f6' : undefined }}>// {plan.name.toLowerCase()}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 16 }}>
                  <span style={{ fontSize: 'clamp(40px, 5vw, 56px)', fontWeight: 700, letterSpacing: '-0.03em' }}>{plan.price}</span>
                  <span style={{ fontSize: 14, color: 'var(--text-3)' }}>{plan.period}</span>
                </div>
                <p style={{ fontSize: 14, color: 'var(--text-3)', marginTop: 8, marginBottom: 24 }}>{plan.description}</p>
                <div style={{ borderTop: '1px solid var(--line)', paddingTop: 24 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>What you get</div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {plan.features.map((feature, i) => (
                      <li key={i} style={{ fontSize: 'clamp(13px, 1.8vw, 14px)', color: 'var(--text-2)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <span style={{ color: plan.highlighted ? '#3b82f6' : 'var(--green)', flexShrink: 0, marginTop: 2 }}>✓</span> {feature}
                      </li>
                    ))}
                  </ul>
                </div>
                {plan.name === 'Pro' && (
                  <a href="/pro" className="btn btn-primary" style={{ marginTop: 24, width: '100%', textAlign: 'center' }}>
                    Get Pro — ₹299/mo or ₹2,870/yr
                  </a>
                )}
                {plan.name === "Student's Support" && (
                  <a href="/pro" className="btn btn-primary" style={{ marginTop: 24, width: '100%', textAlign: 'center', background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>
                    Get Student&apos;s Support — ₹49/mo or ₹470/yr
                  </a>
                )}
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: 'var(--text-3)' }}>
            Annual plans save 20% — choose monthly or annual on the checkout page.
          </div>
        </section>

        {/* Comparison table */}
        <section style={{
          borderTop: '1px solid var(--line)',
          padding: 'clamp(48px, 8vh, 80px) clamp(16px, 4vw, 48px)',
        }}>
          <div className="kicker" style={{ marginBottom: 12 }}>// how does it compare</div>
          <h2 style={{ fontSize: 'clamp(24px, 3vw, 32px)', margin: 0, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 8 }}>
            EdgeBalancer vs. alternatives
          </h2>
          <p style={{ fontSize: 'clamp(14px, 2vw, 15px)', color: 'var(--text-3)', marginBottom: 32, maxWidth: 720 }}>
            Load balancing shouldn&apos;t cost a base fee. Compare with traditional solutions.
          </p>

          <div className="feature-card" style={{ padding: 'clamp(16px, 3vw, 24px)', overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 'clamp(12px, 1.5vw, 14px)', borderCollapse: 'collapse', minWidth: 700 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--line)' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--text-3)', fontWeight: 500, fontFamily: 'var(--mono)' }}>Feature</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--accent)', fontFamily: 'var(--mono)' }}>EdgeBalancer</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>AWS ALB</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>CF LB</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>Nginx</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Monthly cost', '₹0–₹299', '~$22', '~$5/balancer', 'Server cost'],
                  ['Free tier', '5 LBs, all strategies', 'None after yr 1', 'None', 'Manual setup'],
                  ['Idle fee', '₹0', 'Yes (hourly)', 'Per-query', 'Always-on'],
                  ['Deploy time', '90 seconds', '10-30 min', '5-15 min', 'Hours'],
                  ['Health checks', '✓', '✓', '✓', 'Manual'],
                  ['Geo-steering', '✓', 'Extra cost', 'Extra cost', 'Manual'],
                  ['Cookie sticky', '✓', '✗', '✗', 'Manual'],
                  ['Edge deployment', '✓ (330+ PoPs)', '✗ (regional)', '✓', '✗'],
                  ['AI Agent', 'Pro only', '✗', '✗', '✗'],
                ].map(([feature, eb, aws, cf, nginx], i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '12px 16px', color: 'var(--text-2)', fontWeight: 500 }}>{feature}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--green)', fontFamily: 'var(--mono)' }}>{eb}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>{aws}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>{cf}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>{nginx}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* FAQ */}
        <section style={{
          borderTop: '1px solid var(--line)',
          padding: 'clamp(48px, 8vh, 80px) clamp(16px, 4vw, 48px)',
        }}>
          <div className="kicker" style={{ marginBottom: 12 }}>// pricing faq</div>
          <h2 style={{ fontSize: 'clamp(24px, 3vw, 32px)', margin: 0, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 32 }}>
            Common pricing questions
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(clamp(300px, 45vw, 450px), 1fr))', gap: 16 }}>
            {FAQS.map((faq, i) => (
              <div key={i} className="feature-card" style={{ padding: 'clamp(16px, 2vw, 20px)' }}>
                <div style={{ fontSize: 'clamp(14px, 1.8vw, 15px)', fontWeight: 600, marginBottom: 8 }}>{faq.q}</div>
                <div style={{ fontSize: 'clamp(13px, 1.6vw, 14px)', color: 'var(--text-2)', lineHeight: 1.6 }}>{faq.a}</div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section style={{
          borderTop: '1px solid var(--line)',
          padding: 'clamp(48px, 8vh, 80px) clamp(16px, 4vw, 48px)',
          textAlign: 'center',
        }}>
          <div className="feature-card" style={{ padding: 'clamp(32px, 5vw, 48px)' }}>
            <h2 style={{ fontSize: 'clamp(24px, 3vw, 32px)', margin: 0, fontWeight: 600, textAlign: 'left' }}>Start for free, scale when ready</h2>
            <p style={{ fontSize: 'clamp(14px, 2vw, 16px)', color: 'var(--text-2)', marginTop: 12, marginBottom: 24, maxWidth: 500, marginLeft: 'auto', marginRight: 'auto' }}>
              Deploy your first load balancer in 90 seconds. No credit card required.
            </p>
            <CTAButton />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
