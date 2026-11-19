import { AxioDB, InstanceTypes } from 'axiodb';

export { InstanceTypes };
export type AxioDatabase = InstanceType<typeof InstanceTypes.Database>;
export type AxioCollection = InstanceType<typeof InstanceTypes.Collection>;

export interface KnowledgeItem {
  title: string;
  description: string;
}

export const KNOWLEDGE_BY_CATEGORY: Record<
  'general_info' | 'plan_info' | 'issue_info',
  Record<string, KnowledgeItem[]>
> = {
  general_info: {
    architecture: [
      {
        title: '[ARCH:OVERVIEW] What is EdgeBalancer (how-it-works, architecture, platform-overview, control-plane)',
        description: 'EdgeBalancer is a cloud control plane that lets you deploy and manage high-performance load balancers and API gateways on Cloudflare Workers without writing any code. You connect your Cloudflare account, configure your backend servers (origins), select a routing strategy, and EdgeBalancer generates, deploys, and monitors the edge Worker automatically.',
      },
      {
        title: '[ARCH:RUNTIME] Cloudflare Workers V8 Runtime (cold-starts, isolates, serverless, edge-network)',
        description: 'EdgeBalancer runs entirely on Cloudflare Workers using Google V8 isolates instead of heavy containers or virtual machines. This means requests execute in under 5 milliseconds with zero cold starts across more than 300 data centers worldwide. Your users connect to the closest edge server rather than waiting for traffic to travel across the globe.',
      },
      {
        title: '[ARCH:ORIGINS] Backend Origins & Upstream Servers (origin-servers, backend-urls, ip-origins, ports)',
        description: 'Origins are your backend application servers that receive traffic from EdgeBalancer. An origin must be an HTTP or HTTPS URL (like https://api1.example.com or http://192.0.2.1:8080). If you provide a raw IP address, EdgeBalancer automatically creates the required DNS records in your Cloudflare zone so the Worker can securely reach your server.',
      },
      {
        title: '[ARCH:DOMAINS] Custom Domains & Automated SSL Certificates (custom-hostnames, ssl-tls, universal-ssl, dns)',
        description: 'You can attach any domain or subdomain that you manage on Cloudflare (for example, api.yourdomain.com or lb.yourdomain.com). Cloudflare automatically issues and renews free SSL/TLS certificates (Universal SSL, DigiCert, or Let\'s Encrypt) and handles HTTPS termination right at the edge closest to your visitor.',
      },
      {
        title: '[ARCH:SESSIONS] Deployment History & Instant One-Click Rollback (sessions, audit-log, version-history, rollback)',
        description: 'Every time you create or update a load balancer or gateway, EdgeBalancer saves an immutable snapshot of your configuration and compiled Worker code in your session history. If a new update causes bugs or an origin goes down, you can instantly restore any previous working version with one click without needing to touch DNS or certificates.',
      },
    ],
    features: [
      {
        title: '[FEAT:STRATEGIES] Load Balancing Strategies Overview (round-robin, least-latency, geo-steering, ip-hash, failover)',
        description: 'EdgeBalancer provides 5 traffic distribution algorithms: Round-Robin distributes requests evenly one after another; Least-Latency sends traffic to the fastest origin based on real-time probe measurements; Geo-Steering routes visitors to servers in their geographic region; IP-Hash ensures a user always reaches the same server for sticky sessions; Active-Passive Failover sends all traffic to a primary server and only switches to backup servers if the primary goes down.',
      },
      {
        title: '[FEAT:ROUND_ROBIN] Round-Robin Load Balancing (equal-distribution, weighted-round-robin, uniform-traffic)',
        description: 'Round-Robin spreads incoming web requests sequentially across all healthy backend servers. It is the best default strategy when your servers have similar hardware capacity and you want an even distribution of traffic. You can also assign custom weights to send more traffic to beefier machines.',
      },
      {
        title: '[FEAT:LEAST_LATENCY] Least-Latency Routing (fastest-server, low-latency, real-time-performance)',
        description: 'Least-Latency routes each request to the origin server that currently responds with the lowest response time. EdgeBalancer measures server latency using background health probes, ensuring users always get the fastest possible experience, especially in multi-region cloud setups.',
      },
      {
        title: '[FEAT:GEO_STEERING] Geo-Steering & Region-Based Routing (geographic-routing, continent, country-routing, proximity)',
        description: 'Geo-Steering inspects the visitor\'s country and continent header (provided automatically by Cloudflare) and forwards their request to the server located closest to them. For example, European visitors go to your Frankfurt servers, while American visitors go to your Virginia servers.',
      },
      {
        title: '[FEAT:IP_HASH] IP-Hash Sticky Sessions (session-stickiness, client-ip, stateful-apps)',
        description: 'IP-Hash hashes the visitor\'s public IP address (from the CF-Connecting-IP header) to consistently map them to the exact same origin server on every visit. This is ideal for applications that store user sessions or in-memory state on specific servers without requiring an external Redis session store.',
      },
      {
        title: '[FEAT:FAILOVER] Active-Passive Failover Strategy (high-availability, backup-servers, standby, disaster-recovery)',
        description: 'Active-Passive Failover keeps a designated primary server active handling 100% of your traffic while standby backup servers wait in reserve. If the primary server fails health checks or throws 5xx errors, EdgeBalancer seamlessly shifts traffic to the backup servers in milliseconds without dropping visitor connections.',
      },
      {
        title: '[FEAT:HEALTH_CHECKS] Active Origin Health Probes (synthetic-monitoring, auto-failover, healthz, degraded-servers)',
        description: 'EdgeBalancer sends automated synthetic HTTP requests (like GET or HEAD to /healthz) to your backend servers every 30 or 60 seconds. If a server takes too long to respond, times out, or returns an error status code, EdgeBalancer immediately takes it out of the active rotation so your users never see error screens.',
      },
      {
        title: '[FEAT:GATEWAY] API Gateway Policies & Rules (path-routing, rate-limiting, authentication, cors)',
        description: 'The EdgeBalancer API Gateway lets you enforce security and traffic rules at the edge before requests reach your backend: you can route different URL paths to different services, enforce rate limits to block abuse, validate JWT login tokens, require user roles, reshape request headers, and cache responses.',
      },
      {
        title: '[FEAT:BODY_SHAPING] Response Body Shaping & Sensitive Field Masking (strip-fields, json-masking, data-privacy)',
        description: 'Response Body Shaping intercepts JSON responses from your backend servers before they reach the user. It automatically strips out sensitive fields (like password_hash, ssn, credit_card, or internal_id) or renames JSON keys, preventing accidental data leaks without requiring changes to your backend code.',
      },
      {
        title: '[FEAT:HEADER_REWRITE] Request Path & Header Rewriting (url-rewrite, header-injection, authorization-forwarding)',
        description: 'Request rewriting allows you to modify incoming requests before they touch your backend. You can rewrite paths (for example, mapping /api/orders to /v2/orders), inject custom tracking or authentication headers (like X-Forwarded-For or X-Tenant-ID), and strip out insecure client headers.',
      },
      {
        title: '[FEAT:CACHING] Edge Micro-Caching (cache-control, ttl, fast-api, stale-while-revalidate)',
        description: 'Edge micro-caching stores API responses directly inside Cloudflare\'s edge memory for a duration you choose (such as 10 to 60 seconds). This drastically speeds up frequent read requests and protects your database from being overwhelmed during sudden viral traffic surges.',
      },
      {
        title: '[FEAT:CANARY] Canary Deployments & Traffic Shadowing (traffic-splitting, dark-launch, progressive-rollout)',
        description: 'Canary routing lets you safely test new releases by sending a small percentage of real traffic (like 10%) to a new version while 90% stays on the stable version. Traffic Shadowing duplicates live requests in the background to a test server without delaying the primary user response.',
      },
    ],
    edge_infrastructure: [
      {
        title: '[INFRA:POPS] Global Edge POP Network (300-cities, worldwide-reach, anycast-routing, ddos-protection)',
        description: 'EdgeBalancer workers are deployed across Cloudflare\'s network spanning over 300 cities and 100+ countries. Every visitor connects to the nearest physical data center over Anycast routing, providing automatic protection against massive DDoS attacks and ensuring fast loading times worldwide.',
      },
      {
        title: '[INFRA:COLD_STARTS] Zero Cold Starts & Instant Execution (fast-response, v8-isolates, sub-millisecond)',
        description: 'Traditional serverless platforms like AWS Lambda or Google Cloud Functions suffer from cold start delays of 100ms to 2000ms when waking up idle containers. Cloudflare Workers use lightweight V8 memory isolates that start in under 5ms, giving your API consistent sub-second latency at all times.',
      },
      {
        title: '[INFRA:RESILIENCE] Origin Quarantine & Zero-Downtime Resilience (automatic-ejection, self-healing, high-availability)',
        description: 'If a backend server stops responding or experiences network outages, EdgeBalancer\'s edge logic detects the problem within seconds, quarantines the unhealthy server, and reroutes incoming traffic to your healthy servers with zero downtime for end users.',
      },
    ],
  },
  plan_info: {
    tiers: [
      {
        title: '[PLAN:FREE] Free Plan Tier Details & Limits (free-tier, starter, pricing, hobbyist, limits)',
        description: 'The Free plan is designed for individual developers and testing. It costs $0 and includes: 5 active load balancers, 1 API gateway, up to 4 backend servers per load balancer, 2 active health checks, 5 gateway routes, standard Round-Robin and Least-Latency strategies, and basic analytics. It does not include AI agent generations, edge micro-caching, response body shaping, or canary routing.',
      },
      {
        title: '[PLAN:STUDENT] Student Plan Tier Details & Limits (student-tier, academic, discounted-pricing)',
        description: 'The Student plan is tailored for students and open-source contributors with verified academic email. It includes: 10 active load balancers, 3 API gateways, 5 active health checks, up to 10 gateway routes, extended rate limiting (up to 3 rules per gateway), basic JWT auth validation, and standard analytics.',
      },
      {
        title: '[PLAN:PRO] Pro Plan Tier Details & Capabilities (pro-tier, production-scale, unlimited-gateways, full-features)',
        description: 'The Pro plan is built for production businesses and high-traffic applications. It includes: 50 active load balancers, unlimited API gateways, up to 20 origins per load balancer, unlimited health checks, full AI agent automation access, response body shaping, edge micro-caching, traffic shadowing, canary progressive rollouts, custom placement editing, and priority email support.',
      },
      {
        title: '[PLAN:ENTERPRISE] Enterprise & Annual Plans (annual-billing, custom-quotas, dedicated-sla, volume-scale)',
        description: 'Enterprise and Annual plans provide discounted annual billing, custom load balancer and origin limits exceeding 100+ servers, multi-zone Cloudflare deployments, dedicated account support, and guaranteed 99.99% uptime service level agreements (SLAs).',
      },
    ],
    quotas_and_limits: [
      {
        title: '[PLAN:QUOTA_LBS] Load Balancer & Origin Quotas by Tier (max-loadbalancers, max-origins, fleet-caps)',
        description: 'Total load balancers allowed: Free plan allows up to 5 load balancers; Student plan allows up to 10 load balancers; Pro plan allows up to 50 load balancers. Origins allowed per load balancer: Free allows up to 4 servers; Pro allows up to 20 servers. Active health checks: Free allows 2; Student allows 5; Pro allows unlimited.',
      },
      {
        title: '[PLAN:QUOTA_GW] API Gateway Route & Policy Quotas (gateway-limits, max-routes, rate-limit-rules)',
        description: 'API Gateway limits per plan: Free plan includes 1 gateway with up to 5 routes, 1 rate-limit rule, 3 header rules, and 2 mock routes. Pro plan includes unlimited gateways with up to 50 routes per gateway, 20 rate-limit rules, and unlimited mock routes.',
      },
      {
        title: '[PLAN:QUOTA_AI] AI Generation Rate Limits (3-runs-per-15m, ai-cooldowns, fair-use)',
        description: 'To ensure reliable service and prevent upstream model budget exhaustion, the AI Agent has a fair-use limit of 3 generation runs per 15-minute rolling window per user. The system uses a fast multi-model ladder (free high-quality OpenRouter models first, falling back to metered Mistral models) with automatic Redis rate-limit cooldowns.',
      },
    ],
    feature_matrix: [
      {
        title: '[PLAN:MATRIX_SEC] Security & Compliance Feature Matrix (rbac, jwt, schema-validation, body-shaping)',
        description: 'Comparison of security features across plans: Basic CORS and IP allow/block lists are available on all plans (including Free). Advanced security features—such as JWT signature validation, RBAC role authorization, JSON schema validation, and sensitive response field masking—require a Pro or Enterprise plan.',
      },
      {
        title: '[PLAN:MATRIX_PERF] Performance & Routing Feature Matrix (caching, geo-steering, canary, analytics)',
        description: 'Comparison of routing features across plans: Round-Robin, Least-Latency, and Active-Passive Failover are available on all plans. Geo-Steering, IP-Hash sticky sessions, Edge Micro-Caching, Traffic Shadowing, and Canary routing require a Pro or Enterprise subscription.',
      },
    ],
  },
  issue_info: {
    common_errors: [
      {
        title: '[ERR:409_HOSTNAME] How to Fix 409 Hostname Conflict Error (409-conflict, hostname-taken, route-overlap)',
        description: 'A 409 Conflict error happens when the hostname you entered (like api.yourdomain.com) is already being used by another Cloudflare Worker Route, another Custom Domain, or an existing DNS record. How to fix it: 1) Check your Cloudflare Dashboard under Workers > Triggers > Routes to see if the hostname is bound to an old script; 2) Delete the old conflicting route; 3) Make sure the subdomain is not in use by another EdgeBalancer load balancer.',
      },
      {
        title: '[ERR:403_CF_TOKEN] How to Fix 403 Forbidden Cloudflare API Token Error (403-forbidden, token-permissions, cloudflare-auth)',
        description: 'A 403 Forbidden error means your Cloudflare API Token does not have all the required permissions. How to fix it: In Cloudflare Dashboard, create an API Token with these exact 4 permissions: 1) Account > Workers Scripts > Edit; 2) Account > Account Analytics > Read; 3) Zone > Zone > Read; 4) Zone > DNS > Edit (needed to route traffic to raw IP addresses). Never use your global API key; always use a scoped API Token.',
      },
      {
        title: '[ERR:504_TIMEOUT] How to Fix 504 Gateway Timeout & Health Probe Failures (504-timeout, origin-down, health-check-timeout)',
        description: 'A 504 Gateway Timeout occurs when your backend server does not respond within the 5-second health probe window or drops incoming connections. How to fix it: 1) Verify that your backend application is running and responding to curl requests; 2) Check if your server firewall or cloud security groups allow inbound traffic from Cloudflare IPs; 3) Verify that your health check path (like /healthz) returns a 200 OK status.',
      },
      {
        title: '[ERR:429_RATELIMIT] How to Fix 429 Too Many Requests (429-rate-limit, throttled, retry-after)',
        description: 'A 429 error means incoming client traffic exceeded the rate limit configured on your API gateway (such as 100 requests per minute). The response includes a Retry-After header telling the client how many seconds to wait before making another request. You can adjust your gateway rate limit policy to allow higher request volumes.',
      },
      {
        title: '[ERR:401_JWT] How to Fix 401 Unauthorized JWT Authentication Errors (401-unauthorized, token-expired, bad-signature)',
        description: 'A 401 Unauthorized error occurs on protected gateway routes when a client request does not supply an Authorization Bearer header, the JWT token has expired (exp claim), or the cryptographic signature does not match the secret key configured on the gateway. Verify your JWT secret and check that your token has not expired.',
      },
      {
        title: '[ERR:521_SERVER_DOWN] How to Fix Cloudflare Error 521 Web Server Is Down (error-521, connection-refused, firewall)',
        description: 'Error 521 means Cloudflare attempted to connect to your backend origin server, but your server refused the TCP connection on port 80 or 443. How to fix it: 1) Check that your web server (Nginx, Apache, Node.js) is actually listening on 0.0.0.0, not 127.0.0.1; 2) Ensure your server firewall (iptables, AWS Security Groups, GCP Firewall) allows incoming TCP traffic on ports 80 and 443 from all Cloudflare IP ranges.',
      },
    ],
    troubleshooting: [
      {
        title: '[TROUBLESHOOT:FIREWALL] Origin Firewall & Security Group Setup Guide (security-groups, cloudflare-ips, allowlist, iptables)',
        description: 'To allow Cloudflare Workers to reach your backend servers safely without getting blocked by firewalls: 1) Open ports 80 and 443 in your cloud security groups (AWS, Google Cloud, Azure, DigitalOcean); 2) Add Cloudflare\'s published IP ranges to your firewall allowlist; 3) Ensure your server software binds to public interfaces (0.0.0.0) rather than localhost (127.0.0.1).',
      },
      {
        title: '[TROUBLESHOOT:SSL] How to Fix SSL/TLS Handshake Errors 525 and 526 (error-525, error-526, ssl-handshake, full-strict)',
        description: 'Error 525 (SSL Handshake Failed) and Error 526 (Invalid SSL Certificate) happen when HTTPS connections between Cloudflare and your backend fail. How to fix it: If using "Full (Strict)" SSL mode in Cloudflare, your backend server must have a valid, unexpired SSL certificate with a matching domain name. If your backend uses a self-signed certificate, switch your Cloudflare SSL mode to "Full" instead of "Full (Strict)".',
      },
      {
        title: '[TROUBLESHOOT:ROLLBACK] How to Restore a Previous Deployment Using Session History (revert-version, recovery, rollback-steps)',
        description: 'If a recent load balancer or gateway update introduced bugs or broke traffic routing, you can restore a previous working version in seconds: 1) Open the EdgeBalancer dashboard and click your load balancer; 2) Click on the "History" or "Sessions" tab; 3) Find the last known healthy deployment; 4) Click "Restore" to re-deploy that exact snapshot without altering your DNS or domain setup.',
      },
      {
        title: '[TROUBLESHOOT:CORS] How to Fix CORS Errors on API Gateways (cors-preflight, access-control-allow-origin, options-method)',
        description: 'Cross-Origin Resource Sharing (CORS) errors happen when a browser blocks frontend requests to a different domain. How to fix it: In your EdgeBalancer API Gateway settings, enable CORS and specify your frontend URL under Allowed Origins (e.g. https://app.example.com). The gateway will automatically handle OPTIONS preflight requests and inject the required Access-Control-Allow-Origin headers.',
      },
    ],
    security_faqs: [
      {
        title: '[SEC:ENCRYPTION] How EdgeBalancer Encrypts Your Credentials (aes-256-gcm, token-vault, encryption-at-rest)',
        description: 'All sensitive credentials—including your Cloudflare API Tokens and 2FA authenticator secrets—are encrypted at rest in MongoDB using military-grade AES-256-GCM encryption. Each secret is encrypted with a unique 96-bit initialization vector (IV) and a 128-bit authentication tag, and the master 256-bit key is stored strictly in server environment variables.',
      },
      {
        title: '[SEC:2FA] Two-Factor Authentication Security (totp, passkeys, webauthn, hardware-keys, fido2)',
        description: 'EdgeBalancer supports two-factor authentication via standard TOTP authenticator apps (like Google Authenticator or 1Password) and modern FIDO2/WebAuthn hardware passkeys (like Touch ID, Face ID, Windows Hello, and YubiKeys). Login challenge tokens are protected inside signed httpOnly cookies, and TOTP codes are protected against replay attacks with single-use locks.',
      },
      {
        title: '[SEC:HEADERS] Automatic Edge Security Headers (hsts, content-security-policy, x-frame-options, hardening)',
        description: 'Every load balancer and API gateway deployed by EdgeBalancer automatically injects essential security headers into every response: Strict-Transport-Security (HSTS) enforces HTTPS, X-Content-Type-Options: nosniff stops MIME sniffing, and X-Frame-Options: DENY protects against clickjacking. In addition, internal server headers are stripped to prevent information leaks.',
      },
    ],
  },
};

