'use client';

import { useEffect, useState } from 'react';
import type { LoadBalancerStrategy } from '@/types/api';

interface VisualizationProps {
  domain?: string;
  subdomain?: string;
  strategy: LoadBalancerStrategy;
  originCount: number;
  isGeoSteering?: boolean;
}

export function LoadBalancerVisualization({
  domain,
  subdomain,
  strategy,
  originCount,
  isGeoSteering = false,
}: VisualizationProps) {
  return (
    <div style={{
      position: 'sticky',
      top: 20,
      padding: 24,
      background: 'var(--bg-1)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--radius-lg)',
      minHeight: 500,
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-3)', marginBottom: 8 }}>
          // Live Visualization
        </div>
        <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: 'var(--accent)' }}>
          {strategy.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
        </h3>
        <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>
          {domain ? `${subdomain ? `${subdomain}.` : ''}${domain}` : 'Configure domain to see full URL'}
        </p>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        {strategy === 'geo-steering' && <GeoSteeringAnimation isConfigured={isGeoSteering} originCount={originCount} />}
        {strategy === 'round-robin' && <RoundRobinAnimation originCount={originCount} />}
        {strategy === 'weighted-round-robin' && <WeightedRoundRobinAnimation originCount={originCount} />}
        {strategy === 'ip-hash' && <IPHashAnimation originCount={originCount} />}
        {strategy === 'cookie-sticky' && <CookieStickyAnimation originCount={originCount} />}
        {strategy === 'weighted-cookie-sticky' && <WeightedStickyAnimation originCount={originCount} />}
        {strategy === 'failover' && <FailoverAnimation originCount={originCount} />}
      </div>

      <div style={{
        marginTop: 20,
        padding: 14,
        background: 'var(--bg-2)',
        borderRadius: 8,
        border: '1px solid var(--line)',
      }}>
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          How it works
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
          {getStrategyExplanation(strategy, isGeoSteering)}
        </div>
      </div>
    </div>
  );
}

