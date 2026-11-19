'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { Icons } from '@/components/shared/Icons';
import { Modal } from '@/components/ui/Modal';
import { api } from '@/lib/api';
import { openCashfreeCheckout } from '@/lib/cashfree';

// All features — one entry per feature, with plan-specific labels
const ALL_FEATURES: { free: string | null; student: string | null; pro: string | null }[] = [
  { free: 'Up to 5 load balancers', student: 'Up to 10 load balancers', pro: 'Unlimited load balancers' },
  { free: 'All 7 traffic strategies', student: 'All 7 traffic strategies', pro: 'All 7 traffic strategies' },
  { free: 'Health Checks (up to 2 LBs)', student: 'Health Checks (up to 5 LBs)', pro: 'Unlimited Health Checks' },
  { free: 'Smart Placement (auto, locked)', student: 'Custom Smart Placement', pro: 'Custom Smart Placement' },
  { free: 'Pause / resume load balancers', student: 'Pause / resume load balancers', pro: 'Pause / resume load balancers' },
  { free: 'Deployment history', student: 'Deployment history', pro: 'Deployment history' },
  { free: null, student: 'Cloudflare analytics per card', pro: 'Cloudflare analytics per card' },
  { free: null, student: 'Download Worker scripts', pro: 'Download Worker scripts' },
  { free: null, student: null, pro: 'AI Agent' },
  { free: null, student: null, pro: 'Rate Limiting' },
];

interface FeatureSpec {
  titleKey: string;
  category: string;
  icon: (p: any) => React.ReactElement;
  getTitle: (plan: 'free' | 'student' | 'pro') => string;
  isUnlocked: (plan: 'free' | 'student' | 'pro') => boolean;
  lockedHint?: string;
}

const LB_FEATURE_SPECS: FeatureSpec[] = [
  {
    titleKey: 'balancers',
    category: 'Fleet Management',
    icon: Icons.Server,
    getTitle: (p) => (p === 'pro' ? 'Unlimited load balancers' : p === 'student' ? 'Up to 10 load balancers' : 'Up to 5 load balancers'),
    isUnlocked: () => true,
  },
  {
    titleKey: 'strategies',
    category: 'Traffic Routing Engine',
    icon: Icons.Flow,
    getTitle: () => 'All 7 traffic strategies',
    isUnlocked: () => true,
  },
  {
    titleKey: 'health',
    category: 'Uptime & Origin Probing',
    icon: Icons.Activity,
    getTitle: (p) => (p === 'pro' ? 'Unlimited Health Checks' : p === 'student' ? 'Health Checks (up to 5 LBs)' : 'Health Checks (up to 2 LBs)'),
    isUnlocked: () => true,
  },
  {
    titleKey: 'placement',
    category: 'Global Latency Optimization',
    icon: Icons.Globe,
    getTitle: (p) => (p === 'free' ? 'Smart Placement (auto, locked)' : 'Custom Smart Placement'),
    isUnlocked: (p) => p !== 'free',
    lockedHint: 'Requires Student or Pro',
  },
];

const GATEWAY_FEATURE_SPECS: FeatureSpec[] = [
  {
    titleKey: 'gw-count',
    category: 'Gateway Fleet',
    icon: Icons.Globe,
    getTitle: (p) => (p === 'pro' ? 'Unlimited API Gateways' : p === 'student' ? 'Up to 3 API Gateways' : '1 API Gateway'),
    isUnlocked: () => true,
  },
  {
    titleKey: 'gw-routes',
    category: 'Reverse Proxy Routing',
    icon: Icons.Flow,
    getTitle: (p) => (p === 'pro' ? 'Unlimited API Routes' : p === 'student' ? 'Up to 20 API Routes' : 'Up to 5 API Routes'),
    isUnlocked: () => true,
  },
  {
    titleKey: 'gw-jwt',
    category: 'Token Verification',
    icon: Icons.Key,
    getTitle: () => 'JWT Authentication',
    isUnlocked: (p) => p !== 'free',
    lockedHint: 'Requires Student or Pro',
  },
  {
    titleKey: 'gw-cache',
    category: 'Performance & Edge CDN',
    icon: Icons.Zap,
    getTitle: () => 'Edge Response Caching',
    isUnlocked: (p) => p !== 'free',
    lockedHint: 'Requires Student or Pro',
  },
  {
    titleKey: 'gw-security',
    category: 'Access Policies & WAF Rules',
    icon: Icons.Lock,
    getTitle: (p) => (p === 'pro' ? 'Unlimited Header & IP Rules' : p === 'student' ? '10 Header & 20 IP Rules' : '3 Header & 5 IP Rules'),
    isUnlocked: () => true,
  },
  {
    titleKey: 'gw-mocks',
    category: 'API Stubs & Prototyping',
    icon: Icons.Copy,
    getTitle: (p) => (p === 'pro' ? 'Unlimited Mock Routes' : p === 'student' ? 'Up to 10 Mock Routes' : 'Up to 2 Mock Routes'),
    isUnlocked: () => true,
  },
  {
    titleKey: 'gw-canary',
    category: 'Phased Release Engineering',
    icon: Icons.Refresh,
    getTitle: () => 'Canary Traffic Splits',
    isUnlocked: (p) => p === 'pro',
    lockedHint: 'Requires Pro Plan',
  },
];

