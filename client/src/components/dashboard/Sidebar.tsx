'use client';

import { useState } from 'react';
import { Logo } from '@/components/shared/Logo';
import { Icons } from '@/components/shared/Icons';

interface SidebarProps {
  current: string;
  onNav: (id: string) => void;
  onLogout: () => void;
  userEmail?: string | null;
  hasCloudflareCredentials?: boolean;
  cloudflareOAuthConnected?: boolean;
  isReady?: boolean;
  isPro?: boolean;
  plan?: string;
  planExpiresAt?: string | null;
}

export const Sidebar = ({
  current,
  onNav,
  onLogout,
  userEmail,
  hasCloudflareCredentials,
  cloudflareOAuthConnected,
  isReady,
  isPro,
  plan,
  planExpiresAt,
}: SidebarProps) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const items = [
    { id: 'overview', icon: 'Grid', label: 'Overview' },
    { id: 'balancers', icon: 'Layers', label: 'Load Balancers' },
    { id: 'gateways', icon: 'Globe', label: 'API Gateways' },
    { id: 'sessions', icon: 'History', label: 'LB History' },
    { id: 'ai-runs', icon: 'Zap', label: 'AI Runs' },
    { id: 'pro', icon: 'Crown', label: 'EdgeBalancer Pro' },
  ];

  const bottom = [
    { id: 'payments', icon: 'CreditCard', label: 'Payment History' },
    { id: 'settings', icon: 'Settings', label: 'Settings' },
  ];

  const SidebarContent = () => (
    <>
      <div style={{ padding: '0 8px 20px' }}>
        <Logo />
        {plan && plan !== 'free' && planExpiresAt && new Date(planExpiresAt) > new Date() && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              borderRadius: 'var(--radius)',
              background: plan?.includes('pro')
                ? 'rgba(255, 149, 0, 0.12)'
                : 'var(--accent-dim)',
              border: plan?.includes('pro')
                ? '1px solid rgba(255, 149, 0, 0.3)'
                : '1px solid rgba(0, 113, 227, 0.3)',
              marginTop: 12,
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: plan?.includes('pro') ? 'var(--orange)' : 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
              }}
            >
              <Icons.Crown size={12} fill="#fff" stroke="#fff" />
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: plan?.includes('pro') ? 'var(--orange)' : 'var(--accent)',
                  fontFamily: 'var(--mono)',
                  letterSpacing: '0.04em',
                }}
              >
                {plan?.includes('pro') ? 'Pro User' : plan?.includes('student') ? 'Student' : 'Trial'}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: 'var(--text-3)',
                  marginTop: 1,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                Until {new Date(planExpiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            </div>
          </div>
        )}
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map((it) => {
          const Ico = Icons[it.icon as keyof typeof Icons];
          const active = current === it.id;
          return (
            <button
              key={it.id}
              onClick={() => {
                onNav(it.id);
                setMobileOpen(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 12px',
                borderRadius: 'var(--radius)',
                background: active ? 'var(--accent-dim)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--text-2)',
                fontSize: 13,
                textAlign: 'left',
                borderLeft: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
                paddingLeft: 10,
                width: '100%',
                border: 'none',
                cursor: 'pointer',
                fontWeight: active ? 500 : 400,
                transition: 'all 160ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              <Ico size={16} stroke={active ? 'var(--accent)' : 'currentColor'} />
              <span>{it.label}</span>
            </button>
          );
        })}
      </nav>

      <div style={{ flex: 1 }} />

      {/* Cloudflare Connection Status Card */}
      <div
        style={{
          padding: 12,
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius)',
          marginBottom: 12,
          background: 'var(--bg-2)',
          fontSize: '11px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ position: 'relative', width: 7, height: 7, flexShrink: 0 }}>
            <div
              className="animate-ping"
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                background: hasCloudflareCredentials ? 'var(--green)' : 'var(--red)',
                opacity: 0.75,
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                background: hasCloudflareCredentials ? 'var(--green)' : 'var(--red)',
              }}
            />
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 500, color: 'var(--text)' }}>
            {hasCloudflareCredentials ? 'Cloudflare Connected' : 'Cloudflare Not Connected'}
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
          Auth: {cloudflareOAuthConnected ? 'OAuth' : 'API Token'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
          Status: {isReady ? <span style={{ color: 'var(--green)', fontWeight: 600 }}>Ready</span> : <span style={{ color: 'var(--red)', fontWeight: 600 }}>Not Ready</span>}
        </div>
      </div>

      {bottom.map((it) => {
        const Ico = Icons[it.icon as keyof typeof Icons];
        return (
          <button
            key={it.id}
            onClick={() => {
              onNav(it.id);
              setMobileOpen(false);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 12px',
              borderRadius: 'var(--radius)',
              color: 'var(--text-2)',
              fontSize: 13,
              width: '100%',
              textAlign: 'left',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 400,
              transition: 'color 150ms ease, background-color 150ms ease',
            }}
          >
            <Ico size={15} /> <span>{it.label}</span>
          </button>
        );
      })}

      <button
        onClick={() => {
          onLogout();
          setMobileOpen(false);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 12px',
          borderRadius: 'var(--radius)',
          color: 'var(--text-3)',
          fontSize: 13,
          width: '100%',
          textAlign: 'left',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontWeight: 400,
          transition: 'color 150ms ease',
        }}
      >
        <Icons.Logout size={15} /> <span>Log out</span>
      </button>
    </>
  );

  return (
    <>
      {/* Desktop Translucent Sidebar */}
      <aside
        className="sidebar-desktop"
        style={{
          width: 240,
          borderRight: '1px solid var(--line)',
          background: 'var(--surface, var(--bg-1))',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          flexDirection: 'column',
          padding: '20px 12px',
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflowY: 'auto',
        }}
        suppressHydrationWarning
      >
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Header with Toggle */}
      <div
        className="sidebar-mobile-header"
        style={{
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--line)',
          background: 'var(--glass)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          gap: 12,
          zIndex: 35,
        }}
      >
        <Logo />
        <button
          className="mobile-menu-trigger"
          onClick={() => setMobileOpen(!mobileOpen)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            borderRadius: 'var(--radius)',
            background: 'var(--accent)',
            color: '#fff',
            boxShadow: '0 2px 8px var(--accent-dim)',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          {mobileOpen ? <Icons.X size={18} /> : <Icons.Menu size={18} />}
        </button>
      </div>

      {/* Mobile Sidebar Overlay & Drawer */}
      <>
        <div
          className="sidebar-overlay"
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 40,
            background: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            opacity: mobileOpen ? 1 : 0,
            pointerEvents: mobileOpen ? 'auto' : 'none',
            transition: 'opacity 250ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
        <aside
          className="sidebar-mobile"
          style={{
            position: 'fixed',
            left: 0,
            top: 0,
            bottom: 0,
            zIndex: 41,
            width: 'min(280px, 85vw)',
            borderRight: '1px solid var(--line)',
            background: 'var(--surface-elevated, var(--bg-1))',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            flexDirection: 'column',
            padding: '20px 12px',
            overflow: 'auto',
            transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
            transition: 'transform 280ms cubic-bezier(0.16, 1, 0.3, 1)',
            boxShadow: '0 20px 48px rgba(0,0,0,0.25)',
          }}
        >
          <SidebarContent />
        </aside>
      </>
    </>
  );
};

export const Topbar = ({
  title,
  subtitle,
  actions,
  crumbs,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  crumbs?: string[];
}) => (
  <header
    style={{
      padding: 'clamp(14px, 2.5vw, 20px) clamp(16px, 3vw, 28px)',
      borderBottom: '1px solid var(--line)',
      background: 'var(--glass)',
      backdropFilter: 'blur(20px) saturate(180%)',
      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      gap: 16,
      flexWrap: 'wrap',
      position: 'sticky',
      top: 0,
      zIndex: 25,
    }}
  >
    <div style={{ minWidth: 0, flex: 1 }}>
      {crumbs && (
        <div
          style={{
            fontFamily: 'var(--mono)',
            fontSize: '11px',
            color: 'var(--text-3)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: 4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {crumbs.join(' / ')}
        </div>
      )}
      <h1
        style={{
          fontSize: 'clamp(20px, 3vw, 24px)',
          margin: 0,
          letterSpacing: '-0.025em',
          fontWeight: 600,
          color: 'var(--text)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {title}
      </h1>
      {subtitle && (
        <div style={{ color: 'var(--text-3)', fontSize: '13px', marginTop: 2 }}>{subtitle}</div>
      )}
    </div>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>{actions}</div>
  </header>
);