// Geo Steering - Earth with colorful servers around it, animated routing
function GeoSteeringAnimation({ isConfigured, originCount }: { isConfigured: boolean; originCount: number }) {
  const [rotation, setRotation] = useState(0);
  const [activeServer, setActiveServer] = useState(0);
  const [particles, setParticles] = useState<{ id: number; server: number; color: string }[]>([]);

  const servers = Math.max(originCount, 3);
  const serverColors = [
    '#10b981', // Green
    '#f59e0b', // Amber
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#06b6d4', // Cyan
    '#f97316', // Orange
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setRotation(prev => (prev + 0.3) % 360);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isConfigured) return;

    let id = 0;
    const interval = setInterval(() => {
      const serverIndex = Math.floor(Math.random() * servers);
      const color = serverColors[serverIndex % serverColors.length];
      setActiveServer(serverIndex);
      setParticles(prev => [...prev, { id: id++, server: serverIndex, color }].slice(-8));
    }, 1500);
    return () => clearInterval(interval);
  }, [isConfigured, servers]);

  return (
    <div style={{ textAlign: 'center', width: '100%' }}>
      <svg width="320" height="320" viewBox="0 0 320 320">
        <defs>
          {/* Gradients for Earth */}
          <radialGradient id="earthGradient">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="50%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#1e40af" />
          </radialGradient>

          {/* Glow effects */}
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>

          {/* Server gradients */}
          {serverColors.map((color, i) => (
            <radialGradient key={`serverGrad${i}`} id={`serverGrad${i}`}>
              <stop offset="0%" stopColor={color} stopOpacity="1" />
              <stop offset="100%" stopColor={color} stopOpacity="0.6" />
            </radialGradient>
          ))}
        </defs>

        {/* Earth in center */}
        <g>
          {/* Outer glow */}
          <circle cx="160" cy="160" r="55" fill="none" stroke="#3b82f6" strokeWidth="1" opacity="0.3">
            <animate attributeName="r" values="55;60;55" dur="3s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.3;0.1;0.3" dur="3s" repeatCount="indefinite" />
          </circle>

          {/* Earth sphere with gradient */}
          <circle cx="160" cy="160" r="40" fill="url(#earthGradient)" filter="url(#glow)" />

          {/* Latitude lines */}
          {[-20, 0, 20].map((offset, i) => {
            const y = 160 + offset;
            const rx = 40 * Math.cos((offset / 40) * (Math.PI / 2));
            return (
              <ellipse
                key={`lat-${i}`}
                cx="160"
                cy={y}
                rx={Math.abs(rx)}
                ry="0.8"
                fill="none"
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="0.5"
              />
            );
          })}

          {/* Animated longitude lines */}
          {[0, 60, 120, 180, 240, 300].map((baseAngle, i) => {
            const angle = baseAngle - rotation;
            const opacity = Math.abs(Math.cos((angle * Math.PI) / 180));
            return (
              <ellipse
                key={`lon-${i}`}
                cx="160"
                cy="160"
                rx={40 * Math.abs(Math.cos((angle * Math.PI) / 180))}
                ry="40"
                fill="none"
                stroke={`rgba(255,255,255,${0.15 + opacity * 0.15})`}
                strokeWidth="0.5"
                transform={`rotate(${angle} 160 160)`}
              />
            );
          })}

          {/* Continents (simplified landmasses) */}
          <g opacity="0.4">
            <path d="M 160 140 Q 165 135 170 140 L 175 145 Q 170 150 165 145 Z" fill="#10b981" />
            <path d="M 145 155 Q 150 150 155 155 L 160 160 Q 155 165 150 160 Z" fill="#10b981" />
            <path d="M 140 165 Q 145 160 150 165 Q 155 170 150 175 Z" fill="#10b981" />
          </g>

          {/* Globe label */}
          <text x="160" y="165" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="9" fontWeight="bold">
            EARTH
          </text>
        </g>

        {/* Origin servers in circle around Earth */}
        {isConfigured && [...Array(servers)].map((_, i) => {
          const angle = (i * (360 / servers)) - 90;
          const x = 160 + 110 * Math.cos((angle * Math.PI) / 180);
          const y = 160 + 110 * Math.sin((angle * Math.PI) / 180);
          const color = serverColors[i % serverColors.length];
          const isActive = activeServer === i;

          return (
            <g key={i}>
              {/* Connection line with gradient */}
              <line
                x1="160"
                y1="160"
                x2={x}
                y2={y}
                stroke={isActive ? color : `${color}40`}
                strokeWidth={isActive ? "2.5" : "1"}
                opacity={isActive ? 0.8 : 0.3}
              >
                {isActive && (
                  <animate
                    attributeName="stroke-width"
                    values="2.5;3.5;2.5"
                    dur="0.5s"
                    repeatCount="indefinite"
                  />
                )}
              </line>

              {/* Animated particles flowing from Earth to server */}
              {particles.filter(p => p.server === i).slice(-2).map((particle, idx) => (
                <circle key={`${particle.id}-${idx}`} r="3" fill={particle.color} filter="url(#glow)">
                  <animateMotion
                    dur="1.2s"
                    repeatCount="1"
                    path={`M 160 160 L ${x} ${y}`}
                  />
                  <animate
                    attributeName="opacity"
                    values="1;1;0"
                    dur="1.2s"
                    repeatCount="1"
                  />
                </circle>
              ))}

              {/* Server node with pulsing effect */}
              <g>
                {/* Pulse ring */}
                {isActive && (
                  <circle
                    cx={x}
                    cy={y}
                    r="22"
                    fill="none"
                    stroke={color}
                    strokeWidth="2"
                    opacity="0"
                  >
                    <animate attributeName="r" values="22;32;22" dur="1s" repeatCount="1" />
                    <animate attributeName="opacity" values="0.8;0;0.8" dur="1s" repeatCount="1" />
                  </circle>
                )}

                {/* Server circle with gradient */}
                <circle
                  cx={x}
                  cy={y}
                  r="22"
                  fill={`url(#serverGrad${i % serverColors.length})`}
                  stroke={color}
                  strokeWidth="2.5"
                  filter="url(#glow)"
                />

                {/* Server label */}
                <text
                  x={x}
                  y={y - 1}
                  textAnchor="middle"
                  fill="white"
                  fontSize="10"
                  fontWeight="bold"
                  style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}
                >
                  S{i + 1}
                </text>
                <text
                  x={x}
                  y={y + 9}
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.7)"
                  fontSize="7"
                >
                  {['US', 'EU', 'ASIA', 'AU', 'SA', 'AF'][i % 6]}
                </text>
              </g>

              {/* Geographic region indicator */}
              <circle
                cx={x}
                cy={y}
                r="28"
                fill="none"
                stroke={color}
                strokeWidth="1"
                strokeDasharray="2,3"
                opacity="0.3"
              >
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from={`0 ${x} ${y}`}
                  to={`360 ${x} ${y}`}
                  dur="8s"
                  repeatCount="indefinite"
                />
              </circle>
            </g>
          );
        })}

        {/* Center prompt when not configured */}
        {!isConfigured && (
          <text x="160" y="250" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="12" fontWeight="500">
            Add geo routing to see traffic flow
          </text>
        )}

        {/* Active routing indicator */}
        {isConfigured && (
          <text x="160" y="290" textAnchor="middle" fill={serverColors[activeServer % serverColors.length]} fontSize="11" fontWeight="600">
            Routing to {['North America', 'Europe', 'Asia', 'Australia', 'South America', 'Africa'][activeServer % 6]}
          </text>
        )}
      </svg>

      {isConfigured && (
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 12, display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
          {[...Array(servers)].map((_, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: serverColors[i % serverColors.length] }} />
              <span>Server {i + 1}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Round Robin - Colorful rotating request distribution
function RoundRobinAnimation({ originCount }: { originCount: number }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [particles, setParticles] = useState<number[]>([]);
  const servers = Math.max(originCount, 3);

  const serverColors = [
    '#10b981', // Green
    '#f59e0b', // Amber
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#06b6d4', // Cyan
    '#f97316', // Orange
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % servers);
      setParticles(prev => [...prev, Date.now()].slice(-3));
    }, 1500);
    return () => clearInterval(interval);
  }, [servers]);

  return (
    <div style={{ width: '100%', textAlign: 'center' }}>
      <svg width="320" height="320" viewBox="0 0 320 320">
        <defs>
          <filter id="glowRR">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>

          {serverColors.map((color, i) => (
            <radialGradient key={`rrGrad${i}`} id={`rrGrad${i}`}>
              <stop offset="0%" stopColor={color} />
              <stop offset="100%" stopColor={color} stopOpacity="0.7" />
            </radialGradient>
          ))}
        </defs>

        {/* Cloudflare Edge (center) with animation */}
        <g>
          {/* Outer pulse rings */}
          <circle cx="160" cy="160" r="30" fill="none" stroke="#f97316" strokeWidth="2" opacity="0">
            <animate attributeName="r" values="30;45;30" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.6;0;0.6" dur="2s" repeatCount="indefinite" />
          </circle>
          <circle cx="160" cy="160" r="30" fill="none" stroke="#f59e0b" strokeWidth="2" opacity="0">
            <animate attributeName="r" values="30;45;30" dur="2s" begin="0.5s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.6;0;0.6" dur="2s" begin="0.5s" repeatCount="indefinite" />
          </circle>

          {/* Center node */}
          <circle cx="160" cy="160" r="28" fill="url(#rrGrad1)" stroke="#f59e0b" strokeWidth="3" filter="url(#glowRR)" />
          <text x="160" y="158" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">
            CF
          </text>
          <text x="160" y="168" textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize="8">
            EDGE
          </text>
        </g>

        {/* Origin servers in circle */}
        {[...Array(servers)].map((_, i) => {
          const angle = (i * (360 / servers)) - 90;
          const x = 160 + 105 * Math.cos((angle * Math.PI) / 180);
          const y = 160 + 105 * Math.sin((angle * Math.PI) / 180);
          const isActive = i === activeIndex;
          const color = serverColors[i % serverColors.length];

          return (
            <g key={i}>
              {/* Connection line with animated dash */}
              <line
                x1="160"
                y1="160"
                x2={x}
                y2={y}
                stroke={isActive ? color : `${color}60`}
                strokeWidth={isActive ? "3" : "1.5"}
                strokeDasharray="5,5"
                opacity={isActive ? 0.9 : 0.4}
              >
                {isActive && (
                  <animate
                    attributeName="stroke-dashoffset"
                    from="0"
                    to="10"
                    dur="0.5s"
                    repeatCount="indefinite"
                  />
                )}
              </line>

              {/* Animated request particles */}
              {isActive && particles.map((particleId, idx) => (
                <circle key={particleId} r="4" fill={color} filter="url(#glowRR)">
                  <animateMotion
                    dur="1.2s"
                    repeatCount="1"
                    path={`M 160 160 L ${x} ${y}`}
                  />
                  <animate
                    attributeName="r"
                    values="4;5;3"
                    dur="1.2s"
                    repeatCount="1"
                  />
                </circle>
              ))}

              {/* Server node with glow */}
              <g>
                {/* Pulse effect when active */}
                {isActive && (
                  <circle
                    cx={x}
                    cy={y}
                    r="24"
                    fill="none"
                    stroke={color}
                    strokeWidth="2.5"
                    opacity="0"
                  >
                    <animate attributeName="r" values="24;35;24" dur="1s" repeatCount="1" />
                    <animate attributeName="opacity" values="0.8;0;0.8" dur="1s" repeatCount="1" />
                  </circle>
                )}

                <circle
                  cx={x}
                  cy={y}
                  r="24"
                  fill={`url(#rrGrad${i % serverColors.length})`}
                  stroke={color}
                  strokeWidth={isActive ? "3" : "2"}
                  filter="url(#glowRR)"
                >
                  {isActive && (
                    <animate
                      attributeName="stroke-width"
                      values="3;4;3"
                      dur="0.8s"
                      repeatCount="indefinite"
                    />
                  )}
                </circle>

                <text x={x} y={y + 5} textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">
                  {i + 1}
                </text>
              </g>

              {/* Server label */}
              <text
                x={x}
                y={y + 40}
                textAnchor="middle"
                fill={color}
                fontSize="10"
                fontWeight="600"
              >
                Origin {i + 1}
              </text>
            </g>
          );
        })}

        {/* Active indicator */}
        <text x="160" y="290" textAnchor="middle" fill={serverColors[activeIndex % serverColors.length]} fontSize="12" fontWeight="600">
          Request → Origin {activeIndex + 1}
        </text>
      </svg>
    </div>
  );
}

