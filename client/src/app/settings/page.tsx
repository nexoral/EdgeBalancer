'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { Sidebar, Topbar } from '@/components/dashboard/Sidebar';
import { Icons } from '@/components/shared/Icons';
import toast from 'react-hot-toast';

type Tab = 'security' | 'cloudflare';

export default function SettingsPage() {
  const router = useRouter();
  const { user, refreshUser, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('security');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      router.push('/login');
    } else {
      setLoading(false);
    }
  }, [user, router]);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  if (loading || !user) {
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
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)', flexDirection: 'row' }}>
      <Sidebar
        current="settings"
        onNav={(id) => {
          if (id === 'balancers') router.push('/dashboard');
          else if (id === 'settings') router.push('/settings');
        }}
        onLogout={handleLogout}
        userEmail={user?.email}
      />
      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Topbar
          crumbs={['Dashboard', 'Settings']}
          title="Settings"
          subtitle="Manage your account security and integrations"
        />
        <div style={{ padding: 'clamp(16px, 4vw, 32px)', maxWidth: 1000, overflow: 'auto', flex: 1 }}>
          {/* Tab Navigation */}
          <div style={{
            display: 'inline-flex', gap: 2, marginBottom: 'clamp(20px, 3vw, 32px)',
            background: 'var(--bg-1)', border: '1px solid var(--line)',
            borderRadius: 'var(--radius)', padding: 4, flexWrap: 'wrap',
          }}>
            <button
              onClick={() => setActiveTab('security')}
              className="btn btn-sm"
              style={{
                background: activeTab === 'security' ? 'var(--accent)' : 'transparent',
                color: activeTab === 'security' ? 'oklch(0.18 0.02 60)' : 'var(--text-2)',
                border: 'none',
                fontSize: 'clamp(12px, 2vw, 13px)',
              }}
            >
              <Icons.Lock size={14} /> Security
            </button>
            <button
              onClick={() => setActiveTab('cloudflare')}
              className="btn btn-sm"
              style={{
                background: activeTab === 'cloudflare' ? 'var(--accent)' : 'transparent',
                color: activeTab === 'cloudflare' ? 'oklch(0.18 0.02 60)' : 'var(--text-2)',
                border: 'none',
              }}
            >
              <Icons.Cloud size={14} /> Cloudflare
            </button>
          </div>

          {/* Tab Content */}
          <div className="slide-in">
            {activeTab === 'security' ? (
              <SecurityTab />
            ) : (
              <CloudflareTab user={user} refreshUser={refreshUser} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function SecurityTab() {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.currentPassword) newErrors.currentPassword = 'Current password is required';
    if (!formData.newPassword) newErrors.newPassword = 'New password is required';
    else if (formData.newPassword.length < 8) newErrors.newPassword = 'Minimum 8 characters required';
    if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);
    try {
      await api.changePassword({
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
      });
      toast.success('Password updated successfully');
      setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setErrors({});
    } catch (error: any) {
      toast.error(error.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ padding: 28, maxWidth: 640, position: 'relative', overflow: 'hidden' }}>
      {/* Decorative icon */}
      <div style={{
        position: 'absolute', top: 20, right: 20,
        opacity: 0.06, pointerEvents: 'none',
      }}>
        <Icons.Lock size={80} />
      </div>

      <div style={{ position: 'relative' }}>
        <div className="kicker" style={{ marginBottom: 8 }}>// account security</div>
        <h2 style={{ fontSize: 22, margin: 0, letterSpacing: '-0.02em', fontWeight: 500 }}>
          Update Password
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-3)', marginTop: 8, marginBottom: 32, lineHeight: 1.6 }}>
          Use a unique password to keep your Cloudflare credentials secure.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Current Password */}
          <div className="field">
            <label className="field-label">
              Current Password <span className="req">*</span>
            </label>
            <input
              type="password"
              className="input"
              value={formData.currentPassword}
              onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
              disabled={loading}
              autoComplete="current-password"
            />
            {errors.currentPassword && (
              <div className="hint" style={{ color: 'var(--red)' }}>{errors.currentPassword}</div>
            )}
          </div>

          {/* New Password */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            <div className="field">
              <label className="field-label">
                New Password <span className="req">*</span>
              </label>
              <input
                type="password"
                className="input"
                value={formData.newPassword}
                onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                disabled={loading}
                autoComplete="new-password"
              />
              {errors.newPassword && (
                <div className="hint" style={{ color: 'var(--red)' }}>{errors.newPassword}</div>
              )}
            </div>

            <div className="field">
              <label className="field-label">
                Confirm New <span className="req">*</span>
              </label>
              <input
                type="password"
                className="input"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                disabled={loading}
                autoComplete="new-password"
              />
              {errors.confirmPassword && (
                <div className="hint" style={{ color: 'var(--red)' }}>{errors.confirmPassword}</div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, paddingTop: 8 }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div style={{
                    width: 14, height: 14,
                    border: '2px solid currentColor', borderTopColor: 'transparent',
                    borderRadius: '50%', animation: 'spin 0.6s linear infinite',
                  }} />
                  Updating...
                </>
              ) : (
                <>
                  <Icons.Check size={14} /> Update Password
                </>
              )}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                setErrors({});
              }}
              disabled={loading}
            >
              Clear
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CloudflareTab({ user, refreshUser }: any) {
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [credentials, setCredentials] = useState<{ accountId: string | null; apiToken: string | null }>({
    accountId: null,
    apiToken: null,
  });
  const [formData, setFormData] = useState({ accountId: '', apiToken: '' });

  useEffect(() => {
    if (user?.hasCloudflareCredentials) fetchCredentials();
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
      // Silent fail - credentials might not exist yet
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

  return (
    <div className="card" style={{ padding: 28, maxWidth: 640, position: 'relative', overflow: 'hidden' }}>
      {/* Decorative icon */}
      <div style={{
        position: 'absolute', top: 20, right: 20,
        opacity: 0.06, pointerEvents: 'none',
      }}>
        <Icons.Cloud size={80} />
      </div>

      <div style={{ position: 'relative' }}>
        <div className="kicker" style={{ marginBottom: 8 }}>// cloudflare integration</div>
        <h2 style={{ fontSize: 22, margin: 0, letterSpacing: '-0.02em', fontWeight: 500 }}>
          API Credentials
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-3)', marginTop: 8, marginBottom: 32, lineHeight: 1.6 }}>
          Your credentials are encrypted with AES-256-CBC and stored securely.
        </p>

        {!editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Account ID */}
            <div style={{
              padding: 16, background: 'var(--bg-2)',
              border: '1px solid var(--line)', borderRadius: 'var(--radius)',
            }}>
              <div className="kicker" style={{ marginBottom: 8 }}>Account ID</div>
              <div className="mono" style={{ fontSize: 13, color: 'var(--text)' }}>
                {credentials.accountId || 'Not configured'}
              </div>
            </div>

            {/* API Token */}
            <div style={{
              padding: 16, background: 'var(--bg-2)',
              border: '1px solid var(--line)', borderRadius: 'var(--radius)',
            }}>
              <div className="kicker" style={{ marginBottom: 8 }}>API Token</div>
              <div className="mono" style={{ fontSize: 13, color: 'var(--text)' }}>
                {credentials.apiToken ? '••••••••••••••••••••••••' : 'Not configured'}
              </div>
            </div>

            {/* Status indicator */}
            {credentials.accountId && (
              <div style={{
                padding: 16, background: 'var(--bg)',
                border: '1px solid var(--line)', borderRadius: 'var(--radius)',
                display: 'flex', gap: 12, alignItems: 'center',
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: 'var(--green)', boxShadow: '0 0 8px var(--green)',
                }} />
                <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
                  Credentials active and encrypted
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, paddingTop: 8 }}>
              <button
                className="btn btn-primary"
                onClick={() => setEditing(true)}
              >
                <Icons.Edit size={14} /> {credentials.accountId ? 'Rotate Credentials' : 'Configure Credentials'}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Account ID */}
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
              <div className="hint">
                Find this in your Cloudflare dashboard under Account → Workers & Pages
              </div>
            </div>

            {/* API Token */}
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
                Token must have <span className="mono" style={{ color: 'var(--accent)' }}>Workers Scripts: Edit</span>, <span className="mono" style={{ color: 'var(--accent)' }}>Account Analytics: Read</span>, and <span className="mono" style={{ color: 'var(--accent)' }}>Zone: Read</span> permissions
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, paddingTop: 8 }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div style={{
                      width: 14, height: 14,
                      border: '2px solid currentColor', borderTopColor: 'transparent',
                      borderRadius: '50%', animation: 'spin 0.6s linear infinite',
                    }} />
                    Verifying...
                  </>
                ) : (
                  <>
                    <Icons.Check size={14} /> Save Credentials
                  </>
                )}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setEditing(false);
                  setFormData({ accountId: '', apiToken: '' });
                }}
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </form>
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
