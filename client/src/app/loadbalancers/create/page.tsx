'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { Sidebar, Topbar } from '@/components/dashboard/Sidebar';
import { Icons } from '@/components/shared/Icons';
import { DeploymentOverlay, DeploymentSuccessModal } from '@/components/loadbalancers/DeploymentExperience';
import { MultiSelect } from '@/components/ui/MultiSelect';
import { LoadBalancerVisualization } from '@/components/loadbalancers/LoadBalancerVisualization';
import { CONTINENTS, COUNTRIES, getCitiesByCountry, getSubdivisionsByCountry, CITIES_BY_SUBDIVISION, getFlagEmoji } from '@/lib/geoData';
import { ALL_CLOUD_REGIONS, REGIONS_BY_PROVIDER } from '@/lib/cloudRegions';
import type { LoadBalancerStrategy } from '@/types/api';
import toast from 'react-hot-toast';

const STRATEGIES = [
  { id: 'round-robin', title: 'Round Robin', desc: 'Rotate requests across origins in edge-local sequence.', icon: 'Refresh' },
  { id: 'weighted-round-robin', title: 'Weighted Round Robin', desc: 'Bias traffic toward stronger origins with per-server weights.', icon: 'Activity' },
  { id: 'ip-hash', title: 'IP Hash', desc: 'Send the same client IP back to the same origin whenever possible.', icon: 'Key' },
  { id: 'cookie-sticky', title: 'Sticky Session', desc: 'Set a cookie so repeat visitors stay on the same origin.', icon: 'Link' },
  { id: 'weighted-cookie-sticky', title: 'Weighted Sticky', desc: 'Assign first visit by weight, then keep that visitor pinned with a cookie.', icon: 'Layers' },
  { id: 'failover', title: 'Failover', desc: 'Try origins in order and move to the next one when an origin fails.', icon: 'Shield' },
  { id: 'geo-steering', title: 'Geo Steering', desc: 'Route users to different servers based on their geographic location (country, region, or continent).', icon: 'Globe' },
];

const STEPS = [
  { n: 1, label: 'Name' },
  { n: 2, label: 'Domain' },
  { n: 3, label: 'Subdomain' },
  { n: 4, label: 'Origins' },
  { n: 5, label: 'Strategy' },
  { n: 6, label: 'Placement' },
];

interface StepIndicatorProps {
  n: number;
  active: boolean;
  done: boolean;
  label: string;
  onJump: () => void;
}

const StepIndicator = ({ n, active, done, label, onJump }: StepIndicatorProps) => (
  <button onClick={onJump} style={{
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 12px', borderRadius: 'var(--radius)',
    background: active ? 'var(--accent-dim)' : 'transparent',
    border: `1px solid ${active ? 'var(--accent)' : 'transparent'}`,
    color: active ? 'var(--text)' : (done ? 'var(--text-2)' : 'var(--text-3)'),
    textAlign: 'left', fontSize: 13,
  }}>
    <div style={{
      width: 22, height: 22, borderRadius: '50%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: active ? 'var(--accent)' : (done ? 'oklch(0.78 0.14 150 / 0.15)' : 'var(--bg-2)'),
      color: active ? 'oklch(0.18 0.02 60)' : (done ? 'var(--green)' : 'var(--text-3)'),
      border: `1px solid ${done ? 'var(--green)' : (active ? 'var(--accent)' : 'var(--line)')}`,
      fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600,
      flexShrink: 0,
    }}>
      {done ? <Icons.Check size={12} strokeWidth={2.4} /> : n}
    </div>
    {label}
  </button>
);

