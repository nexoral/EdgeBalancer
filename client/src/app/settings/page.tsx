'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { Sidebar, Topbar } from '@/components/dashboard/Sidebar';
import { Icons } from '@/components/shared/Icons';
import { OtpInput } from '@/components/auth/OtpInput';
import toast from 'react-hot-toast';
import { permissionSummary } from '@/lib/cloudflarePermissions';
import { ConfirmModal } from '@/components/ui/Modal';
import { isPasskeySupported, registerPasskey } from '@/lib/passkey';
import type { Credential, SecondFactorMethod } from '@/types/api';

export default function SettingsPage() {
  const router = useRouter();
  const { user, loading: authLoading, refreshUser, logout } = useAuth();

  // Wait for the auth check to finish — redirecting on the initial null makes /settings
  // impossible to open directly.
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  if (authLoading || !user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 48, height: 48, margin: '0 auto 16px',
            border: '2px solid var(--line)', borderTopColor: 'var(--accent)',
            borderRadius: '50%', animation: 'spin 0.9s linear infinite',
          }} />
          <p style={{ color: 'var(--text-3)' }}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell" style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar
        current="settings"
        onNav={(id) => {
          if (id === 'overview') router.push('/overview');
    if (id === 'gateways') router.push('/gateways');
          else if (id === 'balancers') router.push('/loadbalancers');
          else if (id === 'sessions') router.push('/sessions');
          else if (id === 'ai-runs') router.push('/ai-runs');
          else if (id === 'pro') router.push('/pro');
          else if (id === 'payments') router.push('/payments');
        }}
        onLogout={handleLogout}
        userEmail={user?.email}
        hasCloudflareCredentials={user?.hasCloudflareCredentials}
        cloudflareOAuthConnected={user?.cloudflareOAuthConnected}
        isReady={!!user?.hasCloudflareCredentials}
        isPro={user?.isPro}
        plan={user?.plan}
        planExpiresAt={user?.planExpiresAt}
      />
      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Topbar
          crumbs={['Overview', 'Settings']}
          title="Settings"
          subtitle="Manage your Cloudflare integration"
        />
        <div style={{ padding: 'clamp(16px, 4vw, 32px)', overflow: 'auto', flex: 1 }}>
          <div className="slide-in settings-grid">
            <CloudflareTab user={user} refreshUser={refreshUser} />
            <TwoFactorSection user={user} refreshUser={refreshUser} />
          </div>
        </div>
      </main>
    </div>
  );
}

function TwoFactorSection({ user, refreshUser }: any) {
  const setPreference = async (method: SecondFactorMethod | null) => {
    try {
      await api.setSecondFactorPreference({ method });
      await refreshUser();
    } catch (error: any) {
      toast.error(error.message || 'Could not save preference');
    }
  };

  return (
    <div>
      <div className="kicker" style={{ marginBottom: 8 }}>// account security</div>
      <h2 style={{ fontSize: 22, margin: 0, letterSpacing: '-0.02em', fontWeight: 500 }}>
        Two-Factor Authentication
      </h2>
      <p style={{ fontSize: 14, color: 'var(--text-3)', marginTop: 8, marginBottom: 20, lineHeight: 1.6 }}>
        Add a second step after Google sign-in. Enrol as many as you like — there are no recovery codes,
        so a spare is what keeps you from being locked out.
      </p>

      <div className="settings-cards">
        <TotpCard user={user} refreshUser={refreshUser} onPrefer={setPreference} />
        <PasskeyCard user={user} refreshUser={refreshUser} onPrefer={setPreference} />
      </div>
    </div>
  );
}

function PreferToggle({ method, preferred, onPrefer, disabled }: {
  method: SecondFactorMethod;
  preferred: SecondFactorMethod | null;
  onPrefer: (method: SecondFactorMethod | null) => void;
  disabled?: boolean;
}) {
  const checked = preferred === method;

  return (
    <label style={{
      display: 'flex', alignItems: 'center', gap: 10, cursor: disabled ? 'not-allowed' : 'pointer',
      padding: 12, borderRadius: 'var(--radius)',
      border: `1px solid ${checked ? 'var(--accent)' : 'var(--line)'}`,
      background: checked ? 'var(--accent-dim)' : 'transparent',
      transition: 'border-color 140ms, background 140ms',
      opacity: disabled ? 0.5 : 1,
    }}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={() => onPrefer(checked ? null : method)}
        style={{ accentColor: 'var(--accent)', width: 15, height: 15 }}
      />
      <span style={{ fontSize: 13, color: checked ? 'var(--text)' : 'var(--text-3)' }}>
        Prefer this at sign-in
      </span>
    </label>
  );
}

