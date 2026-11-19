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
        title: '[ARCH:APEX_VS_SUBDOMAIN] Apex Domains vs Subdomain Routing (root-domain, apex, www, cname, flattening)',
        description: 'You can bind load balancers to either an apex domain (like example.com) or a subdomain (like api.example.com or lb.example.com). Cloudflare provides automated CNAME flattening on apex domains, allowing root apex traffic to resolve directly to Workers without requiring an external A record.',
      },
      {
        title: '[ARCH:RAW_IP] Automatic Raw IP to DNS A-Record Conversion (origin-ip, raw-ip, cloudflare-dns, a-record)',
        description: 'Cloudflare Workers cannot directly fetch raw numeric IP addresses (like http://192.0.2.1). When you add an IP origin in EdgeBalancer, the control plane automatically creates a dedicated, unproxied A record (e.g. _eb-origin-xxxx.yourdomain.com) in your Cloudflare DNS zone, enabling your Worker to reach your origin by hostname transparently.',
      },
      {
        title: '[ARCH:PORT_ROUTING] Custom Ports & Non-Standard HTTP Ports (ports-8080, custom-port, origin-target)',
        description: 'Origins can listen on custom ports (such as http://backend.example.com:8080 or https://origin.example.com:8443). The edge Worker forwards requests directly to the designated port. Note that visitor-facing frontend ports are standard 80 (HTTP) and 443 (HTTPS), while upstream origin connections can use custom ports.',
      },
      {
        title: '[ARCH:SESSIONS] Deployment History & Instant One-Click Rollback (sessions, audit-log, version-history, rollback)',
        description: 'Every time you create or update a load balancer or gateway, EdgeBalancer saves an immutable snapshot of your configuration and compiled Worker code in your session history. If a new update causes bugs or an origin goes down, you can instantly restore any previous working version with one click without needing to touch DNS or certificates.',
      },
      {
        title: '[ARCH:MONOREPO] System Architecture & Technology Stack (fastify, nextjs, mongodb, redis, workers)',
        description: 'EdgeBalancer consists of: 1) A Next.js 16 frontend App Router UI; 2) A Fastify 5 TypeScript backend API server; 3) MongoDB for persistent user profiles, load balancer records, and session history; 4) Redis for distributed locking, idempotency caches, and 2FA single-use tokens; 5) AxioDB for in-process embedded knowledge retrieval; 6) Cloudflare Workers for edge execution.',
      },
      {
        title: '[ARCH:SSL_MODES] Cloudflare SSL/TLS Encryption Modes (flexible, full, full-strict, origin-ca, self-signed)',
        description: 'Cloudflare offers three primary SSL modes: 1) Flexible encrypts traffic between visitor and Cloudflare but sends HTTP to your origin, which can cause infinite 301 redirect loops if your backend enforces HTTPS; 2) Full encrypts end-to-end and allows self-signed origin certificates; 3) Full (Strict) requires a valid CA-signed or Cloudflare Origin CA certificate on your backend server. Full or Full (Strict) is strongly recommended for EdgeBalancer.',
      },
      {
        title: '[ARCH:MULTI_CLOUD] Multi-Cloud & Hybrid Origin Deployments (hybrid-cloud, aws, gcp, hetzner, bare-metal)',
        description: 'EdgeBalancer supports hybrid multi-cloud topologies. A single load balancer can distribute traffic across servers located in AWS, Google Cloud, Azure, Hetzner, DigitalOcean, and private on-premise bare-metal data centers simultaneously. Health checks monitor each cloud origin independently, automatically routing around cloud provider outages.',
      },
      {
        title: '[ARCH:PROXY_HEADERS] Injected & Forwarded Edge Headers (cf-ray, cf-connecting-ip, x-forwarded-for, x-forwarded-proto, client-headers)',
        description: 'EdgeBalancer automatically passes through and enriches edge proxy headers: CF-Connecting-IP contains the visitor\'s true public IP, CF-Ray provides a unique request trace ID across Cloudflare\'s edge, CF-IPCountry identifies the visitor\'s country code, and X-Forwarded-Proto indicates whether the user connected via http or https.',
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
        title: '[FEAT:PATH_ROUTING] Wildcard & Path Prefix Routing (wildcards, path-matching, microservices, prefix-routes)',
        description: 'Path routing lets you dispatch traffic based on URL patterns. For example, route /api/users/* to User Service, /api/billing/* to Billing Service, and fallback /* to your Main Web App. Prefix wildcards and exact match paths are supported.',
      },
      {
        title: '[FEAT:RATE_LIMITING] Edge Rate Limiting Algorithms (sliding-window, token-bucket, retry-after, ddos-mitigation)',
        description: 'Rate limiting protects your backends from abuse and brute-force attacks by enforcing request thresholds at the edge (for example, 100 requests per minute globally or 10 requests per minute on /login). When limits are exceeded, the edge Worker returns HTTP 429 with standard Retry-After headers.',
      },
      {
        title: '[FEAT:JWT_AUTH] Edge JWT Authentication Verification (jwt-validation, hs256, hs384, hs512, bearer-token)',
        description: 'The API Gateway verifies JSON Web Tokens (JWT) directly at the edge before requests reach your servers. It validates the cryptographic signature (supporting HMAC algorithms HS256, HS384, HS512), checks expiration (exp), verifies issuer (iss) and audience (aud), rejecting invalid requests with HTTP 401 instantly.',
      },
      {
        title: '[FEAT:RBAC] Edge Role-Based Access Control (rbac, user-roles, claims, permission-scopes)',
        description: 'Role-Based Access Control allows you to require specific claims in a user\'s JWT token to access sensitive endpoints. For example, requiring role: admin on /admin/* or scope: write on /v1/settings. Requests lacking required roles are denied with HTTP 403 at the edge without putting load on your backend.',
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
        title: '[FEAT:MOCK_ROUTES] Edge Mock Responses (mock-endpoints, stub-api, testing, json-response)',
        description: 'Mock routes let you simulate API responses directly from the edge without forwarding traffic to any backend server. You specify the HTTP status code (e.g. 200, 201), response headers, and static JSON body. This is ideal for stubbing out APIs during frontend development or serving maintenance mode notices.',
      },
      {
        title: '[FEAT:CACHING] Edge Micro-Caching (cache-control, ttl, fast-api, stale-while-revalidate)',
        description: 'Edge micro-caching stores API responses directly inside Cloudflare\'s edge memory for a duration you choose (such as 10 to 60 seconds). This drastically speeds up frequent read requests and protects your database from being overwhelmed during sudden viral traffic surges.',
      },
      {
        title: '[FEAT:CANARY] Canary Deployments & Traffic Shadowing (traffic-splitting, dark-launch, progressive-rollout)',
        description: 'Canary routing lets you safely test new releases by sending a small percentage of real traffic (like 10%) to a new version while 90% stays on the stable version. Traffic Shadowing duplicates live requests in the background to a test server without delaying the primary user response.',
      },
      {
        title: '[FEAT:WEBSOCKETS] WebSocket & Long-Lived Streaming Support (websockets, wss, duplex-streaming, upgrades)',
        description: 'EdgeBalancer passes through WebSocket upgrade headers (Upgrade: websocket) and HTTP/2 duplex streams to your origins. This ensures real-time applications—such as chat servers, gaming backends, live collaboration tools, and stock tickers—maintain persistent bidirectional connections without termination.',
      },
      {
        title: '[FEAT:GRPC_HTTP2] HTTP/2 & gRPC Streaming Support (grpc, http2, multiplexing, binary-streaming, bidirectional)',
        description: 'EdgeBalancer fully supports multiplexed HTTP/2 transport and gRPC binary streaming directly to backend microservices. Incoming gRPC remote procedure calls preserve trailers, custom status codes, and continuous stream connections without truncation.',
      },
      {
        title: '[FEAT:CUSTOM_ERRORS] Edge Custom Error Pages & Fallbacks (custom-502, custom-503, fallback-json, maintenance-mode, origin-down-ui)',
        description: 'EdgeBalancer API Gateway lets you configure custom JSON or HTML fallback responses for 502 Bad Gateway and 503 Service Unavailable errors. When all origin servers are offline or down for maintenance, visitors receive your branded error page or fallback JSON payload rather than raw Cloudflare error pages.',
      },
      {
        title: '[FEAT:CORS_ADVANCED] Advanced CORS & Credential Configuration (cors-credentials, access-control-allow-credentials, expose-headers, max-age)',
        description: 'EdgeBalancer handles complex Cross-Origin Resource Sharing requirements at the edge: preflight OPTIONS caching via Access-Control-Max-Age (e.g. 86400 seconds), credentialed cross-origin requests with Access-Control-Allow-Credentials: true, dynamic origin matching, and explicit exposed headers.',
      },
      {
        title: '[FEAT:IP_ACCESS_LIST] IP Whitelisting & CIDR Blacklisting (ip-allowlist, ip-blocklist, cidr-ranges, geo-blocking, perimeter-security)',
        description: 'You can protect sensitive administrative routes by enforcing IP access rules right at the edge. Configure allowed CIDR blocks (e.g. 198.51.100.0/24 for your corporate VPN) or block known abusive IP ranges. Requests from unauthorized IPs are rejected with HTTP 403 Forbidden before reaching your servers.',
      },
      {
        title: '[FEAT:CACHE_PURGE] Edge Micro-Cache Invalidation & TTL Controls (cache-purge, stale-while-revalidate, max-age, s-maxage, cache-bypass)',
        description: 'Edge micro-caching respects standard Cache-Control response headers including max-age, s-maxage, and stale-while-revalidate directives. You can configure automatic cache bypass for requests containing Authorization or Cookie headers, ensuring private user data is never cached.',
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
      {
        title: '[INFRA:PLACEMENTS] Smart Placement & Regional Compute Directives (smart-placement, edge-steering, origin-proximity)',
        description: 'Cloudflare Smart Placement automatically detects where your backend databases and origins live, running compute isolates as close to your backend as possible when multi-turn database queries are needed. You can toggle Smart Placement or pin compute regions in EdgeBalancer.',
      },
      {
        title: '[INFRA:TRAFFIC_SPIKES] Sudden Traffic Spikes & Unmetered DDoS Absorption (scale-to-infinity, unmetered-ddos, volumetric-attacks)',
        description: 'Cloudflare\'s massive edge network absorbs hundreds of gigabits per second of malicious layer 3/4 and layer 7 DDoS traffic automatically. Legitimate visitors continue receiving uninterrupted service without scaling delays or capacity bottlenecks.',
      },
      {
        title: '[INFRA:ORIGIN_CLOAKING] Origin Cloaking & Authenticated Origin Pulls (origin-cloaking, authenticated-pulls, client-certificates, bypass-protection)',
        description: 'Origin cloaking ensures nobody can bypass EdgeBalancer or Cloudflare to attack your origin directly by IP address. By enabling Authenticated Origin Pulls (AOP), your origin web server validates Cloudflare\'s client TLS certificate, dropping any direct Internet connection that does not originate from the edge network.',
      },
      {
        title: '[INFRA:RATE_SYNC] Distributed Edge Rate Limiting Synchronization (distributed-rate-limits, global-counters, sliding-window-sync)',
        description: 'EdgeBalancer rate limiting runs locally inside edge isolates across 300+ POPs for sub-millisecond evaluation, while periodically synchronizing rate counters across regions. This prevents edge bottlenecks and provides accurate abuse mitigation without introducing database latency.',
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
      {
        title: '[PLAN:UPGRADE_FLOW] How Upgrading & Payment Works (cashfree, payment-gateway, instant-activation, billing-cycle)',
        description: 'You can upgrade your plan at any time from the Settings > Subscription page. EdgeBalancer uses Cashfree Payment Gateway for secure payments (supporting UPI, credit/debit cards, and net banking). Once payment succeeds, your account is immediately upgraded and higher limits apply instantly.',
      },
      {
        title: '[PLAN:DOWNGRADE_POLICY] Plan Downgrade & Fleet Retention Behavior (downgrade-flow, quota-exceeded, grace-period, active-workers)',
        description: 'If you downgrade your plan or your subscription expires, your currently active Cloudflare Workers remain deployed and continue serving traffic without sudden outage. However, creating new load balancers or editing existing configurations is locked until your fleet is brought within your plan limits.',
      },
      {
        title: '[PLAN:BILLING_INVOICES] Invoicing, GST & Payment Receipts (cashfree-receipts, tax-invoices, gst-number, billing-history)',
        description: 'After every successful subscription payment processed through Cashfree, EdgeBalancer automatically generates an itemized tax invoice. You can enter your company name and GSTIN in Settings > Billing to receive GST-compliant business invoices directly via email.',
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
      {
        title: '[PLAN:QUOTA_HEALTH] Health Check Probe Frequency Limits (probe-intervals, timeout-caps, active-monitors)',
        description: 'Health check probe intervals can be configured from 30 seconds to 300 seconds. Pro plans support 30-second interval probes on unlimited origins; Free plans support 60-second minimum probe intervals on up to 2 origins. Synthetic probes time out after 5000ms.',
      },
      {
        title: '[PLAN:QUOTA_RATE_LIMIT] Edge Rate Limiter Quotas & Burst Allowances (burst-capacity, sliding-window-limits)',
        description: 'Rate limit rules support request limits from 1 to 10,000 requests per minute with configurable time windows (e.g. 1 minute, 5 minutes, 1 hour). Pro plans support up to 20 distinct rate-limiting rules per gateway; Free plans support 1 rate-limit rule.',
      },
      {
        title: '[PLAN:LIMITS_CPU_TIME] Cloudflare Worker CPU & Subrequest Limits (cpu-limit, 10ms-limit, 50ms-paid, 50-subrequests, wall-clock-timeout)',
        description: 'Cloudflare Workers enforce runtime resource boundaries: Free Cloudflare tier enforces a 10ms CPU time limit per request, while Paid Workers provide 50ms of CPU time (with up to 30s wall clock time). In addition, Workers can initiate up to 50 subrequests on Free and up to 1000 on Paid tiers. EdgeBalancer Workers are pre-compiled and optimized to consume under 2ms of CPU time.',
      },
      {
        title: '[PLAN:LIMITS_PAYLOAD] Request & Response Body Size Limits (max-body-size, 100mb-limit, streaming-upload, file-uploads)',
        description: 'Cloudflare Workers support request and response bodies up to 100MB on standard plans. For multi-gigabyte file uploads, we recommend generating pre-signed S3 or Cloudflare R2 upload URLs on your API gateway so clients upload directly to storage rather than routing massive payloads through Workers.',
      },
      {
        title: '[PLAN:HISTORY_RETENTION] Session Snapshot & Audit History Retention (history-retention, snapshot-limits, session-logs)',
        description: 'Every deployment is snapshotted in session history. Free accounts retain the last 30 days of deployment snapshots and rollbacks; Pro accounts maintain unlimited lifetime session history with instant one-click rollbacks to any historical version.',
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
      {
        title: '[PLAN:MATRIX_SUPPORT] Support SLAs & Monitoring Matrix (email-support, priority-sla, dedicated-manager)',
        description: 'Free tier includes community documentation and standard ticket response within 48 hours. Pro tier includes priority email support with responses within 8 hours. Enterprise plans include a dedicated account manager, emergency phone support, and 99.99% uptime guarantees.',
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
      {
        title: '[ERR:522_TIMED_OUT] How to Fix Cloudflare Error 522 Connection Timed Out (error-522, syn-ack-timeout, origin-offline)',
        description: 'Error 522 means Cloudflare sent a TCP SYN packet to your origin server, but your origin never completed the 3-way handshake within 15 seconds. How to fix it: 1) Ensure your server is not suffering from CPU or memory exhaustion; 2) Verify routing and default gateway settings on your cloud virtual machine; 3) Check that your cloud hosting provider has not blocked Cloudflare IP ranges.',
      },
      {
        title: '[ERR:525_SSL_HANDSHAKE] How to Fix Cloudflare Error 525 SSL Handshake Failed (error-525, tls-ciphers, handshake-error)',
        description: 'Error 525 occurs when the SSL/TLS handshake between Cloudflare and your origin server fails. How to fix it: 1) Verify that your origin server supports TLS 1.2 or TLS 1.3; 2) Confirm that your origin web server has modern TLS cipher suites enabled; 3) If your origin uses a self-signed certificate, ensure Cloudflare SSL mode is set to "Full", not "Full (Strict)".',
      },
      {
        title: '[ERR:526_INVALID_SSL] How to Fix Cloudflare Error 526 Invalid SSL Certificate (error-526, self-signed-cert, expired-ssl)',
        description: 'Error 526 occurs when Cloudflare SSL mode is set to "Full (Strict)" and your origin server presents an invalid, expired, or self-signed certificate. How to fix it: 1) Install a valid SSL certificate (like Let\'s Encrypt) on your origin; or 2) Install a free Cloudflare Origin CA certificate; or 3) Switch Cloudflare SSL encryption mode to "Full" to allow self-signed certificates.',
      },
      {
        title: '[ERR:1000_DNS_LOOP] How to Fix Error 1000 DNS Points to Prohibited IP (dns-loop, origin-self-referencing)',
        description: 'Error 1000 happens when an origin DNS record points to a Cloudflare reverse proxy IP address instead of your real backend server IP, creating an infinite routing loop. How to fix it: In your Cloudflare DNS settings, make sure your backend origin A record points to your real server IP (e.g. your AWS/DigitalOcean droplet IP), not a Cloudflare IP.',
      },
      {
        title: '[ERR:520_UNKNOWN_ERROR] How to Fix Cloudflare Error 520 Web Server Returned Unknown Error (error-520, header-too-large, connection-reset, empty-response)',
        description: 'Error 520 occurs when your backend origin server returns an invalid, empty, or unexpected TCP response to Cloudflare. Common causes: 1) Origin response headers exceed Cloudflare\'s 32KB header size limit (often due to huge cookies or verbose auth headers); 2) Origin process crashed or segfaulted midway through writing the response; 3) Origin sent a TCP FIN or RST packet before headers were completed. Check server error logs for crashes or reduce response cookie sizes.',
      },
      {
        title: '[ERR:523_ORIGIN_UNREACHABLE] How to Fix Cloudflare Error 523 Origin Is Unreachable (error-523, routing-issue, bad-gateway-ip, bgp-routing)',
        description: 'Error 523 means Cloudflare\'s edge cannot establish a network route to your origin IP address. Common causes: 1) Incorrect origin IP configured in EdgeBalancer; 2) Origin host is completely powered off or undergoing a network interface change; 3) Upstream cloud provider BGP routing issues or null-routing. Verify that your origin IP responds to ping/curl and matches the address entered in EdgeBalancer.',
      },
      {
        title: '[ERR:524_ORIGIN_TIMEOUT] How to Fix Cloudflare Error 524 A Timeout Occurred (error-524, 100-seconds, long-running-query, export-timeout)',
        description: 'Error 524 occurs when Cloudflare successfully connected to your backend server, but your server took longer than 100 seconds to send an HTTP response. This happens during long database exports, machine learning inferences, or heavy PDF generation. To fix it, offload long-running tasks to background job queues or asynchronous polling endpoints rather than holding a single HTTP request open.',
      },
      {
        title: '[ERR:1001_DNS_RESOLUTION] How to Fix Error 1001 DNS Resolution Error (error-1001, zone-mismatch, cname-target, dangling-cname)',
        description: 'Error 1001 occurs when a domain or subdomain resolves to Cloudflare IPs, but there is no active Cloudflare zone or Custom Domain configured to accept traffic for that exact hostname. How to fix it: Ensure the domain is properly added to your Cloudflare account and that the load balancer hostname assignment in EdgeBalancer completed successfully.',
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
      {
        title: '[TROUBLESHOOT:DEGRADED] Troubleshooting Degraded Origins & False Health Check Failures (flapping-health, false-alarms)',
        description: 'If an origin keeps flapping between healthy and degraded: 1) Increase the health check interval (e.g. from 30s to 60s); 2) Ensure the health check endpoint (like /healthz) performs lightweight checks and does not run expensive database queries; 3) Check origin server access logs to see if health check requests are timing out.',
      },
      {
        title: '[TROUBLESHOOT:DNS_PROPAGATION] DNS Record Changes & Cache Propagation (dns-ttl, nameservers, propagation-delay)',
        description: 'When attaching a new domain, DNS changes on Cloudflare propagate globally in under 60 seconds because Cloudflare controls the authoritative nameservers. If a new domain is not resolving, confirm in your domain registrar that your domain\'s nameservers are pointed to Cloudflare.',
      },
      {
        title: '[TROUBLESHOOT:TOKEN_ROTATION] Rotating Cloudflare API Tokens Without Downtime (token-refresh, zero-downtime-rotation)',
        description: 'To rotate your Cloudflare API token without interrupting running load balancers: 1) In Cloudflare Dashboard, create a new API Token with required permissions; 2) Open EdgeBalancer Settings > Cloudflare and update your API Token; 3) Existing deployed Workers continue running seamlessly while future deployments use the new token.',
      },
      {
        title: '[TROUBLESHOOT:TRAILING_SLASH] Trailing Slash Redirects Breaking POST/PUT Requests (trailing-slash, 301-redirect-drops-body, redirect-loop, fast-api-slash)',
        description: 'Many backend frameworks (such as FastAPI, Django, or Next.js) automatically issue a 301/308 redirect from /endpoint to /endpoint/. When standard HTTP clients receive a 301, they convert POST/PUT requests to GET and drop the request body. To fix this, always ensure your client requests match the exact URL path expected by the backend, or disable strict trailing-slash redirects in your backend router.',
      },
      {
        title: '[TROUBLESHOOT:MIXED_CONTENT] Resolving Mixed Content Warnings (mixed-content, relative-urls, http-assets, insecure-scripts)',
        description: 'Mixed content warnings appear in web browsers when your frontend is loaded over HTTPS but backend responses include hardcoded http:// links for images, scripts, or stylesheets. To resolve this: 1) Update your backend to generate relative URLs or https:// URLs; 2) Enable "Automatic HTTPS Rewrites" in your Cloudflare dashboard.',
      },
      {
        title: '[TROUBLESHOOT:PASSKEY_ISSUES] Passkey & WebAuthn Troubleshooting Guide (passkey-not-supported, cross-device-auth, rp-id-mismatch, bluetooth-passkey)',
        description: 'If passkey registration or authentication fails: 1) Ensure you are accessing the dashboard over a valid HTTPS URL (WebAuthn is blocked by browsers on unencrypted HTTP, except on localhost); 2) Verify that your browser and operating system support WebAuthn / FIDO2; 3) When using cross-device authentication via QR code, make sure Bluetooth is enabled on both your computer and mobile device.',
      },
      {
        title: '[TROUBLESHOOT:HEALTH_FLAPPING] Origin Health Flapping Under High CPU Load (flapping-probes, false-unhealthy, high-load-timeout, probe-tuning)',
        description: 'When backend servers experience sudden traffic surges, single-threaded web frameworks can experience event loop lag, causing synthetic health check requests to time out even when the application is alive. To fix this: Ensure your /healthz route is handled by a lightweight non-blocking handler, or increase the probe timeout and interval in EdgeBalancer settings.',
      },
      {
        title: '[TROUBLESHOOT:WILDCARD_CONFLICTS] Wildcard Route Precedence & Collisions (wildcard-precedence, route-shadowing, route-conflict, star-routes)',
        description: 'Cloudflare Worker routes follow strict longest-prefix matching. A specific route like api.yourdomain.com/* takes precedence over a broad wildcard like *.yourdomain.com/*. In EdgeBalancer, Custom Domains always take priority over Worker Routes for the same hostname.',
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
      {
        title: '[SEC:FIREBASE_MERGE] Account Merging & OAuth Identity Security (google-auth, github-oauth, account-linking)',
        description: 'EdgeBalancer supports Google and GitHub OAuth authentication. The identity anchor is the Firebase user UID. When a user signs in with a provider claiming an existing email, EdgeBalancer securely links both credentials to the single account so duplicate accounts are never created.',
      },
      {
        title: '[SEC:DATA_PRIVACY] What Data EdgeBalancer Stores vs Forwards (privacy, zero-logging, payload-passthrough)',
        description: 'EdgeBalancer is a control plane and reverse proxy. Your application database records, customer passwords, and user payloads are never stored on EdgeBalancer servers—they pass transparently through Cloudflare Worker isolates directly to your backend servers.',
      },
      {
        title: '[SEC:BOT_MANAGEMENT] Edge Bot Mitigation & Automated Scraping Protection (bot-fight-mode, scraper-blocking, challenge-solvers)',
        description: 'By leveraging Cloudflare\'s edge threat intelligence, EdgeBalancer load balancers automatically identify and challenge malicious headless browsers, credential stuffers, and automated content scrapers before they consume backend server CPU.',
      },
      {
        title: '[SEC:AUDIT_TRAIL] Tamper-Resistant Deployment Audit Trail (audit-trail, immutable-records, session-verification)',
        description: 'Every load balancer creation, modification, domain re-assignment, and deletion produces an immutable audit record in MongoDB containing user ID, timestamp, and configuration hash. These records cannot be overwritten, providing an audit trail for compliance and team governance.',
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
