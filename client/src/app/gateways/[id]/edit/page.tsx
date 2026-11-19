'use client';
// Edit page — mirrors create but pre-fills from GET /gateways/:id and PUTs on submit

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { Topbar } from '@/components/dashboard/Sidebar';
import { Icons } from '@/components/shared/Icons';
import Link from 'next/link';
import { DeploymentOverlay, DeploymentSuccessModal } from '@/components/loadbalancers/DeploymentExperience';
import { MultiSelect } from '@/components/ui/MultiSelect';
import { ALL_CLOUD_REGIONS, REGIONS_BY_PROVIDER } from '@/lib/cloudRegions';
import toast from 'react-hot-toast';

const STEPS = [
  { n: 1, label: 'Name *' },
  { n: 2, label: 'Domain *' },
  { n: 3, label: 'Upstreams *' },
  { n: 4, label: 'Path Routing' },
  { n: 5, label: 'JWT Auth' },
  { n: 6, label: 'Header Transforms' },
  { n: 7, label: 'Caching' },
  { n: 8, label: 'Canary & Shadow' },
  { n: 9, label: 'IP Rules' },
  { n: 10, label: 'Mock Routes' },
  { n: 11, label: 'Rate Limiting' },
  { n: 12, label: 'CORS' },
  { n: 13, label: 'Body Shaping' },
  { n: 14, label: 'Schema Validation' },
  { n: 15, label: 'Placement' },
];

const JWT_ALGORITHMS = [
  { code: 'HS256', name: 'HS256' },
  { code: 'HS384', name: 'HS384' },
  { code: 'HS512', name: 'HS512' },
  { code: 'RS256', name: 'RS256' },
  { code: 'RS384', name: 'RS384' },
  { code: 'RS512', name: 'RS512' },
  { code: 'ES256', name: 'ES256' },
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
      fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600, flexShrink: 0,
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
        border: '1px solid var(--accent)', flexShrink: 0,
      }}>{n}</div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <h3 style={{ margin: 0, fontSize: 'clamp(14px, 3vw, 16px)', letterSpacing: '-0.01em', fontWeight: 500 }}>{title}</h3>
        <div style={{ color: 'var(--text-3)', fontSize: 'clamp(12px, 2vw, 13px)', marginTop: 4 }}>{subtitle}</div>
      </div>
    </div>
    <div>{children}</div>
  </div>
);

function TagListInput({
  tags,
  onChange,
  placeholder,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState('');

  const addTags = (raw: string) => {
    const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
    if (!parts.length) return;
    const next = [...tags];
    for (const p of parts) {
      if (!next.includes(p)) next.push(p);
    }
    onChange(next);
    setInput('');
  };

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 6,
      border: '1px solid var(--line)', borderRadius: 'var(--radius)',
      padding: '6px 10px', background: 'var(--bg)', minHeight: 38,
      alignItems: 'center',
    }}>
      {tags.map(t => (
        <div key={t} style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: 'var(--bg-3)', borderRadius: 4, padding: '2px 8px', fontSize: 12,
        }}>
          <span>{t}</span>
          <button
            type="button"
            onClick={() => onChange(tags.filter(x => x !== t))}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 0, lineHeight: 1 }}
          >
            ×
          </button>
        </div>
      ))}
      <input
        type="text"
        className="input-mono"
        value={input}
        onChange={e => {
          if (e.target.value.includes(',')) {
            addTags(e.target.value);
          } else {
            setInput(e.target.value);
          }
        }}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            if (input.trim()) addTags(input);
          } else if (e.key === 'Backspace' && !input && tags.length > 0) {
            onChange(tags.slice(0, -1));
          }
        }}
        onBlur={() => {
          if (input.trim()) addTags(input);
        }}
        placeholder={placeholder || 'Type and press Enter or comma'}
        style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 12, flex: 1, minWidth: 160 }}
      />
    </div>
  );
}