// Weighted Round Robin - Colorful with different sized servers
function WeightedRoundRobinAnimation({ originCount }: { originCount: number }) {
  const [pulses, setPulses] = useState<{ id: number; server: number }[]>([]);
  const [activeParticles, setActiveParticles] = useState<{ id: number; server: number }[]>([]);
  const servers = Math.max(originCount, 3);
  const weights = [50, 30, 20];
  const serverColors = ['#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

  useEffect(() => {
    let id = 0;
    const interval = setInterval(() => {
      const random = Math.random() * 100;
      let serverIndex = 0;
      if (random > 50) serverIndex = 1;
      if (random > 80) serverIndex = 2;

      const finalServer = serverIndex % servers;
      setPulses(prev => [...prev, { id: id, server: finalServer }].slice(-15));
      setActiveParticles(prev => [...prev, { id: id, server: finalServer }]);

      // Remove particle after animation completes
      setTimeout(() => {
        setActiveParticles(prev => prev.filter(p => p.id !== id));
      }, 1000);

      id++;
    }, 700);
    return () => clearInterval(interval);
  }, [servers]);

  return (
    <div style={{ width: '100%', textAlign: 'center' }}>
      <svg width="320" height="300" viewBox="0 0 320 300">
        <defs>
          <filter id="glowWRR">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Traffic flow from top */}
        <g>
          <circle cx="160" cy="40" r="20" fill="#f97316" stroke="#ea580c" strokeWidth="2" filter="url(#glowWRR)" />
          <text x="160" y="45" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">
            REQ
          </text>
        </g>

        {/* Servers with different sizes based on weight */}
        {[...Array(Math.min(servers, 3))].map((_, i) => {
          const x = 70 + (i * 90);
          const y = 150;
          const weight = weights[i % weights.length];
          const radius = 18 + (weight / 4);
          const color = serverColors[i % serverColors.length];
          const recentHits = pulses.filter(p => p.server === i).length;
          const isActive = recentHits > 0;

          return (
            <g key={i}>
              {/* Weight bar */}
              <rect
                x={x - 35}
                y="220"
                width="70"
                height="12"
                rx="6"
                fill="rgba(100,116,139,0.3)"
                stroke={color}
                strokeWidth="1"
              />
              <rect
                x={x - 35}
                y="220"
                width={70 * (weight / 100)}
                height="12"
                rx="6"
                fill={color}
                opacity="0.8"
              >
                <animate
                  attributeName="opacity"
                  values="0.8;1;0.8"
                  dur="2s"
                  repeatCount="indefinite"
                />
              </rect>

              {/* Weight label */}
              <text x={x} y="215" textAnchor="middle" fill={color} fontSize="14" fontWeight="bold">
                {weight}%
              </text>

              {/* Animated particles flowing to server */}
              {activeParticles.filter(p => p.server === i).map((pulse) => (
                <circle key={`particle-${pulse.id}`} r="4" fill={color} filter="url(#glowWRR)">
                  <animateMotion
                    dur="1s"
                    repeatCount="1"
                    path={`M 160 60 L ${x} ${y - radius - 5}`}
                  />
                  <animate
                    attributeName="opacity"
                    values="0;1;1;0"
                    dur="1s"
                    repeatCount="1"
                  />
                  <animate
                    attributeName="r"
                    values="2;4;5;3"
                    dur="1s"
                    repeatCount="1"
                  />
                </circle>
              ))}

              {/* Server circle */}
              <g>
                {/* Pulse ring when receiving traffic */}
                {isActive && (
                  <circle
                    cx={x}
                    cy={y}
                    r={radius + 5}
                    fill="none"
                    stroke={color}
                    strokeWidth="2.5"
                    opacity="0"
                  >
                    <animate attributeName="r" values={`${radius + 5};${radius + 15};${radius + 5}`} dur="0.7s" repeatCount="1" />
                    <animate attributeName="opacity" values="0.9;0;0.9" dur="0.7s" repeatCount="1" />
                  </circle>
                )}

                <circle
                  cx={x}
                  cy={y}
                  r={radius}
                  fill={color}
                  stroke={color}
                  strokeWidth="3"
                  opacity="0.9"
                  filter="url(#glowWRR)"
                />

                <text x={x} y={y - 5} textAnchor="middle" fill="white" fontSize="13" fontWeight="bold">
                  S{i + 1}
                </text>
                <text x={x} y={y + 7} textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize="9">
                  {recentHits}
                </text>
              </g>

              {/* Hit counter visualization */}
              <text x={x} y="250" textAnchor="middle" fill={color} fontSize="10" fontWeight="600">
                {recentHits} hits
              </text>
            </g>
          );
        })}

        <text x="160" y="280" textAnchor="middle" fill="#64748b" fontSize="11">
          Higher weight = More traffic
        </text>
      </svg>
    </div>
  );
}