function CredentialRow({ credential, active, disabled, onRemove }: {
  credential: Credential;
  active?: boolean;
  disabled?: boolean;
  onRemove: () => void;
}) {
  return (
    <div style={{
      padding: 16, background: 'var(--bg-2)',
      border: `1px solid ${active ? 'var(--accent)' : 'var(--line)'}`,
      borderRadius: 'var(--radius)',
      display: 'flex', gap: 12, alignItems: 'center',
      transition: 'border-color 140ms',
    }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 8px var(--green)', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="mono" style={{ fontSize: 13, color: 'var(--text)' }}>{credential.name}</div>
        <div className="hint">Added {new Date(credential.createdAt).toLocaleDateString()}</div>
      </div>
      <button type="button" className="btn btn-ghost btn-sm" disabled={disabled}
        aria-label={`Remove ${credential.name}`} onClick={onRemove}>
        <Icons.Trash size={14} />
      </button>
    </div>
  );
}

function NameStep({ label, placeholder, busy, onSave, onSkip }: {
  label: string;
  placeholder: string;
  busy: boolean;
  onSave: (name: string) => void;
  onSkip: () => void;
}) {
  const [value, setValue] = useState('');

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{
        padding: 16, background: 'var(--bg-2)',
        border: '1px solid var(--green)', borderRadius: 'var(--radius)',
        display: 'flex', gap: 12, alignItems: 'center',
      }}>
        <Icons.Check size={16} stroke="var(--green)" />
        <div style={{ fontSize: 13, color: 'var(--text-2)' }}>{label}</div>
      </div>

      <div className="field">
        <label className="field-label">Give it a name <span className="hint">(optional)</span></label>
        <input
          type="text"
          className="input"
          maxLength={30}
          placeholder={placeholder}
          value={value}
          disabled={busy}
          autoFocus
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && value.trim()) onSave(value.trim()); }}
        />
        <div className="hint">Leave it blank and we will name it for you.</div>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <button className="btn btn-primary" disabled={busy || !value.trim()} onClick={() => onSave(value.trim())}>
          <Icons.Check size={14} /> Save name
        </button>
        <button className="btn btn-ghost" disabled={busy} onClick={onSkip}>Skip</button>
      </div>
    </div>
  );
}