export default function EditGatewayPage() {
  const router = useRouter();
  const params = useParams();
  const gatewayId = (params as any)?.id as string;
  const { user, loading: authLoading } = useAuth();

  const [activeStep, setActiveStep] = useState(1);
  const [loadingGateway, setLoadingGateway] = useState(true);
  useEffect(() => {
    if (!gatewayId || authLoading || !user) return;
    (async () => {
      try {
        const res = await api.getGateway(gatewayId);
        if (res.success && res.data?.gateway) {
          const gw: any = res.data.gateway;
          setForm((prev: any) => ({
            ...prev,
            name: gw.name ?? prev.name,
            domain: gw.domain ?? '',
            subdomain: gw.subdomain ?? '',
            zoneId: gw.zoneId ?? '',
            upstreams: gw.upstreams?.length ? gw.upstreams : prev.upstreams,
            pathRoutes: gw.pathRoutes ?? [],
            bffRoutes: gw.bffRoutes ?? [],
            corsEnabled: gw.corsEnabled ?? false,
            corsOrigins: gw.corsOrigins ?? [],
            jwtEnabled: gw.jwtAuthEnabled ?? false,
            jwtHeaderName: gw.jwtHeaderName ?? 'Authorization',
            jwtAlgorithms: ['HS256'],
            jwtIssuer: '',
            jwtSecret: '',
            rbacRules: gw.jwtRbacRules ?? [],
            injectHeaders: gw.jwtInjectHeaders ?? false,
            headerReqSet: gw.headerTransforms?.request?.set?.map((r: any, idx: number) => ({ id: idx + 1, name: r.name, value: r.value })) ?? [],
            headerReqRemove: gw.headerTransforms?.request?.remove ?? [],
            headerResSet: gw.headerTransforms?.response?.set?.map((r: any, idx: number) => ({ id: idx + 1, name: r.name, value: r.value })) ?? [],
            headerResRemove: gw.headerTransforms?.response?.remove ?? [],
            cacheEnabled: gw.cacheConfig?.enabled ?? false,
            cacheTtl: gw.cacheConfig?.ttlSeconds ?? 60,
            cachePaths: gw.cacheConfig?.paths ?? [],
            normalizeQuery: gw.cacheConfig?.normalizeQuery ?? false,
            canaryEnabled: gw.canary?.enabled ?? false,
            canaryPercentage: gw.canary?.percentage ?? 10,
            canaryUpstreamIndex: gw.canary?.upstreamIndex ?? 0,
            shadowEnabled: gw.shadowConfig?.enabled ?? false,
            shadowPercentage: gw.shadowConfig?.percentage ?? 10,
            shadowUpstreamIndex: gw.shadowConfig?.upstreamIndex ?? 0,
            bodyTransforms: gw.bodyTransforms ?? [],
            schemaRules: gw.schemaRules ?? [],
            ipRules: gw.ipRules ?? [],
            mockRoutes: gw.mockRoutes ?? [],
            rateLimitEnabled: gw.rateLimitEnabled ?? false,
            rateLimitRpm: gw.rateLimitRequestsPerMinute ?? 60,
            rateLimitKeyType: gw.rateLimitKeyType ?? 'ip',
            rateLimitHeaderName: gw.rateLimitHeaderName ?? 'X-API-Key',
            pathRateLimits: gw.pathRateLimits ?? [],
            smartPlacement: gw.placement?.smartPlacement !== false,
            placementHint: gw.placement?.region || '',
          }));
        }
      } catch (e: any) {
        toast.error(e.response?.data?.message || e.message || 'Failed to load gateway');
      } finally {
        setLoadingGateway(false);
      }
    })();
  }, [gatewayId, authLoading, user]);


  const [deploying, setDeploying] = useState(false);
  const [zones, setZones] = useState<any[]>([]);
  const [deploySuccess, setDeploySuccess] = useState<{ name: string; fullDomain: string } | null>(null);
  const [hostnameError, setHostnameError] = useState<string | null>(null);
  const [validatingHostname, setValidatingHostname] = useState(false);

  const plan = (user?.plan || 'free') as string;
  const isPro = !!user?.isPro;
  const isFree = plan === 'free';
  const isTrialOrStudent = plan === 'trial' || plan === 'student' || plan === 'student-annual';
  const isStudent = isTrialOrStudent;
  const canJwt = !isFree;
  const canCache = !isFree;
  const canCanary = isPro;
  const canRateLimit = isPro;

  const headerLimit = isPro ? Infinity : isFree ? 3 : 10;
  const ipLimit = isPro ? Infinity : isFree ? 5 : 20;
  const mockLimit = isPro ? Infinity : isFree ? 2 : 10;
  const routesLimit = isPro ? Infinity : isFree ? 5 : 20;
  const rateLimitRulesLimit = isPro ? Infinity : isFree ? 1 : 5;
  const rbacLimit = isPro ? Infinity : isFree ? 0 : 5;
  const schemaLimit = isPro ? Infinity : isFree ? 1 : 5;
  const bodyShapingLimit = isPro ? Infinity : isFree ? 1 : 5;
  const canIdentityRateLimit = isPro || isStudent;
  const canBff = isPro;
  const canShadow = isPro;
  const canHeaderInjection = isPro;
  const canRbac = isPro || isStudent;

  const [form, setForm] = useState({
    name: '',
    zoneId: '',
    subdomain: '',
    upstreams: [{ id: 1, url: '', weight: 100 }],
    pathRoutes: [] as Array<{ path: string; upstreamIndex: number; priority: number }>,
    bffRoutes: [] as Array<{ path: string; upstreamIndices: number[]; priority: number }>,
    jwtEnabled: false,
    jwtHeaderName: 'Authorization',
    jwtAlgorithms: ['HS256'] as string[],
    jwtIssuer: '',
    jwtSecret: '',
    rbacRules: [] as Array<{ path: string; requiredRoles: string[] }>,
    injectHeaders: false,
    headerReqSet: [] as Array<{ id: number; name: string; value: string }>,
    headerReqRemove: [] as string[],
    headerResSet: [] as Array<{ id: number; name: string; value: string }>,
    headerResRemove: [] as string[],
    cacheEnabled: false,
    cacheTtl: 60,
    cachePaths: [] as string[],
    normalizeQuery: false,
    canaryEnabled: false,
    canaryPercentage: 10,
    canaryUpstreamIndex: 0,
    shadowEnabled: false,
    shadowPercentage: 10,
    shadowUpstreamIndex: 0,
    ipRules: [] as Array<{ value: string; action: 'allow' | 'deny' }>,
    mockRoutes: [] as Array<{ path: string; method: string; status: number; body: string; contentType: string }>,
    bodyTransforms: [] as Array<{ path: string; phase: 'request' | 'response'; stripFields: string[]; renameFields: Array<{ from: string; to: string }> }>,
    schemaRules: [] as Array<{ path: string; method: string; requiredFields: string[]; fieldTypes: Array<{ field: string; type: 'string' | 'number' | 'boolean' | 'array' }> }>,
    rateLimitEnabled: false,
    rateLimitRpm: 60,
    rateLimitKeyType: 'ip' as 'ip' | 'header' | 'jwt',
    rateLimitHeaderName: 'X-API-Key',
    pathRateLimits: [] as Array<{ path: string; requestsPerMinute: number; priority: number }>,
    corsEnabled: false,
    corsOrigins: [] as string[],
    smartPlacement: true,
    placementHint: '',
  });

  const [corsInput, setCorsInput] = useState('');
  const [cachePathInput, setCachePathInput] = useState('');
  const [reqRemoveInput, setReqRemoveInput] = useState('');
  const [resRemoveInput, setResRemoveInput] = useState('');

  const update = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v } as typeof f));

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
      if (response.success && (response.data as any)?.zones) {
        setZones((response.data as any).zones);
      }
    } catch {
      toast.error('Failed to fetch Cloudflare zones');
    }
  };

  const selectedZone = zones.find(z => z.id === form.zoneId);
  const fullHost = selectedZone
    ? (form.subdomain ? `${form.subdomain}.${selectedZone.name}` : selectedZone.name)
    : '—';

  const validateHostname = async () => {
    if (!selectedZone?.name) return;
    setValidatingHostname(true);
    setHostnameError(null);
    try {
      const res = await api.validateGatewayHostname({
        domain: selectedZone.name,
        subdomain: form.subdomain.trim() || undefined,
        zoneId: form.zoneId,
      });
      if (!res.success) setHostnameError(res.message || 'Hostname unavailable');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Hostname validation failed';
      setHostnameError(msg);
    } finally {
      setValidatingHostname(false);
    }
  };

  const nameValid = /^[a-z0-9-]+$/.test(form.name) && form.name.length >= 3 && form.name.length <= 50;
  const zoneValid = !!form.zoneId;
  const upstreamsValid = form.upstreams.length >= 1 && form.upstreams.every(s => {
    const u = s.url.trim();
    return u.length > 0 && (u.startsWith('http://') || u.startsWith('https://'));
  });
  const placementValid = form.smartPlacement || form.placementHint.trim().length > 0;
  const allValid = nameValid && zoneValid && upstreamsValid && placementValid && !hostnameError;

  const redistributeWeights = (arr: typeof form.upstreams) => {
    const n = arr.length;
    const share = Math.floor(100 / n);
    const remainder = 100 - share * n;
    return arr.map((o, i) => ({ ...o, weight: i < remainder ? share + 1 : share }));
  };

  const addUpstream = () => {
    setForm(f => {
      const next = [...f.upstreams, { id: Date.now(), url: '', weight: 1 }];
      return { ...f, upstreams: redistributeWeights(next) };
    });
  };

  const removeUpstream = (id: number) => {
    setForm(f => {
      if (f.upstreams.length <= 1) return f;
      return { ...f, upstreams: redistributeWeights(f.upstreams.filter(s => s.id !== id)) };
    });
  };

  const updateUpstream = (id: number, patch: Partial<typeof form.upstreams[number]>) => {
    setForm(f => ({ ...f, upstreams: f.upstreams.map(s => s.id === id ? { ...s, ...patch } : s) }));
  };

  const headerTotal = form.headerReqSet.length + form.headerReqRemove.length + form.headerResSet.length + form.headerResRemove.length;
  const headerAtCap = headerTotal >= headerLimit;
  const ipAtCap = form.ipRules.length >= ipLimit;
  const mockAtCap = form.mockRoutes.length >= mockLimit;
  const routesAtCap = form.pathRoutes.length >= routesLimit;
  const rateRulesAtCap = form.pathRateLimits.length >= rateLimitRulesLimit;

  const addCorsOrigin = (value: string) => {
    const trimmed = value.trim().replace(/\/$/, '');
    if (!trimmed) return;
    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    if (!form.corsOrigins.includes(normalized)) update('corsOrigins', [...form.corsOrigins, normalized]);
    setCorsInput('');
  };

  const deploy = async () => {
    if (!allValid) return;
    if (form.jwtEnabled && canJwt && !form.jwtSecret.trim()) {
      toast.error('JWT secret is required when JWT auth is enabled');
      return;
    }
    setDeploying(true);
    try {
      if (!selectedZone?.name) throw new Error('Please select a valid domain');
      const trimmedSubdomain = form.subdomain.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        zoneId: form.zoneId,
        domain: selectedZone.name,
        subdomain: trimmedSubdomain || undefined,
        upstreams: form.upstreams.map(u => ({ url: u.url.trim(), weight: Number(u.weight) || 1 })),
        pathRoutes: form.pathRoutes.length ? form.pathRoutes : undefined,
        bffRoutes: canBff && form.bffRoutes.length ? form.bffRoutes : undefined,
        corsEnabled: form.corsEnabled,
        corsOrigins: form.corsOrigins,
        jwtAuth: canJwt ? {
          enabled: form.jwtEnabled,
          headerName: form.jwtHeaderName.trim() || 'Authorization',
          algorithms: form.jwtAlgorithms.length ? form.jwtAlgorithms : ['HS256'],
          issuer: form.jwtIssuer.trim() || null,
          secret: form.jwtEnabled ? form.jwtSecret : null,
          rbacRules: canRbac && form.rbacRules.length ? form.rbacRules : [],
          injectHeaders: canHeaderInjection ? form.injectHeaders : false,
        } : undefined,
        headerTransforms: {
          request: {
            set: form.headerReqSet.map(r => ({ name: r.name.trim(), value: r.value })),
            remove: form.headerReqRemove,
          },
          response: {
            set: form.headerResSet.map(r => ({ name: r.name.trim(), value: r.value })),
            remove: form.headerResRemove,
          },
        },
        cacheConfig: canCache ? {
          enabled: form.cacheEnabled,
          ttlSeconds: Number(form.cacheTtl) || 60,
          paths: form.cachePaths,
          normalizeQuery: form.normalizeQuery,
        } : undefined,
        canary: canCanary ? {
          enabled: form.canaryEnabled,
          percentage: Number(form.canaryPercentage) || 10,
          upstreamIndex: Number(form.canaryUpstreamIndex) || 0,
        } : undefined,
        shadowConfig: canShadow && form.shadowEnabled ? {
          enabled: true,
          percentage: Number(form.shadowPercentage) || 10,
          upstreamIndex: Number(form.shadowUpstreamIndex) || 0,
        } : undefined,
        bodyTransforms: form.bodyTransforms.length ? form.bodyTransforms : undefined,
        schemaRules: form.schemaRules.length ? form.schemaRules : undefined,
        ipRules: form.ipRules.length ? form.ipRules : undefined,
        mockRoutes: form.mockRoutes.length ? form.mockRoutes.map(m => ({
          path: m.path,
          method: m.method || 'GET',
          status: Number(m.status) || 200,
          body: m.body || '',
          contentType: m.contentType || 'application/json',
        })) : undefined,
        rateLimitEnabled: canRateLimit ? form.rateLimitEnabled : false,
        rateLimitRequestsPerMinute: canRateLimit && form.rateLimitEnabled ? Number(form.rateLimitRpm) || 60 : null,
        rateLimitKeyType: canIdentityRateLimit ? form.rateLimitKeyType : 'ip',
        rateLimitHeaderName: canIdentityRateLimit && form.rateLimitKeyType === 'header' ? form.rateLimitHeaderName : undefined,
        pathRateLimits: canRateLimit && form.pathRateLimits.length ? form.pathRateLimits : undefined,
        placement: {
          smartPlacement: form.smartPlacement,
          region: !form.smartPlacement ? form.placementHint.trim() : undefined,
        },
      };

      const operationId = `gateway-create-${Date.now()}`;
      const response = await api.updateGateway(gatewayId, payload, { headers: { 'x-operation-id': operationId } });
      if (response.success && (response.data as any)?.gateway) {
        const gw = (response.data as any).gateway;
        setDeploySuccess({ name: gw.name, fullDomain: gw.fullDomain || fullHost });
      } else {
        throw new Error(response.message || 'Deployment failed');
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to deploy gateway';
      if (msg.toLowerCase().includes('limit') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('plan')) {
        toast.error(msg);
      } else {
        toast.error(msg);
      }
    } finally {
      setDeploying(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)', flexDirection: 'row' }}>
      <aside style={{
        width: 280, borderRight: '1px solid var(--line)',
        padding: 'clamp(20px, 3vw, 32px)', position: 'sticky', top: 0, height: '100vh',
        display: 'flex', flexDirection: 'column', gap: 'clamp(16px, 3vw, 24px)',
        fontSize: 'clamp(12px, 2vw, 13px)', overflow: 'auto',
      }} className="hide-md">
        <button onClick={() => router.push('/gateways')} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontFamily: 'var(--mono)', fontSize: 'clamp(9px, 2vw, 11px)', color: 'var(--text-3)',
          textTransform: 'uppercase', letterSpacing: '0.06em', background: 'none', border: 'none', cursor: 'pointer',
        }}>
          <Icons.Arrow size={12} style={{ transform: 'rotate(180deg)' }} /> Back to Gateways
        </button>
        <div>
          <div className="kicker" style={{ marginBottom: 8, fontSize: 'clamp(9px, 2vw, 11px)' }}>// edit gateway</div>
          <h2 style={{ margin: 0, fontSize: 'clamp(18px, 3vw, 20px)', letterSpacing: '-0.02em', fontWeight: 500 }}>{form.name ? form.name : 'Edit API Gateway'}</h2>
          <div style={{ color: 'var(--text-3)', fontSize: 'clamp(11px, 2vw, 12px)', marginTop: 6, lineHeight: 1.5 }}>
            Update routing, auth and transforms — then redeploy to Cloudflare.
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {STEPS.map(s => (
            <StepIndicator key={s.n} n={s.n} label={s.label} active={activeStep === s.n} done={activeStep > s.n} onJump={() => setActiveStep(s.n)} />
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ padding: 14, border: '1px solid var(--line)', borderRadius: 'var(--radius)', background: 'var(--bg-1)', fontSize: 'clamp(11px, 2vw, 12px)' }}>
          <div className="kicker" style={{ marginBottom: 10, fontSize: 'clamp(9px, 2vw, 11px)' }}>// preview</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 'clamp(10px, 2vw, 11px)', color: 'var(--text-2)', lineHeight: 1.7 }}>
            <div>name: <span style={{ color: form.name ? 'var(--accent)' : 'var(--text-3)' }}>{form.name || '—'}</span></div>
            <div>host: <span style={{ color: selectedZone ? 'var(--accent)' : 'var(--text-3)' }}>{fullHost}</span></div>
            <div>upstreams: <span style={{ color: 'var(--accent)' }}>{form.upstreams.filter(s => s.url).length}</span></div>
            <div>plan: <span style={{ color: 'var(--accent)' }}>{plan}</span></div>
          </div>
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
        <Topbar
          crumbs={['Overview', 'API Gateways', form.name ? form.name : 'Edit']}
          title={`Edit API Gateway${form.name ? ` — ${form.name}` : ''}`}
          subtitle={loadingGateway ? 'Loading gateway...' : 'Update routing, auth, caching and edge rules — then redeploy.'}
          actions={<button className="btn btn-ghost btn-sm" onClick={() => router.push('/gateways')}>Cancel</button>}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 32, padding: 'clamp(16px, 4vw, 32px)', overflow: 'auto', flex: 1 }}>
          <div className="create-form-shell" style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(12px, 2vw, 20px)' }}>

            <FieldBlock n={1} title="Gateway Name" subtitle="Locked after creation — deployed as the exact Worker script name">
              <div className="field">
                <label className="field-label">Name <span className="req">*</span> <span style={{ fontWeight: 400, color: 'var(--text-3)', fontSize: 11 }}>(locked)</span></label>
                <input className="input input-mono" placeholder="e.g., api-gateway-prod" value={form.name} disabled style={{ opacity: 0.6, cursor: 'not-allowed' }} />
                <div className="hint">Gateway name cannot be changed after creation. This is the Worker script name in your Cloudflare account.</div>
              </div>
            </FieldBlock>

            <FieldBlock n={2} title="Domain Selection" subtitle="Pick the Cloudflare zone and optional subdomain">
              <div className="field">
                <label className="field-label">Domain <span className="req">*</span></label>
                <div className="domain-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(140px, 50vw, 220px), 1fr))', gap: 'clamp(6px, 2vw, 8px)' }}>
                  {zones.map(z => {
                    const active = form.zoneId === z.id;
                    return (
                      <button key={z.id} onClick={() => { update('zoneId', z.id); setActiveStep(2); setHostnameError(null); }} disabled={z.status !== 'active'}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: 12, borderRadius: 'var(--radius)',
                          border: `1px solid ${active ? 'var(--accent)' : 'var(--line)'}`, background: active ? 'var(--accent-dim)' : 'var(--bg-2)',
                          textAlign: 'left', opacity: z.status === 'active' ? 1 : 0.4,
                        }}>
                        <Icons.Globe size={14} stroke={active ? 'var(--accent)' : 'var(--text-3)'} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="mono" style={{ fontSize: 13, fontWeight: 500, color: active ? 'var(--text)' : 'var(--text-2)' }}>{z.name}</div>
                          <div className="mono" style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase' }}>{z.status}</div>
                        </div>
                        {active && <Icons.Check size={14} stroke="var(--accent)" />}
                      </button>
                    );
                  })}
                </div>
                <div className="hint">Zones are fetched from your connected Cloudflare account.</div>
              </div>
              <div className="field" style={{ marginTop: 12 }}>
                <label className="field-label">Subdomain prefix <span style={{ fontWeight: 400, color: 'var(--text-3)' }}>(optional)</span></label>
                <div className="subdomain-row" style={{ display: 'flex', alignItems: 'stretch', border: '1px solid var(--line)', borderRadius: 'var(--radius)', background: 'var(--bg-1)', overflow: 'hidden' }}>
                  <input className="input input-mono" placeholder="api" value={form.subdomain}
                    onChange={e => update('subdomain', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    onFocus={() => setActiveStep(2)} onBlur={validateHostname}
                    style={{ border: 'none', background: 'transparent', flex: 1 }} />
                  <div className="subdomain-suffix" style={{ display: 'flex', alignItems: 'center', padding: '0 16px', fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text-3)', borderLeft: '1px solid var(--line)', background: 'var(--bg-2)' }}>
                    .{selectedZone?.name || 'select-domain.com'}
                  </div>
                </div>
                <div className="hint">
                  {form.subdomain.trim() ? <><span className="mono" style={{ color: 'var(--accent)' }}>https://{fullHost}</span> — subdomain will be created automatically</> : <>Uses bare domain <span className="mono" style={{ color: 'var(--accent)' }}>https://{fullHost}</span></>}
                </div>
                {validatingHostname && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>Validating hostname…</div>}
                {hostnameError && <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 4 }}>{hostnameError}</div>}
                {!hostnameError && !validatingHostname && selectedZone && form.subdomain && <div style={{ fontSize: 12, color: 'var(--green)', marginTop: 4 }}>Hostname available</div>}
              </div>
            </FieldBlock>

            <FieldBlock n={3} title="Upstreams" subtitle="Backends that receive traffic — at least one required, url must start with http:// or https://">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {form.upstreams.map((u, i) => (
                  <div key={u.id} style={{ display: 'grid', gridTemplateColumns: '48px minmax(0, 1fr) 110px 40px', gap: 8, alignItems: 'center' }} className="upstream-row">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 44, border: '1px solid var(--line)', borderRadius: 'var(--radius)', background: 'var(--bg-2)', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-3)' }}>#{i + 1}</div>
                    <input className="input input-mono" placeholder="https://origin.example.com" value={u.url}
                      onChange={e => updateUpstream(u.id, { url: e.target.value })}
                      onFocus={() => setActiveStep(3)} />
                    <div style={{ position: 'relative' }}>
                      <input className="input input-mono" type="number" min={1} max={99} value={u.weight}
                        onChange={e => { if (e.target.value.includes('.')) return; const n = Number.parseInt(e.target.value, 10); updateUpstream(u.id, { weight: Number.isNaN(n) ? 1 : Math.min(99, Math.max(1, n)) }); }}
                        onBlur={() => setForm(f => ({ ...f, upstreams: redistributeWeights(f.upstreams) }))}
                        style={{ paddingRight: 28 }} />
                      <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-3)' }}>wt</span>
                    </div>
                    <button onClick={() => removeUpstream(u.id)} disabled={form.upstreams.length === 1}
                      style={{ height: 44, borderRadius: 'var(--radius)', border: '1px solid var(--line)', color: 'var(--text-3)', opacity: form.upstreams.length === 1 ? 0.3 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icons.Trash size={14} />
                    </button>
                  </div>
                ))}
                {form.upstreams.some(u => u.url && !(u.url.startsWith('http://') || u.url.startsWith('https://'))) && (
                  <div style={{ fontSize: 12, color: 'var(--red)' }}>Each upstream URL must start with http:// or https://</div>
                )}
                <button onClick={addUpstream} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, borderRadius: 'var(--radius)', border: '1px dashed var(--line-2)', color: 'var(--text-2)', fontSize: 13 }}>
                  <Icons.Plus size={14} /> Add Upstream
                </button>
              </div>
            </FieldBlock>

            <FieldBlock n={4} title="Path Routing" subtitle={`Route URL paths to specific upstreams — ${form.pathRoutes.length} / ${routesLimit === Infinity ? '∞' : routesLimit}`}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {form.pathRoutes.map((r, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input className="input input-mono" placeholder="/api/*" value={r.path}
                      onChange={e => { const next = [...form.pathRoutes]; next[i] = { ...next[i], path: e.target.value }; update('pathRoutes', next); }}
                      onFocus={() => setActiveStep(4)} style={{ flex: 2 }} />
                    <select className="input" value={r.upstreamIndex}
                      onChange={e => { const next = [...form.pathRoutes]; next[i] = { ...next[i], upstreamIndex: Number(e.target.value) }; update('pathRoutes', next); }}
                      style={{ flex: 1 }}>
                      {form.upstreams.map((_, idx) => (
                        <option key={idx} value={idx}>Upstream {idx + 1}</option>
                      ))}
                    </select>
                    <input className="input" type="number" min={1} value={r.priority}
                      onChange={e => { const next = [...form.pathRoutes]; next[i] = { ...next[i], priority: Number(e.target.value) || 1 }; update('pathRoutes', next); }}
                      style={{ width: 80 }} />
                    <button type="button" className="btn btn-ghost" onClick={() => update('pathRoutes', form.pathRoutes.filter((_, j) => j !== i))} style={{ padding: '4px 8px', color: 'var(--red)' }}>✕</button>
                  </div>
                ))}
                <button type="button" className="btn btn-ghost"
                  disabled={routesAtCap}
                  onClick={() => {
                    if (routesAtCap) { toast.error(`Route limit reached (${routesLimit})`); return; }
                    if (!form.upstreams.some(u => u.url.trim())) { toast.error('Add at least one upstream first'); return; }
                    update('pathRoutes', [...form.pathRoutes, { path: '', upstreamIndex: 0, priority: form.pathRoutes.length + 1 }]);
                  }}
                  style={{ fontSize: 13, opacity: routesAtCap ? 0.4 : 1 }}>
                  + Add route {routesLimit !== Infinity && `(${form.pathRoutes.length}/${routesLimit})`}
                </button>

                <div style={{ marginTop: 16, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>BFF Multi-Upstream Fan-Out & Aggregation</span>
                    <span style={{ fontSize: 11, color: 'var(--accent)', background: 'var(--accent-dim)', padding: '2px 8px', borderRadius: 4 }}>Pro Feature</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10 }}>
                    Accept 1 incoming request, fetch multiple internal upstreams in parallel, and return merged JSON.
                  </div>
                  {form.bffRoutes.map((b, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                      <input className="input input-mono" placeholder="/dashboard" value={b.path}
                        onChange={e => { const next = [...form.bffRoutes]; next[i] = { ...next[i], path: e.target.value }; update('bffRoutes', next); }}
                        style={{ flex: 2, minWidth: 140 }} />
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flex: 2, alignItems: 'center' }}>
                        {form.upstreams.map((_, uIdx) => (
                          <label key={uIdx} style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-2)', padding: '4px 8px', borderRadius: 4, cursor: 'pointer' }}>
                            <input type="checkbox" checked={b.upstreamIndices.includes(uIdx)}
                              onChange={e => {
                                const set = new Set(b.upstreamIndices);
                                if (e.target.checked) set.add(uIdx); else set.delete(uIdx);
                                const next = [...form.bffRoutes];
                                next[i] = { ...next[i], upstreamIndices: Array.from(set) };
                                update('bffRoutes', next);
                              }} />
                            Upstream {uIdx + 1}
                          </label>
                        ))}
                      </div>
                      <button type="button" className="btn btn-ghost" onClick={() => update('bffRoutes', form.bffRoutes.filter((_, j) => j !== i))} style={{ padding: '4px 8px', color: 'var(--red)' }}>✕</button>
                    </div>
                  ))}
                  <button type="button" className="btn btn-ghost" disabled={!canBff}
                    onClick={() => {
                      if (!canBff) { toast.error('BFF Multi-Upstream Aggregation requires the Pro plan'); return; }
                      update('bffRoutes', [...form.bffRoutes, { path: '', upstreamIndices: [0], priority: form.bffRoutes.length + 1 }]);
                    }}
                    style={{ fontSize: 12, opacity: canBff ? 1 : 0.4 }}>
                    + Add BFF Fan-Out Route {!canBff && '(Requires Pro)'}
                  </button>
                </div>
              </div>
            </FieldBlock>

            <FieldBlock n={5} title="JWT Auth" subtitle="Verify JWTs on every request — algorithms, issuer and secret">
              {!canJwt ? (
                <div style={{ padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icons.Lock size={14} stroke="var(--text-3)" />
                    <span style={{ fontSize: 13, color: 'var(--text-2)' }}>JWT Auth is available on Trial / Student / Pro</span>
                  </div>
                  <Link href="/pro"><button className="btn btn-primary btn-sm">Upgrade</button></Link>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <label style={{ display: 'flex', gap: 14, padding: 16, border: `1px solid ${form.jwtEnabled ? 'var(--accent)' : 'var(--line)'}`, background: form.jwtEnabled ? 'var(--accent-dim)' : 'var(--bg-2)', borderRadius: 'var(--radius)', cursor: 'pointer' }}>
                    <div style={{ width: 36, height: 20, flexShrink: 0, borderRadius: 999, background: form.jwtEnabled ? 'var(--accent)' : 'var(--bg-3)', position: 'relative', transition: 'background 160ms' }}>
                      <div style={{ position: 'absolute', top: 2, left: form.jwtEnabled ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: 'var(--bg)', transition: 'left 160ms' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>Enable JWT Auth</div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>When enabled, requests without a valid JWT are rejected.</div>
                    </div>
                    <input type="checkbox" checked={form.jwtEnabled} onChange={e => update('jwtEnabled', e.target.checked)} style={{ display: 'none' }} />
                  </label>
                  {form.jwtEnabled && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div className="field">
                        <label className="field-label">Header Name</label>
                        <input className="input input-mono" placeholder="Authorization" value={form.jwtHeaderName} onChange={e => update('jwtHeaderName', e.target.value)} onFocus={() => setActiveStep(5)} />
                      </div>
                      <div className="field">
                        <label className="field-label">Algorithms</label>
                        <MultiSelect options={JWT_ALGORITHMS} value={form.jwtAlgorithms} onChange={v => update('jwtAlgorithms', v)} placeholder="Select algorithms..." />
                      </div>
                      <div className="field">
                        <label className="field-label">Issuer <span style={{ fontWeight: 400, color: 'var(--text-3)' }}>(optional)</span></label>
                        <input className="input input-mono" placeholder="https://issuer.example.com" value={form.jwtIssuer} onChange={e => update('jwtIssuer', e.target.value)} onFocus={() => setActiveStep(5)} />
                      </div>
                      <div className="field">
                        <label className="field-label">Secret <span className="req">*</span></label>
                        <input className="input input-mono" type="password" placeholder="JWT secret" value={form.jwtSecret} onChange={e => update('jwtSecret', e.target.value)} onFocus={() => setActiveStep(5)} />
                        {form.jwtEnabled && !form.jwtSecret.trim() && <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 4 }}>Secret is required when JWT is enabled.</div>}
                      </div>

                      <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12, marginTop: 4 }}>
                        <label style={{ display: 'flex', gap: 10, alignItems: 'center', cursor: canHeaderInjection ? 'pointer' : 'not-allowed', opacity: canHeaderInjection ? 1 : 0.6 }}>
                          <input type="checkbox" checked={form.injectHeaders} disabled={!canHeaderInjection} onChange={e => update('injectHeaders', e.target.checked)} />
                          <div>
                            <span style={{ fontSize: 13, fontWeight: 500 }}>Forward Claims Downstream (X-User-Id, X-User-Roles)</span>
                            <span style={{ fontSize: 10, color: 'var(--accent)', background: 'var(--accent-dim)', padding: '2px 6px', borderRadius: 4, marginLeft: 8 }}>Pro Only</span>
                            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Injects verified claims into upstream requests so internal services do not re-verify JWTs.</div>
                          </div>
                        </label>
                      </div>

                      <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 500 }}>Route-Level RBAC {rbacLimit !== Infinity && `(${form.rbacRules.length}/${rbacLimit})`}</span>
                          <span style={{ fontSize: 10, color: 'var(--accent)', background: 'var(--accent-dim)', padding: '2px 6px', borderRadius: 4 }}>Student / Pro</span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>Block requests on matching paths with 403 Forbidden unless the token has a required role.</div>
                        {form.rbacRules.map((r, i) => (
                          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                            <input className="input input-mono" placeholder="/admin/*" value={r.path}
                              onChange={e => { const next = [...form.rbacRules]; next[i] = { ...next[i], path: e.target.value }; update('rbacRules', next); }} style={{ flex: 2 }} />
                            <input className="input input-mono" placeholder="admin, manager" value={r.requiredRoles.join(', ')}
                              onChange={e => { const next = [...form.rbacRules]; next[i] = { ...next[i], requiredRoles: e.target.value.split(',').map(x => x.trim()).filter(Boolean) }; update('rbacRules', next); }} style={{ flex: 2 }} />
                            <button type="button" className="btn btn-ghost" onClick={() => update('rbacRules', form.rbacRules.filter((_, j) => j !== i))} style={{ color: 'var(--red)', padding: '4px 8px' }}>✕</button>
                          </div>
                        ))}
                        <button type="button" className="btn btn-ghost" disabled={!canRbac || form.rbacRules.length >= rbacLimit}
                          onClick={() => {
                            if (!canRbac) { toast.error('RBAC requires a Student or Pro plan.'); return; }
                            if (form.rbacRules.length >= rbacLimit) { toast.error(`RBAC limit reached (${rbacLimit})`); return; }
                            update('rbacRules', [...form.rbacRules, { path: '', requiredRoles: ['admin'] }]);
                          }} style={{ fontSize: 12, opacity: (!canRbac || form.rbacRules.length >= rbacLimit) ? 0.4 : 1 }}>
                          + Add RBAC rule {!canRbac && '(Requires Student/Pro)'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </FieldBlock>

            <FieldBlock n={6} title="Header Transforms" subtitle={`Rewrite headers at the edge — ${headerTotal} / ${headerLimit === Infinity ? '∞' : headerLimit} rules`}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Request Headers — Set</div>
                  {form.headerReqSet.map(r => (
                    <div key={r.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                      <input className="input input-mono" placeholder="X-Custom-Header" value={r.name} onChange={e => setForm(f => ({ ...f, headerReqSet: f.headerReqSet.map(x => x.id === r.id ? { ...x, name: e.target.value } : x) }))} onFocus={() => setActiveStep(6)} style={{ flex: 1 }} />
                      <input className="input input-mono" placeholder="value" value={r.value} onChange={e => setForm(f => ({ ...f, headerReqSet: f.headerReqSet.map(x => x.id === r.id ? { ...x, value: e.target.value } : x) }))} onFocus={() => setActiveStep(6)} style={{ flex: 1 }} />
                      <button type="button" className="btn btn-ghost" onClick={() => update('headerReqSet', form.headerReqSet.filter(x => x.id !== r.id))} style={{ color: 'var(--red)', padding: '4px 8px' }}>✕</button>
                    </div>
                  ))}
                  <button type="button" className="btn btn-ghost" disabled={headerAtCap} onClick={() => { if (headerAtCap) { toast.error(`Header rule limit reached (${headerLimit})`); return; } update('headerReqSet', [...form.headerReqSet, { id: Date.now(), name: '', value: '' }]); }} style={{ fontSize: 12, opacity: headerAtCap ? 0.4 : 1 }}>+ Add request set</button>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Request Headers — Remove</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '6px 10px', background: 'var(--bg)', minHeight: 40, alignItems: 'center' }}>
                    {form.headerReqRemove.map(v => (
                      <div key={v} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-3)', borderRadius: 4, padding: '2px 8px', fontSize: 12 }}>
                        <span>{v}</span>
                        <button type="button" onClick={() => update('headerReqRemove', form.headerReqRemove.filter(x => x !== v))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }}>×</button>
                      </div>
                    ))}
                    <input type="text" value={reqRemoveInput} onChange={e => setReqRemoveInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); const t = reqRemoveInput.trim(); if (t && !form.headerReqRemove.includes(t)) { if (headerAtCap) toast.error(`Header rule limit reached (${headerLimit})`); else update('headerReqRemove', [...form.headerReqRemove, t]); } setReqRemoveInput(''); } }}
                      onBlur={() => { const t = reqRemoveInput.trim(); if (t && !form.headerReqRemove.includes(t)) { if (!headerAtCap) update('headerReqRemove', [...form.headerReqRemove, t]); } setReqRemoveInput(''); }}
                      onFocus={() => setActiveStep(6)} placeholder="header-name then Enter" style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 12, flex: 1, minWidth: 160 }} />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Response Headers — Set</div>
                  {form.headerResSet.map(r => (
                    <div key={r.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                      <input className="input input-mono" placeholder="X-Response-Header" value={r.name} onChange={e => setForm(f => ({ ...f, headerResSet: f.headerResSet.map(x => x.id === r.id ? { ...x, name: e.target.value } : x) }))} onFocus={() => setActiveStep(6)} style={{ flex: 1 }} />
                      <input className="input input-mono" placeholder="value" value={r.value} onChange={e => setForm(f => ({ ...f, headerResSet: f.headerResSet.map(x => x.id === r.id ? { ...x, value: e.target.value } : x) }))} onFocus={() => setActiveStep(6)} style={{ flex: 1 }} />
                      <button type="button" className="btn btn-ghost" onClick={() => update('headerResSet', form.headerResSet.filter(x => x.id !== r.id))} style={{ color: 'var(--red)', padding: '4px 8px' }}>✕</button>
                    </div>
                  ))}
                  <button type="button" className="btn btn-ghost" disabled={headerAtCap} onClick={() => { if (headerAtCap) { toast.error(`Header rule limit reached (${headerLimit})`); return; } update('headerResSet', [...form.headerResSet, { id: Date.now(), name: '', value: '' }]); }} style={{ fontSize: 12, opacity: headerAtCap ? 0.4 : 1 }}>+ Add response set</button>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Response Headers — Remove</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '6px 10px', background: 'var(--bg)', minHeight: 40, alignItems: 'center' }}>
                    {form.headerResRemove.map(v => (
                      <div key={v} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-3)', borderRadius: 4, padding: '2px 8px', fontSize: 12 }}>
                        <span>{v}</span>
                        <button type="button" onClick={() => update('headerResRemove', form.headerResRemove.filter(x => x !== v))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }}>×</button>
                      </div>
                    ))}
                    <input type="text" value={resRemoveInput} onChange={e => setResRemoveInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); const t = resRemoveInput.trim(); if (t && !form.headerResRemove.includes(t)) { if (headerAtCap) toast.error(`Header rule limit reached (${headerLimit})`); else update('headerResRemove', [...form.headerResRemove, t]); } setResRemoveInput(''); } }}
                      onBlur={() => { const t = resRemoveInput.trim(); if (t && !form.headerResRemove.includes(t) && !headerAtCap) update('headerResRemove', [...form.headerResRemove, t]); setResRemoveInput(''); }}
                      onFocus={() => setActiveStep(6)} placeholder="header-name then Enter" style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 12, flex: 1, minWidth: 160 }} />
                  </div>
                </div>
                {headerAtCap && <div style={{ fontSize: 12, color: 'var(--red)' }}>Header rule limit reached ({headerLimit}). {isFree ? 'Upgrade for more.' : ''}</div>}
              </div>
            </FieldBlock>

            <FieldBlock n={7} title="Caching" subtitle="Cache responses at the edge by path">
              {!canCache ? (
                <div style={{ padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icons.Lock size={14} stroke="var(--text-3)" />
                    <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Caching is available on Trial / Student / Pro</span>
                  </div>
                  <Link href="/pro"><button className="btn btn-primary btn-sm">Upgrade</button></Link>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <label style={{ display: 'flex', gap: 14, padding: 16, border: `1px solid ${form.cacheEnabled ? 'var(--accent)' : 'var(--line)'}`, background: form.cacheEnabled ? 'var(--accent-dim)' : 'var(--bg-2)', borderRadius: 'var(--radius)', cursor: 'pointer' }}>
                    <div style={{ width: 36, height: 20, flexShrink: 0, borderRadius: 999, background: form.cacheEnabled ? 'var(--accent)' : 'var(--bg-3)', position: 'relative', transition: 'background 160ms' }}>
                      <div style={{ position: 'absolute', top: 2, left: form.cacheEnabled ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: 'var(--bg)', transition: 'left 160ms' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>Enable Caching</div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>Cache matching paths for the TTL below.</div>
                    </div>
                    <input type="checkbox" checked={form.cacheEnabled} onChange={e => update('cacheEnabled', e.target.checked)} style={{ display: 'none' }} />
                  </label>
                  {form.cacheEnabled && (
                    <>
                      <div className="field" style={{ maxWidth: 220 }}>
                        <label className="field-label">TTL (seconds)</label>
                        <input className="input input-mono" type="number" min={1} max={86400} value={form.cacheTtl}
                          onChange={e => { if (e.target.value.includes('.')) return; const n = Number.parseInt(e.target.value, 10); update('cacheTtl', Number.isNaN(n) ? 60 : Math.min(86400, Math.max(1, n))); }}
                          onFocus={() => setActiveStep(7)} />
                      </div>
                      <div className="field">
                        <label className="field-label">Cached paths</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '6px 10px', background: 'var(--bg)', minHeight: 40, alignItems: 'center' }}>
                          {form.cachePaths.map(p => (
                            <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-3)', borderRadius: 4, padding: '2px 8px', fontSize: 12 }}>
                              <span>{p}</span>
                              <button type="button" onClick={() => update('cachePaths', form.cachePaths.filter(x => x !== p))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }}>×</button>
                            </div>
                          ))}
                          <input type="text" value={cachePathInput} onChange={e => setCachePathInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); const t = cachePathInput.trim(); if (t && !form.cachePaths.includes(t)) update('cachePaths', [...form.cachePaths, t]); setCachePathInput(''); } }}
                            onBlur={() => { const t = cachePathInput.trim(); if (t && !form.cachePaths.includes(t)) update('cachePaths', [...form.cachePaths, t]); setCachePathInput(''); }}
                            onFocus={() => setActiveStep(7)} placeholder="/api/* then Enter" style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 12, flex: 1, minWidth: 160 }} />
                        </div>
                      </div>
                      <label style={{ display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer', marginTop: 4 }}>
                        <input type="checkbox" checked={form.normalizeQuery} onChange={e => update('normalizeQuery', e.target.checked)} />
                        <div>
                          <span style={{ fontSize: 13, fontWeight: 500 }}>Semantic Cache: Strip Tracking & Sort Query Parameters</span>
                          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Strips utm_*, fbclid and sorts query keys alphabetically so variations hit the same cache.</div>
                        </div>
                      </label>
                    </>
                  )}
                </div>
              )}
            </FieldBlock>

            <FieldBlock n={8} title="Canary & Traffic Shadowing" subtitle="Gradually shift traffic or mirror live requests asynchronously">
              {!canCanary ? (
                <div style={{ padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icons.Lock size={14} stroke="var(--text-3)" />
                    <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Canary & Shadowing are Pro features</span>
                  </div>
                  <Link href="/pro"><button className="btn btn-primary btn-sm">Upgrade to Pro</button></Link>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <label style={{ display: 'flex', gap: 14, padding: 16, border: `1px solid ${form.canaryEnabled ? 'var(--accent)' : 'var(--line)'}`, background: form.canaryEnabled ? 'var(--accent-dim)' : 'var(--bg-2)', borderRadius: 'var(--radius)', cursor: 'pointer' }}>
                    <div style={{ width: 36, height: 20, flexShrink: 0, borderRadius: 999, background: form.canaryEnabled ? 'var(--accent)' : 'var(--bg-3)', position: 'relative', transition: 'background 160ms' }}>
                      <div style={{ position: 'absolute', top: 2, left: form.canaryEnabled ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: 'var(--bg)', transition: 'left 160ms' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>Enable Canary Traffic Split</div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>Send a percentage of live traffic to a specific upstream based on hash.</div>
                    </div>
                    <input type="checkbox" checked={form.canaryEnabled} onChange={e => update('canaryEnabled', e.target.checked)} style={{ display: 'none' }} />
                  </label>
                  {form.canaryEnabled && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div className="field">
                        <label className="field-label">Percentage: {form.canaryPercentage}%</label>
                        <input type="range" min={1} max={100} value={form.canaryPercentage} onChange={e => update('canaryPercentage', Number(e.target.value))} onFocus={() => setActiveStep(8)} style={{ width: '100%' }} />
                      </div>
                      <div className="field">
                        <label className="field-label">Canary upstream</label>
                        <select className="input" value={form.canaryUpstreamIndex} onChange={e => update('canaryUpstreamIndex', Number(e.target.value))} onFocus={() => setActiveStep(8)} style={{ width: '100%' }}>
                          {form.upstreams.map((_, idx) => (
                            <option key={idx} value={idx}>Upstream {idx + 1}: {form.upstreams[idx].url || '(empty)'}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}>
                    <label style={{ display: 'flex', gap: 14, padding: 14, border: `1px solid ${form.shadowEnabled ? 'var(--accent)' : 'var(--line)'}`, background: form.shadowEnabled ? 'var(--accent-dim)' : 'var(--bg-2)', borderRadius: 'var(--radius)', cursor: 'pointer' }}>
                      <div style={{ width: 36, height: 20, flexShrink: 0, borderRadius: 999, background: form.shadowEnabled ? 'var(--accent)' : 'var(--bg-3)', position: 'relative', transition: 'background 160ms' }}>
                        <div style={{ position: 'absolute', top: 2, left: form.shadowEnabled ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: 'var(--bg)', transition: 'left 160ms' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>Asynchronous Traffic Shadowing (Mirroring)</div>
                        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>Duplicate live requests to a staging upstream via ctx.waitUntil without delaying the user.</div>
                      </div>
                      <input type="checkbox" checked={form.shadowEnabled} onChange={e => update('shadowEnabled', e.target.checked)} style={{ display: 'none' }} />
                    </label>
                    {form.shadowEnabled && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                        <div>
                          <label className="field-label">Shadow Target Upstream</label>
                          <select className="input" value={form.shadowUpstreamIndex} onChange={e => update('shadowUpstreamIndex', Number(e.target.value))}>
                            {form.upstreams.map((_, i) => <option key={i} value={i}>Upstream {i + 1}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="field-label">Sample % ({form.shadowPercentage}%)</label>
                          <input className="input" type="number" min={1} max={100} value={form.shadowPercentage} onChange={e => update('shadowPercentage', Number(e.target.value) || 10)} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </FieldBlock>

            <FieldBlock n={9} title="IP Rules" subtitle={`Allow or deny by IP/CIDR — ${form.ipRules.length} / ${ipLimit === Infinity ? '∞' : ipLimit}`}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {form.ipRules.map((r, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input className="input input-mono" placeholder="192.168.1.0/24 or 1.1.1.1" value={r.value}
                      onChange={e => { const next = [...form.ipRules]; next[i] = { ...next[i], value: e.target.value }; update('ipRules', next); }}
                      onFocus={() => setActiveStep(9)} style={{ flex: 2 }} />
                    <select className="input" value={r.action} onChange={e => { const next = [...form.ipRules]; next[i] = { ...next[i], action: e.target.value as 'allow' | 'deny' }; update('ipRules', next); }} style={{ width: 120 }}>
                      <option value="allow">Allow</option>
                      <option value="deny">Deny</option>
                    </select>
                    <button type="button" className="btn btn-ghost" onClick={() => update('ipRules', form.ipRules.filter((_, j) => j !== i))} style={{ color: 'var(--red)', padding: '4px 8px' }}>✕</button>
                  </div>
                ))}
                <button type="button" className="btn btn-ghost" disabled={ipAtCap}
                  onClick={() => { if (ipAtCap) { toast.error(`IP rule limit reached (${ipLimit})`); return; } update('ipRules', [...form.ipRules, { value: '', action: 'deny' }]); }}
                  style={{ fontSize: 13, opacity: ipAtCap ? 0.4 : 1 }}>
                  + Add IP rule {ipLimit !== Infinity && `(${form.ipRules.length}/${ipLimit})`}
                </button>
              </div>
            </FieldBlock>

            <FieldBlock n={10} title="Mock Routes" subtitle={`Return synthetic responses without hitting upstreams — ${form.mockRoutes.length} / ${mockLimit === Infinity ? '∞' : mockLimit}`}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {form.mockRoutes.map((m, i) => (
                  <div key={i} style={{ padding: 12, border: '1px solid var(--line)', borderRadius: 'var(--radius)', background: 'var(--bg-2)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input className="input input-mono" placeholder="/mock/hello" value={m.path} onChange={e => { const next = [...form.mockRoutes]; next[i] = { ...next[i], path: e.target.value }; update('mockRoutes', next); }} onFocus={() => setActiveStep(10)} style={{ flex: 2 }} />
                      <select className="input" value={m.method} onChange={e => { const next = [...form.mockRoutes]; next[i] = { ...next[i], method: e.target.value }; update('mockRoutes', next); }} style={{ width: 110 }}>
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                        <option value="DELETE">DELETE</option>
                        <option value="PATCH">PATCH</option>
                        <option value="ANY">ANY</option>
                      </select>
                      <input className="input" type="number" min={100} max={599} value={m.status} onChange={e => { const next = [...form.mockRoutes]; next[i] = { ...next[i], status: Number(e.target.value) || 200 }; update('mockRoutes', next); }} style={{ width: 90 }} />
                      <button type="button" className="btn btn-ghost" onClick={() => update('mockRoutes', form.mockRoutes.filter((_, j) => j !== i))} style={{ color: 'var(--red)', padding: '4px 8px' }}>✕</button>
                    </div>
                    <input className="input input-mono" placeholder="content-type e.g. application/json" value={m.contentType} onChange={e => { const next = [...form.mockRoutes]; next[i] = { ...next[i], contentType: e.target.value }; update('mockRoutes', next); }} onFocus={() => setActiveStep(10)} />
                    <textarea className="input input-mono" placeholder="Response body" value={m.body} onChange={e => { const next = [...form.mockRoutes]; next[i] = { ...next[i], body: e.target.value }; update('mockRoutes', next); }} onFocus={() => setActiveStep(10)} rows={2} style={{ resize: 'vertical' }} />
                  </div>
                ))}
                <button type="button" className="btn btn-ghost" disabled={mockAtCap}
                  onClick={() => { if (mockAtCap) { toast.error(`Mock route limit reached (${mockLimit})`); return; } update('mockRoutes', [...form.mockRoutes, { path: '', method: 'GET', status: 200, body: '', contentType: 'application/json' }]); }}
                  style={{ fontSize: 13, opacity: mockAtCap ? 0.4 : 1 }}>
                  + Add mock route {mockLimit !== Infinity && `(${form.mockRoutes.length}/${mockLimit})`}
                </button>
              </div>
            </FieldBlock>

            <FieldBlock n={11} title="Rate Limiting" subtitle="Global and per-path request caps — Pro only">
              {!canRateLimit ? (
                <div style={{ padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icons.Lock size={14} stroke="var(--text-3)" />
                    <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Rate Limiting is a Pro feature</span>
                  </div>
                  <Link href="/pro"><button className="btn btn-primary btn-sm">Upgrade to Pro</button></Link>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <label style={{ display: 'flex', gap: 14, padding: 16, border: `1px solid ${form.rateLimitEnabled ? 'var(--accent)' : 'var(--line)'}`, background: form.rateLimitEnabled ? 'var(--accent-dim)' : 'var(--bg-2)', borderRadius: 'var(--radius)', cursor: 'pointer' }}>
                    <div style={{ width: 36, height: 20, flexShrink: 0, borderRadius: 999, background: form.rateLimitEnabled ? 'var(--accent)' : 'var(--bg-3)', position: 'relative', transition: 'background 160ms' }}>
                      <div style={{ position: 'absolute', top: 2, left: form.rateLimitEnabled ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: 'var(--bg)', transition: 'left 160ms' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>Global Rate Limit</div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>Caps every visitor at a fixed number of requests per minute.</div>
                    </div>
                    <input type="checkbox" checked={form.rateLimitEnabled} onChange={e => update('rateLimitEnabled', e.target.checked)} style={{ display: 'none' }} />
                  </label>
                  {form.rateLimitEnabled && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div className="field" style={{ maxWidth: 320 }}>
                        <label className="field-label">Requests per minute</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input className="input input-mono" type="number" min={1} max={100000} value={form.rateLimitRpm}
                            onChange={e => { if (e.target.value.includes('.')) return; const n = Number.parseInt(e.target.value, 10); update('rateLimitRpm', Number.isNaN(n) ? 60 : Math.min(100000, Math.max(1, n))); }}
                            onFocus={() => setActiveStep(11)} style={{ flex: 1 }} />
                          <span style={{ fontSize: 12, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>req / min</span>
                        </div>
                      </div>

                      <div className="field" style={{ maxWidth: 440 }}>
                        <label className="field-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span>Rate Limit Key Identity</span>
                          {!canIdentityRateLimit && <span style={{ fontSize: 10, color: 'var(--accent)', background: 'var(--accent-dim)', padding: '2px 6px', borderRadius: 4 }}>Student / Pro</span>}
                        </label>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <select className="input" value={form.rateLimitKeyType}
                            onChange={e => {
                              if (!canIdentityRateLimit && e.target.value !== 'ip') {
                                toast.error('Identity-based rate limiting requires a Student or Pro plan.');
                                return;
                              }
                              update('rateLimitKeyType', e.target.value);
                            }} style={{ flex: 1 }}>
                            <option value="ip">Client IP Address (Default)</option>
                            <option value="header" disabled={!canIdentityRateLimit}>Custom Header (e.g. X-API-Key)</option>
                            <option value="jwt" disabled={!canIdentityRateLimit}>JWT Subject (user_id / sub)</option>
                          </select>
                          {form.rateLimitKeyType === 'header' && (
                            <input className="input input-mono" placeholder="X-API-Key" value={form.rateLimitHeaderName}
                              onChange={e => update('rateLimitHeaderName', e.target.value)} style={{ flex: 1 }} />
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  <div style={{ borderTop: '1px solid var(--line)', paddingTop: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Per-Path Rate Limits {rateLimitRulesLimit !== Infinity && `(${form.pathRateLimits.length}/${rateLimitRulesLimit})`}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>Each rule uses its own counter — per-path and global limits are independent.</div>
                    {form.pathRateLimits.map((rl, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                        <input className="input input-mono" placeholder="/login/*" value={rl.path} onChange={e => { const next = [...form.pathRateLimits]; next[i] = { ...next[i], path: e.target.value }; update('pathRateLimits', next); }} onFocus={() => setActiveStep(11)} style={{ flex: 2 }} />
                        <input className="input" type="number" min={1} max={100000} value={rl.requestsPerMinute} onChange={e => { const next = [...form.pathRateLimits]; next[i] = { ...next[i], requestsPerMinute: Number(e.target.value) || 60 }; update('pathRateLimits', next); }} style={{ width: 100 }} />
                        <span style={{ fontSize: 12, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>req/min</span>
                        <input className="input" type="number" min={1} value={rl.priority} onChange={e => { const next = [...form.pathRateLimits]; next[i] = { ...next[i], priority: Number(e.target.value) || 1 }; update('pathRateLimits', next); }} style={{ width: 80 }} />
                        <button type="button" className="btn btn-ghost" onClick={() => update('pathRateLimits', form.pathRateLimits.filter((_, j) => j !== i))} style={{ padding: '4px 8px', color: 'var(--red)' }}>✕</button>
                      </div>
                    ))}
                    <button type="button" className="btn btn-ghost" disabled={rateRulesAtCap}
                      onClick={() => { if (rateRulesAtCap) { toast.error(`Rate limit rule cap reached (${rateLimitRulesLimit})`); return; } update('pathRateLimits', [...form.pathRateLimits, { path: '', requestsPerMinute: 60, priority: form.pathRateLimits.length + 1 }]); }}
                      style={{ fontSize: 13, opacity: rateRulesAtCap ? 0.4 : 1 }}>+ Add per-path rule</button>
                  </div>
                </div>
              )}
            </FieldBlock>

            <FieldBlock n={12} title="CORS" subtitle="Handle cross-origin requests — allow your frontend domains">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label style={{ display: 'flex', gap: 14, padding: 16, border: `1px solid ${form.corsEnabled ? 'var(--accent)' : 'var(--line)'}`, background: form.corsEnabled ? 'var(--accent-dim)' : 'var(--bg-2)', borderRadius: 'var(--radius)', cursor: 'pointer', flexDirection: 'column' }}
                  onClick={() => setActiveStep(12)}>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <div style={{ width: 36, height: 20, flexShrink: 0, marginTop: 2, borderRadius: 999, background: form.corsEnabled ? 'var(--accent)' : 'var(--bg-3)', position: 'relative', transition: 'background 160ms' }}>
                      <div style={{ position: 'absolute', top: 2, left: form.corsEnabled ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: 'var(--bg)', transition: 'left 160ms' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>Handle Cross-Origin Requests</div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                        Turn on to let the gateway handle CORS checks so your upstream does not need to.
                      </div>
                    </div>
                  </div>
                  <input type="checkbox" checked={form.corsEnabled} onChange={e => update('corsEnabled', e.target.checked)} style={{ display: 'none' }} />
                  {form.corsEnabled && (
                    <div style={{ marginTop: 8 }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '6px 10px', background: 'var(--bg)', minHeight: 40, alignItems: 'center' }}>
                        {form.corsOrigins.map(origin => (
                          <div key={origin} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-3)', borderRadius: 4, padding: '2px 8px', fontSize: 12 }}>
                            <span>{origin}</span>
                            <button type="button" onClick={() => update('corsOrigins', form.corsOrigins.filter(o => o !== origin))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-3)', lineHeight: 1 }}>×</button>
                          </div>
                        ))}
                        <input type="text" value={corsInput} onChange={e => setCorsInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Tab' || e.key === 'Enter') { e.preventDefault(); addCorsOrigin(corsInput); } }}
                          onBlur={() => { if (corsInput.trim()) addCorsOrigin(corsInput); }}
                          onFocus={() => setActiveStep(12)} placeholder="https://yourdomain.com" style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 12, flex: 1, minWidth: 180 }} />
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>Press Tab or Enter to add each origin.</div>
                    </div>
                  )}
                </label>
              </div>
            </FieldBlock>

            <FieldBlock n={13} title="Payload Transformation (Body Shaping)" subtitle={`Strip sensitive response fields or rename JSON keys — ${form.bodyTransforms.length} / ${bodyShapingLimit === Infinity ? '∞' : bodyShapingLimit}`}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {form.bodyTransforms.map((bt, i) => (
                  <div key={i} style={{ padding: 12, border: '1px solid var(--line)', borderRadius: 'var(--radius)', background: 'var(--bg-2)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input className="input input-mono" placeholder="/api/users/*" value={bt.path}
                        onChange={e => { const next = [...form.bodyTransforms]; next[i] = { ...next[i], path: e.target.value }; update('bodyTransforms', next); }}
                        style={{ flex: 2 }} />
                      <select className="input" value={bt.phase}
                        onChange={e => { const next = [...form.bodyTransforms]; next[i] = { ...next[i], phase: e.target.value as 'request' | 'response' }; update('bodyTransforms', next); }}
                        style={{ width: 130 }}>
                        <option value="response">Response (Mask)</option>
                        <option value="request">Request (Rewrite)</option>
                      </select>
                      <button type="button" className="btn btn-ghost" onClick={() => update('bodyTransforms', form.bodyTransforms.filter((_, j) => j !== i))} style={{ color: 'var(--red)', padding: '4px 8px' }}>✕</button>
                    </div>
                    <div className="field">
                      <label className="field-label" style={{ fontSize: 11 }}>Strip Fields (type field name then press Enter or comma)</label>
                      <TagListInput
                        tags={bt.stripFields || []}
                        onChange={nextTags => {
                          const next = [...form.bodyTransforms];
                          next[i] = { ...next[i], stripFields: nextTags };
                          update('bodyTransforms', next);
                        }}
                        placeholder="password_hash, ssn then Enter or comma"
                      />
                    </div>
                  </div>
                ))}
                <button type="button" className="btn btn-ghost" disabled={form.bodyTransforms.length >= bodyShapingLimit}
                  onClick={() => {
                    if (form.bodyTransforms.length >= bodyShapingLimit) { toast.error(`Payload transform rule limit reached (${bodyShapingLimit})`); return; }
                    update('bodyTransforms', [...form.bodyTransforms, { path: '', phase: 'response', stripFields: ['password_hash'], renameFields: [] }]);
                  }}
                  style={{ fontSize: 12, opacity: form.bodyTransforms.length >= bodyShapingLimit ? 0.4 : 1 }}>
                  + Add Body Transform {bodyShapingLimit !== Infinity && `(${form.bodyTransforms.length}/${bodyShapingLimit})`}
                </button>
              </div>
            </FieldBlock>

            <FieldBlock n={14} title="Contract & Schema Validation" subtitle={`Shield compute from invalid requests at the edge — ${form.schemaRules.length} / ${schemaLimit === Infinity ? '∞' : schemaLimit}`}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {form.schemaRules.map((sr, i) => (
                  <div key={i} style={{ padding: 12, border: '1px solid var(--line)', borderRadius: 'var(--radius)', background: 'var(--bg-2)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input className="input input-mono" placeholder="/api/orders" value={sr.path}
                        onChange={e => { const next = [...form.schemaRules]; next[i] = { ...next[i], path: e.target.value }; update('schemaRules', next); }}
                        style={{ flex: 2 }} />
                      <select className="input" value={sr.method}
                        onChange={e => { const next = [...form.schemaRules]; next[i] = { ...next[i], method: e.target.value }; update('schemaRules', next); }}
                        style={{ width: 110 }}>
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                        <option value="PATCH">PATCH</option>
                        <option value="ANY">ANY</option>
                      </select>
                      <button type="button" className="btn btn-ghost" onClick={() => update('schemaRules', form.schemaRules.filter((_, j) => j !== i))} style={{ color: 'var(--red)', padding: '4px 8px' }}>✕</button>
                    </div>
                    <div className="field">
                      <label className="field-label" style={{ fontSize: 11 }}>Required JSON Keys (type key name then press Enter or comma)</label>
                      <TagListInput
                        tags={sr.requiredFields || []}
                        onChange={nextTags => {
                          const next = [...form.schemaRules];
                          next[i] = { ...next[i], requiredFields: nextTags };
                          update('schemaRules', next);
                        }}
                        placeholder="email, amount then Enter or comma"
                      />
                    </div>
                  </div>
                ))}
                <button type="button" className="btn btn-ghost" disabled={form.schemaRules.length >= schemaLimit}
                  onClick={() => {
                    if (form.schemaRules.length >= schemaLimit) { toast.error(`Schema validation limit reached (${schemaLimit})`); return; }
                    update('schemaRules', [...form.schemaRules, { path: '', method: 'POST', requiredFields: ['email'], fieldTypes: [] }]);
                  }}
                  style={{ fontSize: 12, opacity: form.schemaRules.length >= schemaLimit ? 0.4 : 1 }}>
                  + Add Schema Validation Rule {schemaLimit !== Infinity && `(${form.schemaRules.length}/${schemaLimit})`}
                </button>
              </div>
            </FieldBlock>

            <FieldBlock n={15} title="Placement"
              subtitle="Optimize edge latency or pin the gateway to a specific cloud region">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <label style={{
                  display: 'flex', gap: 14, padding: 16,
                  border: `1px solid ${form.smartPlacement ? 'var(--accent)' : 'var(--line)'}`,
                  background: form.smartPlacement ? 'var(--accent-dim)' : 'var(--bg-2)',
                  borderRadius: 'var(--radius)', cursor: user?.isSubscribed ? 'pointer' : 'not-allowed',
                  position: 'relative', opacity: user?.isSubscribed ? 1 : 0.6,
                }} onClick={() => { if (user?.isSubscribed) setActiveStep(13); }}>
                  {!user?.isSubscribed && (
                    <div style={{
                      position: 'absolute', top: 8, right: 8,
                      display: 'flex', alignItems: 'center', gap: 4,
                      fontSize: 10, color: 'var(--accent)', fontFamily: 'var(--mono)',
                      fontWeight: 600,
                    }}>
                      <Icons.Lock size={10} /> PRO
                    </div>
                  )}
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
                    <div style={{ fontSize: 14, fontWeight: 500 }}>Optimize for Server Speed</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                      By default, the gateway runs near your <strong>visitors</strong> for the fastest response. Turn this on if your upstream is slow — the gateway will move closer to your <strong>upstream</strong> instead, cutting round-trip latency.
                      {!user?.isSubscribed && (
                        <span style={{ display: 'block', marginTop: 6, color: 'var(--accent)', fontWeight: 500 }}>
                          Upgrade to Student or Pro to customize placement.
                        </span>
                      )}
                    </div>
                  </div>
                  <input
                    type="checkbox" checked={form.smartPlacement}
                    onChange={e => { if (user?.isSubscribed) update('smartPlacement', e.target.checked); }}
                    style={{ display: 'none' }}
                  />
                </label>

                <div className="field">
                  <label className="field-label">
                    Pin to a Cloud Region
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
                      onFocus={() => setActiveStep(13)}
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
                      <option value="">Choose a region to pin the gateway to...</option>
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
                      onFocus={() => setActiveStep(13)}
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
                      ? 'Cloudflare automatically positions the Worker near your upstreams when Smart Placement is enabled.'
                      : 'Required. Choose a cloud region where your upstream servers are located, or enter a custom hint.'}
                  </div>
                </div>
              </div>
            </FieldBlock>

            <div className="deploy-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', background: 'var(--bg-1)' }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-3)' }}>
                {allValid ? <><span style={{ color: 'var(--green)' }}>✓</span> Ready to deploy • ~90s</> : <>Complete required fields to deploy</>}
              </div>
              <div className="deploy-actions" style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-ghost" onClick={() => router.push('/gateways')}>Cancel</button>
                <button className="btn btn-primary" disabled={!allValid || deploying} onClick={deploy} style={{ opacity: (!allValid || deploying) ? 0.5 : 1 }}>
                  {deploying ? (
                    <>
                      <span style={{ width: 14, height: 14, border: '2px solid currentColor', borderRightColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                      Deploying gateway…
                    </>
                  ) : (
                    <>
                      <Icons.Zap size={14} /> Deploy gateway
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>

          <div className="visualization-panel" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ padding: 20, border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', background: 'var(--bg-1)' }}>
              <div className="kicker" style={{ marginBottom: 12 }}>// live preview</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>upstreams</span><span style={{ color: 'var(--accent)' }}>{form.upstreams.length}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>routes</span><span style={{ color: 'var(--accent)' }}>{form.pathRoutes.length}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>jwt</span><span style={{ color: form.jwtEnabled ? 'var(--green)' : 'var(--text-3)' }}>{form.jwtEnabled ? 'on' : 'off'}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>cache</span><span style={{ color: form.cacheEnabled ? 'var(--green)' : 'var(--text-3)' }}>{form.cacheEnabled ? `${form.cacheTtl}s` : 'off'}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>canary</span><span style={{ color: form.canaryEnabled ? 'var(--green)' : 'var(--text-3)' }}>{form.canaryEnabled ? `${form.canaryPercentage}%` : 'off'}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>IP rules</span><span style={{ color: 'var(--accent)' }}>{form.ipRules.length}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>mocks</span><span style={{ color: 'var(--accent)' }}>{form.mockRoutes.length}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>CORS</span><span style={{ color: form.corsEnabled ? 'var(--green)' : 'var(--text-3)' }}>{form.corsEnabled ? 'on' : 'off'}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>placement</span><span style={{ color: form.smartPlacement ? 'var(--green)' : (form.placementHint ? 'var(--accent)' : 'var(--text-3)') }}>{form.smartPlacement ? 'smart' : form.placementHint || 'edge'}</span></div>
              </div>
            </div>
            <div style={{ padding: 16, border: '1px dashed var(--line-2)', borderRadius: 'var(--radius)', background: 'var(--bg-2)', fontSize: 12, color: 'var(--text-3)', lineHeight: 1.6 }}>
              Gateway runs on Cloudflare Workers at <span style={{ color: 'var(--accent)', fontFamily: 'var(--mono)' }}>{fullHost}</span> and forwards to your upstreams with the rules above.
            </div>
          </div>
        </div>

        <DeploymentOverlay isOpen={deploying} mode="create" targetName={form.name} onCancel={() => {}} cancelRequested={false} cancellable={false} />
        <DeploymentSuccessModal isOpen={!!deploySuccess} mode="create" name={deploySuccess?.name || form.name} fullDomain={deploySuccess?.fullDomain || fullHost} onContinue={() => router.push('/gateways')} />

        <style jsx>{`
          @media (max-width: 768px) {
            .hide-md { display: none !important; }
            .create-form-shell { padding: 16px !important; max-width: 100% !important; gap: 14px !important; }
            .domain-grid { grid-template-columns: 1fr !important; }
            .subdomain-row { flex-direction: column; }
            .subdomain-suffix { border-left: none !important; border-top: 1px solid var(--line); padding: 10px 12px !important; }
            main > div { grid-template-columns: 1fr !important; }
            .visualization-panel { display: none !important; }
            .upstream-row { display: flex !important; flex-direction: column; align-items: stretch !important; gap: 8px !important; }
            .deploy-bar { flex-direction: column; align-items: flex-start !important; gap: 12px; }
            .deploy-actions { width: 100%; }
            .deploy-actions :global(button) { flex: 1; }
          }
        `}</style>
      </main>
    </div>
  );
}
