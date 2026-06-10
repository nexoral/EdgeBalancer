# EdgeBalancer — Project Context

## What It Is
SaaS control plane for deploying and managing Cloudflare Worker-based load balancers without writing Worker code manually. Users connect their Cloudflare account, configure origins + strategy, and EdgeBalancer generates and deploys the Worker.

---

## Monorepo Layout

```
EdgeBalancer/
├── client/          # Next.js 16 frontend (App Router)
├── server/          # Fastify API backend
├── config/          # Nginx config (edgebalancer.conf)
├── AGENTS.md        # ← canonical context (this file)
└── CLAUDE.md        # points here
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Axios |
| Backend | Fastify, TypeScript (strict), Mongoose ODM |
| Database | MongoDB Atlas |
| Auth | JWT in httpOnly cookies + Firebase (Google OAuth) |
| Edge Runtime | Cloudflare Workers (user-controlled accounts) |
| Encryption | AES-256-GCM for Cloudflare credentials at rest |
| Password | bcrypt (10 rounds) |
| Tests (client) | Jest + React Testing Library — run with `--runInBand` |
| Tests (server) | Jest integration tests — real DB, mocked Cloudflare/Firebase |

---

## Client Structure (`client/src/`)

```
app/                         # Next.js App Router pages
  page.tsx                   # Landing page
  layout.tsx                 # Root layout (AuthProvider, ToastProvider)
  dashboard/page.tsx         # Load balancer list dashboard
  loadbalancers/
    create/page.tsx          # Create flow
    [id]/edit/page.tsx       # Edit flow
  sessions/page.tsx          # Deployment history
  settings/page.tsx          # User settings / password change
  login/page.tsx
  register/page.tsx
  onboarding/page.tsx        # Cloudflare credential setup

components/
  auth/                      # AuthLayout, GoogleAuthButton
  dashboard/                 # LoadBalancerCard, SessionCard, Sidebar
  landing/                   # FlowDiagram
  layout/                    # ProtectedRoute
  loadbalancers/             # DeploymentExperience, LoadBalancerVisualization, PauseModal
  providers/                 # ToastProvider
  shared/                    # Icons, Logo
  ui/                        # Badge, Button, Card, Input, Modal, MultiSelect

contexts/
  AuthContext.tsx             # Global auth state (user, loading, signOut)

lib/
  api.ts                     # Singleton ApiClient (Axios) — calls backend directly
  firebase.ts                # Firebase app init
  cloudRegions.ts            # Cloudflare region list
  geoData.ts                 # Geo targeting data
  utils.ts                   # Generic helpers

types/
  api.ts                     # All shared TypeScript interfaces