// IP Hash - Colorful IPs flowing to specific servers
function IPHashAnimation({ originCount }: { originCount: number }) {
  const [activeIPs, setActiveIPs] = useState<{ ip: string; server: number; id: number; color: string }[]>([]);
  const servers = Math.max(originCount, 3);
  const serverColors = ['#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

  useEffect(() => {
    let id = 0;
    const interval = setInterval(() => {
      const fakeIP = `192.168.${Math.floor(Math.random() * 4)}.${Math.floor(Math.random() * 255)}`;
      const hash = fakeIP.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const serverIndex = hash % servers;
      const color = serverColors[serverIndex % serverColors.length];

      setActiveIPs(prev => [...prev, { ip: fakeIP, server: serverIndex, id: id++, color }].slice(-8));
    }, 1800);
    return () => clearInterval(interval);
  }, [servers]);

  return (
    <div style={{ width: '100%', textAlign: 'center' }}>
      <svg width="320" height="300" viewBox="0 0 320 300">
        <defs>
          <filter id="glowIP">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Hash function visualization */}
        <g>
          <rect x="30" y="130" width="80" height="40" rx="8" fill="#475569" stroke="#64748b" strokeWidth="2" />
          <text x="70" y="155" textAnchor="middle" fill="#cbd5e1" fontSize="10" fontWeight="bold">
            HASH()
          </text>
        </g>

        {/* Servers on the right */}
        {[...Array(Math.min(servers, 3))].map((_, i) => {
          const y = 50 + (i * 75);
          const color = serverColors[i % serverColors.length];
          const hits = activeIPs.filter(ip => ip.server === i).length;

          return (
            <g key={i}>
              <rect
                x="220"
                y={y}
                width="80"
                height="50"
                rx="8"
                fill={color}
                stroke={color}
                strokeWidth="2.5"
                opacity="0.9"
                filter="url(#glowIP)"
              >
                {hits > 0 && (
                  <animate
                    attributeName="opacity"
                    values="0.9;1;0.9"
                    dur="1s"
                    repeatCount="indefinite"
                  />
                )}
              </rect>
              <text x="260" y={y + 25} textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">
                Server {i + 1}
              </text>
              <text x="260" y={y + 38} textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize="9">
                {hits} IPs
              </text>
            </g>
          );
        })}

        {/* IP addresses flowing */}
        {activeIPs.slice(-3).map((item, idx) => {
          const yStart = 150 + (idx * 15); // Stagger vertically to avoid overlap
          const yEnd = 50 + (item.server * 75) + 25;

          return (
            <g key={item.id}>
              {/* IP text moving from hash to server */}
              <text
                x="120"
                y={yStart}
                fill={item.color}
                fontSize="9"
                fontFamily="monospace"
                fontWeight="700"
                opacity="0"
                filter="url(#glowIP)"
              >
                {item.ip}
                <animate
                  attributeName="opacity"
                  from="0"
                  to="1"
                  dur="0.3s"
                  fill="freeze"
                />
                <animate
                  attributeName="x"
                  from="120"
                  to="180"
                  dur="1.5s"
                  fill="freeze"
                />
                <animate
                  attributeName="y"
                  from={yStart}
                  to={yEnd}
                  dur="1.5s"
                  fill="freeze"
                />
                <animate
                  attributeName="opacity"
                  from="1"
                  to="0"
                  begin="1.2s"
                  dur="0.3s"
                  fill="freeze"
                />
              </text>

              {/* Trailing particle */}
              <circle r="3" fill={item.color} filter="url(#glowIP)">
                <animateMotion
                  dur="1.5s"
                  path={`M 110 ${yStart} L 220 ${yEnd}`}
                  fill="freeze"
                />
                <animate
                  attributeName="opacity"
                  values="1;1;0"
                  dur="1.5s"
                  fill="freeze"
                />
              </circle>
            </g>
          );
        })}

        <text x="160" y="270" textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="500">
          Same IP → Same Server
        </text>
      </svg>
    </div>
  );
}

