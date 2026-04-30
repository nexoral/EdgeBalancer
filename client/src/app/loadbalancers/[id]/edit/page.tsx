'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { Sidebar, Topbar } from '@/components/dashboard/Sidebar';
import { Icons } from '@/components/shared/Icons';
import { DeploymentOverlay, DeploymentSuccessModal } from '@/components/loadbalancers/DeploymentExperience';
import { MultiSelect } from '@/components/ui/MultiSelect';
import { CONTINENTS, COUNTRIES, getRegionsByCountry, getAllRegions } from '@/lib/geoData';
import type { LoadBalancer } from '@/types/api';
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

export default function EditLoadBalancerPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);
  const [deploySuccess, setDeploySuccess] = useState<{ name: string; fullDomain: string } | null>(null);
  const [loadBalancer, setLoadBalancer] = useState<LoadBalancer | null>(null);
  const [form, setForm] = useState({
    subdomain: '',
    origins: [{ id: 1, url: '', weight: 100, geoCountries: [], geoColos: [], geoContinents: [] }],
    strategy: 'round-robin',
    smartPlacement: true,
    placementHint: '',
  });

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (!user.hasCloudflareCredentials) {
      router.push('/onboarding');
      return;
    }
    if (params?.id) {
      fetchLoadBalancer(params.id);
    }
  }, [user, router, params]);

  const fetchLoadBalancer = async (id: string) => {
    try {
      setLoading(true);
      const response = await api.getLoadBalancer(id);
      if (response.success && response.data?.loadBalancer) {
        const lb = response.data.loadBalancer;
        setLoadBalancer(lb);
        setForm({
          subdomain: lb.subdomain || '',
          origins: lb.origins.map((o: any, i: number) => ({
            id: i + 1,
            url: o.url,
            weight: o.weight || 100,
            geoCountries: o.geoCountries || [],
            geoColos: o.geoColos || [],
            geoContinents: o.geoContinents || [],
          })),
          strategy: lb.strategyValue,
          smartPlacement: lb.placement?.smartPlacement !== false,
          placementHint: lb.placement?.region || '',
        });
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to load load balancer');
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const update = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const addOrigin = () => {
    setForm(f => ({ ...f, origins: [...f.origins, { id: Date.now(), url: '', weight: 100, geoCountries: [], geoColos: [], geoContinents: [] }] }));
  };

  const removeOrigin = (id: number) => {
    setForm(f => ({ ...f, origins: f.origins.length > 1 ? f.origins.filter(s => s.id !== id) : f.origins }));
  };

  const updateOrigin = (id: number, patch: any) => {
    setForm(f => ({ ...f, origins: f.origins.map(s => s.id === id ? { ...s, ...patch } : s) }));
  };

  const originsValid = form.origins.every(s => s.url.trim().length > 0);
  const allValid = originsValid;

  const fullHost = loadBalancer
    ? (form.subdomain ? `${form.subdomain}.${loadBalancer.domain}` : loadBalancer.domain)
    : '—';

  const deploy = async () => {
    if (!allValid || !loadBalancer || !params?.id) return;

    setDeploying(true);
    try {
      const weightedEnabled = form.strategy === 'weighted-round-robin' || form.strategy === 'weighted-cookie-sticky';
      const trimmedSubdomain = form.subdomain.trim();
      const placementHint = form.placementHint.trim();

      const payload = {
        name: loadBalancer.name,
        zoneId: loadBalancer.zoneId,
        domain: loadBalancer.domain,
        subdomain: trimmedSubdomain || undefined,
        origins: form.origins.map((o) => {
          const url = o.url.trim();
          const finalUrl = /^https?:\/\//i.test(url) ? url : `http://${url}`;
          return {
            url: finalUrl,
            weight: o.weight,
            geoCountries: o.geoCountries || [],
            geoColos: o.geoColos || [],
            geoContinents: o.geoContinents || [],
          };
        }),
        strategy: form.strategy,
        weightedEnabled,
        placement: {
          smartPlacement: form.smartPlacement,
          ...(placementHint ? { region: placementHint } : {}),
        },
      };

      const operationId = `update-${Date.now()}`;
      const response = await api.updateLoadBalancer(params.id, payload, {
        headers: { 'x-operation-id': operationId },
      });

      if (response.success && response.data?.loadBalancer) {
        setDeploySuccess({
          name: response.data.loadBalancer.name,
          fullDomain: response.data.loadBalancer.fullDomain,
        });
      } else {
        throw new Error(response.message || 'Update failed');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update load balancer');
    } finally {
      setDeploying(false);
    }
  };

  const showWeights = form.strategy === 'weighted-round-robin' || form.strategy === 'weighted-cookie-sticky';

  if (loading || !loadBalancer) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 48, height: 48, margin: '0 auto 16px',
            border: '2px solid var(--line)', borderTopColor: 'var(--accent)',
            borderRadius: '50%', animation: 'spin 0.9s linear infinite',
          }} />
          <p style={{ color: 'var(--text-3)' }}>Loading load balancer...</p>
        </div>
      </div>
    );
  }

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
          <div className="kicker" style={{ marginBottom: 8, fontSize: 'clamp(9px, 2vw, 11px)' }}>// editing</div>
          <h2 style={{ margin: 0, fontSize: 'clamp(18px, 3vw, 20px)', letterSpacing: '-0.02em', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {loadBalancer.name}
          </h2>
          <div style={{ color: 'var(--text-3)', fontSize: 'clamp(11px, 2vw, 12px)', marginTop: 6, lineHeight: 1.5 }}>
            Update routing strategy, origins, or domain configuration.
          </div>
        </div>

        <div style={{
          padding: 14, border: '1px solid var(--line)', borderRadius: 'var(--radius)',
          background: 'var(--bg-1)',
          fontSize: 'clamp(11px, 2vw, 12px)',
        }}>
          <div className="kicker" style={{ marginBottom: 10, fontSize: 'clamp(9px, 2vw, 11px)' }}>// preview</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 'clamp(10px, 2vw, 11px)', color: 'var(--text-2)', lineHeight: 1.7 }}>
            <div>name: <span style={{ color: 'var(--accent)' }}>{loadBalancer.name}</span></div>
            <div>host: <span style={{ color: 'var(--accent)' }}>{fullHost}</span></div>
            <div>origins: <span style={{ color: 'var(--accent)' }}>{form.origins.filter(s => s.url).length}</span></div>
            <div>strategy: <span style={{ color: 'var(--accent)' }}>{form.strategy}</span></div>
          </div>
        </div>

        <div style={{ flex: 1 }} />

        <div style={{
          padding: 14, border: '1px solid var(--line)', borderRadius: 'var(--radius)',
          background: 'var(--bg-1)',
        }}>
          <div className="kicker" style={{ marginBottom: 8, color: 'var(--text-3)' }}>// note</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>
            Worker name cannot be changed after creation. Updates deploy through Worker Versions.
          </div>
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
        <Topbar
          crumbs={['Dashboard', 'Load Balancers', loadBalancer.name]}
          title="Edit Load Balancer"
          subtitle="Configuration changes are promoted through Worker version deployments"
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
                    Updating…
                  </>
                ) : (
                  <>
                    <Icons.Check size={14} /> <span className="hide-sm">Save Changes</span><span className="hide-md">Save</span>
                  </>
                )}
              </button>
            </>
          }
        />

        <div style={{ padding: 'clamp(16px, 4vw, 32px)', maxWidth: 820, display: 'flex', flexDirection: 'column', gap: 'clamp(12px, 2vw, 20px)', overflow: 'auto', flex: 1 }}>
          <FieldBlock n={1} title="Subdomain"
            subtitle="Optional hostname prefix for the active edge route">
            <div className="field">
              <label className="field-label">Subdomain</label>
              <div style={{
                display: 'flex', alignItems: 'stretch',
                border: '1px solid var(--line)', borderRadius: 'var(--radius)',
                background: 'var(--bg-1)', overflow: 'hidden',
              }}>
                <input
                  className="input input-mono"
                  placeholder="api"
                  value={form.subdomain}
                  onChange={e => update('subdomain', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  style={{ border: 'none', background: 'transparent', flex: 1 }}
                />
                <div style={{
                  display: 'flex', alignItems: 'center', padding: '0 16px',
                  fontFamily: 'var(--mono)', fontSize: 13,
                  color: 'var(--text-3)', borderLeft: '1px solid var(--line)',
                  background: 'var(--bg-2)',
                }}>
                  .{loadBalancer.domain}
                </div>
              </div>
              <div className="hint">
                Your balancer will serve at{' '}
                <span className="mono" style={{ color: 'var(--accent)' }}>https://{fullHost}</span>
              </div>
            </div>
          </FieldBlock>

          <FieldBlock n={2} title="Origin Servers"
            subtitle="Add, remove, or rebalance the backends that receive traffic here">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {form.origins.map((s, i) => (
                <div key={s.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: showWeights ? '56px minmax(0, 1fr) 110px 40px' : '56px minmax(0, 1fr) 40px',
                    gap: 8, alignItems: 'center',
                  }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      height: 44, border: '1px solid var(--line)',
                      borderRadius: 'var(--radius)', background: 'var(--bg-2)',
                      fontFamily: 'var(--mono)', fontSize: 11,
                      color: 'var(--text-3)', textTransform: 'uppercase',
                    }}>#{i + 1}</div>
                    <input
                      className="input input-mono"
                      placeholder="https://domain.com, http://127.0.0.1, or 192.168.1.100"
                      value={s.url}
                      onChange={e => updateOrigin(s.id, { url: e.target.value })}
                    />
                    {showWeights && (
                      <div style={{ position: 'relative' }}>
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
                    <button
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

                  {form.strategy === 'geo-steering' && (() => {
                    const selectedCountries = s.geoCountries || [];
                    const selectedContinents = s.geoContinents || [];

                    // Smart filtering: Countries ↔ Continents bidirectional
                    // If continents selected → show only countries in those continents
                    // If countries selected → show only continents those countries belong to
                    const availableCountries = selectedContinents.length > 0
                      ? COUNTRIES.filter(c => (selectedContinents as string[]).includes(c.continent))
                      : COUNTRIES;

                    const availableContinents = selectedCountries.length > 0
                      ? (() => {
                          const countryObjects = COUNTRIES.filter(c => (selectedCountries as string[]).includes(c.code));
                          const continentCodes = [...new Set(countryObjects.map(c => c.continent))];
                          return CONTINENTS.filter(cont => (continentCodes as string[]).includes(cont.code));
                        })()
                      : CONTINENTS;

                    // Regions filter by selected countries
                    const availableRegions = selectedCountries.length > 0
                      ? selectedCountries.flatMap(country => getRegionsByCountry(country))
                      : getAllRegions();

                    return (
                      <div style={{
                        padding: 12, border: '1px solid var(--line)',
                        borderRadius: 'var(--radius)', background: 'var(--bg-2)',
                        marginLeft: 64,
                      }}>
                        <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10 }}>
                          Geographic routing for this server <span style={{ color: 'var(--text-2)', fontWeight: 500 }}>(at least one required)</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                          <div className="field">
                            <label className="field-label" style={{ fontSize: 11, marginBottom: 6 }}>
                              Countries {selectedContinents.length > 0 && <span style={{ color: 'var(--text-3)', fontWeight: 'normal' }}>(filtered by continents)</span>}
                            </label>
                            <MultiSelect
                              options={availableCountries.map(c => ({ code: c.code, name: c.name }))}
                              value={s.geoCountries || []}
                              onChange={(codes) => updateOrigin(s.id, { geoCountries: codes })}
                              placeholder="Select countries..."
                            />
                            <div className="hint" style={{ fontSize: 10, marginTop: 4 }}>Traffic from these countries</div>
                          </div>
                          <div className="field">
                            <label className="field-label" style={{ fontSize: 11, marginBottom: 6 }}>
                              Regions {selectedCountries.length > 0 && <span style={{ color: 'var(--text-3)', fontWeight: 'normal' }}>(filtered by countries)</span>}
                            </label>
                            <MultiSelect
                              options={availableRegions}
                              value={s.geoColos || []}
                              onChange={(codes) => updateOrigin(s.id, { geoColos: codes })}
                              placeholder={selectedCountries.length > 0 ? "Select regions..." : "Select countries first..."}
                              disabled={selectedCountries.length === 0}
                            />
                            <div className="hint" style={{ fontSize: 10, marginTop: 4 }}>Specific data center locations</div>
                          </div>
                          <div className="field">
                            <label className="field-label" style={{ fontSize: 11, marginBottom: 6 }}>
                              Continents {selectedCountries.length > 0 && <span style={{ color: 'var(--text-3)', fontWeight: 'normal' }}>(filtered by countries)</span>}
                            </label>
                            <MultiSelect
                              options={availableContinents.map(c => ({ code: c.code, name: c.name }))}
                              value={s.geoContinents || []}
                              onChange={(codes) => updateOrigin(s.id, { geoContinents: codes })}
                              placeholder="Select continents..."
                            />
                            <div className="hint" style={{ fontSize: 10, marginTop: 4 }}>Traffic from these continents</div>
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

          <FieldBlock n={3} title="Traffic Strategy"
            subtitle="Switch how requests are distributed across your origin fleet">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
              {STRATEGIES.map(s => {
                const Ico = Icons[s.icon as keyof typeof Icons];
                const active = form.strategy === s.id;
                return (
                  <button key={s.id}
                    onClick={() => update('strategy', s.id)}
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

          <FieldBlock n={4} title="Worker Placement"
            subtitle="Tune where the Worker executes relative to your origin infrastructure">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <label style={{
                display: 'flex', gap: 14, padding: 16,
                border: `1px solid ${form.smartPlacement ? 'var(--accent)' : 'var(--line)'}`,
                background: form.smartPlacement ? 'var(--accent-dim)' : 'var(--bg-2)',
                borderRadius: 'var(--radius)', cursor: 'pointer',
              }}>
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
                <label className="field-label">Placement Hint</label>
                <input
                  className="input input-mono"
                  placeholder="e.g., aws:us-east-1, gcp:europe-west1, azure:eastus2"
                  value={form.placementHint}
                  onChange={e => update('placementHint', e.target.value)}
                />
                <div className="hint">
                  Optional provider region hint for deployments that need to stay close to a specific origin geography.
                </div>
              </div>
            </div>
          </FieldBlock>

          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '16px 20px', border: '1px solid var(--line)',
            borderRadius: 'var(--radius-lg)', background: 'var(--bg-1)',
          }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-3)' }}>
              {allValid ? (
                <><span style={{ color: 'var(--green)' }}>✓</span> Ready to deploy update</>
              ) : (
                <>Complete required fields to deploy</>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
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
                    Updating…
                  </>
                ) : (
                  <>
                    <Icons.Check size={14} /> Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <DeploymentOverlay
          isOpen={deploying}
          mode="edit"
          targetName={loadBalancer.name}
          onCancel={() => {}}
          cancelRequested={false}
          cancellable={false}
        />

        <DeploymentSuccessModal
          isOpen={!!deploySuccess}
          mode="edit"
          name={deploySuccess?.name || loadBalancer.name}
          fullDomain={deploySuccess?.fullDomain || fullHost}
          onContinue={() => router.push('/dashboard')}
        />
      </main>

      <style jsx>{`
        @media (max-width: 768px) {
          .hide-md { display: none; }
          main {
            padding: 16px !important;
          }
          div[style*="gridTemplateColumns"] {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 640px) {
          .deploy-actions {
            flex-direction: column;
            width: 100%;
          }
          .deploy-actions button {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
