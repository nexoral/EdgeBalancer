'use client';

import { Icons } from '@/components/shared/Icons';

interface AuthStep {
  n: string;
  t: string;
  d: string;
}

interface AuthLayoutProps {
  children: React.ReactNode;
  step: 'signin' | 'register' | 'connect' | 'verified';
  onBack: () => void;
  aside?: React.ReactNode;
}

export const AuthLayout = ({ children, step, onBack, aside }: AuthLayoutProps) => {
  const steps: AuthStep[] = [
    { n: '01', t: 'Create your account', d: 'One tap with Google or GitHub. No credit card.' },
    { n: '02', t: 'Connect Cloudflare', d: 'Paste a scoped API token — Workers + DNS edit access.' },
    { n: '03', t: 'Deploy your first balancer', d: 'Pick zone, add origins, choose strategy. 60 seconds.' },
  ];

  return (
    <div className="auth-grid min-h-screen grid grid-cols-1 md:grid-cols-2 bg-[var(--bg)] text-[var(--text)] transition-colors duration-200">
      {/* Left — Brand & Step Progression Panel */}
      <div className="hide-md relative flex flex-col justify-between p-8 lg:p-14 border-r border-[var(--line)] bg-[var(--surface-secondary,var(--bg-1))] overflow-hidden">
        <div className="relative z-10">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-xs font-mono text-[var(--text-3)] hover:text-[var(--text)] transition-colors active:scale-95"
          >
            ← edge/balancer
          </button>
        </div>

        <div className="relative z-10 my-auto py-8 max-w-md">
          {aside ?? (
            <>
              <div className="kicker mb-4">// three steps</div>
              <div className="space-y-4">
                {steps.map((s, i) => {
                  const active =
                    (step === 'register' && i === 0) ||
                    (step === 'connect' && i === 1) ||
                    (step === 'verified' && i === 2);
                  const done =
                    (step === 'connect' && i < 1) ||
                    (step === 'verified' && i < 2);
                  return (
                    <div
                      key={i}
                      className={`flex gap-4 p-4 rounded-2xl border transition-all duration-200 ${
                        active
                          ? 'border-[var(--accent)] bg-[var(--accent-dim)] shadow-sm'
                          : 'border-[var(--line)] bg-[var(--surface,var(--bg-1))]'
                      }`}
                    >
                      <div
                        className={`font-mono text-xs font-bold min-w-[24px] ${
                          active ? 'text-[var(--accent)]' : 'text-[var(--text-3)]'
                        }`}
                      >
                        {done ? <Icons.Check size={16} stroke="var(--green)" /> : s.n}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-[var(--text)]">{s.t}</div>
                        <div className="text-xs text-[var(--text-3)] mt-1 leading-relaxed">{s.d}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="relative z-10 font-mono text-[11px] text-[var(--text-3)] uppercase tracking-wider">
          &quot;Our p95 dropped 62% in a weekend.&quot; — platform eng, fintech
        </div>
      </div>

      {/* Right — Forms Panel */}
      <div className="relative flex min-h-screen items-center justify-center p-6 sm:p-12">
        <button
          onClick={onBack}
          className="hide-md-inverse absolute top-6 left-6 text-xs font-mono text-[var(--text-3)] hover:text-[var(--text)] transition-colors active:scale-95"
        >
          ← Back
        </button>
        <div className="w-full max-w-md">
          {children}
          {aside && (
            <div className="hide-md-inverse mt-6">
              {aside}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const GoogleG = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" className="shrink-0">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

export const GithubMark = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
    <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55 0-.27-.01-.99-.02-1.95-3.2.7-3.88-1.42-3.88-1.42-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.49-.28-5.11-1.25-5.11-5.56 0-1.23.44-2.23 1.16-3.02-.12-.28-.5-1.42.11-2.96 0 0 .94-.3 3.09 1.15a10.7 10.7 0 0 1 5.63 0c2.14-1.45 3.08-1.15 3.08-1.15.62 1.54.23 2.68.11 2.96.72.79 1.16 1.79 1.16 3.02 0 4.32-2.63 5.27-5.13 5.55.41.35.77 1.05.77 2.12 0 1.53-.01 2.76-.01 3.14 0 .3.2.67.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z"/>
  </svg>
);

export const Divider = ({ label }: { label: string }) => (
  <div className="flex items-center gap-3 my-4 font-mono text-[11px] text-[var(--text-3)] uppercase tracking-wider">
    <div className="flex-1 h-px bg-[var(--line)]" />
    <span>{label}</span>
    <div className="flex-1 h-px bg-[var(--line)]" />
  </div>
);
