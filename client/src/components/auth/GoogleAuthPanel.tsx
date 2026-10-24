'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { AuthLayout, GoogleG, GithubMark, Divider } from '@/components/auth/AuthLayout';
import { OtpInput } from '@/components/auth/OtpInput';
import { isFirebaseConfigured } from '@/lib/firebase';
import { Icons } from '@/components/shared/Icons';
import toast from 'react-hot-toast';
import type { SecondFactorMethod } from '@/types/api';

const COPY = {
  step: 'signin' as const,
  kicker: '// Get started',
  title: 'Sign in or create an account',
  subtitle: 'Continue with Google or GitHub — your account is created automatically.',
  cta: 'Continue with Google',
  ctaGithub: 'Continue with GitHub',
  busy: 'Signing in with Google...',
  busyGithub: 'Signing in with GitHub...',
  success: 'Signed in with Google',
  successGithub: 'Signed in with GitHub',
  failure: 'Google sign-in failed',
  failureGithub: 'GitHub sign-in failed',
};

type Stage = null | 'passkey' | 'totp' | 'choose';
type Busy = 'google' | 'github' | 'passkey' | 'totp' | null;

export function GoogleAuthPanel() {
  const router = useRouter();
  const { user, loginWithGoogle, loginWithGitHub, verifyTotp, verifyPasskey, loading: authLoading } = useAuth();
  const copy = COPY;
  const [busy, setBusy] = useState<Busy>(null);
  const [stage, setStage] = useState<Stage>(null);
  const [methods, setMethods] = useState<SecondFactorMethod[]>([]);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      router.push('/overview');
    }
  }, [user, authLoading, router]);

  const finish = (message: string) => {
    toast.success(message);
    router.push('/overview');
  };

  const startPasskey = async () => {
    setStage('passkey');
    setBusy('passkey');
    try {
      await verifyPasskey();
      finish('Signed in');
    } catch (error: any) {
      toast.error(error.message || 'Passkey sign-in failed');
      setStage('choose');
    } finally {
      setBusy(null);
    }
  };

  const handleLogin = async (
    provider: 'google' | 'github',
    login: () => Promise<{ twoFactorRequired: boolean; methods: SecondFactorMethod[]; preferred: SecondFactorMethod | null }>,
    success: string,
    failure: string
  ) => {
    setBusy(provider);
    try {
      const { twoFactorRequired, methods: available, preferred } = await login();

      if (twoFactorRequired) {
        setMethods(available);
        const next = preferred && available.includes(preferred)
          ? preferred
          : available.length === 1 ? available[0] : 'choose';

        if (next === 'passkey') {
          await startPasskey();
        } else {
          setStage(next);
        }
        return;
      }

      finish(success);
    } catch (error: any) {
      toast.error(error.message || failure);
    } finally {
      setBusy(null);
    }
  };

  const handleGoogle = () => handleLogin('google', loginWithGoogle, copy.success, copy.failure);
  const handleGitHub = () => handleLogin('github', loginWithGitHub, copy.successGithub, copy.failureGithub);

  const handleCode = async (value: string) => {
    setBusy('totp');
    setCodeError(false);
    try {
      await verifyTotp(value);
      finish('Signed in');
    } catch (error: any) {
      toast.error(error.message || 'That code is not valid');
      setCodeError(true);
      setCode('');
    } finally {
      setBusy(null);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <div className="text-center">
          <div className="w-10 h-10 mx-auto mb-4 border-2 border-[var(--line)] border-t-[var(--accent)] rounded-full animate-spin" />
          <p className="text-xs text-[var(--text-3)] font-mono">Loading...</p>
        </div>
      </div>
    );
  }

  if (stage) {
    const tryAnotherWay = methods.length > 1 && (
      <div className="text-center mt-6">
        <button
          type="button"
          onClick={() => setStage('choose')}
          disabled={busy !== null}
          className="text-[var(--accent)] hover:opacity-80 active:scale-95 transition-transform text-xs font-medium"
        >
          Try another way
        </button>
      </div>
    );

    return (
      <AuthLayout step="signin" onBack={() => { setStage(null); setMethods([]); }}>
        <div className="kicker mb-2">// Step 02 of 02</div>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text)]">
          {stage === 'passkey' ? 'Fetching Passkey' : stage === 'totp' ? 'Two-factor code' : 'Choose a method'}
        </h2>
        <p className="text-xs sm:text-sm text-[var(--text-3)] mt-2 mb-6 leading-relaxed">
          {stage === 'passkey'
            ? 'Confirm with your passkey, security key or password manager.'
            : stage === 'totp'
              ? 'Enter the 6-digit code from any of your authenticator apps.'
              : 'How would you like to confirm it is you?'}
        </p>

        {stage === 'passkey' && (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="w-10 h-10 border-2 border-[var(--line)] border-t-[var(--accent)] rounded-full animate-spin" />
            <div className="text-xs text-[var(--text-3)] font-mono">Waiting for your authenticator...</div>
          </div>
        )}

        {stage === 'totp' && (
          <>
            <OtpInput
              value={code}
              onChange={(value) => { setCode(value); if (codeError) setCodeError(false); }}
              onComplete={handleCode}
              error={codeError}
              disabled={busy !== null}
            />

            <div className="flex items-center justify-center gap-2 mt-5 text-xs text-[var(--text-3)]">
              {busy !== null ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-[var(--line)] border-t-[var(--accent)] rounded-full animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <Icons.Lock size={12} />
                  <span>The code changes every 30 seconds</span>
                </>
              )}
            </div>
          </>
        )}

        {stage === 'choose' && (
          <div className="flex flex-col gap-3">
            {methods.map((method) => (
              <button
                key={method}
                type="button"
                className="btn btn-ghost btn-lg w-full justify-start gap-3 shadow-xs"
                onClick={() => (method === 'passkey' ? startPasskey() : setStage('totp'))}
              >
                {method === 'passkey' ? <Icons.Key size={16} /> : <Icons.Lock size={16} />}
                <span>{method === 'passkey' ? 'Passkey or security key' : 'Authenticator app code'}</span>
              </button>
            ))}
          </div>
        )}

        {stage !== 'choose' && tryAnotherWay}
      </AuthLayout>
    );
  }

  return (
    <AuthLayout step={copy.step} onBack={() => router.push('/')}>
      <div className="kicker mb-2">{copy.kicker}</div>
      <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text)]">
        {copy.title}
      </h2>
      <p className="text-xs sm:text-sm text-[var(--text-3)] mt-2 mb-6 leading-relaxed">
        {copy.subtitle}
      </p>

      {isFirebaseConfigured() ? (
        <div className="space-y-3">
          <button
            type="button"
            className="btn btn-ghost btn-lg w-full justify-center gap-3 shadow-xs"
            onClick={handleGoogle}
            disabled={busy !== null}
          >
            <GoogleG />
            <span>{busy === 'google' ? copy.busy : copy.cta}</span>
          </button>

          <Divider label="or" />

          <button
            type="button"
            className="btn btn-ghost btn-lg w-full justify-center gap-3 shadow-xs"
            onClick={handleGitHub}
            disabled={busy !== null}
          >
            <GithubMark />
            <span>{busy === 'github' ? copy.busyGithub : copy.ctaGithub}</span>
          </button>
        </div>
      ) : (
        <div className="p-4 rounded-xl border border-[var(--line)] bg-[var(--surface,var(--bg-1))] text-xs text-[var(--text-2)] leading-relaxed">
          Sign-in isn&apos;t configured on this deployment. Set the
          {' '}<span className="font-mono text-[var(--accent)] font-semibold">NEXT_PUBLIC_FIREBASE_*</span>{' '}
          environment variables and reload.
        </div>
      )}
    </AuthLayout>
  );
}