export const Knowledge_base: KnowledgeItem[] = Object.values(KNOWLEDGE_BY_CATEGORY).flatMap(
  (collectionsMap) => Object.values(collectionsMap).flat()
);

export let axioClient: AxioDB;

export const databases: {
  general_info?: AxioDatabase;
  plan_info?: AxioDatabase;
  issue_info?: AxioDatabase;
} = {};

export const collections: {
  architecture?: AxioCollection;
  features?: AxioCollection;
  edge_infrastructure?: AxioCollection;
  tiers?: AxioCollection;
  quotas_and_limits?: AxioCollection;
  feature_matrix?: AxioCollection;
  common_errors?: AxioCollection;
  troubleshooting?: AxioCollection;
  security_faqs?: AxioCollection;
} = {};

let initPromise: Promise<void> | null = null;

export async function initKnowledgeBase(): Promise<void> {
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    if (!axioClient) {
      axioClient = new AxioDB({
        RootName: 'EdgeBalancerKB',
        Cache: true,
      });
    }
    await axioClient.ready;

    for (const [dbName, collectionsMap] of Object.entries(KNOWLEDGE_BY_CATEGORY)) {
      const db = await axioClient.createDB(dbName);
      databases[dbName as keyof typeof databases] = db;

      for (const [colName, rawItems] of Object.entries(collectionsMap)) {
        const col = await db.createCollection(colName);
        collections[colName as keyof typeof collections] = col;

        const countRes = await col.totalDocuments();
        const total = (countRes as { data?: { total?: number } })?.data?.total ?? 0;

        if (total === 0) {
          const sorted = [...rawItems].sort((a, b) => a.title.localeCompare(b.title));
          const itemsToInsert = sorted.map(({ title, description }) => ({ title, description }));

          if (itemsToInsert.length > 0) {
            await col.insertMany(itemsToInsert);
          }
        }
      }
    }
  })();

  return initPromise;
}
