let roundRobinCursor = 0;

const config = __CONFIG__;

export default {
  async fetch(request) {
    if (!config.origins.length) {
      return new Response("No origin servers available", { status: 502 });
    }

    const origin = selectRoundRobinOrigin(config.origins);
    return proxyToOrigin(origin, request);
  }
};

function selectRoundRobinOrigin(origins) {
  const origin = origins[roundRobinCursor % origins.length];
  roundRobinCursor = (roundRobinCursor + 1) % 2147483647;
  return origin;
}

async function proxyToOrigin(origin, request) {
  const url = new URL(request.url);
  const originBase = new URL(origin.url);
  const targetUrl = origin.url.replace(/\/$/, "") + url.pathname + url.search;
  const requestClone = request.clone();
  const headers = new Headers(requestClone.headers);

  // Set Host to the origin's hostname — fixes virtual-host routing and image/favicon loading
  headers.set("Host", originBase.hostname);

  // Rewrite Referer so the origin never sees the load balancer's domain
  const referer = headers.get("Referer");
  if (referer) {
    try {
      const refUrl = new URL(referer);
      refUrl.protocol = originBase.protocol;
      refUrl.host = originBase.host;
      headers.set("Referer", refUrl.toString());
    } catch {}
  }

  // Rewrite Origin header to the actual origin domain (skipped when exposeRealOrigin is enabled)
  const originHeader = headers.get("Origin");
  if (originHeader && !config.exposeRealOrigin) {
    headers.set("Origin", originBase.origin);
  }

  // Forward real client IP; strip any header that reveals the load balancer domain
  headers.set("X-Forwarded-For", request.headers.get("cf-connecting-ip") || "");
  headers.set("X-Forwarded-Proto", url.protocol.replace(":", ""));
  headers.delete("X-Forwarded-Host");

  try {
    return await fetch(targetUrl, {
      method: request.method,
      headers,
      body: allowsBody(request.method) ? requestClone.body : undefined,
    });
  } catch (error) {
    return new Response("Origin server unavailable", { status: 502 });
  }
}

function allowsBody(method) {
  return method !== "GET" && method !== "HEAD";
}
