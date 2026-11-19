const config = __CONFIG__;

function matchPathPattern(pattern, pathname) {
  if (pattern === '/') return pathname === '/';
  const p = pattern.endsWith('/*') ? pattern : pattern.replace(/\/+$/, '');
  if (p === pathname) return true;
  if (p.endsWith('/*')) {
    const prefix = p.slice(0, -2);
    return pathname === prefix || pathname.startsWith(prefix + '/');
  }
  return false;
}

function findMatchingRoute(pathname) {
  for (const route of config.pathRoutes) {
    if (matchPathPattern(route.path, pathname)) return route;
  }
  return null;
}

function findMatchingBffRoute(pathname) {
  if (!config.bffRoutes || !config.bffRoutes.length) return null;
  for (const route of config.bffRoutes) {
    if (matchPathPattern(route.path, pathname)) return route;
  }
  return null;
}

function findMatchingPathRateLimit(pathname) {
  for (const rl of config.pathRateLimits) {
    if (matchPathPattern(rl.path, pathname)) return rl;
  }
  return null;
}

function findMatchingMock(pathname, method) {
  for (const mock of config.mockRoutes) {
    if (!matchPathPattern(mock.path, pathname)) continue;
    if (mock.method !== 'ANY' && mock.method !== method) continue;
    return mock;
  }
  return null;
}

function findMatchingBodyTransform(pathname, phase) {
  if (!config.bodyTransforms || !config.bodyTransforms.length) return null;
  for (const rule of config.bodyTransforms) {
    if (rule.phase === phase && matchPathPattern(rule.path, pathname)) return rule;
  }
  return null;
}

function findMatchingSchemaRule(pathname, method) {
  if (!config.schemaRules || !config.schemaRules.length) return null;
  for (const rule of config.schemaRules) {
    if (!matchPathPattern(rule.path, pathname)) continue;
    if (rule.method && rule.method !== 'ANY' && rule.method !== method) continue;
    return rule;
  }
  return null;
}

function isPathCacheable(pathname) {
  if (!config.cacheConfig.enabled) return false;
  if (!config.cacheConfig.paths.length) return true;
  for (const p of config.cacheConfig.paths) {
    if (matchPathPattern(p, pathname)) return true;
  }
  return false;
}

function getSemanticCacheKey(request, url) {
  if (!config.cacheConfig.normalizeQuery) return request;
  const normalizedUrl = new URL(url.toString());
  const stripParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid'];
  for (const p of stripParams) normalizedUrl.searchParams.delete(p);
  normalizedUrl.searchParams.sort();
  return new Request(normalizedUrl.toString(), {
    method: request.method,
    headers: request.headers,
  });
}

function transformJsonData(data, rule) {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) {
    return data.map((item) => transformJsonData(item, rule));
  }
  const result = { ...data };
  if (Array.isArray(rule.stripFields)) {
    for (const f of rule.stripFields) delete result[f];
  }
  if (Array.isArray(rule.renameFields)) {
    for (const ren of rule.renameFields) {
      if (ren.from && ren.to && result[ren.from] !== undefined) {
        result[ren.to] = result[ren.from];
        delete result[ren.from];
      }
    }
  }
  return result;
}

