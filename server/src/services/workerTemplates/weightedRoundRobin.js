const config = __CONFIG__;

export default {
  async fetch(request) {
    if (!config.origins.length) {
      return new Response("No origin servers available", { status: 502 });
    }

    const origin = selectWeightedOrigin(config.origins);
    return proxyToOrigin(origin, request);
  }
};

function selectWeightedOrigin(origins) {
  const totalWeight = origins.reduce((sum, origin) => sum + origin.weight, 0);
  let rand = Math.random() * totalWeight;

  for (const origin of origins) {
    rand -= origin.weight;
    if (rand <= 0) {
      return origin;
    }
  }

  return origins[0];
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
