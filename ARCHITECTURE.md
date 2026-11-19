# EdgeBalancer — System Architecture & Anti-Hallucination Context Map

> **Canonical System Reference**: This document serves as the ground-truth architectural blueprint and zero-grep directory index for human engineers and autonomous AI agents. All statements and file paths in this document reflect verified production code.
>
> **AI Ingestion Format**: Uses Anthropic's hybrid XML-Markdown pattern. Semantic XML tags delineate machine-parsable boundaries to eliminate context bleed and ambiguity, while standard Markdown inside provides optimal human readability.

---

<system_overview>
## 1. System Overview & Monorepo Topology

EdgeBalancer is a SaaS control plane for provisioning and managing Cloudflare Worker-based reverse proxies, API gateways, and load balancers directly inside users' Cloudflare accounts without writing Worker code. Traffic flows directly between client edge locations (330+ Cloudflare PoPs) and user origin servers; runtime traffic never routes through EdgeBalancer's control plane servers.

```
                           ┌──────────────────────────────────────────────┐
                           │          Client Edge Traffic Flow            │
                           │  End User ──► Cloudflare Worker Edge ──►     │
                           │              (User Cloudflare Account)       │
                           │                          │                   │
                           │                          ▼                   │
                           │                 Customer Origin Servers      │
                           └──────────────────────────────────────────────┘
                                                  ▲
                                                  │ Control Plane Deployment
                                                  │ (Cloudflare API)
┌────────────────────────────┐    HTTP/JSON       │
│        @client             │ ◄─────────────► ┌──┴────────────────────────┐
│ Next.js 16 (App Router)    │  (httpOnly JWT) │        @server            │
│ React 19, Tailwind CSS v4  │                 │ Fastify 5, TypeScript     │
└────────────────────────────┘                 │ MongoDB (Mongoose), Redis │
                                               └───────────────────────────┘
```

### High-Level Components
* **`client/`**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4. Consumes the backend REST API directly via `NEXT_PUBLIC_API_URL` with credentials (`httpOnly` cookies).
* **`server/`**: Fastify 5 REST API, strict TypeScript, Mongoose (MongoDB), Redis (locks, rate limits, caching, and BullMQ queues).
* **`Cloudflare Workers Edge`**: Synthesized modern JavaScript reverse proxy scripts deployed to the customer's Cloudflare account via Workers Scripts & Custom Domains APIs.
* **`Model Context Protocol (MCP)`**: Fastify-integrated MCP server exposing tools for Cloudflare, Gateways, and Load Balancers.
</system_overview>

---

<ground_truth_invariants>
## 2. Ground-Truth Invariants & Anti-Hallucination Guardrails

AI agents and developers **must adhere** to the following inviolable constraints. Do not deviate or assume alternative implementations:

<security_auth_rules>
### 2.1 Security & Authentication
1. **Server-Only Cloudflare Calls**: The client **never** interacts directly with the Cloudflare API or holds Cloudflare API tokens. All Cloudflare mutations and reads execute through [cloudflareClient.ts](file:///home/ankan/Documents/Projects/EdgeBalancer/server/src/services/cloudflareClient.ts).
2. **Deterministic Encryption**: Cloudflare credentials are encrypted at rest using AES-256-GCM. The initialization vector (IV) and GCM auth tag are stored alongside ciphertext. `ENCRYPTION_KEY` must be exactly 64 hexadecimal characters (fail fast if invalid).
3. **No Password Authentication**: Registration and authentication occur strictly via Firebase OAuth (Google and GitHub). `/register` 307-redirects to `/login`.
4. **Identity Anchor**: The database identity anchor is the Firebase `uid` (`User.firebaseUid`). Users with matching verified/unverified emails across OAuth providers merge into the same account; duplicate accounts under the same email are blocked.
5. **2FA Enforcement**: 2FA supports only TOTP (`totpDevices[]`) and WebAuthn Passkeys (`passkeyCredentials[]`). **No SMS, no email OTP, no recovery codes exist.**
6. **2FA Challenge Separation**: Authentication challenge tokens (`eb_2fa`) contain a `stage: '2fa_required'` claim. The `authenticate` middleware strictly rejects any token containing `stage` — challenge cookies cannot be used as session cookies.
</security_auth_rules>

<data_state_rules>
### 2.2 Data Integrity & State
1. **Compound Script Name Uniqueness**: Load balancer and Gateway names are 3–50 characters, lowercase alphanumeric with hyphens, locked after creation. Script names are derived via `generateScriptName(name)` and enforced unique per user via compound index `{ userId: 1, scriptName: 1 }`.
2. **Immutable Sessions**: Every successful deployment creates an immutable snapshot in `Session`. On update or deletion, previous records are marked `isActive: false`; session contents are **never** mutated in-place.
3. **One Account per Cloudflare Tenant**: A single Cloudflare account ID can link to at most one EdgeBalancer account. This is strictly enforced via `cloudflareAccountHash` (deterministic HMAC-SHA256 sparse unique index).
4. **Tool Parity**: AI tools (`server/src/modules/ai/services/tools/`) execute the **exact same orchestrators** as REST controllers. Never create private logic or separate execution paths for AI tools.
</data_state_rules>
</ground_truth_invariants>

---

<zero_grep_directory_map>
## 3. Zero-Grep Codebase Directory Map

Use this directory map to locate source files without running recursive searches or blind grep operations.

```
EdgeBalancer/
├── client/                     # Next.js 16 Frontend
│   └── src/
│       ├── app/                # App Router Routes & Pages
│       ├── components/         # Modular React Components
│       ├── contexts/           # React Contexts (Auth)
│       ├── lib/                # Client Utilities, API Client & Integrations
│       ├── types/              # Client TypeScript Interfaces
│       └── middleware.ts       # Next.js Edge Middleware
├── server/                     # Fastify 5 Backend
│   └── src/
│       ├── config/             # Static configurations (Firebase, plans)
│       ├── controllers/        # Flat REST controllers (Auth, CF, User, AI)
│       ├── mcp/                # Model Context Protocol Server & Tools
│       ├── middleware/         # Fastify Plugins (Auth, CORS, Helmet, RateLimit)
│       ├── models/             # Mongoose Models & Schemas
│       ├── modules/            # Domain Feature Modules (Vertical Slices)
│       ├── routes/             # Flat API Routes
│       ├── services/           # Shared Infrastructure & Cloudflare Services
│       ├── types/              # Server-wide TypeScript Interfaces
│       ├── utils/              # Shared Utilities (Locking, Crypto, Retry)
│       ├── app.ts              # Fastify Server Factory (`buildServer`)
│       └── index.ts            # Process Entrypoint & Graceful Shutdown
├── k8s/                        # Kubernetes deployment configurations
├── graphify-out/               # Knowledge graph and community index
└── AGENTS.md                   # Canonical operational rules for AI agents
```

<backend_modules>
### 3.1 Backend Domain Modules (`server/src/modules/`)

Every vertical module adheres to the standard pattern: `controllers/` → `orchestrators/` (multi-step with rollback) → `services/` (pure logic) → `*.routes.ts`.

| Module | Route Prefix | Key Responsibilities | Primary File Pointers |
|---|---|---|---|
| **`loadbalancer`** | `/api/loadbalancers` | Load balancer lifecycle, DNS resolution, script generation, custom domain attachment, analytics | Orchestrators: [create.orchestrator.ts](file:///home/ankan/Documents/Projects/EdgeBalancer/server/src/modules/loadbalancer/orchestrators/create.orchestrator.ts), [update.orchestrator.ts](file:///home/ankan/Documents/Projects/EdgeBalancer/server/src/modules/loadbalancer/orchestrators/update.orchestrator.ts), [delete.orchestrator.ts](file:///home/ankan/Documents/Projects/EdgeBalancer/server/src/modules/loadbalancer/orchestrators/delete.orchestrator.ts)<br>Routes: [loadbalancer.routes.ts](file:///home/ankan/Documents/Projects/EdgeBalancer/server/src/modules/loadbalancer/loadbalancer.routes.ts) |
| **`gateway`** | `/api/gateways` | API Gateway proxy configuration, path routing, rate limits, CORS policies, security headers | Orchestrators: [create.orchestrator.ts](file:///home/ankan/Documents/Projects/EdgeBalancer/server/src/modules/gateway/orchestrators/create.orchestrator.ts), [update.orchestrator.ts](file:///home/ankan/Documents/Projects/EdgeBalancer/server/src/modules/gateway/orchestrators/update.orchestrator.ts)<br>Routes: [gateway.routes.ts](file:///home/ankan/Documents/Projects/EdgeBalancer/server/src/modules/gateway/gateway.routes.ts) |
| **`ai`** | `/api/ai` | Multi-tier model router, SSE streaming agent, surgical context compaction, audit logging | Agent: [agent.service.ts](file:///home/ankan/Documents/Projects/EdgeBalancer/server/src/modules/ai/services/agent.service.ts)<br>Compaction: [compaction.service.ts](file:///home/ankan/Documents/Projects/EdgeBalancer/server/src/modules/ai/services/compaction.service.ts)<br>Router: [model-router.service.ts](file:///home/ankan/Documents/Projects/EdgeBalancer/server/src/modules/ai/services/model-router.service.ts)<br>Routes: [aiRoutes.ts](file:///home/ankan/Documents/Projects/EdgeBalancer/server/src/routes/aiRoutes.ts) |
| **`healthcheck`** | `/api/loadbalancers` | BullMQ-driven origin probing, health evaluation, scheduler sync, origin auto-recovery | Worker: [worker.service.ts](file:///home/ankan/Documents/Projects/EdgeBalancer/server/src/modules/healthcheck/services/worker.service.ts)<br>Scheduler: [scheduler.service.ts](file:///home/ankan/Documents/Projects/EdgeBalancer/server/src/modules/healthcheck/services/scheduler.service.ts)<br>Reconciliation: [reconcile-health.orchestrator.ts](file:///home/ankan/Documents/Projects/EdgeBalancer/server/src/modules/healthcheck/orchestrators/reconcile-health.orchestrator.ts) |
| **`payment`** | `/api/payments` | Cashfree integration, subscription plans, order creation, signature verification, webhooks | Cashfree: [cashfree.service.ts](file:///home/ankan/Documents/Projects/EdgeBalancer/server/src/modules/payment/services/cashfree.service.ts)<br>Subscriptions: [subscription.service.ts](file:///home/ankan/Documents/Projects/EdgeBalancer/server/src/modules/payment/services/subscription.service.ts)<br>Routes: [payment.routes.ts](file:///home/ankan/Documents/Projects/EdgeBalancer/server/src/modules/payment/payment.routes.ts) |
| **`session`** | `/api/sessions` | Immutable Worker deployment logs, generated JavaScript inspection | Controllers: [list.controller.ts](file:///home/ankan/Documents/Projects/EdgeBalancer/server/src/modules/session/controllers/list.controller.ts), [script.controller.ts](file:///home/ankan/Documents/Projects/EdgeBalancer/server/src/modules/session/controllers/script.controller.ts) |
| **`stats`** | `/api/stats` | Platform-level and user-level summary telemetry and resource metrics | Routes: [stats.routes.ts](file:///home/ankan/Documents/Projects/EdgeBalancer/server/src/modules/stats/stats.routes.ts) |
</backend_modules>

<shared_services_utils>
### 3.2 Core Backend Services & Shared Utilities

* **Cloudflare Client**: [cloudflareClient.ts](file:///home/ankan/Documents/Projects/EdgeBalancer/server/src/services/cloudflareClient.ts) — Typed wrapper handling script PUT/DELETE, domain bindings, routes, zone discovery, analytics, and credential verification.
* **Worker Synthesis**: [workerGenerator.ts](file:///home/ankan/Documents/Projects/EdgeBalancer/server/src/services/workerGenerator.ts) — Combines strategy templates with security headers, CORS, rate limits, and path routing.
* **Worker Templates**: [workerTemplates/](file:///home/ankan/Documents/Projects/EdgeBalancer/server/src/services/workerTemplates/) — Production edge templates:
  * `roundRobin.js`, `weightedRoundRobin.js`
  * `ipHash.js`
  * `cookieSticky.js`, `weightedCookieSticky.js`
  * `failover.js`
  * `geoSteering.js`
  * `apiGateway.js`
  * `paused.js`, `maintenance.js`
* **Deployment & DNS**: [workerDeployment.ts](file:///home/ankan/Documents/Projects/EdgeBalancer/server/src/services/workerDeployment.ts), [workerDomain.ts](file:///home/ankan/Documents/Projects/EdgeBalancer/server/src/services/workerDomain.ts), [workerDns.ts](file:///home/ankan/Documents/Projects/EdgeBalancer/server/src/services/workerDns.ts).
* **Two-Factor Services**: [totpService.ts](file:///home/ankan/Documents/Projects/EdgeBalancer/server/src/services/totpService.ts), [passkeyService.ts](file:///home/ankan/Documents/Projects/EdgeBalancer/server/src/services/passkeyService.ts).
* **Distributed Locking**: [resourceLock.ts](file:///home/ankan/Documents/Projects/EdgeBalancer/server/src/utils/resourceLock.ts) — Redis `SET NX EX` distributed lock primitives preventing concurrent deployment race conditions.
* **Operation Cancellation**: [requestCancellation.ts](file:///home/ankan/Documents/Projects/EdgeBalancer/server/src/utils/requestCancellation.ts) — Operation cancellation registry triggered by `POST /operations/:id/cancel`.
* **Database & Crypto**: [encryption.ts](file:///home/ankan/Documents/Projects/EdgeBalancer/server/src/utils/encryption.ts) (AES-256-GCM), [jwt.ts](file:///home/ankan/Documents/Projects/EdgeBalancer/server/src/utils/jwt.ts), [database.ts](file:///home/ankan/Documents/Projects/EdgeBalancer/server/src/utils/database.ts).
</shared_services_utils>

<database_models>
### 3.3 Database Models (`server/src/models/`)

* **`User`** ([User.ts](file:///home/ankan/Documents/Projects/EdgeBalancer/server/src/models/User.ts)): Anchor for auth (`firebaseUid`), encrypted Cloudflare credentials, `cloudflareAccountHash`, confirmed TOTP devices, WebAuthn passkeys, and subscription tier.
* **`LoadBalancer`** ([LoadBalancer.ts](file:///home/ankan/Documents/Projects/EdgeBalancer/server/src/models/LoadBalancer.ts)): Configuration of deployed LBs (origins, routing strategy, domain/subdomain, rate limiting, health check params, worker URL, status).
* **`Gateway`** ([Gateway.ts](file:///home/ankan/Documents/Projects/EdgeBalancer/server/src/models/Gateway.ts)): API Gateway configuration (routes, upstream origins, security headers, rate limits, CORS).
* **`Session`** ([Session.ts](file:///home/ankan/Documents/Projects/EdgeBalancer/server/src/models/Session.ts)): Immutable snapshot of generated Worker JavaScript and configuration on every create or update.
* **`AiRun`** ([AiRun.ts](file:///home/ankan/Documents/Projects/EdgeBalancer/server/src/models/AiRun.ts)): Audit record for AI agent invocations, replayed turns, tool executions, and root-cause analysis.
* **`HealthCheckScheduler`** ([HealthCheckScheduler.ts](file:///home/ankan/Documents/Projects/EdgeBalancer/server/src/models/HealthCheckScheduler.ts)): Schedule configurations for background BullMQ health check probes.
* **`PaymentHistory`** ([PaymentHistory.ts](file:///home/ankan/Documents/Projects/EdgeBalancer/server/src/models/PaymentHistory.ts)): Records of Cashfree payment orders and plan transitions.
</database_models>

<mcp_integration>
### 3.4 Model Context Protocol (`server/src/mcp/`)

Integrates MCP directly into the Fastify server:
* Server setup & SSE transport: [server.ts](file:///home/ankan/Documents/Projects/EdgeBalancer/server/src/mcp/server.ts), [index.ts](file:///home/ankan/Documents/Projects/EdgeBalancer/server/src/mcp/index.ts)
* MCP Tools: [cloudflare.ts](file:///home/ankan/Documents/Projects/EdgeBalancer/server/src/mcp/tools/cloudflare.ts), [loadbalancers.ts](file:///home/ankan/Documents/Projects/EdgeBalancer/server/src/mcp/tools/loadbalancers.ts), [gateways.ts](file:///home/ankan/Documents/Projects/EdgeBalancer/server/src/mcp/tools/gateways.ts)
* Auth & discovery: [discovery.ts](file:///home/ankan/Documents/Projects/EdgeBalancer/server/src/mcp/auth/discovery.ts), [verify.ts](file:///home/ankan/Documents/Projects/EdgeBalancer/server/src/mcp/auth/verify.ts)
</mcp_integration>

<frontend_client>
### 3.5 Frontend Architecture (`client/src/`)

* **App Router Pages (`app/`)**:
  * `/login`, `/register`: Single entry auth with Google/GitHub and 2FA challenge forms.
  * `/onboarding`: First-time setup connecting Cloudflare credentials.
  * `/overview`: Dashboard status, metrics, and active resource summary.
  * `/loadbalancers`: List, create (`/loadbalancers/create`), and edit (`/loadbalancers/[id]/edit`).
  * `/gateways`: List, create (`/gateways/create`), and edit (`/gateways/[id]/edit`).
  * `/sessions`: Inspection of past immutable deployment snapshots and code.
  * `/ai-runs`: Conversation and execution history with the AI assistant.
  * `/settings`: Profile, Cloudflare connection status, TOTP & Passkey device management.
  * `/payments`, `/pro`: Cashfree plan upgrade and subscription billing management.
* **State & Libs**:
  * [AuthContext.tsx](file:///home/ankan/Documents/Projects/EdgeBalancer/client/src/contexts/AuthContext.tsx): Global user authentication state, token refresh, and 2FA challenge orchestration.
  * [api.ts](file:///home/ankan/Documents/Projects/EdgeBalancer/client/src/lib/api.ts): Central Axios client with credentials (`withCredentials: true`), response interceptors, and typed REST methods.
  * [aiStream.ts](file:///home/ankan/Documents/Projects/EdgeBalancer/client/src/lib/aiStream.ts): SSE stream consumer parsing `model_active`, `tool_start`, `tool_result`, `compaction_start`, and `done`.
  * [passkey.ts](file:///home/ankan/Documents/Projects/EdgeBalancer/client/src/lib/passkey.ts): Browser `@simplewebauthn/browser` helpers for passkey registration and verification.
</frontend_client>
</zero_grep_directory_map>

---

<execution_lifecycles>
## 4. Core Lifecycles & Execution Flowcharts

<lifecycle name="load_balancer_create">
### 4.1 Load Balancer / Gateway Creation Lifecycle

Every provision request adheres to distributed synchronization and atomic rollback:

```
[ POST /api/loadbalancers ]
             │
             ▼
1. Acquire Redis Lock: `lb:create:{accountId}:{scriptName}` (Fail with 409 if held)
             │
             ▼
2. Fetch & Decrypt User Cloudflare Credentials (AES-256-GCM)
             │
             ▼
3. Check Script Name Availability on Cloudflare (Prevent overwriting existing Workers)
             │
             ▼
4. Resolve Raw IP Origins (Generate internal DNS records if origins are raw IPs)
             │
             ▼
5. Synthesize Worker JavaScript from Template (workerGenerator.ts)
             │
             ▼
6. Deploy Worker to Cloudflare (PUT /accounts/:id/workers/scripts/:name)
             │
             ▼
7. Check Hostname Conflict (Custom Domains & Worker Routes)
             │
             ▼
8. Attach Custom Domain (POST /accounts/:id/workers/scripts/:name/routes or domains)
             │
             ▼
9. Persist Document in MongoDB (LoadBalancer or Gateway)
             │
             ▼
10. Register Health Check Scheduler in BullMQ (Non-blocking)
             │
             ▼
11. Write Immutable Snapshot to Session Collection (Non-blocking)
             │
             ▼
[ Release Redis Lock ] ──► Return 200 Success
```

#### Rollback Contract
If any step between 2 and 9 fails or if `cancellation.throwIfCancelled()` fires:
* Rollback runs **only while holding the Redis lock** (prevents deleting a winner's worker in race conditions).
* Created DNS records are deleted.
* Partial MongoDB records are purged.
* Worker script and domain attachment on Cloudflare are deleted.
* Lock is released in the `finally` block.
</lifecycle>

<lifecycle name="auth_2fa_state_machine">
### 4.2 Authentication & 2FA State Machine

```
User triggers Google / GitHub OAuth
                │
                ▼
Firebase returns ID Token (Client)
                │
                ▼
POST /api/auth/google (Server verifies with Firebase Admin)
                │
        2FA Enabled?
       ├── NO  ──► Set `eb_session` JWT cookie (24h) ──► Return { user }
       │
       └── YES ──► Set `eb_2fa` cookie with `stage: '2fa_required'`
                   Return { twoFactorRequired: true, methods: ['totp', 'passkey'] }
                        │
                        ▼
             Client Prompts for Second Factor
             ├── TOTP: POST /api/auth/2fa/verify { code }
             └── Passkey: POST /api/auth/2fa/passkey/auth/verify { assertion }
                        │
                   Validated?
                   ├── YES ──► Clear `eb_2fa`, set `eb_session` JWT (24h)
                   └── NO  ──► Return 401 Unauthorized
```
</lifecycle>

<lifecycle name="ai_agent_loop">
### 4.3 AI Agent SSE Execution Loop

The AI agent executes as an SSE stream at `POST /api/ai/generate`:

```
User Prompt (Client)
        │
        ▼
Rate Limit & Quota Check (3 runs / 15 min; Redis sliding window)
        │
        ▼
Select Model via Model Ladder
(OpenRouter Free Large MoE ──failover──► Mistral Metered)
        │
        ▼
Load Conversation History (Redis `conversation:{userId}:{convId}` or Mongo `AiRun`)
        │
        ▼
Token Budget Pressured?
├── YES ──► Surgical Compaction (compaction.service.ts preserves pinned system rules)
└── NO  ──► Proceed
        │
        ▼
Agent Inference & Tool Decision
├── Mutating Tool (update/delete/pause)? ──► Emits prose confirmation requirement first
└── Query / Safe Tool (list/read)       ──► Executes via REST Orchestrator
        │
        ▼
Persist Final Turns to Redis (30m TTL) & Push to Mongo `AiRun`
        │
        ▼
SSE Emits `done` Event
```
</lifecycle>
</execution_lifecycles>

---

<anti_hallucination_axioms>
## 5. Anti-Hallucination Grounding Rules for Agents

When generating code or debugging this codebase, AI models must reference these strict axioms:

| Axiom | True Pattern | Forbidden Hallucination |
|---|---|---|
| **API Pathing** | Base URL: `${NEXT_PUBLIC_API_URL}/api` | Never call `/api/v1` or root `/loadbalancers` without `/api` prefix. |
| **Response Wrapper** | `{ success: boolean, data: T, message: string }` | Never return raw naked objects or inconsistent top-level payloads. |
| **Cloudflare Calls** | Server-side only via `CloudflareClient` | Never import Cloudflare SDKs or make `fetch()` to Cloudflare in `@client`. |
| **Passwords** | Nonexistent in schema or routes | Never suggest password reset, bcrypt, salt, or password login fields. |
| **2FA Options** | TOTP (`otplib`) and Passkeys (`@simplewebauthn`) | Never generate SMS verification, recovery codes, or email magic links. |
| **Worker Script Name** | Derived from user-facing name via `generateScriptName` | Never allow arbitrary user-defined script names or script name renaming after creation. |
| **Worker Updates** | Uses Worker Versions & Deployments API | Never completely tear down a Worker to update route configs. |
| **AI Tool Calls** | Calls `*Orchestrator` functions directly | Never rewrite ad-hoc Cloudflare or Mongo calls inside `ai/services/tools/`. |
| **Code Comments** | Omit code comments unless explicitly requested | Do not clutter production code with trivial comments. |
</anti_hallucination_axioms>

---

<verification_commands>
## 6. Verification & Test Commands

Run the following verification suites before committing or submitting changes:

### Client Verification
```bash
cd client && npx tsc --noEmit && npm test -- --runInBand
```
*Note: Client tests must run with `--runInBand`. Cloudflare and Firebase services are mocked.*

### Server Verification
```bash
cd server && npx tsc --ignoreDeprecations 6.0 --noEmit && npm run build && npm test
```
*Note: Server tests run integration suites against `mongodb-memory-server` with mocked Redis. Multiple users in integration tests must specify unique `firebaseUid` values to avoid collisions on the unique sparse index.*
</verification_commands>