// Cookie Sticky - Colorful cookie sessions
function CookieStickyAnimation({ originCount }: { originCount: number }) {
  const [sessions, setSessions] = useState<{ id: number; server: number; color: string; isNew: boolean }[]>([]);
  const servers = Math.max(originCount, 3);
  const serverColors = ['#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

  useEffect(() => {
    let id = 0;
    const interval = setInterval(() => {
      const isReturning = Math.random() > 0.4 && sessions.length > 0;
      const server = isReturning
        ? sessions[sessions.length - 1].server
        : Math.floor(Math.random() * servers);
      const color = serverColors[server % serverColors.length];

      setSessions(prev => [...prev, { id: id++, server, color, isNew: !isReturning }].slice(-10));
    }, 1600);
    return () => clearInterval(interval);
  }, [servers, sessions]);

  const latestSession = sessions[sessions.length - 1];

  return (
    <div style={{ width: '100%', textAlign: 'center' }}>
      <svg width="320" height="300" viewBox="0 0 320 300">
        <defs>
          <filter id="glowCookie">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Cookie icon on left */}
        <g>
          <circle cx="70" cy="150" r="35" fill="#f59e0b" stroke="#d97706" strokeWidth="3" filter="url(#glowCookie)" />
          <circle cx="60" cy="140" r="5" fill="#92400e" />
          <circle cx="75" cy="155" r="5" fill="#92400e" />
          <circle cx="70" cy="160" r="4" fill="#92400e" />
          <circle cx="65" cy="148" r="3" fill="#92400e" />
          <circle cx="78" cy="145" r="4" fill="#92400e" />

          {/* Session indicator */}
          <text x="70" y="200" textAnchor="middle" fill="#f59e0b" fontSize="9" fontWeight="600">
            SESSION
          </text>
        </g>

        {/* Arrow with color */}
        <line
          x1="110"
          y1="150"
          x2="170"
          y2="150"
          stroke={latestSession ? latestSession.color : '#64748b'}
          strokeWidth="3"
          markerEnd="url(#arrowCookie)"
        >
          <animate
            attributeName="stroke-dasharray"
            values="0,100;100,0"
            dur="1.5s"
            repeatCount="indefinite"
          />
        </line>

        <defs>
          <marker id="arrowCookie" markerWidth="12" markerHeight="10" refX="11" refY="5" orient="auto">
            <polygon points="0 0, 12 5, 0 10" fill={latestSession ? latestSession.color : '#64748b'} />
          </marker>
        </defs>

        {/* Server stack */}
        {[...Array(Math.min(servers, 3))].map((_, i) => {
          const y = 60 + (i * 60);
          const color = serverColors[i % serverColors.length];
          const isActive = latestSession?.server === i;
          const hitCount = sessions.filter(s => s.server === i).length;

          return (
            <g key={i}>
              <rect
                x="190"
                y={y}
                width="100"
                height="45"
                rx="8"
                fill={color}
                stroke={color}
                strokeWidth={isActive ? "3" : "2"}
                opacity={isActive ? 1 : 0.7}
                filter="url(#glowCookie)"
              >
                {isActive && (
                  <animate
                    attributeName="opacity"
                    values="0.9;1;0.9"
                    dur="0.8s"
                    repeatCount="indefinite"
                  />
                )}
              </rect>

              <text x="240" y={y + 22} textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">
                Server {i + 1}
              </text>
              <text x="240" y={y + 35} textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize="9">
                {hitCount} sessions
              </text>
            </g>
          );
        })}

        <text x="160" y="270" textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="500">
          {latestSession?.isNew ? 'New visitor → Random server' : 'Returning → Same server'}
        </text>
      </svg>
    </div>
  );
}

