'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Logo } from '@/components/shared/Logo';
import { Icons } from '@/components/shared/Icons';

export function Nav() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-[var(--line)] bg-[var(--glass)] backdrop-blur-2xl transition-all duration-200">
      <div className="w-full flex items-center justify-between px-6 sm:px-10 lg:px-16 py-3.5">
        <a href="/" className="flex items-center transition-opacity hover:opacity-90">
          <Logo />
        </a>

        {/* Desktop Links */}
        <div className="hidden md:flex items-center gap-8 text-[13px] font-medium text-[var(--text-2)]">
          <a href="/features" className="transition-colors hover:text-[var(--text)]">Features</a>
          <a href="/strategies" className="transition-colors hover:text-[var(--text)]">Strategies</a>
          <a href="/pricing" className="transition-colors hover:text-[var(--text)]">Pricing</a>
          <a href="/stats" className="transition-colors hover:text-[var(--text)]">Stats</a>
          <a href="/blog" className="transition-colors hover:text-[var(--text)]">Blog</a>
          <a href="/faq" className="transition-colors hover:text-[var(--text)]">FAQ</a>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 sm:gap-3">
          {!loading && (
            user ? (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => router.push('/overview')}
              >
                <span>Overview</span>
                <Icons.Arrow size={14} />
              </button>
            ) : (
              <>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => router.push('/login')}
                >
                  Sign in
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => router.push('/login')}
                >
                  <span>Get started</span>
                  <Icons.Arrow size={14} />
                </button>
              </>
            )
          )}

          {/* Mobile hamburger toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex md:hidden h-8 w-8 items-center justify-center rounded-lg text-[var(--text-2)] hover:bg-[var(--bg-2)] hover:text-[var(--text)] active:scale-95 transition-all"
            aria-label="Toggle navigation"
          >
            {mobileMenuOpen ? <Icons.X size={18} /> : <Icons.Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[var(--line)] bg-[var(--surface-elevated,var(--bg-1))] px-6 py-4 space-y-2.5 backdrop-blur-2xl shadow-lg">
          <a href="/features" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm font-medium text-[var(--text-2)] hover:text-[var(--text)]">Features</a>
          <a href="/strategies" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm font-medium text-[var(--text-2)] hover:text-[var(--text)]">Strategies</a>
          <a href="/pricing" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm font-medium text-[var(--text-2)] hover:text-[var(--text)]">Pricing</a>
          <a href="/stats" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm font-medium text-[var(--text-2)] hover:text-[var(--text)]">Stats</a>
          <a href="/blog" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm font-medium text-[var(--text-2)] hover:text-[var(--text)]">Blog</a>
          <a href="/faq" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm font-medium text-[var(--text-2)] hover:text-[var(--text)]">FAQ</a>
        </div>
      )}
    </nav>
  );
}
