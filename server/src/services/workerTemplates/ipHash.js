const config = __CONFIG__;

export default {
  async fetch(request) {
    if (!config.origins.length) {
      return new Response("No origin servers available", { status: 502 });
    }

    if (config.corsEnabled && request.method === "OPTIONS") {
      return buildCorsPreflightResponse(request);
    }

    const origin = selectHashedOrigin(config.origins, request);
    return proxyToOrigin(origin, request);
  }
};

function selectHashedOrigin(origins, request) {
  const ip = request.headers.get("cf-connecting-ip") || "0.0.0.0";
  let hash = 0;

  for (let i = 0; i < ip.length; i += 1) {
    hash = ((hash << 5) - hash) + ip.charCodeAt(i);
    hash |= 0;
  }

  return origins[Math.abs(hash) % origins.length];
}

async function proxyToOrigin(origin, request) {
  const url = new URL(request.url);
  const originBase = new URL(origin.url);
  const targetUrl = origin.url.replace(/\/$/, "") + url.pathname + url.search;
  const requestClone = request.clone();
  const headers = new Headers(requestClone.headers);

  headers.set("Host", originBase.hostname);

  const referer = headers.get("Referer");
  if (referer) {
    try {
      const refUrl = new URL(referer);
      refUrl.protocol = originBase.protocol;
      refUrl.host = originBase.host;
      headers.set("Referer", refUrl.toString());
    } catch {}
  }

  const originHeader = headers.get("Origin");
  if (originHeader && !config.exposeRealOrigin) {
    headers.set("Origin", originBase.origin);
  }

  headers.set("X-Forwarded-For", request.headers.get("cf-connecting-ip") || "");
  headers.set("X-Forwarded-Proto", url.protocol.replace(":", ""));
  headers.delete("X-Forwarded-Host");

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: allowsBody(request.method) ? requestClone.body : undefined,
    });
    return config.corsEnabled ? injectCorsHeaders(response, request) : response;
  } catch (error) {
    return new Response("Origin server unavailable", { status: 502 });
  }
}

function allowsBody(method) {
  return method !== "GET" && method !== "HEAD";
}

function getAllowedOrigin(requestOrigin) {
  if (!requestOrigin) return null;
  if (!config.corsOrigins || config.corsOrigins.length === 0) return requestOrigin;
  return config.corsOrigins.includes(requestOrigin) ? requestOrigin : null;
}

function buildCorsPreflightResponse(request) {
  const allowedOrigin = getAllowedOrigin(request.headers.get("Origin"));
  const headers = new Headers();
  if (allowedOrigin) {
    headers.set("Access-Control-Allow-Origin", allowedOrigin);
    headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
    headers.set("Access-Control-Allow-Headers",
      request.headers.get("Access-Control-Request-Headers") || "Content-Type, Authorization");
    headers.set("Access-Control-Allow-Credentials", "true");
    headers.set("Access-Control-Max-Age", "86400");
    headers.set("Vary", "Origin");
  }
  return new Response(null, { status: 204, headers });
}

function injectCorsHeaders(response, request) {
  const allowedOrigin = getAllowedOrigin(request.headers.get("Origin"));
  if (!allowedOrigin) return response;
  const headers = new Headers(response.headers);
  headers.delete("Access-Control-Allow-Origin");
  headers.delete("Access-Control-Allow-Credentials");
  headers.delete("Access-Control-Expose-Headers");
  headers.set("Access-Control-Allow-Origin", allowedOrigin);
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set("Vary", "Origin");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