```

**Client → Backend:** `api.ts` calls `NEXT_PUBLIC_API_URL/api/*` directly (no Next.js proxy). Credentials sent as httpOnly cookies via `withCredentials: true`.

---

## Server Structure (`server/src/`)

```
index.ts                     # Entry: connects MongoDB, starts Fastify
app.ts                       # buildServer() — registers plugins, middleware, routes

config/
  firebase.ts                # Firebase Admin SDK init

middleware/
  auth.ts                    # JWT extraction + verification → attaches req.user
  cors.ts                    # CORS for configured CLIENT_URL
  errorHandler.ts            # Global error handler (last in chain)
  fastifyIdempotency.ts      # Idempotency plugin for POST/PUT
  validation.ts              # Input validation helpers
  validators/
    authValidators.ts
    cloudflareValidators.ts
    loadBalancerValidators.ts
    userValidators.ts

models/
  User.ts                    # IUser Mongoose schema
  LoadBalancer.ts            # ILoadBalancer Mongoose schema
  Session.ts                 # ISession Mongoose schema

routes/                      # Flat route handlers (auth, cloudflare, user)
  authRoutes.ts
  cloudflareRoutes.ts
  loadBalancerRoutes.ts      # Legacy — active routes are in modules/
  userRoutes.ts

controllers/                 # Flat controllers (auth, cloudflare, user)
  authController.ts
  cloudflareController.ts
  loadBalancerController.ts  # Legacy
  userController.ts

modules/                     # Domain-module pattern (preferred)
  loadbalancer/
    loadbalancer.routes.ts   # Fastify route registrations
    controllers/             # One file per operation (kebab-case.controller.ts)
      create.controller.ts
      update.controller.ts
      delete.controller.ts
      list.controller.ts
      get.controller.ts
      cancel.controller.ts
      validate.controller.ts
      pause.controller.ts
      resume.controller.ts
      assign-domain.controller.ts
    orchestrators/           # Multi-step workflows with rollback
      create.orchestrator.ts
      update.orchestrator.ts
      delete.orchestrator.ts
      pause.orchestrator.ts
      resume.orchestrator.ts
      assign-domain.orchestrator.ts
      release-domain.orchestrator.ts
    services/                # Pure domain logic (*.service.ts)
      credentials.service.ts
      validation.service.ts
      strategy.service.ts
      formatter.service.ts
      hostname.service.ts
      operation.service.ts
      snapshot.service.ts
    types/
      loadBalancer.types.ts
  session/
    session.routes.ts
    controllers/
      list.controller.ts
      script.controller.ts

services/                    # Cross-cutting infra services
  cloudflareClient.ts        # Cloudflare REST API wrapper
  workerGenerator.ts         # Generates Worker JS from templates
  workerDeployment.ts        # CF Worker upload
  workerDomain.ts            # CF Worker domain attach/detach
  workerDeletion.ts          # CF Worker delete
  sessionService.ts          # Session CRUD
  credentialsService.ts      # Legacy
  workerTemplates/           # Strategy-specific Worker JS templates
    roundRobin.js
    weightedRoundRobin.js
    ipHash.js
    cookieSticky.js
    weightedCookieSticky.js
    failover.js
    geoSteering.js
    paused.js
    maintenance.js

utils/
  encryption.ts              # AES-256-GCM encrypt/decrypt
  password.ts                # bcrypt hash/compare
  jwt.ts                     # JWT generate/verify
  database.ts                # Mongoose connect
  workerName.ts              # Script name generation + WORKER_SCRIPT_NAME_REGEX
  loadBalancerOperationStore.ts  # In-memory operation tracking for cancel
  requestCancellation.ts     # Cancellation token pattern
  mask.ts                    # Token/ID masking for API responses
  username.ts                # Username generation from name
  retry.ts                   # Retry with backoff
  routeRunner.ts             # runHandlers() chains Fastify middleware + handler

types/
  http.ts                    # Fastify request/reply extensions
```

---

## Naming Conventions

### Files
| Context | Convention | Example |
|---|---|---|
| Module controllers | `kebab-case.controller.ts` | `assign-domain.controller.ts` |
| Module orchestrators | `kebab-case.orchestrator.ts` | `create.orchestrator.ts` |
| Module services | `kebab-case.service.ts` | `credentials.service.ts` |
| Module routes | `[module].routes.ts` | `loadbalancer.routes.ts` |
| Module types | `[module].types.ts` | `loadBalancer.types.ts` |
| Flat controllers | `camelCase` | `authController.ts` |
| Flat routes | `camelCase` | `authRoutes.ts` |
| Client components | `PascalCase.tsx` | `LoadBalancerCard.tsx` |
| Client lib/utils | `camelCase.ts` | `cloudRegions.ts` |
| Test files | mirror source path under `__tests__/` | `__tests__/unit/jwt.test.ts` |

### Folders
| Scope | Convention | Example |
|---|---|---|
| Server modules | `camelCase` | `loadbalancer/`, `session/` |
| Client components | `camelCase` | `dashboard/`, `loadbalancers/` |
| Client pages (App Router) | `camelCase` or `[param]` | `loadbalancers/[id]/edit/` |

### TypeScript
- Interfaces: `PascalCase` prefixed with `I` for Mongoose docs (`IUser`, `ILoadBalancer`)
- Types: `PascalCase` (`LoadBalancerStrategy`, `ApiResponse<T>`)
- Functions: `camelCase` for functions, `PascalCase` for React components

---

## Database Models

### User
| Field | Type | Notes |
|---|---|---|
| name | String | required, 2–100 chars |
| email | String | unique, sparse (null for Google-only) |
| username | String | unique, lowercase |
| password | String | nullable (null for Google-only users) |
| firebaseUid | String | unique, sparse (Google OAuth users) |
| cloudflareAccountId | String | AES-256-GCM encrypted |
| cloudflareApiToken | String | AES-256-GCM encrypted |
| cloudflareAccountIdIv / Tag | String | IV + GCM tag for accountId |
| cloudflareTokenIv / Tag | String | IV + GCM tag for apiToken |

### LoadBalancer
| Field | Type | Notes |
|---|---|---|
| userId | ObjectId | ref User |
| name | String | 3–50 chars, lowercase + hyphens only, locked after creation |
| scriptName | String | unique, derived from name at creation |
| domain | String | CF zone domain |
| subdomain | String | optional prefix |
| origins | Array\<IOriginServer\> | min 1, each has url, weight, geo fields, isFallback |
| strategy | String | enum (see strategies) |
| weightedEnabled | Boolean | derived from strategy |
| exposeRealOrigin | Boolean | adds X-Origin-Url header in Worker |
| placement | Object | { smartPlacement, region } |
| zoneId | String | Cloudflare zone ID |
| status | String | `active` \| `paused` \| `inactive` |
| pauseMode | String | `release-domain` \| `keep-domain` |
| workerUrl | String | deployed Worker URL |

### Session
Stores deployment history snapshots (Worker JS + config) per load balancer action.

| Field | Type | Notes |
|---|---|---|
| userId | ObjectId | |
| email | String | nullable |
| content | String | full Worker script at time of deploy |
| loadBalancerName | String | |
| domain / subdomain | String | |
| strategy | String | |
| placement | Object | nullable |
| exposeRealOrigin | Boolean | nullable |
| actionType | String | `create` \| `edit` |
| isActive | Boolean | false once LB deleted/updated |
| loadBalancerId | ObjectId | nullable |

---

## API Routes

### Auth (`/api/auth`)
| Method | Path | Notes |
|---|---|---|
| POST | `/register` | email+password signup |
| POST | `/login` | sets httpOnly JWT cookie |
| POST | `/logout` | clears cookie |
| GET | `/me` | current user (protected) |
| POST | `/google` | Firebase ID token → JWT |

### Cloudflare (`/api/cloudflare`)
| Method | Path | Notes |
|---|---|---|
| POST | `/credentials` | save CF account ID + API token |
| PUT | `/credentials` | update CF credentials |
| GET | `/credentials` | get masked credentials |
| GET | `/zones` | list CF zones from user account |

### Load Balancers (`/api/loadbalancers`)
| Method | Path | Notes |
|---|---|---|
| GET | `/` | list user's LBs |
| POST | `/` | create (validates hostname, deploys Worker) |
| GET | `/:id` | get single LB |
| PUT | `/:id` | update (uses CF Worker Versions, rollback on failure) |
| DELETE | `/:id` | delete (removes Worker + domain) |
| POST | `/validate-hostname` | preflight hostname conflict check |
| POST | `/operations/:operationId/cancel` | cancel in-flight create/update |
| POST | `/:id/pause` | pause (release-domain or keep-domain) |
| POST | `/:id/resume` | resume paused LB |

### Sessions (`/api/sessions`)
| Method | Path | Notes |
|---|---|---|
| GET | `/` | cursor-paginated list (filter: all/active/inactive) |
| GET | `/:id/script` | raw Worker JS for a session |

### User (`/api/user`)
| Method | Path | Notes |
|---|---|---|
| GET | `/profile` | user profile |
| PUT | `/password` | change password |

### Health
| Method | Path |
|---|---|
| GET | `/health` |

---

## Routing Strategies

| Strategy | Behavior |
|---|---|
| `round-robin` | Edge-local rotating cursor |
| `weighted-round-robin` | Weighted random selection by origin weight |
| `ip-hash` | Stable origin from `cf-connecting-ip` |
| `cookie-sticky` | First request assigns origin, affinity by cookie |
| `weighted-cookie-sticky` | Weighted first assignment, then affinity by cookie |
| `failover` | Ordered retry; advances on 5xx or connection failure |
| `geo-steering` | Match by CF `colo` → `country` → `continent` → fallback rotation |

---

## Cloudflare Integration

All Cloudflare API calls are **server-only** (never from client).

**Required token permissions:**
- Account > Worker Scripts > Edit
- Account > Workers KV Storage > Edit
- Zone > Zone > Read

**Key CF operations:**
- `PUT /accounts/{id}/workers/scripts/{name}` — deploy Worker
- `PUT /accounts/{id}/workers/domains` — attach hostname
- Worker Versions + Deployments API — used for updates (not script re-deploy)
- Domain detach → re-attach for hostname changes on update

---

## Request Flow: Create Load Balancer

```
Client → POST /api/loadbalancers
  → authenticate middleware
  → createLoadBalancer controller
    → createLoadBalancerOrchestrator
      1. getCloudflareCredentialsForUser (decrypt from DB)
      2. generateScriptName(name)
      3. ensureWorkerNameAvailability (CF API check)
      4. generateWorkerCode (from strategy template)
      5. deployWorker → CF API
      6. assertHostnameAvailable (CF API check)
      7. attachDomainToWorker → CF API → returns workerUrl
      8. LoadBalancer.create() → MongoDB
      9. createSession() → MongoDB (non-blocking, failure ignored)
    ← formatted LB response
  ← { success, data, message }
```

On any failure after Worker deploy: full rollback (delete Worker + DB record).

---

## Response Format

All API responses:
```json
{ "success": true|false, "data": <payload>, "message": "..." }
```

---

## Environment Variables

### Client (`.env.local`)
```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

### Server (`.env`)
```
MONGODB_URI=mongodb+srv://...
JWT_SECRET=                  # min 32 chars
ENCRYPTION_KEY=              # exactly 64-char hex (32-byte AES key)
PORT=8000
CLIENT_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3000
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

---

## Development Commands

### Client
```bash
cd client
npm install
npm run dev                  # localhost:3000
npx tsc --noEmit             # type check
npm test -- --runInBand      # tests (must use --runInBand)
```

### Server
```bash
cd server
npm install
npm run dev                  # localhost:8000 with pino-pretty
npx tsc --ignoreDeprecations 6.0 --noEmit
npm run build
npm test                     # integration tests (requires DB + env)
```

---

## Security Invariants

- Cloudflare credentials: AES-256-GCM encrypted before MongoDB write; IV + GCM tag stored alongside
- JWT: httpOnly cookie, 24h expiry
- Passwords: bcrypt 10 rounds; null for Google-only users
- CORS: restricted to `CORS_ORIGIN` env value
- All inputs validated server-side before DB/CF operations
- Error responses never leak credentials, stack traces, or internal IDs
- `ENCRYPTION_KEY` must be exactly 64 hex chars; fail fast if wrong length

---

## Idempotency

POST and PUT routes on load balancers use the `fastifyIdempotency` plugin. Clients should send an `Idempotency-Key` header to safely retry in-flight operations.

---

## Cancellation Pattern

Long-running operations (create, update) register an `operationId` in `loadBalancerOperationStore`. The cancel endpoint calls `cancellation.cancel()` which sets a flag; orchestrators call `cancellation.throwIfCancelled()` between steps, triggering rollback cleanup.

---

## Deployment History (Sessions)

Every successful create/edit saves a `Session` record with the full generated Worker JS and config snapshot. Sessions are immutable logs — they are marked `isActive: false` when the LB is updated or deleted, never modified.

---

## Responsive Layout (Client)

| Breakpoint | Label | Behavior |
|---|---|---|
| < 640px | phone | sidebar hidden, full-width panels |
| 640–1023px | tablet | collapsed sidebar |
| ≥ 1024px | desktop | sidebar visible; create/edit panels use `.hide-lg` on list |

---

## Test Notes

- Client tests: `--runInBand` required; Cloudflare and Firebase are mocked
- Server tests: integration only (real MongoDB); `firebaseUid` uses sparse index — tests must not collide on null values
- Worker generator tests: unit-level, verify template output per strategy