export default {
  async fetch(request, env, ctx) {
    if (!config.upstreams.length) {
      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Maintenance | EdgeBalancer</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#fff;color:#1a1a1a;display:flex;align-items:center;justify-content:center;height:100vh;-webkit-font-smoothing:antialiased}.container{text-align:center;max-width:440px;width:90%;padding:2.5rem}h1{font-size:2rem;font-weight:600;margin-bottom:1rem;color:#111;letter-spacing:-.02em}p{font-size:1.0625rem;line-height:1.6;color:#4b5563;margin-bottom:2rem}.divider{height:1px;background:#f3f4f6;width:60px;margin:0 auto 2rem}.meta{font-size:.8125rem;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;font-weight:500}</style></head><body><div class="container"><div style="font-size:2.5rem;margin-bottom:1.5rem">\u23F8</div><h1>Gateway Paused</h1><p>This gateway is currently <strong>undergoing maintenance</strong>. We expect to be back <strong>very shortly</strong>.</p><div class="divider"></div><div class="meta">Status: 503 Service Unavailable<br>Powered by EdgeBalancer</div></div></body></html>`;
      return new Response(html, { status: 503, headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Retry-After': '3600' } });
    }

    if (config.corsEnabled && request.method === 'OPTIONS') {
      return buildCorsPreflightResponse(request);
    }

    const ipBlocked = enforceIpRules(request);
    if (ipBlocked) return ipBlocked;

    const url = new URL(request.url);

    // 1. JWT Auth + Route RBAC verification
    const jwtResult = await enforceJwtAuthAndRbac(request, url);
    if (jwtResult.response) return jwtResult.response;
    const jwtPayload = jwtResult.payload;

    // 2. Schema / Contract Validation
    const schemaError = await enforceSchemaValidation(request, url);
    if (schemaError) return schemaError;

    // 3. Identity-Based or IP-Based Rate Limiting
    const rateLimitIdentity = getRateLimitIdentity(request, jwtPayload);
    const limited = await enforceRateLimit(request, env, rateLimitIdentity);
    if (limited) return limited;

    const pathLimited = await enforcePathRateLimit(request, env, rateLimitIdentity);
    if (pathLimited) return pathLimited;

    // 4. Request Body Shaping (Mutation)
    let effectiveRequest = request;
    const reqBodyRule = findMatchingBodyTransform(url.pathname, 'request');
    if (reqBodyRule && allowsBody(request.method)) {
      try {
        const cloned = request.clone();
        const json = await cloned.json();
        const transformed = transformJsonData(json, reqBodyRule);
        const headers = new Headers(request.headers);
        headers.set('Content-Type', 'application/json');
        effectiveRequest = new Request(request.url, {
          method: request.method,
          headers,
          body: JSON.stringify(transformed),
        });
      } catch {}
    }

    // 5. Edge Mock Routes
    const mock = findMatchingMock(url.pathname, request.method);
    if (mock) {
      const headers = new Headers({ 'Content-Type': mock.contentType });
      if (config.corsEnabled) {
        const origin = request.headers.get('Origin');
        const allowed = getAllowedOrigin(origin);
        if (allowed) {
          headers.set('Access-Control-Allow-Origin', allowed);
          headers.set('Access-Control-Allow-Credentials', 'true');
          headers.set('Vary', 'Origin');
        }
      }
      applyHeaderMap(headers, config.headerTransforms.response.set, config.headerTransforms.response.remove);
      headers.set('X-Mock', 'HIT');
      return new Response(mock.body, { status: mock.status, headers });
    }

    // 6. Semantic Cache Match (GET)
    const cacheKey = getSemanticCacheKey(effectiveRequest, url);
    if (config.cacheConfig.enabled && request.method === 'GET' && isPathCacheable(url.pathname)) {
      try {
        const cached = await caches.default.match(cacheKey);
        if (cached) {
          const headers = new Headers(cached.headers);
          headers.set('X-Cache', 'HIT');
          const withCors = config.corsEnabled ? injectCorsHeaders(new Response(cached.body, { status: cached.status, headers }), request) : new Response(cached.body, { status: cached.status, headers });
          return applyResponseHeaderTransforms(withCors);
        }
      } catch {}
    }

    // 7. BFF Fan-Out Aggregation
    const bffRoute = findMatchingBffRoute(url.pathname);
    if (bffRoute && Array.isArray(bffRoute.upstreamIndices) && bffRoute.upstreamIndices.length > 0) {
      return executeBffAggregation(bffRoute, effectiveRequest, url, jwtPayload);
    }

    // 8. Single Upstream Selection (Path routing, Canary splitting, or weighted)
    let upstream;
    const pathRoute = findMatchingRoute(url.pathname);
    if (pathRoute) {
      upstream = config.upstreams[pathRoute.upstreamIndex];
    } else if (config.canary.enabled && config.canary.percentage > 0) {
      const canaryUpstream = config.upstreams[config.canary.upstreamIndex];
      if (canaryUpstream && shouldRouteToCanary(request)) {
        upstream = canaryUpstream;
      } else {
        upstream = selectWeightedUpstream(config.upstreams);
      }
    } else {
      upstream = selectWeightedUpstream(config.upstreams);
    }

    if (!upstream) {
      return new Response('No upstream available', { status: 502 });
    }

    // 9. Asynchronous Traffic Shadowing (Mirroring)
    if (config.shadowConfig && config.shadowConfig.enabled && config.shadowConfig.percentage > 0) {
      const shadowUpstream = config.upstreams[config.shadowConfig.upstreamIndex];
      if (shadowUpstream && Math.random() * 100 < config.shadowConfig.percentage) {
        const shadowClone = effectiveRequest.clone();
        if (ctx && ctx.waitUntil) {
          ctx.waitUntil(proxyToUpstream(shadowUpstream, shadowClone, jwtPayload).catch(function () {}));
        }
      }
    }

    // 10. Forward to Primary Upstream
    const rawResponse = await proxyToUpstream(upstream, effectiveRequest, jwtPayload);
    let finalResponse = rawResponse;

    // 11. Response Body Shaping (Field Stripping / Renaming)
    const respBodyRule = findMatchingBodyTransform(url.pathname, 'response');
    if (respBodyRule && rawResponse.status === 200) {
      const ct = rawResponse.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        try {
          const json = await rawResponse.clone().json();
          const transformed = transformJsonData(json, respBodyRule);
          const headers = new Headers(rawResponse.headers);
          finalResponse = new Response(JSON.stringify(transformed), {
            status: rawResponse.status,
            statusText: rawResponse.statusText,
            headers,
          });
        } catch {}
      }
    }

    const transformedResponse = applyResponseHeaderTransforms(finalResponse);

    // 12. Cache Put (GET 200)
    if (config.cacheConfig.enabled && request.method === 'GET' && transformedResponse.status === 200 && isPathCacheable(url.pathname)) {
      const cacheHeaders = new Headers(transformedResponse.headers);
      cacheHeaders.set('Cache-Control', 'public, max-age=' + config.cacheConfig.ttlSeconds);
      const toCache = new Response(transformedResponse.clone().body, { status: transformedResponse.status, headers: cacheHeaders });
      if (ctx && ctx.waitUntil) ctx.waitUntil(caches.default.put(cacheKey, toCache).catch(function () {}));
      else { try { await caches.default.put(cacheKey, toCache); } catch {} }
      const outHeaders = new Headers(transformedResponse.headers);
      outHeaders.set('X-Cache', 'MISS');
      return new Response(transformedResponse.body, { status: transformedResponse.status, headers: outHeaders });
    }

    return transformedResponse;
  },
};

const RATE_WINDOW_MS = 60000;
const memoryRateWindows = new Map();
const pathRateWindows = new Map();

function rateLimitedResponse(retryAfter) {
  return new Response(JSON.stringify({ error: 'Rate limit exceeded', retryAfter }), {
    status: 429,
    headers: { 'Retry-After': String(retryAfter), 'Content-Type': 'application/json' },
  });
}

function getRateLimitIdentity(request, jwtPayload) {
  const mode = config.rateLimitKeyType || 'ip';
  if (mode === 'header') {
    const hdr = config.rateLimitHeaderName || 'X-API-Key';
    const val = request.headers.get(hdr);
    return val ? 'hdr:' + val.slice(0, 64) : 'ip:' + (request.headers.get('cf-connecting-ip') || '0.0.0.0');
  }
  if (mode === 'jwt' && jwtPayload && jwtPayload.sub) {
    return 'jwt:' + String(jwtPayload.sub).slice(0, 64);
  }
  return 'ip:' + (request.headers.get('cf-connecting-ip') || '0.0.0.0');
}

function memoryRateRecordAndCheck(keyId, now, limit) {
  const cutoff = now - RATE_WINDOW_MS;
  const key = 'gw:rl:' + keyId;
  const recent = (memoryRateWindows.get(key) || []).filter((t) => t >= cutoff);
  const allowed = recent.length < limit;
  recent.push(now);
  memoryRateWindows.set(key, recent);
  if (memoryRateWindows.size > 1000) {
    for (const [k, v] of memoryRateWindows) {
      if (v[v.length - 1] < cutoff) memoryRateWindows.delete(k);
    }
  }
  return allowed;
}

async function cacheRateRecordAndCheck(keyId, now, limit) {
  try {
    const key = 'https://edgebalancer.local/gw-ratelimit/' + encodeURIComponent(keyId);
    const cutoff = now - RATE_WINDOW_MS;
    let recent = [];
    const cached = await caches.default.match(key);
    if (cached) {
      try {
        const parsed = await cached.json();
        if (Array.isArray(parsed.timestamps)) recent = parsed.timestamps;
      } catch {}
    }
    recent = recent.filter((t) => t >= cutoff);
    const allowed = recent.length < limit;
    recent.push(now);
    await caches.default.put(
      key,
      new Response(JSON.stringify({ timestamps: recent }), {
        headers: { 'Cache-Control': 'max-age=60' },
      }),
    );
    return allowed;
  } catch {
    return true;
  }
}

async function enforceRateLimit(request, env, identity) {
  if (!config.rateLimitEnabled) return null;
  const limit = config.rateLimitRequestsPerMinute || 60;
  const now = Date.now();
  if (!memoryRateRecordAndCheck(identity, now, limit)) return rateLimitedResponse(60);
  const cacheAllowed = await cacheRateRecordAndCheck(identity, now, limit);
  if (!cacheAllowed) return rateLimitedResponse(60);
  if (!env.EDGEBALANCER_RATE_LIMITER) return null;
  const result = await env.EDGEBALANCER_RATE_LIMITER.limit({ key: 'gw:' + identity });
  if (!result.success) {
    const retryAfter = Number.isFinite(result.reset_in_seconds) && result.reset_in_seconds > 0 ? Math.max(1, Math.round(result.reset_in_seconds)) : 60;
    return rateLimitedResponse(retryAfter);
  }
  return null;
}

async function enforcePathRateLimit(request, env, identity) {
  if (!config.pathRateLimits || !config.pathRateLimits.length) return null;
  const url = new URL(request.url);
  const match = findMatchingPathRateLimit(url.pathname);
  if (!match) return null;
  const now = Date.now();
  const limit = match.requestsPerMinute;
  const key = 'gw:prl:' + match.path + ':' + identity;
  const cutoff = now - RATE_WINDOW_MS;
  const recent = (pathRateWindows.get(key) || []).filter(function (t) { return t >= cutoff; });
  if (recent.length >= limit) return rateLimitedResponse(60);
  recent.push(now);
  pathRateWindows.set(key, recent);
  if (pathRateWindows.size > 1000) {
    for (const [k, v] of pathRateWindows) {
      if (v[v.length - 1] < cutoff) pathRateWindows.delete(k);
    }
  }
  try {
    const cacheKey = 'https://edgebalancer.local/gw-pathratelimit/' + encodeURIComponent(key);
    let cached = [];
    const cachedResp = await caches.default.match(cacheKey);
    if (cachedResp) {
      try {
        const parsed = await cachedResp.json();
        if (Array.isArray(parsed.timestamps)) cached = parsed.timestamps;
      } catch {}
    }
    cached = cached.filter(function (t) { return t >= cutoff; });
    if (cached.length >= limit) return rateLimitedResponse(60);
    cached.push(now);
    await caches.default.put(cacheKey, new Response(JSON.stringify({ timestamps: cached }), { headers: { 'Cache-Control': 'max-age=60' } }));
  } catch {}
  if (!env.EDGEBALANCER_RATE_LIMITER) return null;
  try {
    const result = await env.EDGEBALANCER_RATE_LIMITER.limit({ key: key });
    if (!result.success) {
      const retryAfter = Number.isFinite(result.reset_in_seconds) && result.reset_in_seconds > 0 ? Math.max(1, Math.round(result.reset_in_seconds)) : 60;
      return rateLimitedResponse(retryAfter);
    }
  } catch {}
  return null;
}

function enforceIpRules(request) {
  if (!config.ipRules || !config.ipRules.length) return null;
  const ip = request.headers.get('cf-connecting-ip') || '';
  if (!ip) return null;
  for (const rule of config.ipRules) {
    if (ipMatchesRule(ip, rule.value) && rule.action === 'deny') {
      return new Response('Forbidden', { status: 403 });
    }
  }
  const hasAllow = config.ipRules.some((r) => r.action === 'allow');
  if (hasAllow) {
    const allowed = config.ipRules.some((r) => r.action === 'allow' && ipMatchesRule(ip, r.value));
    if (!allowed) return new Response('Forbidden', { status: 403 });
  }
  return null;
}

function ipMatchesRule(ip, pattern) {
  if (pattern.includes('/')) {
    const [base, bits] = pattern.split('/');
    const mask = parseInt(bits, 10);
    return ipInCidr(ip, base, mask);
  }
  if (pattern.endsWith('.*')) {
    return ip.startsWith(pattern.slice(0, -2) + '.');
  }
  return ip === pattern;
}

function ipInCidr(ip, base, bits) {
  try {
    const ipNum = ipToNumber(ip);
    const baseNum = ipToNumber(base);
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (ipNum & mask) === (baseNum & mask);
  } catch {
    return false;
  }
}

function ipToNumber(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) throw new Error('invalid ip');
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

async function enforceSchemaValidation(request, url) {
  const rule = findMatchingSchemaRule(url.pathname, request.method);
  if (!rule || !allowsBody(request.method)) return null;
  try {
    const cloned = request.clone();
    const body = await cloned.json();
    if (!body || typeof body !== 'object') {
      return new Response(JSON.stringify({ error: 'Validation failed: Invalid JSON payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (Array.isArray(rule.requiredFields)) {
      for (const field of rule.requiredFields) {
        if (body[field] === undefined || body[field] === null || body[field] === '') {
          return new Response(JSON.stringify({ error: 'Validation failed: Missing required field "' + field + '"' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }
    }
    if (Array.isArray(rule.fieldTypes)) {
      for (const ft of rule.fieldTypes) {
        const val = body[ft.field];
        if (val !== undefined && val !== null) {
          const actualType = Array.isArray(val) ? 'array' : typeof val;
          if (actualType !== ft.type) {
            return new Response(JSON.stringify({ error: 'Validation failed: Field "' + ft.field + '" must be of type ' + ft.type + ', received ' + actualType }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            });
          }
        }
      }
    }
  } catch {
    return new Response(JSON.stringify({ error: 'Validation failed: Malformed JSON payload' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return null;
}

async function enforceJwtAuthAndRbac(request, url) {
  if (!config.jwtAuth.enabled || !config.jwtAuth.secret) {
    return { response: null, payload: null };
  }
  const headerName = config.jwtAuth.headerName || 'Authorization';
  let token = request.headers.get(headerName) || '';
  if (headerName.toLowerCase() === 'authorization' && token.toLowerCase().startsWith('bearer ')) {
    token = token.slice(7).trim();
  }
  if (!token) {
    return { response: new Response(JSON.stringify({ error: 'Missing authentication token' }), { status: 401, headers: { 'Content-Type': 'application/json' } }), payload: null };
  }
  const verifyResult = await verifyJwtHs256(token, config.jwtAuth.secret, config.jwtAuth);
  if (!verifyResult || !verifyResult.valid) {
    return { response: new Response(JSON.stringify({ error: 'Invalid or expired token' }), { status: 401, headers: { 'Content-Type': 'application/json' } }), payload: null };
  }

  const payload = verifyResult.payload;

  // Enforce route-level RBAC if configured
  if (Array.isArray(config.jwtAuth.rbacRules) && config.jwtAuth.rbacRules.length > 0) {
    for (const rule of config.jwtAuth.rbacRules) {
      if (matchPathPattern(rule.path, url.pathname)) {
        const userRoles = Array.isArray(payload.roles)
          ? payload.roles
          : (typeof payload.role === 'string' ? [payload.role] : []);
        const hasRequiredRole = rule.requiredRoles.some((r) => userRoles.includes(r));
        if (!hasRequiredRole) {
          return {
            response: new Response(JSON.stringify({ error: 'Forbidden: Insufficient role permissions' }), {
              status: 403,
              headers: { 'Content-Type': 'application/json' },
            }),
            payload,
          };
        }
      }
    }
  }

  return { response: null, payload };
}

function base64UrlDecode(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + pad;
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function base64UrlEncode(bytes) {
  let str = '';
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function verifyJwtHs256(token, secret, opts) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h64, p64, s64] = parts;
  let header, payload;
  try {
    header = JSON.parse(new TextDecoder().decode(base64UrlDecode(h64)));
    payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(p64)));
  } catch {
    return null;
  }
  const alg = header.alg || 'HS256';
  if (opts.algorithms && Array.isArray(opts.algorithms) && !opts.algorithms.includes(alg)) return null;
  const hashName = alg === 'HS384' ? 'SHA-384' : alg === 'HS512' ? 'SHA-512' : 'SHA-256';
  if (payload.exp && typeof payload.exp === 'number' && Date.now() / 1000 > payload.exp) return null;
  if (payload.nbf && typeof payload.nbf === 'number' && Date.now() / 1000 < payload.nbf) return null;
  if (opts.issuer && payload.iss !== opts.issuer) return null;
  const keyData = new TextEncoder().encode(secret);
  const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: hashName }, false, ['verify']);
  const data = new TextEncoder().encode(h64 + '.' + p64);
  const sig = base64UrlDecode(s64);
  const valid = await crypto.subtle.verify('HMAC', key, sig, data);
  return valid ? { valid: true, payload } : null;
}

function hashStringDjb2(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
  return hash;
}

function shouldRouteToCanary(request) {
  const pct = config.canary.percentage;
  if (pct <= 0) return false;
  if (pct >= 100) return true;
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '';
  const cookie = request.headers.get('Cookie') || '';
  const key = ip + '|' + cookie.slice(0, 64);
  return (hashStringDjb2(key) % 100) < pct;
}

function selectWeightedUpstream(upstreams) {
  const total = upstreams.reduce((s, u) => s + (u.weight || 1), 0);
  if (total <= 0) return upstreams[0] || null;
  let r = Math.random() * total;
  for (const u of upstreams) {
    r -= u.weight || 1;
    if (r < 0) return u;
  }
  return upstreams[upstreams.length - 1] || null;
}

function applyHeaderMap(headers, setRules, removeRules) {
  for (const name of removeRules || []) headers.delete(name);
  for (const rule of setRules || []) headers.set(rule.name, rule.value);
}

function applyResponseHeaderTransforms(response) {
  const headers = new Headers(response.headers);
  applyHeaderMap(headers, config.headerTransforms.response.set, config.headerTransforms.response.remove);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function proxyToUpstream(upstream, request, jwtPayload) {
  const url = new URL(request.url);
  const upstreamBase = new URL(upstream.url);
  const targetUrl = upstream.url.replace(/\/$/, '') + url.pathname + url.search;
  const requestClone = request.clone();
  const headers = new Headers(requestClone.headers);
  headers.set('Host', upstreamBase.hostname);
  const referer = headers.get('Referer');
  if (referer) {
    try {
      const refUrl = new URL(referer);
      refUrl.protocol = upstreamBase.protocol;
      refUrl.host = upstreamBase.host;
      headers.set('Referer', refUrl.toString());
    } catch {}
  }
  applyHeaderMap(headers, config.headerTransforms.request.set, config.headerTransforms.request.remove);
  headers.set('X-Forwarded-For', request.headers.get('cf-connecting-ip') || '');
  headers.set('X-Forwarded-Proto', url.protocol.replace(':', ''));
  headers.delete('X-Forwarded-Host');

  // Downstream claim injection
  if (config.jwtAuth && config.jwtAuth.injectHeaders && jwtPayload) {
    if (jwtPayload.sub) headers.set('X-User-Id', String(jwtPayload.sub));
    const roles = Array.isArray(jwtPayload.roles) ? jwtPayload.roles : (jwtPayload.role ? [jwtPayload.role] : []);
    if (roles.length) headers.set('X-User-Roles', roles.join(','));
  }

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: allowsBody(request.method) ? requestClone.body : undefined,
    });
    return config.corsEnabled ? injectCorsHeaders(response, request) : response;
  } catch {
    return new Response('Upstream unavailable', { status: 502 });
  }
}

async function executeBffAggregation(bffRoute, request, url, jwtPayload) {
  const upstreamsToFetch = bffRoute.upstreamIndices.map((idx) => config.upstreams[idx]).filter(Boolean);
  if (!upstreamsToFetch.length) return new Response('No valid BFF upstreams configured', { status: 502 });

  const promises = upstreamsToFetch.map(async (upstream, i) => {
    const targetUrl = upstream.url.replace(/\/$/, '') + url.pathname + url.search;
    try {
      const clonedReq = request.clone();
      const headers = new Headers(clonedReq.headers);
      headers.set('Host', new URL(upstream.url).hostname);
      if (config.jwtAuth && config.jwtAuth.injectHeaders && jwtPayload) {
        if (jwtPayload.sub) headers.set('X-User-Id', String(jwtPayload.sub));
        const roles = Array.isArray(jwtPayload.roles) ? jwtPayload.roles : (jwtPayload.role ? [jwtPayload.role] : []);
        if (roles.length) headers.set('X-User-Roles', roles.join(','));
      }
      const res = await fetch(targetUrl, {
        method: request.method,
        headers,
        body: allowsBody(request.method) ? clonedReq.body : undefined,
      });
      let data;
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        try { data = await res.json(); } catch { data = await res.text(); }
      } else {
        data = await res.text();
      }
      return { upstreamIndex: bffRoute.upstreamIndices[i], status: res.status, data };
    } catch {
      return { upstreamIndex: bffRoute.upstreamIndices[i], status: 502, error: 'Upstream unreachable' };
    }
  });

  const results = await Promise.allSettled(promises);
  const aggregated = {};
  for (const r of results) {
    if (r.status === 'fulfilled') {
      aggregated['upstream_' + r.value.upstreamIndex] = r.value;
    }
  }
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (config.corsEnabled) {
    const origin = request.headers.get('Origin');
    const allowed = getAllowedOrigin(origin);
    if (allowed) {
      headers.set('Access-Control-Allow-Origin', allowed);
      headers.set('Access-Control-Allow-Credentials', 'true');
    }
  }
  return new Response(JSON.stringify({ success: true, aggregated }), { status: 200, headers });
}

function allowsBody(method) {
  return method !== 'GET' && method !== 'HEAD';
}

function getAllowedOrigin(requestOrigin) {
  if (!requestOrigin) return null;
  if (!config.corsOrigins || config.corsOrigins.length === 0) return requestOrigin;
  return config.corsOrigins.includes(requestOrigin) ? requestOrigin : null;
}

function buildCorsPreflightResponse(request) {
  const allowedOrigin = getAllowedOrigin(request.headers.get('Origin'));
  const headers = new Headers();
  if (allowedOrigin) {
    headers.set('Access-Control-Allow-Origin', allowedOrigin);
    headers.set('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, DELETE, PATCH, OPTIONS');
    headers.set('Access-Control-Allow-Headers', request.headers.get('Access-Control-Request-Headers') || '*');
    headers.set('Access-Control-Expose-Headers', '*');
    headers.set('Access-Control-Allow-Credentials', 'true');
    headers.set('Access-Control-Max-Age', '86400');
    headers.set('Vary', 'Origin');
  }
  return new Response(null, { status: 204, headers });
}

function injectCorsHeaders(response, request) {
  const allowedOrigin = getAllowedOrigin(request.headers.get('Origin'));
  if (!allowedOrigin) return response;
  const headers = new Headers(response.headers);
  headers.delete('Access-Control-Allow-Origin');
  headers.delete('Access-Control-Allow-Credentials');
  headers.delete('Access-Control-Expose-Headers');
  headers.set('Access-Control-Allow-Origin', allowedOrigin);
  headers.set('Access-Control-Allow-Credentials', 'true');
  headers.set('Vary', 'Origin');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