const UNIFIED_FEATURE_SPECS: FeatureSpec[] = [
  {
    titleKey: 'history',
    category: 'Audit Logs & Version Snapshots',
    icon: Icons.History,
    getTitle: () => 'Deployment History & Snapshots',
    isUnlocked: () => true,
  },
  {
    titleKey: 'pause-resume',
    category: 'Fleet Lifecycle Controls',
    icon: Icons.Zap,
    getTitle: () => 'Pause / Resume Services',
    isUnlocked: () => true,
  },
  {
    titleKey: 'analytics',
    category: 'Realtime Edge Telemetry',
    icon: Icons.Layers,
    getTitle: () => 'Cloudflare Analytics per Card',
    isUnlocked: (p) => p !== 'free',
    lockedHint: 'Requires Student or Pro',
  },
  {
    titleKey: 'download',
    category: 'Source Script Export',
    icon: Icons.Download,
    getTitle: () => 'Download Worker Scripts',
    isUnlocked: (p) => p !== 'free',
    lockedHint: 'Requires Student or Pro',
  },
  {
    titleKey: 'rate-limit',
    category: 'DDoS & Traffic Protection',
    icon: Icons.Shield,
    getTitle: (p) => (p === 'pro' ? 'Unlimited Edge Rate Limiting' : 'Edge Rate Limiting'),
    isUnlocked: (p) => p === 'pro',
    lockedHint: 'Requires Pro Plan',
  },
  {
    titleKey: 'ai',
    category: 'Autonomous Fleet Operations',
    icon: Icons.Crown,
    getTitle: () => 'Autonomous AI Agent',
    isUnlocked: (p) => p === 'pro',
    lockedHint: 'Requires Pro Plan',
  },
];

type PlanType = 'trial' | 'student' | 'pro' | 'student-annual' | 'pro-annual';
type BillingPeriod = 'monthly' | 'annual';