function TotpCard({ user, refreshUser, onPrefer }: any) {
  const devices: Credential[] = user?.totpDevices || [];
  const [mode, setMode] = useState<'idle' | 'enrolling' | 'naming' | 'removing'>('idle');
  const [enrolment, setEnrolment] = useState<{ deviceId: string; name: string; secret: string; qrDataUrl: string } | null>(null);
  const [removeTarget, setRemoveTarget] = useState<Credential | null>(null);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState(false);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setMode('idle');
    setEnrolment(null);
    setRemoveTarget(null);
    setCode('');
    setCodeError(false);
  };

  const startEnrolment = async () => {
    setBusy(true);
    try {
      const response = await api.setupTotp({});
      setEnrolment(response.data);
      setMode('enrolling');
      setCode('');
      setCodeError(false);
    } catch (error: any) {
      toast.error(error.message || 'Could not start setup');
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async (value: string) => {
    setBusy(true);
    setCodeError(false);
    try {
      if (mode === 'enrolling' && enrolment) {
        await api.confirmTotp({ deviceId: enrolment.deviceId, code: value });
        await refreshUser();
        // The code expires in 30s, so it is spent immediately and the name is asked for after.
        setMode('naming');
        setCode('');
        return;
      }

      if (mode === 'removing' && removeTarget) {
        await api.removeTotp({ deviceId: removeTarget.id, code: value });
        toast.success('Authenticator app removed');
      }
      await refreshUser();
      reset();
    } catch (error: any) {
      toast.error(error.message || 'That code is not valid');
      setCodeError(true);
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  const saveName = async (value: string) => {
    setBusy(true);
    try {
      await api.renameCredential({ kind: 'totp', id: enrolment!.deviceId, name: value });
      await refreshUser();
    } catch (error: any) {
      toast.error(error.message || 'Could not save the name');
    } finally {
      setBusy(false);
      reset();
    }
  };

  const codePrompt = mode === 'enrolling'
    ? 'Enter the 6-digit code your app is showing to finish setup.'
    : devices.length > 1
      ? 'Enter a code from one of your other authenticator apps to remove this one.'
      : 'This is your last authenticator app — removing it turns two-factor authentication off.';

  return (
    <div className="card" style={{ padding: 28, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 20, right: 20, opacity: 0.06, pointerEvents: 'none' }}>
        <Icons.Shield size={80} />
      </div>

      <div style={{ position: 'relative' }}>
        <h2 style={{ fontSize: 22, margin: 0, letterSpacing: '-0.02em', fontWeight: 500 }}>
          TOTP Method
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-3)', marginTop: 8, marginBottom: 20, lineHeight: 1.6 }}>
          A 6-digit code from an authenticator app, generated offline.
        </p>

        {devices.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <PreferToggle method="totp" preferred={user?.preferredSecondFactor ?? null} onPrefer={onPrefer} disabled={busy} />
          </div>
        )}

        {mode === 'naming' ? (
          <NameStep
            label="Authenticator app verified and enabled."
            placeholder="e.g. iPhone, Authy, 1Password"
            busy={busy}
            onSave={saveName}
            onSkip={reset}
          />
        ) : mode === 'enrolling' && enrolment ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="kicker">
              Setting up <span style={{ color: 'var(--accent)' }}>{enrolment.name}</span>
            </div>

            <div style={{
              display: 'flex', justifyContent: 'center', padding: 16,
              background: '#fff', borderRadius: 'var(--radius)', alignSelf: 'center',
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={enrolment.qrDataUrl} alt="Scan this QR code with your authenticator app" width={200} height={200} />
            </div>

            <div style={{ padding: 16, background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 'var(--radius)' }}>
              <div className="kicker" style={{ marginBottom: 8 }}>Or enter this key manually</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
                <span className="mono" style={{ fontSize: 13, color: 'var(--text)', wordBreak: 'break-all' }}>
                  {enrolment.secret.replace(/(.{4})/g, '$1 ').trim()}
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    navigator.clipboard.writeText(enrolment.secret);
                    toast.success('Key copied');
                  }}
                >
                  <Icons.Copy size={14} />
                </button>
              </div>
            </div>

            <div>
              <div className="field-label" style={{ marginBottom: 12 }}>{codePrompt}</div>
              <OtpInput
                value={code}
                onChange={(value) => { setCode(value); if (codeError) setCodeError(false); }}
                onComplete={submitCode}
                error={codeError}
                disabled={busy}
              />
            </div>

            <button type="button" className="btn btn-ghost" onClick={reset} disabled={busy} style={{ alignSelf: 'flex-start' }}>
              Cancel
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {devices.length === 0 ? (
              <div style={{
                padding: 16, background: 'var(--bg-2)',
                border: '1px solid var(--line)', borderRadius: 'var(--radius)',
                display: 'flex', gap: 12, alignItems: 'center',
              }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--text-3)' }} />
                <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
                  No authenticator app enrolled
                </div>
              </div>
            ) : (
              devices.map((device) => (
                <div key={device.id}>
                  <CredentialRow
                    credential={device}
                    active={removeTarget?.id === device.id}
                    disabled={busy}
                    onRemove={() => {
                      if (removeTarget?.id === device.id) {
                        reset();
                        return;
                      }
                      setMode('removing');
                      setRemoveTarget(device);
                      setCode('');
                      setCodeError(false);
                    }}
                  />

                  {mode === 'removing' && removeTarget?.id === device.id && (
                    <div className="fade-in" style={{ paddingTop: 16 }}>
                      <div className="hint" style={{ marginBottom: 12, color: devices.length > 1 ? 'var(--text-3)' : 'var(--red)' }}>
                        {codePrompt}
                      </div>
                      <OtpInput
                        value={code}
                        onChange={(value) => { setCode(value); if (codeError) setCodeError(false); }}
                        onComplete={submitCode}
                        error={codeError}
                        disabled={busy}
                      />
                    </div>
                  )}
                </div>
              ))
            )}

            {devices.length === 1 && (
              <div className="hint" style={{ color: 'var(--accent)' }}>
                Add a second app — with only one enrolled, losing that device locks you out.
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, alignItems: 'center', paddingTop: 8, flexWrap: 'wrap' }}>
              <button
                className="btn btn-primary"
                onClick={startEnrolment}
                disabled={busy}
              >
                <Icons.Plus size={14} /> Add authenticator app
              </button>
              <span className="hint">
                {devices.length === 1 ? '1 app enrolled' : `${devices.length} apps enrolled`}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PasskeyCard({ user, refreshUser, onPrefer }: any) {
  const passkeys: Credential[] = user?.passkeys || [];
  const [busy, setBusy] = useState(false);
  const [namingId, setNamingId] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<Credential | null>(null);
  const supported = isPasskeySupported();

  const add = async () => {
    setBusy(true);
    try {
      const response = await registerPasskey();
      await refreshUser();
      // Named afterwards, so the authenticator prompt is the first thing the user sees.
      setNamingId(response.data.passkeyId);
    } catch (error: any) {
      toast.error(error.message || 'Could not add passkey');
    } finally {
      setBusy(false);
    }
  };

  const saveName = async (value: string) => {
    setBusy(true);
    try {
      await api.renameCredential({ kind: 'passkey', id: namingId!, name: value });
      await refreshUser();
    } catch (error: any) {
      toast.error(error.message || 'Could not save the name');
    } finally {
      setBusy(false);
      setNamingId(null);
    }
  };

  const remove = async () => {
    if (!removeTarget) return;
    setBusy(true);
    try {
      await api.removePasskey({ passkeyId: removeTarget.id });
      toast.success('Passkey removed');
      await refreshUser();
      setRemoveTarget(null);
    } catch (error: any) {
      toast.error(error.message || 'Could not remove passkey');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card" style={{ padding: 28, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 20, right: 20, opacity: 0.06, pointerEvents: 'none' }}>
        <Icons.Key size={80} />
      </div>

      <div style={{ position: 'relative' }}>
        <h2 style={{ fontSize: 22, margin: 0, letterSpacing: '-0.02em', fontWeight: 500 }}>
          Passkey
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-3)', marginTop: 8, marginBottom: 20, lineHeight: 1.6 }}>
          A security key, phone, or password manager like Bitwarden. Nothing to type.
        </p>

        {passkeys.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <PreferToggle method="passkey" preferred={user?.preferredSecondFactor ?? null} onPrefer={onPrefer} disabled={busy} />
          </div>
        )}

        {namingId ? (
          <NameStep
            label="Passkey registered and enabled."
            placeholder="e.g. YubiKey, Bitwarden, MacBook"
            busy={busy}
            onSave={saveName}
            onSkip={() => setNamingId(null)}
          />
        ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {passkeys.length === 0 ? (
            <div style={{
              padding: 16, background: 'var(--bg-2)',
              border: '1px solid var(--line)', borderRadius: 'var(--radius)',
              display: 'flex', gap: 12, alignItems: 'center',
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--text-3)' }} />
              <div style={{ fontSize: 13, color: 'var(--text-2)' }}>No passkey registered</div>
            </div>
          ) : (
            passkeys.map((passkey) => (
              <CredentialRow
                key={passkey.id}
                credential={passkey}
                disabled={busy}
                onRemove={() => setRemoveTarget(passkey)}
              />
            ))
          )}

          {passkeys.length === 1 && (
            <div className="hint" style={{ color: 'var(--accent)' }}>
              Add a second passkey — with only one registered, losing that device locks you out.
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', paddingTop: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={add} disabled={busy || !supported}>
              <Icons.Plus size={14} /> Add passkey
            </button>
            <span className="hint">
              {!supported
                ? 'This browser does not support passkeys.'
                : passkeys.length === 1 ? '1 passkey registered' : `${passkeys.length} passkeys registered`}
            </span>
          </div>
        </div>
        )}
      </div>

      <ConfirmModal
        isOpen={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={remove}
        title="Remove passkey"
        message={
          passkeys.length === 1
            ? `Remove "${removeTarget?.name}"? This is your last passkey.`
            : `Remove "${removeTarget?.name}"? It will no longer work at sign-in.`
        }
        confirmText="Remove"
        confirmVariant="danger"
        loading={busy}
      />
    </div>
  );
}

const CF_ORANGE = '#F48120';
const CF_ORANGE_DIM = 'rgba(244, 129, 32, 0.10)';
const CF_ORANGE_BORDER = 'rgba(244, 129, 32, 0.28)';

function CloudflareTab({ user, refreshUser }: any) {
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [credentials, setCredentials] = useState<{ accountId: string | null; apiToken: string | null }>({
    accountId: null,
    apiToken: null,
  });
  const [formData, setFormData] = useState({ accountId: '', apiToken: '' });

  const isOAuth = user?.cloudflareOAuthConnected;

  useEffect(() => {
    if (user?.hasCloudflareCredentials && !isOAuth) fetchCredentials();
  }, [user]);

  const fetchCredentials = async () => {
    try {
      const response = await api.getCloudflareCredentials();
      if (response.success && response.data) {
        setCredentials({
          accountId: response.data.accountId,
          apiToken: response.data.apiToken,
        });
      }
    } catch (error) {
      // Silent fail
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.accountId.trim()) {
      toast.error('Account ID is required');
      return;
    }
    if (!formData.apiToken.trim()) {
      toast.error('API Token is required');
      return;
    }

    setLoading(true);
    try {
      await api.updateCloudflareCredentials({
        accountId: formData.accountId,
        apiToken: formData.apiToken,
      });
      toast.success('Cloudflare credentials updated successfully');
      await refreshUser();
      await fetchCredentials();
      setEditing(false);
      setFormData({ accountId: '', apiToken: '' });
    } catch (error: any) {
      toast.error(error.message || 'Failed to update credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthConnect = async () => {
    setLoading(true);
    try {
      const response = await api.getCloudflareOAuthUrl();
      if (response.data?.url) {
        window.location.href = response.data.url;
      } else {
        toast.error('Failed to generate authorization URL');
        setLoading(false);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to connect to Cloudflare');
      setLoading(false);
    }
  };

  const handleOAuthDisconnect = async () => {
    setLoading(true);
    try {
      await api.disconnectCloudflareOAuth();
      toast.success('Cloudflare OAuth disconnected');
      await refreshUser();
    } catch (error: any) {
      toast.error(error.message || 'Failed to disconnect');
    } finally {
      setLoading(false);
    }
  };

  const handleManualDisconnect = async () => {
    setLoading(true);
    try {
      await api.updateCloudflareCredentials({ accountId: '', apiToken: '' });
      toast.success('Manual credentials removed');
      await refreshUser();
    } catch (error: any) {
      toast.error(error.message || 'Failed to disconnect');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{
      padding: 28, position: 'relative', overflow: 'hidden',
      borderColor: CF_ORANGE_BORDER,
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: CF_ORANGE,
        borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
      }} />

      <div style={{
        position: 'absolute', top: 20, right: 20,
        opacity: 0.07, pointerEvents: 'none', color: CF_ORANGE,
      }}>
        <Icons.Cloud size={80} />
      </div>

      <div style={{ position: 'relative' }}>
        <div className="kicker" style={{ marginBottom: 8, color: CF_ORANGE }}>// cloudflare integration</div>
        <h2 style={{ fontSize: 22, margin: 0, letterSpacing: '-0.02em', fontWeight: 500 }}>
          Cloudflare Connection
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-3)', marginTop: 8, marginBottom: 32, lineHeight: 1.6 }}>
          {isOAuth
            ? 'Connected via Cloudflare OAuth. Tokens are refreshed automatically.'
            : 'Your credentials are encrypted with AES-256-GCM and stored securely.'}
        </p>

        {/* Current connection status */}
        {user?.hasCloudflareCredentials ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Connection method indicator */}
            <div style={{
              padding: 16,
              background: CF_ORANGE_DIM,
              border: `1px solid ${CF_ORANGE_BORDER}`,
              borderRadius: 'var(--radius)',
              display: 'flex', gap: 12, alignItems: 'center',
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: CF_ORANGE,
                boxShadow: `0 0 8px ${CF_ORANGE}`,
                flexShrink: 0,
              }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 500 }}>
                  {isOAuth ? 'Connected via OAuth' : 'Connected via API Token'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                  {isOAuth
                    ? 'Automatic connection — no manual token needed'
                    : `Account ID: ${credentials.accountId || '••••'}`}
                </div>
              </div>
            </div>

            {/* Switch connection method */}
            <div style={{
              padding: 16, background: 'var(--bg-2)',
              border: '1px solid var(--line)', borderRadius: 'var(--radius)',
            }}>
              <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12 }}>
                Switch connection method
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {!isOAuth && (
                  <button
                    className="btn btn-primary"
                    onClick={handleOAuthConnect}
                    disabled={loading}
                  >
                    <Icons.Cloud size={14} /> Switch to OAuth
                  </button>
                )}
                {isOAuth && (
                  <button
                    className="btn btn-ghost"
                    onClick={() => setEditing(true)}
                    disabled={loading}
                  >
                    <Icons.Key size={14} /> Switch to Manual Token
                  </button>
                )}
                <button
                  className="btn btn-ghost"
                  onClick={isOAuth ? handleOAuthDisconnect : handleManualDisconnect}
                  disabled={loading}
                  style={{ color: 'var(--red)' }}
                >
                  <Icons.Trash size={14} /> Disconnect
                </button>
              </div>
            </div>

            {/* Manual token edit form (when switching from OAuth to manual) */}
            {editing && isOAuth && (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{
                  padding: 12, background: 'var(--accent-dim)',
                  border: '1px solid var(--accent)', borderRadius: 'var(--radius)',
                  fontSize: 13, color: 'var(--text-2)',
                }}>
                  Switching to manual token will disconnect your OAuth connection.
                </div>
                <div className="field">
                  <label className="field-label">
                    Cloudflare Account ID <span className="req">*</span>
                  </label>
                  <input
                    type="text"
                    className="input input-mono"
                    placeholder="32-character hexadecimal account ID"
                    value={formData.accountId}
                    onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                    disabled={loading}
                  />
                </div>
                <div className="field">
                  <label className="field-label">
                    Cloudflare API Token <span className="req">*</span>
                  </label>
                  <input
                    type="password"
                    className="input input-mono"
                    placeholder="Paste your API token here"
                    value={formData.apiToken}
                    onChange={(e) => setFormData({ ...formData, apiToken: e.target.value })}
                    disabled={loading}
                  />
                  <div className="hint">
                    Token must have <span className="mono" style={{ color: 'var(--accent)' }}>{permissionSummary()}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Verifying...' : 'Save Credentials'}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => {
                    setEditing(false);
                    setFormData({ accountId: '', apiToken: '' });
                  }} disabled={loading}>
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          /* Not connected state */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center' }}>
            <button
              onClick={handleOAuthConnect}
              disabled={loading}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                width: '100%', padding: '12px 22px', borderRadius: 'var(--radius-xl)',
                fontSize: 15, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
                border: `1px solid ${CF_ORANGE}`,
                background: CF_ORANGE,
                color: '#fff',
                opacity: loading ? 0.7 : 1,
                transition: 'filter 150ms ease, box-shadow 150ms ease',
                boxShadow: `0 1px 2px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.18)`,
              }}
              onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1.08)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.filter = ''; }}
            >
              <Icons.Cloud size={18} />
              {loading ? 'Redirecting...' : 'Connect with Cloudflare'}
              {!loading && <Icons.Arrow size={14} />}
            </button>

            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, width: '100%',
              color: 'var(--text-3)', fontSize: 13,
            }}>
              <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
              <span>or</span>
              <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
            </div>

            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setEditing(true)}
              disabled={loading}
              style={{ fontSize: 14, color: 'var(--text-3)' }}
            >
              <Icons.Key size={14} />
              Enter API token manually
            </button>

            {editing && (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%' }}>
                <div className="field">
                  <label className="field-label">
                    Cloudflare Account ID <span className="req">*</span>
                  </label>
                  <input
                    type="text"
                    className="input input-mono"
                    placeholder="32-character hexadecimal account ID"
                    value={formData.accountId}
                    onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                    disabled={loading}
                  />
                </div>
                <div className="field">
                  <label className="field-label">
                    Cloudflare API Token <span className="req">*</span>
                  </label>
                  <input
                    type="password"
                    className="input input-mono"
                    placeholder="Paste your API token here"
                    value={formData.apiToken}
                    onChange={(e) => setFormData({ ...formData, apiToken: e.target.value })}
                    disabled={loading}
                  />
                  <div className="hint">
                    Token must have <span className="mono" style={{ color: 'var(--accent)' }}>{permissionSummary()}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Verifying...' : 'Save Credentials'}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => {
                    setEditing(false);
                    setFormData({ accountId: '', apiToken: '' });
                  }} disabled={loading}>
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        @media (max-width: 768px) {
          div[style*="padding"] {
            padding: 16px !important;
          }
        }
        @media (max-width: 640px) {
          div[style*="gridTemplateColumns"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