// Weighted Sticky - Shows weight-based initial assignment + stickiness
function WeightedStickyAnimation({ originCount }: { originCount: number }) {
  const [sessions, setSessions] = useState<{ id: number; server: number; color: string; isNew: boolean; weight: number }[]>([]);
  const servers = Math.max(originCount, 3);
  const serverColors = ['#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
  const weights = [50, 30, 20]; // Server weights

  useEffect(() => {
    let id = 0;
    const interval = setInterval(() => {
      const isReturning = Math.random() > 0.4 && sessions.length > 0;
      let server: number;

      if (isReturning) {
        // Returning visitor - go to same server
        server = sessions[sessions.length - 1].server;
      } else {
        // New visitor - weighted selection
        const random = Math.random() * 100;
        server = random < 50 ? 0 : random < 80 ? 1 : 2;
        server = server % servers;
      }

      const color = serverColors[server % serverColors.length];
      const weight = weights[server % weights.length];

      setSessions(prev => [...prev, { id: id++, server, color, isNew: !isReturning, weight }].slice(-10));
    }, 1600);
    return () => clearInterval(interval);
  }, [servers, sessions]);

  const latestSession = sessions[sessions.length - 1];

  return (
    <div style={{ width: '100%', textAlign: 'center' }}>
      <svg width="320" height="300" viewBox="0 0 320 300">
        <defs>
          <filter id="glowWeightedSticky">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Cookie + Weight icon on left */}
        <g>
          <circle cx="70" cy="145" r="35" fill="#f59e0b" stroke="#d97706" strokeWidth="3" filter="url(#glowWeightedSticky)" />
          <circle cx="60" cy="135" r="5" fill="#92400e" />
          <circle cx="75" cy="150" r="5" fill="#92400e" />
          <circle cx="70" cy="155" r="4" fill="#92400e" />
          <circle cx="65" cy="143" r="3" fill="#92400e" />
          <circle cx="78" cy="140" r="4" fill="#92400e" />

          {/* Weight indicator */}
          <rect x="45" y="190" width="50" height="8" rx="4" fill="rgba(100,116,139,0.4)" stroke="#64748b" strokeWidth="1" />
          <rect x="45" y="190" width={latestSession ? (50 * latestSession.weight / 100) : 25} height="8" rx="4" fill={latestSession?.color || '#64748b'}>
            <animate
              attributeName="opacity"
              values="0.8;1;0.8"
              dur="1.5s"
              repeatCount="indefinite"
            />
          </rect>

          <text x="70" y="210" textAnchor="middle" fill="#f59e0b" fontSize="9" fontWeight="600">
            {latestSession?.isNew ? `${latestSession.weight}% WEIGHT` : 'STICKY'}
          </text>
        </g>

        {/* Arrow with color */}
        <line
          x1="110"
          y1="145"
          x2="165"
          y2="145"
          stroke={latestSession ? latestSession.color : '#64748b'}
          strokeWidth="3"
          markerEnd="url(#arrowWeightedSticky)"
        >
          <animate
            attributeName="stroke-dasharray"
            values="0,100;100,0"
            dur="1.5s"
            repeatCount="indefinite"
          />
        </line>

        <defs>
          <marker id="arrowWeightedSticky" markerWidth="12" markerHeight="10" refX="11" refY="5" orient="auto">
            <polygon points="0 0, 12 5, 0 10" fill={latestSession ? latestSession.color : '#64748b'} />
          </marker>
        </defs>

        {/* Servers with different sizes based on weight */}
        {[...Array(Math.min(servers, 3))].map((_, i) => {
          const y = 50 + (i * 65);
          const color = serverColors[i % serverColors.length];
          const weight = weights[i % weights.length];
          const width = 70 + (weight / 2); // Wider for higher weight
          const isActive = latestSession?.server === i;
          const hitCount = sessions.filter(s => s.server === i).length;

          return (
            <g key={i}>
              {/* Weight percentage above server */}
              <text x={190 + width/2} y={y - 5} textAnchor="middle" fill={color} fontSize="11" fontWeight="700">
                {weight}%
              </text>

              <rect
                x="190"
                y={y}
                width={width}
                height="42"
                rx="8"
                fill={color}
                stroke={color}
                strokeWidth={isActive ? "3" : "2"}
                opacity={isActive ? 1 : 0.7}
                filter="url(#glowWeightedSticky)"
              >
                {isActive && (
                  <animate
                    attributeName="opacity"
                    values="0.9;1;0.9"
                    dur="0.8s"
                    repeatCount="indefinite"
                  />
                )}
              </rect>

              <text x={190 + width/2} y={y + 20} textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">
                Server {i + 1}
              </text>
              <text x={190 + width/2} y={y + 33} textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize="9">
                {hitCount} sessions
              </text>
            </g>
          );
        })}

        <text x="160" y="270" textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="500">
          {latestSession?.isNew ? `New → Weighted (${latestSession.weight}%)` : 'Returning → Sticky'}
        </text>
      </svg>
    </div>
  );
}

