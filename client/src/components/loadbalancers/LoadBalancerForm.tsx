'use client';

import axios from 'axios';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { DeploymentOverlay, DeploymentSuccessModal } from './DeploymentExperience';
import type { CloudflareZone, CreateLoadBalancerRequest, LoadBalancer, LoadBalancerStrategy, OriginServer } from '@/types/api';
import toast from 'react-hot-toast';

interface LoadBalancerFormProps {
  mode: 'create' | 'edit';
  initialLoadBalancer?: LoadBalancer | null;
  onCancel: () => void;
  onSuccess: () => void;
  onSubmit: (payload: CreateLoadBalancerRequest, operationId: string) => Promise<{
    name: string;
    fullDomain: string;
  }>;
}

interface FormState {
  name: string;
  zoneId: string;
  domain: string;
  subdomain: string;
  origins: OriginServer[];
  strategy: LoadBalancerStrategy;
  smartPlacement: boolean;
  placementRegion: string;
}

const isWeightedStrategy = (strategy: LoadBalancerStrategy) => (
  strategy === 'weighted-round-robin' || strategy === 'weighted-cookie-sticky'
);

const WORKER_SCRIPT_NAME_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SUBDOMAIN_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/;
const PLACEMENT_REGEX = /^(aws|gcp|azure):[a-z0-9-]+$/;
const GEO_COUNTRY_REGEX = /^[A-Z]{2}$/;
const GEO_COLO_REGEX = /^[A-Z0-9]{3,4}$/;
const GEO_CONTINENT_REGEX = /^(AF|AN|AS|EU|NA|OC|SA)$/;

const parseGeoList = (value: string) => (
  value
    .split(',')
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean)
);

const joinGeoList = (values?: string[]) => (
  Array.isArray(values) ? values.join(', ') : ''
);

const EMPTY_FORM_STATE: FormState = {
  name: '',
  zoneId: '',
  domain: '',
  subdomain: '',
  origins: [{ url: '', weight: 1, geoCountries: [], geoColos: [], geoContinents: [] }],
  strategy: 'round-robin',
  smartPlacement: true,
  placementRegion: '',
};

const toFormState = (loadBalancer: LoadBalancer): FormState => ({
  name: loadBalancer.name,
  zoneId: loadBalancer.zoneId,
  domain: loadBalancer.domain,
  subdomain: loadBalancer.subdomain || '',
  origins: loadBalancer.origins.length > 0
    ? loadBalancer.origins.map((origin) => ({
        ...origin,
        geoCountries: origin.geoCountries || [],
        geoColos: origin.geoColos || [],
        geoContinents: origin.geoContinents || [],
      }))
    : [{ url: '', weight: 1, geoCountries: [], geoColos: [], geoContinents: [] }],
  strategy: loadBalancer.strategyValue,
  smartPlacement: loadBalancer.placement?.smartPlacement !== false,
  placementRegion: loadBalancer.placement?.region || '',
});