interface FieldBlockProps {
  n: number;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

const FieldBlock = ({ n, title, subtitle, children }: FieldBlockProps) => (
  <div style={{
    padding: 'clamp(16px, 3vw, 24px)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)',
    background: 'var(--bg-1)',
  }}>
    <div style={{ display: 'flex', gap: 'clamp(12px, 2vw, 16px)', marginBottom: 16, flexWrap: 'wrap' }}>
      <div style={{
        minWidth: 28, height: 28, borderRadius: 6,
        background: 'var(--accent-dim)', color: 'var(--accent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--mono)', fontSize: 'clamp(11px, 2vw, 12px)', fontWeight: 600,
        border: '1px solid var(--accent)',
        flexShrink: 0,
      }}>{n}</div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <h3 style={{ margin: 0, fontSize: 'clamp(14px, 3vw, 16px)', letterSpacing: '-0.01em', fontWeight: 500 }}>{title}</h3>
        <div style={{ color: 'var(--text-3)', fontSize: 'clamp(12px, 2vw, 13px)', marginTop: 4 }}>{subtitle}</div>
      </div>
    </div>
    <div>{children}</div>
  </div>
);

export default function CreateLoadBalancerPage() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const [activeStep, setActiveStep] = useState(1);
  const [deploying, setDeploying] = useState(false);
  const [zones, setZones] = useState<any[]>([]);
  const [deploySuccess, setDeploySuccess] = useState<{ name: string; fullDomain: string } | null>(null);
  const [form, setForm] = useState({
    name: '',
    zoneId: '',
    subdomain: '',
    origins: [{ id: 1, url: '', weight: 100, rawIp: undefined as string | undefined, geoCities: [], geoSubdivisions: [], geoCountries: [], geoContinents: [], isFallback: false }],
    strategy: 'round-robin',
    exposeRealOrigin: false,
    corsEnabled: false,
    corsOrigins: [] as string[],
    smartPlacement: true,
    placementHint: '',
  });
  const [corsInput, setCorsInput] = useState('');

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (!user.hasCloudflareCredentials) {
      router.push('/onboarding');
      return;
    }
    fetchZones();
  }, [user, router]);

  const fetchZones = async () => {
    try {
      const response = await api.getCloudflareZones();
      if (response.success && response.data?.zones) {
        setZones(response.data.zones);
      }
    } catch (error: any) {
      toast.error('Failed to fetch Cloudflare zones');
    }
  };

  const update = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const handleCorsToggle = (enabled: boolean) => {
    update('corsEnabled', enabled);
  };

  const addCorsOrigin = (value: string) => {
    const trimmed = value.trim().replace(/\/$/, '');
    if (!trimmed) return;
    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    if (!form.corsOrigins.includes(normalized)) {
      update('corsOrigins', [...form.corsOrigins, normalized]);
    }
    setCorsInput('');
  };

  const removeCorsOrigin = (origin: string) => {
    update('corsOrigins', form.corsOrigins.filter(o => o !== origin));
  };

  const addOrigin = () => {
    setForm(f => ({ ...f, origins: [...f.origins, { id: Date.now(), url: '', weight: 100, rawIp: undefined as string | undefined, geoCities: [], geoSubdivisions: [], geoCountries: [], geoContinents: [], isFallback: false }] }));
  };

  const isRawIpUrl = (url: string): boolean => {
    if (!url.trim()) return false;
    const withProto = /^https?:\/\//i.test(url) ? url : `http://${url}`;
    try {
      const { hostname } = new URL(withProto);
      return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
    } catch { return false; }
  };

  const convertOriginToHostname = (originId: number, index: number) => {
    const origin = form.origins.find(o => o.id === originId);
    const domain = zones.find(z => z.id === form.zoneId)?.name;
    if (!origin || !form.name.trim() || !domain) return;
    const raw = origin.url.trim();
    const withProto = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
    const parsed = (() => { try { return new URL(withProto); } catch { return null; } })();
    if (!parsed) return;
    const scriptName = form.name.trim();
    const generatedHostname = `${scriptName}-o${index + 1}.${domain}`;
    const newUrl = `${parsed.protocol}//${generatedHostname}`;
    updateOrigin(originId, { url: newUrl, rawIp: parsed.hostname });
  };

  const removeOrigin = (id: number) => {
    setForm(f => ({ ...f, origins: f.origins.length > 1 ? f.origins.filter(s => s.id !== id) : f.origins }));
  };

  const updateOrigin = (id: number, patch: any) => {
    setForm(f => ({ ...f, origins: f.origins.map(s => s.id === id ? { ...s, ...patch } : s) }));
  };

  const nameValid = /^[a-z0-9-]+$/.test(form.name) && form.name.length > 2;
  const zoneValid = !!form.zoneId;
  const originsValid = form.origins.every(s => s.url.trim().length > 0);
  const allValid = nameValid && zoneValid && originsValid;

  const selectedZone = zones.find(z => z.id === form.zoneId);
  const fullHost = selectedZone
    ? (form.subdomain ? `${form.subdomain}.${selectedZone.name}` : selectedZone.name)
    : '—';

  const deploy = async () => {
    if (!allValid) return;

    setDeploying(true);
    try {
      if (!selectedZone?.name) {
        throw new Error('Please select a valid domain');
      }

      const trimmedSubdomain = form.subdomain.trim();
      const weightedEnabled = form.strategy === 'weighted-round-robin' || form.strategy === 'weighted-cookie-sticky';
      const placementHint = form.placementHint.trim();

      const payload = {
        name: form.name.trim(),
        zoneId: form.zoneId,
        domain: selectedZone.name,
        subdomain: trimmedSubdomain || undefined,
        origins: form.origins.map((o) => {
          const url = o.url.trim();
          const finalUrl = /^https?:\/\//i.test(url) ? url : `http://${url}`;
          return {
            url: finalUrl,
            weight: o.weight,
            ...(o.rawIp ? { rawIp: o.rawIp } : {}),
            geoCities: o.geoCities || [],
            geoSubdivisions: o.geoSubdivisions || [],
            geoCountries: o.geoCountries || [],
            geoContinents: o.geoContinents || [],
            isFallback: o.isFallback || false,
          };
        }),
        strategy: form.strategy,
        weightedEnabled,
        exposeRealOrigin: form.exposeRealOrigin,
        corsEnabled: form.corsEnabled,
        corsOrigins: form.corsOrigins,
        placement: {
          smartPlacement: form.smartPlacement,
          ...(placementHint ? { region: placementHint } : {}),
        },
      };

      const operationId = `create-${Date.now()}`;
      const response = await api.createLoadBalancer(payload, {
        headers: { 'x-operation-id': operationId },
      });

      if (response.success && response.data?.loadBalancer) {
        setDeploySuccess({
          name: response.data.loadBalancer.name,
          fullDomain: response.data.loadBalancer.fullDomain,
        });
      } else {
        throw new Error(response.message || 'Deployment failed');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to deploy load balancer');
    } finally {
      setDeploying(false);
    }
  };

  const showWeights = form.strategy === 'weighted-round-robin' || form.strategy === 'weighted-cookie-sticky';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)', flexDirection: 'row' }}>
      <aside style={{
        width: 280, borderRight: '1px solid var(--line)',
        padding: 'clamp(20px, 3vw, 32px)', position: 'sticky', top: 0, height: '100vh',
        display: 'flex', flexDirection: 'column', gap: 'clamp(16px, 3vw, 24px)',
        fontSize: 'clamp(12px, 2vw, 13px)',
        overflow: 'auto',
      }} className="hide-md">
        <button onClick={() => router.push('/dashboard')} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontFamily: 'var(--mono)', fontSize: 'clamp(9px, 2vw, 11px)', color: 'var(--text-3)',
          textTransform: 'uppercase', letterSpacing: '0.06em',
          background: 'none', border: 'none', cursor: 'pointer',
        }}>
          <Icons.Arrow size={12} style={{ transform: 'rotate(180deg)' }} /> Back to dashboard
        </button>

        <div>
          <div className="kicker" style={{ marginBottom: 8, fontSize: 'clamp(9px, 2vw, 11px)' }}>// create new</div>
          <h2 style={{ margin: 0, fontSize: 'clamp(18px, 3vw, 20px)', letterSpacing: '-0.02em', fontWeight: 500 }}>
            Load Balancer
          </h2>
          <div style={{ color: 'var(--text-3)', fontSize: 'clamp(11px, 2vw, 12px)', marginTop: 6, lineHeight: 1.5 }}>
            Deploy a new Cloudflare Worker-based load balancer with live origin routing.
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {STEPS.map(s => (
            <StepIndicator
              key={s.n} n={s.n} label={s.label}
              active={activeStep === s.n}
              done={activeStep > s.n}
              onJump={() => setActiveStep(s.n)}
            />
          ))}
        </div>

        <div style={{ flex: 1 }} />

        <div style={{
          padding: 14, border: '1px solid var(--line)', borderRadius: 'var(--radius)',
          background: 'var(--bg-1)', fontSize: 'clamp(11px, 2vw, 12px)',
        }}>
          <div className="kicker" style={{ marginBottom: 10, fontSize: 'clamp(9px, 2vw, 11px)' }}>// preview</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 'clamp(10px, 2vw, 11px)', color: 'var(--text-2)', lineHeight: 1.7 }}>
            <div>name: <span style={{ color: form.name ? 'var(--accent)' : 'var(--text-3)' }}>{form.name || '—'}</span></div>
            <div>host: <span style={{ color: selectedZone ? 'var(--accent)' : 'var(--text-3)' }}>{fullHost}</span></div>
            <div>origins: <span style={{ color: 'var(--accent)' }}>{form.origins.filter(s => s.url).length}</span></div>
            <div>strategy: <span style={{ color: 'var(--accent)' }}>{form.strategy}</span></div>
          </div>
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
        <Topbar
          crumbs={['Dashboard', 'Load Balancers', 'New']}
          title="Create Load Balancer"
          subtitle="Deploy a new Cloudflare Worker-based load balancer with live origin routing."
          actions={
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => router.push('/dashboard')}>Cancel</button>
              <button
                className="btn btn-primary btn-sm"
                disabled={!allValid || deploying}
                onClick={deploy}
                style={{ opacity: (!allValid || deploying) ? 0.5 : 1 }}>
                {deploying ? (
                  <>
                    <span style={{
                      width: 12, height: 12, border: '2px solid currentColor',
                      borderRightColor: 'transparent', borderRadius: '50%',
                      animation: 'spin 0.7s linear infinite',
                    }} />
                    Deploying…
                  </>
                ) : (
                  <>
                    <Icons.Zap size={14} /> <span className="hide-sm">Deploy worker</span><span className="hide-md">Deploy</span>
                  </>
                )}
              </button>
            </>
          }
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 32, padding: 'clamp(16px, 4vw, 32px)', overflow: 'auto', flex: 1 }}>
          {/* Form Column */}
          <div className="create-form-shell" style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(12px, 2vw, 20px)' }}>
          <FieldBlock n={1} title="Load Balancer Name"
            subtitle="Choose the exact Cloudflare Worker name used for this deployment">
            <div className="field">
              <label className="field-label">Name <span className="req">*</span></label>
              <input
                className="input input-mono"
                placeholder="e.g., production-api"
                value={form.name}
                onChange={e => {
                  const v = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                  update('name', v);
                  setActiveStep(1);
                }}
                onFocus={() => setActiveStep(1)}
              />
              <div className="hint">
                Lowercase letters, numbers, and hyphens only. This is deployed as the exact Worker script name.
              </div>
              {form.name && !nameValid && (
                <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 4 }}>
                  Name must be at least 3 characters.
                </div>
              )}
            </div>
          </FieldBlock>

          <FieldBlock n={2} title="Domain Selection"
            subtitle="Pick the Cloudflare zone that should point at this load balancer">
            <div className="field">
              <label className="field-label">Domain</label>
              <div className="domain-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(140px, 50vw, 220px), 1fr))', gap: 'clamp(6px, 2vw, 8px)' }}>
                {zones.map(z => {
                  const active = form.zoneId === z.id;
                  return (
                    <button
                      key={z.id}
                      onClick={() => { update('zoneId', z.id); setActiveStep(2); }}
                      disabled={z.status !== 'active'}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: 12, borderRadius: 'var(--radius)',
                        border: `1px solid ${active ? 'var(--accent)' : 'var(--line)'}`,
                        background: active ? 'var(--accent-dim)' : 'var(--bg-2)',
                        textAlign: 'left', opacity: z.status === 'active' ? 1 : 0.4,
                      }}>
                      <Icons.Globe size={14} stroke={active ? 'var(--accent)' : 'var(--text-3)'} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="mono" style={{ fontSize: 13, fontWeight: 500, color: active ? 'var(--text)' : 'var(--text-2)' }}>
                          {z.name}
                        </div>
                        <div className="mono" style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase' }}>
                          {z.status}
                        </div>
                      </div>
                      {active && <Icons.Check size={14} stroke="var(--accent)" />}
                    </button>
                  );
                })}
              </div>
              <div className="hint">Zones are fetched from your connected Cloudflare account.</div>
            </div>
          </FieldBlock>

          <FieldBlock n={3} title="Subdomain"
            subtitle="Optional hostname prefix for the active edge route">
            <div className="field">
              <label className="field-label">Subdomain</label>
              <div className="subdomain-row" style={{
                display: 'flex', alignItems: 'stretch',
                border: '1px solid var(--line)', borderRadius: 'var(--radius)',
                background: 'var(--bg-1)', overflow: 'hidden',
              }}>
                <input
                  className="input input-mono"
                  placeholder="api"
                  value={form.subdomain}
                  onChange={e => update('subdomain', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  onFocus={() => setActiveStep(3)}
                  style={{ border: 'none', background: 'transparent', flex: 1 }}
                />
                <div className="subdomain-suffix" style={{
                  display: 'flex', alignItems: 'center', padding: '0 16px',
                  fontFamily: 'var(--mono)', fontSize: 13,
                  color: 'var(--text-3)', borderLeft: '1px solid var(--line)',
                  background: 'var(--bg-2)',
                }}>
                  .{selectedZone?.name || 'select-domain.com'}
                </div>
              </div>
              <div className="hint">
                Your balancer will serve at{' '}
                <span className="mono" style={{ color: 'var(--accent)' }}>https://{fullHost}</span>
              </div>
            </div>
          </FieldBlock>

          <FieldBlock n={4} title="Origin Servers"
            subtitle="Add, remove, or rebalance the backends that receive traffic here">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {form.origins.map((s, i) => (
                <div key={s.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div className={`origin-row ${showWeights ? 'with-weights' : 'no-weights'}`} style={{
                    display: 'grid',
                    gap: 8, alignItems: 'center',
                  }}>
                    <div className="origin-index" style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      height: 44, border: '1px solid var(--line)',
                      borderRadius: 'var(--radius)', background: 'var(--bg-2)',
                      fontFamily: 'var(--mono)', fontSize: 11,
                      color: 'var(--text-3)', textTransform: 'uppercase',
                    }}>#{i + 1}</div>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        className="input input-mono"
                        placeholder="https://domain.com, http://127.0.0.1, or 192.168.1.100"
                        value={s.url}
                        onChange={e => {
                          const newVal = e.target.value;
                          updateOrigin(s.id, { url: newVal, rawIp: undefined });
                        }}
                        onFocus={() => setActiveStep(4)}
                        style={{ width: '100%', paddingRight: isRawIpUrl(s.url) ? 130 : undefined }}
                      />
                      {isRawIpUrl(s.url) && (
                        <button
                          type="button"
                          onClick={() => convertOriginToHostname(s.id, i)}
                          style={{
                            position: 'absolute', right: 8,
                            fontSize: 11, padding: '3px 8px',
                            background: 'var(--accent-dim)', color: 'var(--accent)',
                            border: '1px solid var(--accent)', borderRadius: 4,
                            cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'var(--mono)',
                          }}
                        >
                          Convert to Domain
                        </button>
                      )}
                    </div>
                    {showWeights && (
                      <div className="weight-input-wrap" style={{ position: 'relative' }}>
                        <input
                          className="input input-mono"
                          type="number" min={1} max={100}
                          value={s.weight}
                          onChange={(e) => {
                            const nextWeight = Number.parseInt(e.target.value, 10);
                            const safeWeight = Number.isNaN(nextWeight) ? 1 : Math.max(1, Math.min(100, nextWeight));
                            updateOrigin(s.id, { weight: safeWeight });
                          }}
                          style={{ paddingRight: 32 }}
                        />
                        <span style={{
                          position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                          fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-3)',
                        }}>wt</span>
                      </div>
                    )}
                    <button className="remove-btn"
                      onClick={() => removeOrigin(s.id)}
                      disabled={form.origins.length === 1}
                      style={{
                        height: 44, borderRadius: 'var(--radius)',
                        border: '1px solid var(--line)',
                        color: 'var(--text-3)',
                        opacity: form.origins.length === 1 ? 0.3 : 1,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                      <Icons.Trash size={14} />
                    </button>
                  </div>

                  {s.rawIp && (() => {
                    const hostname = (() => { try { return new URL(s.url).hostname; } catch { return s.url; } })();
                    const proto = s.url.match(/^https?:\/\//i)?.[0] ?? 'http://';
                    return (
                      <div style={{
                        padding: '10px 14px',
                        background: 'var(--bg-2)',
                        border: '1px solid var(--line)',
                        borderLeft: '3px solid var(--accent)',
                        borderRadius: 'var(--radius)',
                        fontSize: 12,
                        display: 'flex', flexDirection: 'column', gap: 6,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ color: 'var(--text-3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 500 }}>IP converted</span>
                            <span style={{
                              fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-2)',
                              background: 'var(--bg-3)', padding: '2px 7px', borderRadius: 4, border: '1px solid var(--line)',
                            }}>{s.rawIp}</span>
                            <span style={{ color: 'var(--text-3)' }}>→</span>
                            <span style={{
                              fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--accent)',
                              background: 'var(--accent-dim)', padding: '2px 7px', borderRadius: 4, border: '1px solid var(--accent)',
                            }}>{hostname}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => updateOrigin(s.id, { url: `${proto}${s.rawIp}`, rawIp: undefined })}
                            style={{
                              fontSize: 11, padding: '3px 10px', borderRadius: 4, flexShrink: 0,
                              background: 'transparent', border: '1px solid var(--line)',
                              color: 'var(--text-3)', cursor: 'pointer',
                            }}>
                            Undo
                          </button>
                        </div>
                        <div style={{ color: 'var(--text-3)', lineHeight: 1.6 }}>
                          A grey-cloud DNS A record will be created on save. If you use a reverse proxy, add{' '}
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-2)' }}>{hostname}</span>
                          {' '}to your <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-2)' }}>server_name</span>.
                          {' '}If your origin is another load balancer or doesn't use a reverse proxy, no action is needed.
                        </div>
                      </div>
                    );
                  })()}

                  {form.strategy === 'geo-steering' && (() => {
                    const selCountries = (s.geoCountries || []) as string[];
                    const selContinents = (s.geoContinents || []) as string[];
                    const selStates = (s.geoSubdivisions || []) as string[];

                    // Continent → Country (bidirectional filter)
                    const availableCountries = selContinents.length > 0
                      ? COUNTRIES.filter(c => selContinents.includes(c.continent))
                      : COUNTRIES;

                    // Country → Continent (bidirectional: narrow to continents of selected countries)
                    const availableContinents = selCountries.length > 0
                      ? (() => {
                          const codes = new Set(
                            COUNTRIES.filter(c => selCountries.includes(c.code)).map(c => c.continent)
                          );
                          return CONTINENTS.filter(c => (codes as Set<string>).has(c.code));
                        })()
                      : CONTINENTS;

                    // Country → States
                    const availableStates = selCountries.flatMap(c => getSubdivisionsByCountry(c));

                    // State → Cities (when states selected, only show their cities; else all country cities)
                    const availableCities = selCountries.flatMap(c => {
                      const allCities = getCitiesByCountry(c);
                      const countryStateCodes = getSubdivisionsByCountry(c).map(st => st.code);
                      const activeStates = selStates.filter(st => countryStateCodes.includes(st));
                      if (activeStates.length > 0 && CITIES_BY_SUBDIVISION[c]) {
                        const validCodes = new Set(activeStates.flatMap(st => CITIES_BY_SUBDIVISION[c][st] || []));
                        return allCities.filter(city => validCodes.has(city.code));
                      }
                      return allCities;
                    });

                    const onContinentsChange = (codes: string[]) => {
                      const validCountries = selCountries.filter(c => {
                        const country = COUNTRIES.find(co => co.code === c);
                        return country && codes.includes(country.continent);
                      });
                      const validStates = selStates.filter(st =>
                        validCountries.some(c => getSubdivisionsByCountry(c).some(x => x.code === st))
                      );
                      const validCities = (s.geoCities || []).filter((city: string) =>
                        validCountries.some(c => getCitiesByCountry(c).some(x => x.code === city))
                      );
                      updateOrigin(s.id, { geoContinents: codes, geoCountries: validCountries, geoSubdivisions: validStates, geoCities: validCities });
                    };

                    const onCountriesChange = (codes: string[]) => {
                      const validStates = selStates.filter(st =>
                        codes.some(c => getSubdivisionsByCountry(c).some(x => x.code === st))
                      );
                      const validCities = (s.geoCities || []).filter((city: string) =>
                        codes.some(c => getCitiesByCountry(c).some(x => x.code === city))
                      );
                      updateOrigin(s.id, { geoCountries: codes, geoSubdivisions: validStates, geoCities: validCities });
                    };

                    const onStatesChange = (codes: string[]) => {
                      // Clear cities that no longer belong to any selected state
                      const validCities = (s.geoCities || []).filter((city: string) => {
                        for (const countryCode of selCountries) {
                          const allCities = getCitiesByCountry(countryCode);
                          if (!allCities.some(x => x.code === city)) continue;
                          const countryStateCodes = getSubdivisionsByCountry(countryCode).map(st => st.code);
                          const activeStates = codes.filter(st => countryStateCodes.includes(st));
                          if (activeStates.length === 0) return true; // no state filter for this country
                          const validCodes = new Set(activeStates.flatMap(st => CITIES_BY_SUBDIVISION[countryCode]?.[st] || []));
                          return validCodes.has(city);
                        }
                        return false;
                      });
                      updateOrigin(s.id, { geoSubdivisions: codes, geoCities: validCities });
                    };

                    const toggleFallback = () => {
                      const next = !s.isFallback;
                      setForm(f => ({
                        ...f,
                        origins: f.origins.map(o =>
                          o.id === s.id ? { ...o, isFallback: next } : { ...o, isFallback: false }
                        ),
                      }));
                    };

                    return (
                      <div style={{
                        padding: 12, border: '1px solid var(--line)',
                        borderRadius: 'var(--radius)', background: 'var(--bg-2)',
                        marginLeft: 64,
                      }}>
                        <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10 }}>
                          Geographic routing for this origin —{' '}
                          <span style={{ color: 'var(--text-2)', fontWeight: 500 }}>at least one field required, or mark as fallback</span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          {/* Row 1: Continent | Country */}
                          <div className="field">
                            <label className="field-label" style={{ fontSize: 11, marginBottom: 6 }}>
                              Continent
                              {selCountries.length > 0 && <span style={{ color: 'var(--text-3)', fontWeight: 'normal', marginLeft: 4 }}>· filtered by country</span>}
                            </label>
                            <MultiSelect
                              options={availableContinents.map(c => ({ code: c.code, name: c.name }))}
                              value={selContinents}
                              onChange={onContinentsChange}
                              placeholder="Select continents..."
                            />
                          </div>
                          <div className="field">
                            <label className="field-label" style={{ fontSize: 11, marginBottom: 6 }}>
                              Country
                              {selContinents.length > 0 && <span style={{ color: 'var(--text-3)', fontWeight: 'normal', marginLeft: 4 }}>· filtered by continent</span>}
                            </label>
                            <MultiSelect
                              options={availableCountries.map(c => ({ code: c.code, name: c.name, icon: getFlagEmoji(c.code) }))}
                              value={selCountries}
                              onChange={onCountriesChange}
                              placeholder="Select countries..."
                            />
                          </div>

                          {/* Row 2: State | City (cascade: state filters city) */}
                          <div className="field">
                            <label className="field-label" style={{ fontSize: 11, marginBottom: 6 }}>
                              State / Province
                              {selCountries.length === 0 && <span style={{ color: 'var(--text-3)', fontWeight: 'normal', marginLeft: 4 }}>· select country first</span>}
                            </label>
                            <MultiSelect
                              options={availableStates}
                              value={s.geoSubdivisions || []}
                              onChange={onStatesChange}
                              placeholder={selCountries.length > 0 ? 'Select states...' : 'Select country first...'}
                              disabled={selCountries.length === 0}
                            />
                          </div>
                          <div className="field">
                            <label className="field-label" style={{ fontSize: 11, marginBottom: 6 }}>
                              City
                              {selCountries.length === 0
                                ? <span style={{ color: 'var(--text-3)', fontWeight: 'normal', marginLeft: 4 }}>· select country first</span>
                                : selStates.length > 0
                                  ? <span style={{ color: 'var(--text-3)', fontWeight: 'normal', marginLeft: 4 }}>· filtered by state</span>
                                  : null}
                            </label>
                            <MultiSelect
                              options={availableCities}
                              value={s.geoCities || []}
                              onChange={(codes) => updateOrigin(s.id, { geoCities: codes })}
                              placeholder={selCountries.length > 0 ? 'Select cities...' : 'Select country first...'}
                              disabled={selCountries.length === 0}
                            />
                          </div>
                        </div>

                        <div
                          onClick={toggleFallback}
                          style={{
                            marginTop: 10, padding: '10px 12px',
                            borderRadius: 'var(--radius)',
                            border: `1px solid ${s.isFallback ? 'var(--accent)' : 'var(--line)'}`,
                            background: s.isFallback ? 'var(--accent-dim)' : 'transparent',
                            display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                          }}
                        >
                          <div style={{
                            width: 16, height: 16, borderRadius: 3, flexShrink: 0,
                            border: `2px solid ${s.isFallback ? 'var(--accent)' : 'var(--line)'}`,
                            background: s.isFallback ? 'var(--accent)' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {s.isFallback && (
                              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 500, color: s.isFallback ? 'var(--accent)' : 'var(--text-2)' }}>
                              Fallback origin
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>
                              Catches all traffic when no geo rule matches — only one origin can be fallback
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ))}
              <button
                onClick={addOrigin}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 8, padding: '12px', borderRadius: 'var(--radius)',
                  border: '1px dashed var(--line-2)', color: 'var(--text-2)',
                  fontSize: 13,
                }}>
                <Icons.Plus size={14} /> Add Server
              </button>
            </div>
          </FieldBlock>

          <FieldBlock n={5} title="Traffic Strategy"
            subtitle="Switch how requests are distributed across your origin fleet">
            <div className="strategy-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(160px, 50vw, 260px), 1fr))', gap: 'clamp(8px, 2vw, 10px)' }}>
              {STRATEGIES.map(s => {
                const Ico = Icons[s.icon as keyof typeof Icons];
                const active = form.strategy === s.id;
                return (
                  <button key={s.id}
                    onClick={() => { update('strategy', s.id); setActiveStep(5); }}
                    style={{
                      textAlign: 'left', padding: 14,
                      borderRadius: 'var(--radius)',
                      border: `1px solid ${active ? 'var(--accent)' : 'var(--line)'}`,
                      background: active ? 'var(--accent-dim)' : 'var(--bg-2)',
                      display: 'flex', gap: 12, alignItems: 'flex-start',
                    }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 6,
                      border: `1px solid ${active ? 'var(--accent)' : 'var(--line-2)'}`,
                      background: active ? 'oklch(0.80 0.17 70 / 0.25)' : 'var(--bg)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <Ico size={14} stroke={active ? 'var(--accent)' : 'var(--text-2)'} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, color: active ? 'var(--text)' : 'var(--text-2)' }}>
                        {s.title}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.45 }}>{s.desc}</div>
                    </div>
                    <div style={{
                      width: 14, height: 14, borderRadius: '50%',
                      border: `1.5px solid ${active ? 'var(--accent)' : 'var(--line-2)'}`,
                      background: active ? 'var(--accent)' : 'transparent',
                      flexShrink: 0, marginTop: 2,
                      position: 'relative',
                    }}>
                      {active && (
                        <div style={{
                          position: 'absolute', inset: 3,
                          borderRadius: '50%', background: 'oklch(0.18 0.02 60)',
                        }} />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </FieldBlock>

          <FieldBlock n={6} title="Worker Placement"
            subtitle="Tune where the Worker executes relative to your origin infrastructure">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <label style={{
                display: 'flex', gap: 14, padding: 16,
                border: `1px solid ${form.exposeRealOrigin ? 'var(--accent)' : 'var(--line)'}`,
                background: form.exposeRealOrigin ? 'var(--accent-dim)' : 'var(--bg-2)',
                borderRadius: 'var(--radius)', cursor: 'pointer',
              }} onClick={() => setActiveStep(6)}>
                <div style={{
                  width: 36, height: 20, flexShrink: 0,
                  borderRadius: 999,
                  background: form.exposeRealOrigin ? 'var(--accent)' : 'var(--bg-3)',
                  position: 'relative', transition: 'background 160ms',
                }}>
                  <div style={{
                    position: 'absolute', top: 2, left: form.exposeRealOrigin ? 18 : 2,
                    width: 16, height: 16, borderRadius: '50%',
                    background: 'var(--bg)', transition: 'left 160ms',
                  }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>Expose Real Origin</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                    Pass the browser&apos;s real Origin header to your backend. Enable when your backend handles CORS directly.
                  </div>
                </div>
                <input
                  type="checkbox" checked={form.exposeRealOrigin}
                  onChange={e => update('exposeRealOrigin', e.target.checked)}
                  style={{ display: 'none' }}
                />
              </label>

              <label style={{
                display: 'flex', gap: 14, padding: 16,
                border: `1px solid ${form.corsEnabled ? 'var(--accent)' : 'var(--line)'}`,
                background: form.corsEnabled ? 'var(--accent-dim)' : 'var(--bg-2)',
                borderRadius: 'var(--radius)', cursor: 'pointer',
                flexDirection: 'column',
              }} onClick={() => setActiveStep(6)}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 36, height: 20, flexShrink: 0, marginTop: 2,
                    borderRadius: 999,
                    background: form.corsEnabled ? 'var(--accent)' : 'var(--bg-3)',
                    position: 'relative', transition: 'background 160ms',
                  }}>
                    <div style={{
                      position: 'absolute', top: 2, left: form.corsEnabled ? 18 : 2,
                      width: 16, height: 16, borderRadius: '50%',
                      background: 'var(--bg)', transition: 'left 160ms',
                    }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>Worker CORS</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                      After enabling, all Server Based CORS is not needed. The Worker Load Balancer will Allow CORS on behalf of Servers.
                    </div>
                  </div>
                  <input
                    type="checkbox" checked={form.corsEnabled}
                    onChange={e => handleCorsToggle(e.target.checked)}
                    style={{ display: 'none' }}
                  />
                </div>
                {form.corsEnabled && (
                  <div style={{ marginTop: 8 }} onClick={e => e.stopPropagation()}>
                    <div style={{
                      display: 'flex', flexWrap: 'wrap', gap: 6,
                      border: '1px solid var(--line)', borderRadius: 'var(--radius)',
                      padding: '6px 10px', background: 'var(--bg)',
                      minHeight: 40, alignItems: 'center',
                    }}>
                      {form.corsOrigins.map(origin => (
                        <div key={origin} style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          background: 'var(--bg-3)', borderRadius: 4,
                          padding: '2px 8px', fontSize: 12,
                        }}>
                          <span>{origin}</span>
                          <button
                            type="button"
                            onClick={() => removeCorsOrigin(origin)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-3)', lineHeight: 1 }}
                          >×</button>
                        </div>
                      ))}
                      <input
                        type="text"
                        value={corsInput}
                        onChange={e => setCorsInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Tab' || e.key === 'Enter') {
                            e.preventDefault();
                            addCorsOrigin(corsInput);
                          }
                        }}
                        onBlur={() => { if (corsInput.trim()) addCorsOrigin(corsInput); }}
                        placeholder="https://yourdomain.com"
                        style={{
                          border: 'none', outline: 'none', background: 'transparent',
                          fontSize: 12, flex: 1, minWidth: 180,
                        }}
                      />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                      Add the domains of your frontend apps that make requests here. Press Tab or Enter to add each one.
                    </div>
                  </div>
                )}
              </label>

              <label style={{
                display: 'flex', gap: 14, padding: 16,
                border: `1px solid ${form.smartPlacement ? 'var(--accent)' : 'var(--line)'}`,
                background: form.smartPlacement ? 'var(--accent-dim)' : 'var(--bg-2)',
                borderRadius: 'var(--radius)', cursor: 'pointer',
              }} onClick={() => setActiveStep(6)}>
                <div style={{
                  width: 36, height: 20, flexShrink: 0,
                  borderRadius: 999,
                  background: form.smartPlacement ? 'var(--accent)' : 'var(--bg-3)',
                  position: 'relative', transition: 'background 160ms',
                }}>
                  <div style={{
                    position: 'absolute', top: 2, left: form.smartPlacement ? 18 : 2,
                    width: 16, height: 16, borderRadius: '50%',
                    background: 'var(--bg)', transition: 'left 160ms',
                  }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>Smart Placement</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                    Run the Worker closer to your origins to reduce backend latency.
                  </div>
                </div>
                <input
                  type="checkbox" checked={form.smartPlacement}
                  onChange={e => update('smartPlacement', e.target.checked)}
                  style={{ display: 'none' }}
                />
              </label>

              <div className="field">
                <label className="field-label">
                  Placement Hint
                  {!form.smartPlacement && <span style={{ color: 'var(--red)', marginLeft: 4 }}>*</span>}
                  {form.smartPlacement && <span style={{ color: 'var(--text-3)', fontWeight: 'normal', fontSize: 11, marginLeft: 4 }}>(disabled when Smart Placement is on)</span>}
                </label>
                <div style={{ position: 'relative' }}>
                  <select
                    value={ALL_CLOUD_REGIONS.find(r => r.code === form.placementHint) ? form.placementHint : 'custom'}
                    onChange={(e) => {
                      if (e.target.value === 'custom') {
                        update('placementHint', '');
                      } else {
                        update('placementHint', e.target.value);
                      }
                    }}
                    onFocus={() => setActiveStep(6)}
                    disabled={form.smartPlacement}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid var(--line)',
                      borderRadius: 'var(--radius)',
                      background: form.smartPlacement ? 'var(--bg-3)' : 'var(--bg-1)',
                      color: 'var(--text)',
                      fontSize: 12,
                      fontFamily: 'var(--mono)',
                      cursor: form.smartPlacement ? 'not-allowed' : 'pointer',
                      opacity: form.smartPlacement ? 0.5 : 1,
                      colorScheme: 'dark',
                    }}
                  >
                    <option value="">Select cloud region...</option>
                    <optgroup label="AWS">
                      {REGIONS_BY_PROVIDER.aws.map(region => (
                        <option key={region.code} value={region.code}>{region.name}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Google Cloud">
                      {REGIONS_BY_PROVIDER.gcp.map(region => (
                        <option key={region.code} value={region.code}>{region.name}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Azure">
                      {REGIONS_BY_PROVIDER.azure.map(region => (
                        <option key={region.code} value={region.code}>{region.name}</option>
                      ))}
                    </optgroup>
                    <option value="custom">✏️ Custom (write your own)...</option>
                  </select>
                </div>

                {!form.smartPlacement && form.placementHint === '' && (
                  <input
                    className="input input-mono"
                    placeholder="e.g., aws:us-east-1, gcp:europe-west1, azure:eastus2"
                    value={form.placementHint}
                    onChange={e => update('placementHint', e.target.value)}
                    onFocus={() => setActiveStep(6)}
                    style={{ marginTop: 8, fontSize: 12 }}
                  />
                )}

                {!ALL_CLOUD_REGIONS.find(r => r.code === form.placementHint) && form.placementHint && (
                  <div style={{ marginTop: 8, padding: 8, background: 'var(--bg-2)', borderRadius: 4, fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-2)' }}>
                    Custom: {form.placementHint}
                  </div>
                )}

                <div className="hint" style={{ marginTop: 4 }}>
                  {form.smartPlacement
                    ? 'Cloudflare automatically positions the Worker near your origins when Smart Placement is enabled.'
                    : 'Required. Choose a cloud region where your origin servers are located, or enter a custom hint.'}
                </div>
              </div>
            </div>
          </FieldBlock>

          <div className="deploy-bar" style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '16px 20px', border: '1px solid var(--line)',
            borderRadius: 'var(--radius-lg)', background: 'var(--bg-1)',
          }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-3)' }}>
              {allValid ? (
                <><span style={{ color: 'var(--green)' }}>✓</span> Ready to deploy • ~90s</>
              ) : (
                <>Complete required fields to deploy</>
              )}
            </div>
            <div className="deploy-actions" style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => router.push('/dashboard')}>Cancel</button>
              <button
                className="btn btn-primary"
                disabled={!allValid || deploying}
                onClick={deploy}
                style={{ opacity: (!allValid || deploying) ? 0.5 : 1 }}>
                {deploying ? (
                  <>
                    <span style={{
                      width: 14, height: 14, border: '2px solid currentColor',
                      borderRightColor: 'transparent', borderRadius: '50%',
                      animation: 'spin 0.7s linear infinite',
                    }} />
                    Deploying worker…
                  </>
                ) : (
                  <>
                    <Icons.Zap size={14} /> Deploy load balancer
                  </>
                )}
              </button>
            </div>
          </div>
          </div>

          {/* Visualization Column */}
          <div className="visualization-panel" style={{ display: 'flex', flexDirection: 'column' }}>
            <LoadBalancerVisualization
              domain={selectedZone?.name}
              subdomain={form.subdomain}
              strategy={form.strategy as LoadBalancerStrategy}
              originCount={form.origins.filter(o => o.url.trim()).length}
              isGeoSteering={form.strategy === 'geo-steering' && form.origins.some(o =>
                (o.geoCountries && o.geoCountries.length > 0) ||
                (o.geoContinents && o.geoContinents.length > 0)
              )}
            />
          </div>
        </div>

        <DeploymentOverlay
          isOpen={deploying}
          mode="create"
          targetName={form.name}
          onCancel={() => {}}
          cancelRequested={false}
          cancellable={false}
        />

        <DeploymentSuccessModal
          isOpen={!!deploySuccess}
          mode="create"
          name={deploySuccess?.name || form.name}
          fullDomain={deploySuccess?.fullDomain || fullHost}
          onContinue={() => router.push('/dashboard')}
        />
      </main>

      <style jsx>{`
        .origin-row.no-weights {
          grid-template-columns: 56px minmax(0, 1fr) 40px;
        }

        .origin-row.with-weights {
          grid-template-columns: 56px minmax(0, 1fr) 110px 40px;
        }

        @media (max-width: 768px) {
          .hide-md { display: none; }
          .create-form-shell {
            padding: 16px !important;
            max-width: 100% !important;
            gap: 14px !important;
          }
          .domain-grid,
          .strategy-grid {
            grid-template-columns: 1fr !important;
          }
          .subdomain-row {
            flex-direction: column;
          }
          .subdomain-suffix {
            border-left: none !important;
            border-top: 1px solid var(--line);
            padding: 10px 12px !important;
          }
          main > div {
            grid-template-columns: 1fr !important;
          }
          .visualization-panel {
            display: none !important;
          }
          .origin-row {
            display: flex !important;
            flex-direction: column;
            align-items: stretch !important;
          }
          .origin-index {
            height: 36px !important;
          }
          .weight-input-wrap,
          .remove-btn {
            width: 100%;
          }
          .deploy-bar {
            flex-direction: column;
            align-items: flex-start !important;
            gap: 12px;
          }
          .deploy-actions {
            width: 100%;
          }
          .deploy-actions :global(button) {
            flex: 1;
          }
        }
      `}</style>
    </div>
  );
}