// Failover - Colorful server status
function FailoverAnimation({ originCount }: { originCount: number }) {
  const [failedServer, setFailedServer] = useState(-1);
  const [currentServer, setCurrentServer] = useState(0);
  const servers = Math.max(originCount, 2);

  useEffect(() => {
    const failInterval = setInterval(() => {
      if (Math.random() > 0.6 && failedServer === -1) {
        setFailedServer(0);
        setCurrentServer(1);

        setTimeout(() => {
          setFailedServer(-1);
          setCurrentServer(0);
        }, 4000);
      }
    }, 5000);

    return () => {
      clearInterval(failInterval);
    };
  }, [failedServer]);

  const serverColors = ['#10b981', '#f59e0b', '#8b5cf6'];
  const statusColors = {
    active: '#10b981',
    standby: '#64748b',
    failed: '#ef4444',
  };

  return (
    <div style={{ width: '100%', textAlign: 'center' }}>
      <svg width="320" height="300" viewBox="0 0 320 300">
        <defs>
          <filter id="glowFail">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Traffic source */}
        <g>
          <circle cx="50" cy="150" r="25" fill="#f97316" stroke="#ea580c" strokeWidth="2.5" filter="url(#glowFail)" />
          <text x="50" y="155" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">
            REQ
          </text>

          {/* Animated traffic particles */}
          {currentServer >= 0 && (
            <circle r="4" fill="#fbbf24" filter="url(#glowFail)" opacity="0.9">
              <animateMotion
                dur="1.5s"
                repeatCount="indefinite"
                path={`M 75 150 L ${130} ${80 + currentServer * 70}`}
              />
            </circle>
          )}
        </g>

        {/* Servers */}
        {[...Array(Math.min(servers, 3))].map((_, i) => {
          const y = 80 + (i * 70);
          const isFailed = failedServer === i;
          const isActive = currentServer === i;
          const isPrimary = i === 0;

          const status = isFailed ? 'failed' : isActive ? 'active' : 'standby';
          const statusColor = statusColors[status];
          const serverColor = isFailed ? '#7f1d1d' : serverColors[i % serverColors.length];

          return (
            <g key={i}>
              {/* Priority label */}
              <text x="140" y={y} fill="#94a3b8" fontSize="10" fontWeight="700" textAnchor="end">
                {isPrimary ? 'PRIMARY' : `BACKUP ${i}`}
              </text>

              {/* Server box */}
              <rect
                x="150"
                y={y - 25}
                width="140"
                height="50"
                rx="10"
                fill={serverColor}
                stroke={statusColor}
                strokeWidth={isActive ? "4" : "2.5"}
                opacity={isFailed ? 0.8 : 1}
                filter="url(#glowFail)"
              >
                {isFailed && (
                  <animate
                    attributeName="opacity"
                    values="0.8;0.5;0.8"
                    dur="0.5s"
                    repeatCount="indefinite"
                  />
                )}
              </rect>

              {/* Status indicator light */}
              <circle
                cx="170"
                cy={y}
                r="8"
                fill={statusColor}
                stroke="white"
                strokeWidth="2"
                filter="url(#glowFail)"
              >
                {isActive && !isFailed && (
                  <animate
                    attributeName="opacity"
                    values="1;0.5;1"
                    dur="1.2s"
                    repeatCount="indefinite"
                  />
                )}
                {isFailed && (
                  <animate
                    attributeName="fill"
                    values="#ef4444;#7f1d1d;#ef4444"
                    dur="0.8s"
                    repeatCount="indefinite"
                  />
                )}
              </circle>

              {/* Server label */}
              <text x="220" y={y - 5} textAnchor="middle" fill="white" fontSize="13" fontWeight="bold">
                Server {i + 1}
              </text>

              {/* Status text */}
              <text x="220" y={y + 10} textAnchor="middle" fill="rgba(255,255,255,0.9)" fontSize="11" fontWeight="600">
                {status.toUpperCase()}
              </text>
            </g>
          );
        })}

        {/* Status message */}
        <g>
          <rect x="80" y="250" width="160" height="30" rx="8" fill="#1e293b" stroke="#334155" strokeWidth="1.5" />
          <text x="160" y="270" textAnchor="middle" fill={failedServer >= 0 ? '#ef4444' : '#10b981'} fontSize="11" fontWeight="600">
            {failedServer >= 0 ? '⚠️ FAILOVER ACTIVE' : '✓ Primary Online'}
          </text>
        </g>
      </svg>
    </div>
  );
}

function getStrategyExplanation(strategy: LoadBalancerStrategy, isGeoSteering: boolean): string {
  switch (strategy) {
    case 'round-robin':
      return 'Requests rotate sequentially across all servers. Each server gets equal traffic distribution.';
    case 'weighted-round-robin':
      return 'Servers with higher weights receive proportionally more traffic. Perfect for varying server capacities.';
    case 'ip-hash':
      return 'Client IP address determines the server. Same IP always routes to same server for session persistence.';
    case 'cookie-sticky':
      return 'First visit randomly assigned, then cookie ensures all future requests go to the same server for 24 hours.';
    case 'weighted-cookie-sticky':
      return 'Initial assignment based on weights, then cookie maintains sticky sessions.';
    case 'failover':
      return 'Primary server handles all traffic. Backups activate only if primary returns 5xx errors.';
    case 'geo-steering':
      return isGeoSteering
        ? 'Visitors routed to nearest server based on location. Priority: Region → Country → Continent → Fallback.'
        : 'Configure geographic routing on each origin to activate location-based traffic distribution.';
    default:
      return 'Load balancer distributes traffic across origin servers.';
  }
}