export function LoadBalancerForm({
  mode,
  initialLoadBalancer,
  onCancel,
  onSuccess,
  onSubmit,
}: LoadBalancerFormProps) {
  const [loadingZones, setLoadingZones] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [zones, setZones] = useState<CloudflareZone[]>([]);
  const [formData, setFormData] = useState<FormState>(initialLoadBalancer ? toFormState(initialLoadBalancer) : EMPTY_FORM_STATE);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successState, setSuccessState] = useState<{ name: string; fullDomain: string } | null>(null);
  const [cancelRequested, setCancelRequested] = useState(false);
  const operationIdRef = useRef<string | null>(null);

  useEffect(() => {
    fetchZones();
  }, []);

  useEffect(() => {
    if (initialLoadBalancer) {
      setFormData(toFormState(initialLoadBalancer));
    }
  }, [initialLoadBalancer]);

  const fetchZones = async () => {
    try {
      const response = await api.getCloudflareZones();
      if (response.success && response.data?.zones) {
        setZones(response.data.zones);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to fetch zones');
    } finally {
      setLoadingZones(false);
    }
  };

  const handleZoneChange = (zoneId: string) => {
    const zone = zones.find((item) => item.id === zoneId);

    setFormData((current) => ({
      ...current,
      zoneId,
      domain: zone?.name || '',
    }));
    setErrors((current) => ({ ...current, zoneId: '' }));
  };

  const addOrigin = () => {
    setFormData((current) => ({
      ...current,
      origins: [...current.origins, { url: '', weight: 1, geoCountries: [], geoColos: [], geoContinents: [] }],
    }));
  };

  const removeOrigin = (index: number) => {
    setFormData((current) => ({
      ...current,
      origins: current.origins.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const updateOrigin = (
    index: number,
    field: 'url' | 'weight' | 'geoCountries' | 'geoColos' | 'geoContinents',
    value: string | number | string[]
  ) => {
    setFormData((current) => {
      const nextOrigins = [...current.origins];
      nextOrigins[index] = { ...nextOrigins[index], [field]: value };

      return {
        ...current,
        origins: nextOrigins,
      };
    });

    setErrors((current) => {
      const nextErrors = { ...current, [`origin-${index}-${field}`]: '' };
      // Clear general geo error when any geo field is updated
      if (field === 'geoCountries' || field === 'geoColos' || field === 'geoContinents') {
        nextErrors[`origin-${index}-geo`] = '';
      }
      return nextErrors;
    });
  };

  const validateForm = () => {
    const nextErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      nextErrors.name = 'Load balancer name is required';
    } else if (formData.name.trim().length < 3 || formData.name.trim().length > 50) {
      nextErrors.name = 'Name must be between 3 and 50 characters';
    } else if (!WORKER_SCRIPT_NAME_REGEX.test(formData.name.trim())) {
      nextErrors.name = 'Name must use only lowercase letters, numbers, and hyphens';
    }

    if (!formData.zoneId) {
      nextErrors.zoneId = 'Please select a domain';
    }

    if (formData.subdomain.trim() && !SUBDOMAIN_REGEX.test(formData.subdomain.trim())) {
      nextErrors.subdomain = 'Subdomain can only contain letters, numbers, and hyphens';
    }

    formData.origins.forEach((origin, index) => {
      if (!origin.url.trim()) {
        nextErrors[`origin-${index}-url`] = 'Origin URL is required';
      }
      // Validate URL format - accept http://, https://, or plain domain/IP
      const url = origin.url.trim();
      const hasProtocol = /^https?:\/\//i.test(url);
      const plainUrl = hasProtocol ? url : `http://${url}`;

      try {
        new URL(plainUrl);
      } catch {
        nextErrors[`origin-${index}-url`] = 'Invalid URL format';
      }

      if (isWeightedStrategy(formData.strategy) && (origin.weight < 1 || origin.weight > 100)) {
        nextErrors[`origin-${index}-weight`] = 'Weight must be between 1 and 100';
      }

      if (formData.strategy === 'geo-steering') {
        const hasCountries = origin.geoCountries && origin.geoCountries.length > 0;
        const hasColos = origin.geoColos && origin.geoColos.length > 0;
        const hasContinents = origin.geoContinents && origin.geoContinents.length > 0;

        if (!hasCountries && !hasColos && !hasContinents) {
          nextErrors[`origin-${index}-geo`] = 'Specify at least one: countries, regions, or continents for geo-steering';
        }

        origin.geoCountries?.forEach((code) => {
          if (!GEO_COUNTRY_REGEX.test(code)) {
            nextErrors[`origin-${index}-geoCountries`] = 'Use comma-separated 2-letter country codes like US, IN, DE';
          }
        });

        origin.geoColos?.forEach((code) => {
          if (!GEO_COLO_REGEX.test(code)) {
            nextErrors[`origin-${index}-geoColos`] = 'Use comma-separated region codes like DFW, SIN, FRA';
          }
        });

        origin.geoContinents?.forEach((code) => {
          if (!GEO_CONTINENT_REGEX.test(code)) {
            nextErrors[`origin-${index}-geoContinents`] = 'Use continent codes AF, AN, AS, EU, NA, OC, SA';
          }
        });
      }
    });

    if (formData.placementRegion.trim() && !PLACEMENT_REGEX.test(formData.placementRegion.trim())) {
      nextErrors.placementRegion = 'Format: provider:region (e.g., aws:us-east-1)';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!validateForm()) {
      toast.error('Please fix the errors in the form');
      return;
    }

    try {
      await api.validateLoadBalancerHostname({
        domain: formData.domain,
        subdomain: formData.subdomain.trim() || undefined,
        excludeLoadBalancerId: mode === 'edit' ? initialLoadBalancer?.id : undefined,
      });
    } catch (error: any) {
      const hostnameErrorField = formData.subdomain.trim() ? 'subdomain' : 'zoneId';
      setErrors((current) => ({
        ...current,
        [hostnameErrorField]: error.message || 'This hostname is already in use',
      }));
      toast.error(error.message || 'This hostname is already in use');
      return;
    }

    const payload: CreateLoadBalancerRequest = {
      name: formData.name.trim(),
      domain: formData.domain,
      subdomain: formData.subdomain.trim() || undefined,
      zoneId: formData.zoneId,
      origins: formData.origins.map((origin) => {
        // Auto-prefix with http:// if no protocol is specified
        const url = origin.url.trim();
        const finalUrl = /^https?:\/\//i.test(url) ? url : `http://${url}`;

        return {
          url: finalUrl,
          weight: isWeightedStrategy(formData.strategy) ? origin.weight : 1,
          geoCountries: parseGeoList(joinGeoList(origin.geoCountries)),
          geoColos: parseGeoList(joinGeoList(origin.geoColos)),
          geoContinents: parseGeoList(joinGeoList(origin.geoContinents)),
        };
      }),
      strategy: formData.strategy,
      weightedEnabled: isWeightedStrategy(formData.strategy),
      placement: {
        smartPlacement: formData.smartPlacement,
        region: formData.placementRegion.trim() || undefined,
      },
    };

    setSubmitting(true);
    setCancelRequested(false);
    operationIdRef.current = crypto.randomUUID();
    try {
      const result = await onSubmit(payload, operationIdRef.current);
      setSuccessState(result);
    } catch (error: any) {
      const message = String(error?.message || '').toLowerCase();
      if (cancelRequested || message.includes('cancelled') || message.includes('rolled back')) {
        toast('Rollback complete. The load balancer was left unchanged.');
      } else {
        toast.error(error.message || `Failed to ${mode === 'create' ? 'create' : 'update'} load balancer`);
      }
    } finally {
      setSubmitting(false);
      setCancelRequested(false);
      operationIdRef.current = null;
    }
  };

  const handleDeploymentCancel = async () => {
    if (!operationIdRef.current || cancelRequested) {
      return;
    }

    setCancelRequested(true);
    try {
      await api.cancelLoadBalancerOperation(operationIdRef.current);
    } catch (error: any) {
      setCancelRequested(false);
      toast.error(error.message || 'Failed to request cancellation');
    }
  };

  const fullDomain = formData.subdomain.trim()
    ? `${formData.subdomain.trim()}.${formData.domain}`
    : formData.domain;

  const weightedEnabled = isWeightedStrategy(formData.strategy);

  if (loadingZones) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your domains...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-8">
        <FormSection
          number={1}
          title="Load Balancer Name"
          description="Choose the exact Cloudflare Worker name used for this deployment"
        >
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-2">
              Name <span className="text-red-500">*</span>
            </label>
            <Input
              id="name"
              type="text"
              placeholder="e.g., production-api"
              value={formData.name}
              onChange={(event) => {
                setFormData((current) => ({ ...current, name: event.target.value }));
                setErrors((current) => ({ ...current, name: '' }));
              }}
              disabled={submitting || mode === 'edit'}
              className={errors.name ? 'border-red-500' : ''}
            />
            {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name}</p>}
            <p className="text-sm text-muted-foreground mt-2">
              {mode === 'create'
                ? 'Lowercase letters, numbers, and hyphens only. This is deployed as the exact Worker script name.'
                : 'Worker names are fixed after creation. Update routing, origins, placement, or hostname without renaming the Worker.'}
            </p>
          </div>
        </FormSection>

        <FormSection
          number={2}
          title="Domain Selection"
          description="Pick the Cloudflare zone that should point at this load balancer"
        >
          <div>
            <label htmlFor="zone" className="block text-sm font-medium mb-2">
              Domain
            </label>
            <select
              id="zone"
              value={formData.zoneId}
              onChange={(event) => handleZoneChange(event.target.value)}
              disabled={submitting}
              style={{ colorScheme: 'dark' }}
              className={`
                w-full cursor-pointer appearance-none rounded-lg border px-4 py-2
                bg-[#0a0a0a] text-[#fafafa]
                ${errors.zoneId ? 'border-red-500' : 'border-[#262626]'}
                hover:border-[#3b82f6]
                focus:border-[#3b82f6] focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/20
                disabled:cursor-not-allowed disabled:opacity-50
              `}
            >
              <option value="" style={{ background: '#0a0a0a', color: '#a3a3a3' }}>
                Select a domain
              </option>
              {zones.map((zone) => (
                <option key={zone.id} value={zone.id} style={{ background: '#0a0a0a', color: '#fafafa' }}>
                  {zone.name} ({zone.status})
                </option>
              ))}
            </select>
            {errors.zoneId && <p className="text-sm text-red-500 mt-1">{errors.zoneId}</p>}
          </div>
        </FormSection>

        <FormSection
          number={3}
          title="Subdomain"
          description="Optional hostname prefix for the active edge route"
        >
          <div>
            <label htmlFor="subdomain" className="block text-sm font-medium mb-2">
              Subdomain
            </label>
            <Input
              id="subdomain"
              type="text"
              placeholder="e.g., api, edge, prod"
              value={formData.subdomain}
              onChange={(event) => {
                setFormData((current) => ({ ...current, subdomain: event.target.value }));
                setErrors((current) => ({ ...current, subdomain: '' }));
              }}
              disabled={submitting}
              className={errors.subdomain ? 'border-red-500' : ''}
            />
            {errors.subdomain && <p className="text-sm text-red-500 mt-1">{errors.subdomain}</p>}
            {formData.domain && (
              <p className="text-sm text-muted-foreground mt-2">
                Active address:{' '}
                <span className="font-mono text-primary">{fullDomain}</span>
              </p>
            )}
          </div>
        </FormSection>

        <FormSection
          number={4}
          title="Traffic Strategy"
          description="Switch how requests are distributed across your origin fleet"
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <StrategyCard
              title="Round Robin"
              description="Rotate requests across origins in edge-local sequence."
              selected={formData.strategy === 'round-robin'}
              onSelect={() => setFormData((current) => ({ ...current, strategy: 'round-robin' }))}
              disabled={submitting}
            />
            <StrategyCard
              title="Weighted Round Robin"
              description="Bias traffic toward stronger origins with per-server weights."
              selected={formData.strategy === 'weighted-round-robin'}
              onSelect={() => setFormData((current) => ({ ...current, strategy: 'weighted-round-robin' }))}
              disabled={submitting}
            />
            <StrategyCard
              title="IP Hash"
              description="Send the same client IP back to the same origin whenever possible."
              selected={formData.strategy === 'ip-hash'}
              onSelect={() => setFormData((current) => ({ ...current, strategy: 'ip-hash' }))}
              disabled={submitting}
            />
            <StrategyCard
              title="Sticky Session"
              description="Set a cookie so repeat visitors stay on the same origin."
              selected={formData.strategy === 'cookie-sticky'}
              onSelect={() => setFormData((current) => ({ ...current, strategy: 'cookie-sticky' }))}
              disabled={submitting}
            />
            <StrategyCard
              title="Weighted Sticky"
              description="Assign first visit by weight, then keep that visitor pinned with a cookie."
              selected={formData.strategy === 'weighted-cookie-sticky'}
              onSelect={() => setFormData((current) => ({ ...current, strategy: 'weighted-cookie-sticky' }))}
              disabled={submitting}
            />
            <StrategyCard
              title="Failover"
              description="Try origins in order and move to the next one when an origin fails."
              selected={formData.strategy === 'failover'}
              onSelect={() => setFormData((current) => ({ ...current, strategy: 'failover' }))}
              disabled={submitting}
            />
            <StrategyCard
              title="Geo Steering"
              description="Route users to different servers based on their geographic location (country, region, or continent)."
              selected={formData.strategy === 'geo-steering'}
              onSelect={() => setFormData((current) => ({ ...current, strategy: 'geo-steering' }))}
              disabled={submitting}
            />
          </div>
          {(formData.strategy === 'cookie-sticky' || formData.strategy === 'weighted-cookie-sticky') && (
            <p className="mt-4 text-sm text-muted-foreground">
              Returning visitors stay on the same server for 24 hours unless that origin is removed from the pool.
            </p>
          )}
          {formData.strategy === 'failover' && (
            <p className="mt-4 text-sm text-muted-foreground">
              Origin order matters. The first server is primary, and later servers act as fallbacks on upstream 5xx or network failure.
            </p>
          )}
          {formData.strategy === 'geo-steering' && (
            <p className="mt-4 text-sm text-muted-foreground">
              Each server can target specific countries, regions, or continents. Traffic from those locations will be routed to the matching server. Matching priority: region first, then country, then continent. Unmatched traffic uses round-robin.
            </p>
          )}
        </FormSection>

        <FormSection
          number={5}
          title="Origin Servers"
          description="Add, remove, or rebalance the backends that receive traffic here"
        >
          <div className="space-y-4">
            {formData.origins.map((origin, index) => (
              <div key={index} className="flex gap-4 items-start">
                <div className="flex-1">
                  <label htmlFor={`origin-${index}`} className="block text-sm font-medium mb-2">
                    Server {index + 1}
                  </label>
                  <Input
                    id={`origin-${index}`}
                    type="text"
                    placeholder="https://domain.com, http://127.0.0.1, or 192.168.1.100"
                    value={origin.url}
                    onChange={(event) => updateOrigin(index, 'url', event.target.value)}
                    disabled={submitting}
                    className={errors[`origin-${index}-url`] ? 'border-red-500' : ''}
                  />
                  {errors[`origin-${index}-url`] && (
                    <p className="text-sm text-red-500 mt-1">{errors[`origin-${index}-url`]}</p>
                  )}
                  {!errors[`origin-${index}-url`] && origin.url.trim() && !/^https?:\/\//i.test(origin.url.trim()) && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Will use: <span className="font-mono">http://{origin.url.trim()}</span>
                    </p>
                  )}

                  {formData.strategy === 'geo-steering' && (
                    <div className="mt-4 space-y-4">
                      <div className={`p-3 rounded-lg ${errors[`origin-${index}-geo`] ? 'bg-red-500/10 border border-red-500' : 'bg-muted/50'}`}>
                        <p className={`text-sm ${errors[`origin-${index}-geo`] ? 'text-red-500' : 'text-muted-foreground'}`}>
                          Configure which locations should use this server. <strong>At least one field is required</strong>: countries, regions, or continents.
                        </p>
                        {errors[`origin-${index}-geo`] && (
                          <p className="text-sm text-red-500 mt-1 font-medium">{errors[`origin-${index}-geo`]}</p>
                        )}
                      </div>
                      <div className="grid gap-4 md:grid-cols-3">
                        <div>
                          <label htmlFor={`origin-${index}-countries`} className="block text-sm font-medium mb-2">
                            Countries <span className="text-muted-foreground font-normal">(optional)</span>
                          </label>
                          <Input
                            id={`origin-${index}-countries`}
                            type="text"
                            placeholder="e.g., US, IN, DE"
                            value={joinGeoList(origin.geoCountries)}
                            onChange={(event) => updateOrigin(index, 'geoCountries', parseGeoList(event.target.value))}
                            disabled={submitting}
                            className={errors[`origin-${index}-geoCountries`] ? 'border-red-500' : ''}
                          />
                          {errors[`origin-${index}-geoCountries`] && (
                            <p className="text-sm text-red-500 mt-1">{errors[`origin-${index}-geoCountries`]}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">2-letter country codes</p>
                        </div>

                        <div>
                          <label htmlFor={`origin-${index}-colos`} className="block text-sm font-medium mb-2">
                            Regions <span className="text-muted-foreground font-normal">(optional)</span>
                          </label>
                          <Input
                            id={`origin-${index}-colos`}
                            type="text"
                            placeholder="e.g., DFW, SIN, FRA"
                            value={joinGeoList(origin.geoColos)}
                            onChange={(event) => updateOrigin(index, 'geoColos', parseGeoList(event.target.value))}
                            disabled={submitting}
                            className={errors[`origin-${index}-geoColos`] ? 'border-red-500' : ''}
                          />
                          {errors[`origin-${index}-geoColos`] && (
                            <p className="text-sm text-red-500 mt-1">{errors[`origin-${index}-geoColos`]}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">Specific data center codes</p>
                        </div>

                        <div>
                          <label htmlFor={`origin-${index}-continents`} className="block text-sm font-medium mb-2">
                            Continents <span className="text-muted-foreground font-normal">(optional)</span>
                          </label>
                          <Input
                            id={`origin-${index}-continents`}
                            type="text"
                            placeholder="e.g., NA, EU, AS"
                            value={joinGeoList(origin.geoContinents)}
                            onChange={(event) => updateOrigin(index, 'geoContinents', parseGeoList(event.target.value))}
                            disabled={submitting}
                            className={errors[`origin-${index}-geoContinents`] ? 'border-red-500' : ''}
                          />
                          {errors[`origin-${index}-geoContinents`] && (
                            <p className="text-sm text-red-500 mt-1">{errors[`origin-${index}-geoContinents`]}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">AF, AN, AS, EU, NA, OC, SA</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {weightedEnabled && (
                  <div className="w-32">
                    <label htmlFor={`weight-${index}`} className="block text-sm font-medium mb-2">
                      Weight
                    </label>
                    <Input
                      id={`weight-${index}`}
                      type="number"
                      min="1"
                      max="100"
                      value={origin.weight}
                      onChange={(event) => updateOrigin(index, 'weight', parseInt(event.target.value, 10) || 1)}
                      disabled={submitting}
                      className={errors[`origin-${index}-weight`] ? 'border-red-500' : ''}
                    />
                    {errors[`origin-${index}-weight`] && (
                      <p className="text-sm text-red-500 mt-1">{errors[`origin-${index}-weight`]}</p>
                    )}
                  </div>
                )}

                {formData.origins.length > 1 && (
                  <div className="pt-8">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => removeOrigin(index)}
                      disabled={submitting}
                    >
                      Remove
                    </Button>
                  </div>
                )}
              </div>
            ))}

            <Button type="button" variant="outline" onClick={addOrigin} disabled={submitting}>
              + Add Server
            </Button>
          </div>
        </FormSection>

        <FormSection
          number={6}
          title="Worker Placement"
          description="Tune where the Worker executes relative to your origin infrastructure"
        >
          <div className="space-y-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.smartPlacement}
                onChange={(event) => setFormData((current) => ({ ...current, smartPlacement: event.target.checked }))}
                disabled={submitting}
                className="mt-1"
              />
              <div>
                <div className="font-medium">Smart Placement</div>
                <p className="text-sm text-muted-foreground">
                  Run the Worker closer to your origins to reduce backend latency.
                </p>
              </div>
            </label>

            <div>
              <label htmlFor="placementRegion" className="block text-sm font-medium mb-2">
                Placement Hint
              </label>
              <Input
                id="placementRegion"
                type="text"
                placeholder="e.g., aws:us-east-1, gcp:europe-west1, azure:eastus2"
                value={formData.placementRegion}
                onChange={(event) => {
                  setFormData((current) => ({ ...current, placementRegion: event.target.value }));
                  setErrors((current) => ({ ...current, placementRegion: '' }));
                }}
                disabled={submitting}
                className={errors.placementRegion ? 'border-red-500' : ''}
              />
              {errors.placementRegion && <p className="text-sm text-red-500 mt-1">{errors.placementRegion}</p>}
              <p className="text-sm text-muted-foreground mt-2">
                Optional provider region hint for deployments that need to stay close to a specific origin geography.
              </p>
            </div>
          </div>
        </FormSection>

        <div className="flex gap-4 pt-6">
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" disabled={submitting} className="flex-1" size="lg">
            {mode === 'create' ? 'Create Load Balancer' : 'Update Load Balancer'}
          </Button>
        </div>
      </form>

      <DeploymentOverlay
        isOpen={submitting}
        mode={mode}
        targetName={formData.name.trim()}
        onCancel={handleDeploymentCancel}
        cancelRequested={cancelRequested}
      />

      <DeploymentSuccessModal
        isOpen={!!successState}
        mode={mode}
        name={successState?.name || formData.name.trim()}
        fullDomain={successState?.fullDomain || fullDomain}
        onContinue={onSuccess}
      />
    </>
  );
}

function StrategyCard({
  title,
  description,
  selected,
  onSelect,
  disabled,
}: {
  title: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={`rounded-2xl border p-5 text-left transition-all ${
        selected
          ? 'border-primary bg-primary/10 shadow-[0_0_0_1px_rgba(59,130,246,0.3)]'
          : 'border-border bg-card hover:border-primary/40'
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-base font-semibold">{title}</h4>
        <div className={`h-4 w-4 rounded-full border ${selected ? 'border-primary bg-primary' : 'border-muted-foreground'}`} />
      </div>
      <p className="text-sm leading-6 text-muted-foreground">{description}</p>
    </button>
  );
}

function FormSection({
  number,
  title,
  description,
  children,
}: {
  number: number;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-6">
      <div className="flex gap-4 mb-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
          {number}
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-semibold mb-1">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="pl-14">{children}</div>
    </Card>
  );
}