export default function ProPage() {
  const { user, loading: authLoading, refreshUser } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [currentNav, setCurrentNav] = useState('pro');
  const [showModal, setShowModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('student');
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

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

  const handleBuyClick = (plan: PlanType) => {
    setError('');
    setPhone('');
    setSelectedPlan(plan);
    // Free trial: skip phone modal, activate directly
    if (plan === 'trial') {
      handleConfirmBuy('trial');
      return;
    }
    setShowModal(true);
  };

  const handleConfirmBuy = async (planOverride?: PlanType) => {
    const plan = planOverride || selectedPlan;
    const isUpgrade = (typeof window !== 'undefined' && (window as any).__upgradeMode) === true;
    if (plan !== 'trial') {
      if (!phone.trim() || phone.trim().length < 10) {
        setError('Please enter a valid phone number');
        return;
      }
    }
    setError('');
    setShowModal(false);
    setLoading(true);
    const clearUpgradeFlag = () => { if (typeof window !== 'undefined') (window as any).__upgradeMode = false; };
    try {
      const res = isUpgrade
        ? await api.createUpgradeOrder(plan, phone.trim() || '0000000000')
        : await api.createOrder(plan, phone.trim() || '0000000000');

      // Free trial: no Cashfree checkout needed
      if (res.data?.trialActivated) {
        await refreshUser();
        setSuccess(true);
        setTimeout(() => router.push('/overview'), 2000);
        return;
      }

      if (!res.success || !res.data?.paymentSessionId) {
        clearUpgradeFlag();
        setError(res.message || 'Failed to create order');
        setLoading(false);
        return;
      }

      const orderId: string = res.data.orderId;
      await openCashfreeCheckout(res.data.paymentSessionId);

      setPolling(true);
      const deadline = Date.now() + 30000;
      let attempt = 0;
      while (Date.now() < deadline) {
        if (attempt > 0) {
          const base = Math.min(2000 * Math.pow(1.35, attempt - 1), 5000);
          const jitter = Math.random() * 700;
          const sleep = base + jitter;
          if (Date.now() + sleep > deadline) break;
          await new Promise(r => setTimeout(r, sleep));
        }
        try {
          const v: any = await api.verifyPayment(orderId);
          if (v?.data?.verified) {
            await refreshUser();
            setPolling(false);
            clearUpgradeFlag();
            setSuccess(true);
            setTimeout(() => router.push('/overview'), 2000);
            return;
          }
          if (v?.data?.status === 'FAILED') {
            setPolling(false);
            clearUpgradeFlag();
            setError('Payment failed. Please try again.');
            return;
          }
        } catch {}
        await refreshUser();
        const latest: any = await api.getCurrentUser().catch(() => null);
        if (latest?.data?.user?.isSubscribed) {
          setPolling(false);
          clearUpgradeFlag();
          setSuccess(true);
          setTimeout(() => router.push('/overview'), 2000);
          return;
        }
        attempt += 1;
      }
      setPolling(false);
      clearUpgradeFlag();
      setError('Checking payment status — your plan will activate shortly. Refresh in a moment.');
    } catch (err: any) {
      clearUpgradeFlag();
      const expiresAt = err.data?.expiresAt || err.response?.data?.data?.expiresAt;
      const baseMsg = err.response?.data?.message || err.message || 'Something went wrong';
      if (expiresAt) {
        const localTime = new Date(expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setError(`${baseMsg} (Expires at ${localTime})`);
      } else {
        setError(baseMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || !user) return null;

  const currentPlan = user.plan || 'free';
  const isActive = user.isSubscribed && user.planExpiresAt && new Date(user.planExpiresAt) > new Date();
  const expiryDate = user.planExpiresAt
    ? new Date(user.planExpiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;
  const canTrial = !user.hasEverSubscribed;

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
        <div style={{ padding: 'clamp(16px, 4vw, 32px)', overflow: 'auto', flex: 1 }}>

          {success ? (
            <div style={{
              maxWidth: 500, margin: '40px auto', textAlign: 'center', padding: '48px 32px',
              background: 'var(--bg-1)', border: '1px solid var(--green)',
              borderRadius: 'var(--radius-lg)',
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%', margin: '0 auto 20px',
                background: 'rgba(34,197,94,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icons.Check size={32} stroke="var(--green)" />
              </div>
              <h2 style={{ color: 'var(--green)', margin: 0 }}>Welcome!</h2>
              <p style={{ color: 'var(--text-2)', marginTop: 8 }}>Redirecting to dashboard...</p>
            </div>
          ) : isActive ? (() => {
            const isTrial = currentPlan === 'trial';
            const featureKey: 'free' | 'student' | 'pro' = isTrial ? 'student' : currentPlan?.includes('pro') ? 'pro' : currentPlan?.includes('student') ? 'student' : 'pro';
            const planLabel = isTrial ? 'TRIAL' : currentPlan?.includes('pro') ? 'PRO' : currentPlan?.includes('student') ? "STUDENT'S SUPPORT" : 'TRIAL';
            const UPGRADE_PLANS: { key: PlanType; label: string; price: number; duration: string }[] = [
              { key: 'student', label: "Student's Support", price: 49, duration: '30 days' },
              { key: 'student-annual', label: "Student's Support (Annual)", price: 470, duration: '365 days' },
              { key: 'pro', label: 'Pro', price: 299, duration: '30 days' },
              { key: 'pro-annual', label: 'Pro (Annual)', price: 2870, duration: '365 days' },
            ];
            const priceMap: Record<string, number> = { free: 0, trial: 0, student: 49, 'student-annual': 470, pro: 299, 'pro-annual': 2870 };
            const currentPrice = priceMap[currentPlan] ?? 0;
            const unlockedLbCount = LB_FEATURE_SPECS.filter(s => s.isUnlocked(featureKey)).length;
            const unlockedGwCount = GATEWAY_FEATURE_SPECS.filter(s => s.isUnlocked(featureKey)).length;
            const unlockedUnifiedCount = UNIFIED_FEATURE_SPECS.filter(s => s.isUnlocked(featureKey)).length;
            const totalUnlocked = unlockedLbCount + unlockedGwCount + unlockedUnifiedCount;
            const totalFeatures = LB_FEATURE_SPECS.length + GATEWAY_FEATURE_SPECS.length + UNIFIED_FEATURE_SPECS.length;

            const renderFeatureCard = (item: FeatureSpec) => {
              const unlocked = item.isUnlocked(featureKey);
              const title = item.getTitle(featureKey);
              const IconComponent = item.icon;
              return (
                <div
                  key={item.titleKey}
                  style={{
                    padding: '11px 13px',
                    background: unlocked ? 'var(--bg)' : 'var(--bg-2)',
                    border: unlocked ? '1px solid var(--line)' : '1px dashed var(--line-2)',
                    borderRadius: 'var(--radius)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    opacity: unlocked ? 1 : 0.62,
                    transition: 'all 120ms ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: 'var(--radius-sm)',
                      background: unlocked ? 'var(--bg-2)' : 'var(--bg-3)',
                      border: '1px solid var(--line)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      color: unlocked ? 'var(--text)' : 'var(--text-3)',
                    }}>
                      {unlocked ? <IconComponent size={15} stroke="var(--text)" /> : <Icons.Lock size={14} stroke="var(--text-3)" />}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: unlocked ? 'var(--text)' : 'var(--text-2)',
                        lineHeight: 1.35,
                      }}>
                        {title}
                      </div>
                      <div style={{
                        fontSize: 10.5,
                        color: unlocked ? 'var(--text-3)' : '#f59e0b',
                        marginTop: 2,
                        lineHeight: 1.3,
                      }}>
                        {unlocked ? item.category : item.lockedHint || 'Requires Upgrade'}
                      </div>
                    </div>
                  </div>

                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '2px 7px',
                    borderRadius: 999,
                    background: unlocked ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                    border: unlocked ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(245, 158, 11, 0.25)',
                    fontSize: 10.5,
                    fontWeight: 600,
                    color: unlocked ? '#10b981' : '#f59e0b',
                    flexShrink: 0,
                  }}>
                    {unlocked ? (
                      <>
                        <Icons.Check size={10} stroke="#10b981" strokeWidth={2.5} />
                        <span>Active</span>
                      </>
                    ) : (
                      <>
                        <Icons.Lock size={10} stroke="#f59e0b" strokeWidth={2} />
                        <span>Locked</span>
                      </>
                    )}
                  </div>
                </div>
              );
            };

            return (
              <div style={{ width: '100%' }}>
                {/* Active Plan Status Hero Card */}
                <div style={{
                  position: 'relative',
                  overflow: 'hidden',
                  padding: '24px 28px',
                  background: 'var(--bg-1)',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: 'var(--shadow-sm)',
                  marginBottom: 24,
                }}>
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                    background: 'linear-gradient(90deg, #10b981, #3b82f6)',
                  }} />
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                    <div>
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 7,
                        padding: '4px 10px', borderRadius: 999,
                        background: 'rgba(16, 185, 129, 0.08)',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                        marginBottom: 10,
                      }}>
                        <span style={{
                          width: 6, height: 6, borderRadius: '50%',
                          background: '#10b981', display: 'inline-block',
                          boxShadow: '0 0 6px #10b981',
                        }} />
                        <span style={{
                          fontSize: 11, fontFamily: 'var(--mono)',
                          color: '#10b981', fontWeight: 600,
                          letterSpacing: '0.08em', textTransform: 'uppercase',
                        }}>
                          {planLabel} ACTIVE
                        </span>
                      </div>
                      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>
                        Subscription Active
                      </h2>
                      <p style={{ color: 'var(--text-2)', marginTop: 6, fontSize: 13, lineHeight: 1.5 }}>
                        Active until <strong style={{ color: 'var(--text)' }}>{expiryDate}</strong> — full tenure applies from any future upgrade, remaining days forfeited.
                      </p>
                    </div>

                    <div style={{
                      padding: '10px 16px', background: 'var(--bg-2)',
                      border: '1px solid var(--line)', borderRadius: 'var(--radius)',
                      textAlign: 'right', minWidth: 150,
                    }}>
                      <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Entitlements
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginTop: 2 }}>
                        {totalUnlocked} / {totalFeatures} Unlocked
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>
                      Active Plan Entitlements
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 2 }}>
                      Configured quotas and capabilities across your infrastructure
                    </div>
                  </div>
                  <span style={{
                    fontSize: 11, fontFamily: 'var(--mono)', padding: '4px 10px',
                    borderRadius: 999, background: 'var(--bg-2)', border: '1px solid var(--line)',
                    color: 'var(--text-2)',
                  }}>
                    {unlockedLbCount} Balancer · {unlockedGwCount} Gateway · {unlockedUnifiedCount} Unified Active
                  </span>
                </div>

                {/* Side-by-Side Panels: Load Balancers (Left) | API Gateways (Right) */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))',
                  gap: 16,
                  alignItems: 'start',
                  marginBottom: 16,
                }}>
                  {/* Left Column: Load Balancers */}
                  <div style={{
                    background: 'var(--bg-1)',
                    border: '1px solid var(--line)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 18,
                    boxShadow: 'var(--shadow-sm)',
                  }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      marginBottom: 14, paddingBottom: 12,
                      borderBottom: '1px solid var(--line)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 'var(--radius-sm)',
                          background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          <Icons.Server size={17} stroke="#3b82f6" />
                        </div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                            Load Balancers
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                            Traffic routing, origin probing & failover
                          </div>
                        </div>
                      </div>
                      <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-3)' }}>
                        {unlockedLbCount} / {LB_FEATURE_SPECS.length} Unlocked
                      </span>
                    </div>

                    {/* 2-Column Grid inside Load Balancers panel */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 9 }}>
                      {LB_FEATURE_SPECS.map(renderFeatureCard)}
                    </div>
                  </div>

                  {/* Right Column: API Gateways */}
                  <div style={{
                    background: 'var(--bg-1)',
                    border: '1px solid var(--line)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 18,
                    boxShadow: 'var(--shadow-sm)',
                  }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      marginBottom: 14, paddingBottom: 12,
                      borderBottom: '1px solid var(--line)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 'var(--radius-sm)',
                          background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          <Icons.Globe size={17} stroke="#a855f7" />
                        </div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                            API Gateways
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                            Reverse proxy, security policies, auth & caching
                          </div>
                        </div>
                      </div>
                      <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-3)' }}>
                        {unlockedGwCount} / {GATEWAY_FEATURE_SPECS.length} Unlocked
                      </span>
                    </div>

                    {/* 2-Column Grid inside API Gateways panel */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 9 }}>
                      {GATEWAY_FEATURE_SPECS.map(renderFeatureCard)}
                    </div>
                  </div>
                </div>

                {/* Bottom Unified Platform Section */}
                <div style={{
                  background: 'var(--bg-1)',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 18,
                  boxShadow: 'var(--shadow-sm)',
                  marginBottom: 28,
                }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: 14, paddingBottom: 12,
                    borderBottom: '1px solid var(--line)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 'var(--radius-sm)',
                        background: 'rgba(16, 185, 129, 0.1)', color: '#10b981',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <Icons.Zap size={17} stroke="#10b981" />
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                          Unified Platform Capabilities
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                          Account-wide features shared across all load balancers & API gateways
                        </div>
                      </div>
                    </div>
                    <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-3)' }}>
                      {unlockedUnifiedCount} / {UNIFIED_FEATURE_SPECS.length} Unlocked
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
                    {UNIFIED_FEATURE_SPECS.map(renderFeatureCard)}
                  </div>
                </div>

                {/* Upgrade your plan section */}
                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                      Upgrade your plan
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      Pay only the difference between plans
                    </span>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                    gap: 14,
                    marginBottom: 16,
                  }}>
                    {UPGRADE_PLANS.map(p => {
                      const isCurrent = p.key === currentPlan;
                      const payable = p.price - currentPrice;
                      const isUpgrade = payable > 0;
                      return (
                        <div
                          key={p.key}
                          style={{
                            padding: 20,
                            background: 'var(--bg-1)',
                            borderRadius: 'var(--radius-lg)',
                            border: isCurrent
                              ? '1.5px solid #10b981'
                              : isUpgrade
                              ? '1px solid var(--line-2)'
                              : '1px solid var(--line)',
                            opacity: !isCurrent && !isUpgrade ? 0.5 : 1,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                          }}
                        >
                          <div>
                            <div style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8,
                            }}>
                              <span style={{
                                fontSize: 11, fontFamily: 'var(--mono)',
                                color: isCurrent ? '#10b981' : 'var(--text-3)',
                                textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600,
                              }}>
                                {p.label}
                              </span>
                              {isCurrent && (
                                <span style={{
                                  fontSize: 10, padding: '2px 6px', borderRadius: 999,
                                  background: 'rgba(16,185,129,0.12)', color: '#10b981', fontWeight: 700,
                                }}>
                                  CURRENT
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)' }}>₹{p.price}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 16 }}>{p.duration}</div>
                          </div>

                          <div>
                            {isCurrent ? (
                              <button disabled style={{
                                width: '100%', padding: '10px', fontSize: 12.5, fontWeight: 600,
                                borderRadius: 'var(--radius)', border: '1px solid rgba(16,185,129,0.3)',
                                background: 'rgba(16,185,129,0.08)', color: '#10b981', cursor: 'not-allowed',
                              }}>
                                Current active plan
                              </button>
                            ) : isUpgrade ? (
                              <>
                                <div style={{ fontSize: 11, color: '#10b981', fontWeight: 500, marginBottom: 8 }}>
                                  Pay ₹{payable} <span style={{ color: 'var(--text-3)' }}>(Save ₹{currentPrice})</span>
                                </div>
                                <button
                                  onClick={() => {
                                    setSelectedPlan(p.key);
                                    setPhone('');
                                    setError('');
                                    setShowModal(true);
                                    (window as any).__upgradeMode = true;
                                    (window as any).__upgradePlan = p.key;
                                  }}
                                  disabled={loading || polling}
                                  style={{
                                    width: '100%', padding: '10px', fontSize: 13, fontWeight: 600,
                                    borderRadius: 'var(--radius)', border: 'none',
                                    background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                                    color: '#fff', cursor: 'pointer',
                                    boxShadow: '0 2px 8px rgba(59, 130, 246, 0.25)',
                                  }}
                                >
                                  Upgrade — Pay ₹{payable}
                                </button>
                              </>
                            ) : (
                              <button disabled style={{
                                width: '100%', padding: '10px', fontSize: 12,
                                borderRadius: 'var(--radius)', border: '1px solid var(--line)',
                                background: 'var(--bg-2)', color: 'var(--text-3)', cursor: 'not-allowed',
                              }}>
                                Downgrade not available
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{
                    padding: '12px 16px', background: 'var(--bg-1)',
                    border: '1px solid var(--line)', borderRadius: 'var(--radius)',
                    fontSize: 12, color: 'var(--text-3)', lineHeight: 1.6,
                  }}>
                    Upgrade pays <strong style={{ color: 'var(--text)' }}>difference only</strong> and gives full tenure from now. No accumulation — remaining days of current plan are forfeited. Annual → monthly downgrade is not allowed.
                  </div>
                </div>

                {error && <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid var(--red)', borderRadius: 'var(--radius)', color: 'var(--red)', fontSize: 13 }}>{error}</div>}
                {polling && <div style={{ textAlign: 'center', padding: 16, color: '#f59e0b', fontSize: 14 }}>Verifying payment with Cashfree, please wait...</div>}
              </div>
            );
          })() : (
            <div style={{ maxWidth: 1000, margin: '0 auto' }}>
              {/* Trial banner */}
              {canTrial && (
                <div style={{
                  padding: '16px 24px', marginBottom: 24,
                  background: 'linear-gradient(135deg, #f59e0b11, #f9731611)',
                  border: '1px solid #f59e0b44', borderRadius: 'var(--radius)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
                }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
                      Try Pro — <span style={{ color: '#f59e0b', fontWeight: 700 }}>FREE</span>{' '}
                      <span style={{ fontSize: 13, color: 'var(--text-3)' }}>for 14 days</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                      First-time only. No credit card required. All Pro features except AI.
                    </div>
                  </div>
                  <button
                    onClick={() => handleBuyClick('trial')}
                    disabled={loading || polling}
                    style={{
                      padding: '10px 24px', fontSize: 14, fontWeight: 600,
                      background: 'linear-gradient(135deg, #f59e0b, #f97316)',
                      border: 'none', borderRadius: 'var(--radius)',
                      color: '#fff', cursor: 'pointer',
                    }}
                  >
                    <span style={{ textDecoration: 'line-through', opacity: 0.7, marginRight: 6 }}>₹299</span>
                    FREE — Start Trial
                  </button>
                </div>
              )}

              {/* Plan cards */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
                <div style={{
                  display: 'inline-flex', padding: 4, borderRadius: 'var(--radius)',
                  background: 'var(--bg-1)', border: '1px solid var(--line)',
                }}>
                  <button
                    onClick={() => setBillingPeriod('monthly')}
                    style={{
                      padding: '8px 20px', fontSize: 13, fontWeight: 600, borderRadius: 'calc(var(--radius) - 2px)',
                      border: 'none', cursor: 'pointer', transition: 'all 200ms',
                      background: billingPeriod === 'monthly' ? 'var(--accent)' : 'transparent',
                      color: billingPeriod === 'monthly' ? '#fff' : 'var(--text-3)',
                    }}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => setBillingPeriod('annual')}
                    style={{
                      padding: '8px 20px', fontSize: 13, fontWeight: 600, borderRadius: 'calc(var(--radius) - 2px)',
                      border: 'none', cursor: 'pointer', transition: 'all 200ms',
                      background: billingPeriod === 'annual' ? 'var(--accent)' : 'transparent',
                      color: billingPeriod === 'annual' ? '#fff' : 'var(--text-3)',
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    Annual <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 999, background: billingPeriod === 'annual' ? 'rgba(255,255,255,0.2)' : 'var(--green)', color: billingPeriod === 'annual' ? '#fff' : '#000', fontWeight: 700 }}>SAVE 20%</span>
                  </button>
                </div>
              </div>

              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16,
                marginBottom: 32,
              }}>
                {/* Free */}
                <div style={{
                  padding: 28, background: 'var(--bg-1)',
                  border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)',
                }}>
                  <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Free</div>
                  <div style={{ fontSize: 36, fontWeight: 700, marginTop: 8 }}>₹0</div>
                  <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 24 }}>forever</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {ALL_FEATURES.filter(f => f.free).map(f => (
                      <div key={f.free!} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: 'var(--text-2)' }}>
                        <Icons.Check size={15} stroke="var(--green)" style={{ marginTop: 2, flexShrink: 0 }} />
                        <span>{f.free}</span>
                      </div>
                    ))}
                    {ALL_FEATURES.filter(f => !f.free).map(f => (
                      <div key={f.student || f.pro || ''} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: 'var(--text-3)' }}>
                        <Icons.X size={15} stroke="var(--text-3)" style={{ marginTop: 2, flexShrink: 0 }} />
                        <span>{f.student || f.pro}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Student */}
                <div style={{
                  padding: 28, background: 'var(--bg-1)',
                  border: '2px solid #3b82f6', borderRadius: 'var(--radius-lg)',
                  position: 'relative', overflow: 'hidden',
                }}>
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                    background: 'linear-gradient(90deg, #3b82f6, #6366f1)',
                  }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Student&apos;s Support</div>
                  </div>
                  <div style={{ fontSize: 36, fontWeight: 700, marginTop: 8 }}>
                    {billingPeriod === 'monthly' ? '₹49' : '₹470'}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 24 }}>
                    {billingPeriod === 'monthly' ? 'for 30 days' : 'for 365 days'}
                  </div>
                  {billingPeriod === 'annual' && (
                    <div style={{ fontSize: 12, color: 'var(--green)', marginTop: -16, marginBottom: 16 }}>
                      ₹39/mo — save 20%
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {ALL_FEATURES.filter(f => f.student).map(f => (
                      <div key={f.student!} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: 'var(--text)' }}>
                        <Icons.Check size={15} stroke="#3b82f6" style={{ marginTop: 2, flexShrink: 0 }} />
                        <span>{f.student}</span>
                      </div>
                    ))}
                    {ALL_FEATURES.filter(f => !f.student).map(f => (
                      <div key={f.pro || ''} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: 'var(--text-3)' }}>
                        <Icons.X size={15} stroke="var(--text-3)" style={{ marginTop: 2, flexShrink: 0 }} />
                        <span>{f.pro}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => handleBuyClick(billingPeriod === 'monthly' ? 'student' : 'student-annual')}
                    disabled={loading || polling}
                    style={{
                      width: '100%', padding: '12px', marginTop: 24, fontSize: 14, fontWeight: 600,
                      background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                      border: 'none', borderRadius: 'var(--radius)',
                      color: '#fff', cursor: 'pointer',
                    }}
                  >
                    Get Student&apos;s Support — {billingPeriod === 'monthly' ? '₹49' : '₹470'}
                  </button>
                </div>

                {/* Pro */}
                <div style={{
                  padding: 28, background: 'var(--bg-1)',
                  border: '2px solid #f59e0b', borderRadius: 'var(--radius-lg)',
                  position: 'relative', overflow: 'hidden',
                  boxShadow: '0 0 40px #f59e0b15',
                }}>
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                    background: 'linear-gradient(90deg, #f59e0b, #f97316)',
                  }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Pro</div>
                    <div style={{
                      fontSize: 10, padding: '2px 8px', borderRadius: 999,
                      background: 'linear-gradient(135deg, #f59e0b, #f97316)',
                      color: '#fff', fontWeight: 600,
                    }}>BEST VALUE</div>
                  </div>
                  <div style={{ fontSize: 36, fontWeight: 700, marginTop: 8 }}>
                    {billingPeriod === 'monthly' ? '₹299' : '₹2,870'}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 24 }}>
                    {billingPeriod === 'monthly' ? 'for 30 days' : 'for 365 days'}
                  </div>
                  {billingPeriod === 'annual' && (
                    <div style={{ fontSize: 12, color: 'var(--green)', marginTop: -16, marginBottom: 16 }}>
                      ₹239/mo — save 20%
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {ALL_FEATURES.map(f => (
                      <div key={f.pro!} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
                        <Icons.Check size={15} stroke="#f59e0b" style={{ marginTop: 2, flexShrink: 0 }} />
                        <span>{f.pro}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => handleBuyClick(billingPeriod === 'monthly' ? 'pro' : 'pro-annual')}
                    disabled={loading || polling}
                    style={{
                      width: '100%', padding: '12px', marginTop: 24, fontSize: 14, fontWeight: 600,
                      background: 'linear-gradient(135deg, #f59e0b, #f97316)',
                      border: 'none', borderRadius: 'var(--radius)',
                      color: '#fff', cursor: 'pointer',
                      boxShadow: '0 4px 24px #f59e0b44',
                    }}
                  >
                    Get Pro — {billingPeriod === 'monthly' ? '₹299' : '₹2,870'}
                  </button>
                </div>
              </div>

              {/* No auto-renew disclaimer */}
              <div style={{
                padding: '16px 20px', marginBottom: 24,
                background: 'var(--bg-1)', border: '1px solid var(--line)',
                borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--text-2)',
                lineHeight: 1.7,
              }}>
                <strong style={{ color: 'var(--text)' }}>No auto-renewal.</strong> All subscriptions are one-time payments.
                When your plan expires, your account automatically reverts to the Free plan.
                <span style={{ whiteSpace: 'nowrap' }}> You can re-subscribe anytime.</span>
              </div>

              {error && (
                <div style={{
                  padding: '12px 16px', marginBottom: 16,
                  background: 'rgba(239,68,68,0.1)', border: '1px solid var(--red)',
                  borderRadius: 'var(--radius)', color: 'var(--red)', fontSize: 13,
                }}>
                  {error}
                </div>
              )}

              {polling && (
                <div style={{ textAlign: 'center', padding: 16, color: '#f59e0b', fontSize: 14 }}>
                  Verifying payment with Cashfree, please wait...
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Phone number modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Complete your details" size="sm">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 6, display: 'block' }}>Email</label>
            <input
              className="input"
              value={user.email || ''}
              disabled
              style={{ opacity: 0.6, cursor: 'not-allowed' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 6, display: 'block' }}>Phone Number *</label>
            <input
              className="input"
              type="tel"
              placeholder="9876543210"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              maxLength={15}
            />
          </div>
          {error && (
            <div style={{ fontSize: 13, color: 'var(--red)' }}>{error}</div>
          )}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={() => handleConfirmBuy()}
              style={{ background: 'linear-gradient(135deg, #f59e0b, #f97316)', border: 'none', color: '#fff' }}
            >
              {selectedPlan === 'trial' ? 'Start Free Trial' : selectedPlan === 'student' ? 'Pay ₹49' : selectedPlan === 'pro' ? 'Pay ₹299' : selectedPlan === 'student-annual' ? 'Pay ₹470' : 'Pay ₹2,870'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Loading overlay — shown between modal close and Cashfree checkout open */}
      {loading && !polling && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.6)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: 'var(--bg-1)', borderRadius: 'var(--radius-lg)',
            padding: '32px 48px', textAlign: 'center',
          }}>
            <div style={{
              width: 32, height: 32, margin: '0 auto 16px',
              border: '3px solid var(--line)', borderTopColor: 'var(--accent)',
              borderRadius: '50%', animation: 'spin 0.9s linear infinite',
            }} />
            <div style={{ fontSize: 14, color: 'var(--text-2)' }}>Opening payment gateway...</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>Please wait</div>
          </div>
        </div>
      )}
    </div>
  );
}
