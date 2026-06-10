'use client';

import { useState } from 'react';
import { Logo } from '@/components/shared/Logo';
import { Icons } from '@/components/shared/Icons';
import { useTheme } from '@/hooks/useTheme';

interface SidebarProps {
  current: string;
  onNav: (id: string) => void;
  onLogout: () => void;
  userEmail?: string | null;
}

export const Sidebar = ({ current, onNav, onLogout, userEmail }: SidebarProps) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const items = [
    { id: 'balancers', icon: 'Layers', label: 'Load Balancers' },
    { id: 'sessions', icon: 'History', label: 'Sessions' },
  ];

  const bottom = [
    { id: 'settings', icon: 'Settings', label: 'Settings' },
  ];

  const SidebarContent = () => (
    <>
      <div style={{ padding: '0 8px 20px' }}>
        <Logo />
      </div>

      <div className="kicker" style={{ padding: '8px 12px', marginBottom: 4 }}>// workspace</div>
      <button style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 12px', borderRadius: 'var(--radius)',
        border: '1px solid var(--line)', background: 'var(--bg-1)',
        marginBottom: 20, textAlign: 'left', width: '100%',
        fontSize: 'clamp(12px, 2vw, 13px)',
      }}>
        <div style={{
          width: 24, height: 24, borderRadius: 6,
          background: 'var(--accent-dim)',
          border: '1px solid var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)',
          flexShrink: 0,
        }}>
          {userEmail ? userEmail.substring(0, 2).toUpperCase() : 'AL'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            My Workspace
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
            free
          </div>
        </div>
      </button>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {items.map(it => {
          const Ico = Icons[it.icon as keyof typeof Icons];
          const active = current === it.id;
          return (
            <button key={it.id} onClick={() => { onNav(it.id); setMobileOpen(false); }} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px', borderRadius: 'var(--radius)',
              background: active ? 'var(--bg-2)' : 'transparent',
              color: active ? 'var(--text)' : 'var(--text-2)',
              fontSize: 13, textAlign: 'left',
              borderLeft: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
              paddingLeft: 10,
              width: '100%',
              border: 'none',
              cursor: 'pointer',
            }}>
              <Ico size={15} stroke={active ? 'var(--accent)' : 'currentColor'} />
              {it.label}
            </button>
          );
        })}
      </nav>

      <div style={{ flex: 1 }} />

      <div style={{
        padding: 14, border: '1px solid var(--line)',
        borderRadius: 'var(--radius)', marginBottom: 12,
        fontSize: 'clamp(11px, 2vw, 12px)',
      }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)' }} />
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-2)' }}>CF connected</div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
          token • cf_live_••••
        </div>
      </div>

      {bottom.map(it => {
        const Ico = Icons[it.icon as keyof typeof Icons];
        return (
          <button key={it.id} onClick={() => { onNav(it.id); setMobileOpen(false); }} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 12px', borderRadius: 'var(--radius)',
            color: 'var(--text-2)', fontSize: 13,
            width: '100%',
            textAlign: 'left',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}>
            <Ico size={15} /> {it.label}
          </button>
        );
      })}
      <button onClick={toggleTheme} style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 12px', borderRadius: 'var(--radius)',
        color: 'var(--text-3)', fontSize: 13,
        width: '100%', textAlign: 'left',
        background: 'none', border: 'none', cursor: 'pointer',
      }}>
        {theme === 'dark' ? <Icons.Sun size={15} /> : <Icons.Moon size={15} />}
        {theme === 'dark' ? 'Light mode' : 'Dark mode'}
      </button>
      <button onClick={() => { onLogout(); setMobileOpen(false); }} style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 12px', borderRadius: 'var(--radius)',
        color: 'var(--text-3)', fontSize: 13,
        width: '100%',
        textAlign: 'left',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
      }}>
        <Icons.Logout size={15} /> Log out
      </button>
    </>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="sidebar-desktop" style={{
        width: 240, borderRight: '1px solid var(--line)',
        background: 'var(--bg)', display: 'flex', flexDirection: 'column',
        padding: '20px 12px', position: 'sticky', top: 0, height: '100vh',
        overflowY: 'auto',
      }} suppressHydrationWarning>
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Header with Toggle */}
      <div className="sidebar-mobile-header" style={{
        display: 'none', alignItems: 'center', justifyContent: 'space-between',
        padding: 'clamp(12px, 2vw, 16px)', borderBottom: '1px solid var(--line)',
        gap: 12, zIndex: 35,
      }}>
        <Logo />
        <button
          className="mobile-menu-trigger"
          onClick={() => setMobileOpen(!mobileOpen)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 40, height: 40, borderRadius: 'var(--radius)',
            background: 'var(--accent)', color: 'var(--bg)',
            border: 'none', cursor: 'pointer',
          }}
        >
          {mobileOpen ? <Icons.X size={20} /> : <Icons.Menu size={20} />}
        </button>
      </div>

      {/* Mobile Sidebar Overlay & Drawer */}
      <>
        <div
          className="sidebar-overlay"
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 40,
            background: 'rgba(0,0,0,0.5)',
            opacity: mobileOpen ? 1 : 0,
            pointerEvents: mobileOpen ? 'auto' : 'none',
            transition: 'opacity 280ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
        <aside className="sidebar-mobile" style={{
          position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 41,
          width: 'min(280px, 85vw)',
          borderRight: '1px solid var(--line)',
          background: 'var(--bg)', display: 'flex', flexDirection: 'column',
          padding: '20px 12px', overflow: 'auto',
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 280ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}>
          <SidebarContent />
        </aside>
      </>

      <style jsx>{`
        @media (min-width: 769px) {
          .sidebar-desktop {
            display: flex !important;
          }
          .sidebar-mobile-header {
            display: none !important;
          }
          .mobile-menu-trigger {
            display: none !important;
          }
        }
        @media (max-width: 768px) {
          .sidebar-desktop {
            display: none !important;
          }
          .sidebar-mobile-header {
            display: flex !important;
          }
        }
      `}</style>
    </>
  );
};

export const Topbar = ({ title, subtitle, actions, crumbs }: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  crumbs?: string[];
}) => (
  <header style={{
    padding: 'clamp(16px, 3vw, 24px)', borderBottom: '1px solid var(--line)',
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
    gap: 16, flexWrap: 'wrap',
  }}>
    <div style={{ minWidth: 0, flex: 1 }}>
      {crumbs && (
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 'clamp(10px, 2vw, 11px)', color: 'var(--text-3)',
          textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {crumbs.join(' / ')}
        </div>
      )}
      <h1 style={{ 
        fontSize: 'clamp(20px, 4vw, 24px)', margin: 0, letterSpacing: '-0.02em', fontWeight: 500,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{title}</h1>
      {subtitle && (
        <div style={{ color: 'var(--text-3)', fontSize: 'clamp(12px, 2vw, 13px)', marginTop: 4 }}>{subtitle}</div>
      )}
    </div>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{actions}</div>
  </header>
);
