# EdgeBalancer — Project Context

## Objective
SaaS control plane for deploying and managing Cloudflare Worker-based load balancers without writing Worker code. Users connect a Cloudflare account, configure origins + strategy, and EdgeBalancer generates and deploys the Worker.

## Rules
- All Cloudflare API calls are **server-only** (never from client). Client calls the backend directly via `NEXT_PUBLIC_API_URL` with httpOnly cookies (`withCredentials: true`).
- Cloudflare credentials AES-256-GCM encrypted at rest; IV + GCM tag stored alongside. `ENCRYPTION_KEY` must be exactly 64 hex chars — fail fast otherwise.
- Auth: Firebase OAuth (Google + GitHub) → JWT in httpOnly cookie, 24h expiry. No password login, single sign-in page (`/login`; `/register` 307s to it). Identity anchor is the Firebase `uid` — the provider's claimed email (verified or not) may match into the account that already owns it; the same email is never allowed to create a duplicate account. Firebase's "One account per email address" must be OFF in the console (it otherwise rejects matching GitHub sign-ins with `auth/account-exists-with-different-credential` before our merge can run). 2FA challenge tokens carry `stage` and `authenticate` rejects any token with `stage` — never forge/rename challenge cookies into sessions.
- Destructive AI tools call the **same orchestrators** as REST routes (identical rollback semantics). No `ask_user` tool — clarifications are plain prose.
- No code comments unless asked.

## Constraints
- LB `name`: 3–50 chars, lowercase + hyphens, locked after creation. `scriptName` derived from name, unique per user (compound index `{userId, scriptName}`). Worker names unique only within a CF account.
- 2FA: authenticator TOTP + passkeys only — no SMS/email/recovery codes. 2FA is on iff ≥1 confirmed device (`hasTotp()` in `services/totpService.ts` is the single source of truth).
- AI model ladder: free OpenRouter tier first, then metered Mistral. Global Redis cooldowns only for quota exhaustion (24h provider / 90s model); 401/403 and transient failures are per-run only. One API key per provider = shared upstream budget.
- All API responses: `{ success, data, message }`.

## Monorepo
```
EdgeBalancer/
├── client/   # Next.js 16 (App Router), React 19, TS, Tailwind v4
├── server/   # Fastify 5, TS strict, Mongoose
├── k8s/      # deployment.yaml
└── AGENTS.md # canonical context
```

## Architecture (small)
**Server** (`server/src/`): `index.ts` + `app.ts` (buildServer). Domain modules in `modules/` (preferred): `controllers/` (one kebab-case file per op) → `orchestrators/` (multi-step, rollback) → `services/` (pure logic). Flat `routes/` + `controllers/` for auth/cloudflare/user/ai. Shared `services/` (CloudflareClient, workerGenerator/Deployment/Deletion/Domain), `utils/` (encryption, jwt, resourceLock, retry), `models/` (User, LoadBalancer, Session, AiRun).

**Client** (`client/src/`): App Router pages under `app/` (landing, overview, loadbalancers CRUD, sessions, settings, login/register, onboarding); components grouped under `components/` (auth, dashboard, loadbalancers, layout, ui, shared); `contexts/AuthContext.tsx`; `lib/api.ts` (axios singleton), `lib/aiStream.ts` (SSE reader).

**Create flow**: validate → decrypt CF credentials → claim Redis name lock → CF script-name check → generate Worker from `workerTemplates/` → deploy → hostname conflict check → attach domain → Mongo insert → session record.

## Naming
| Scope | Pattern | Example |
|---|---|---|
| Module files | `kebab-case.{controller,orchestrator,service,types}.ts` | `assign-domain.controller.ts` |
| Flat controllers/routes | camelCase | `authRoutes.ts` |
| Components | `PascalCase.tsx` | `LoadBalancerCard.tsx` |
| Mongoose interfaces | `I` prefix | `IUser`, `ILoadBalancer` |
| Client lib/utils | camelCase | `cloudRegions.ts` |

## Key Concepts
### Create lock & rollback
Orchestrator claims `lb:create:{accountId}:{scriptName}` via `acquireLock` (Redis SET NX), released in `finally`. CF script PUT is an upsert, so the lock serialises same-name concurrent creates; rollback runs **only while holding the lock** (else it would delete the winning Worker). Redis down → fail open (create proceeds). Migration: drop old global index once per env — `db.loadbalancers.dropIndex('scriptName_1')`.

### Idempotency & cancellation
POST/PUT LB routes use the `fastifyIdempotency` plugin; clients send an `Idempotency-Key` header. Long ops register an `operationId` in `loadBalancerOperationStore`; `POST /operations/:id/cancel` sets a flag, and orchestrators call `cancellation.throwIfCancelled()` between steps → full rollback.

### 2FA (TOTP + Passkeys)
- Any number of named TOTP devices in `totpDevices[]`, each with its own AES-GCM encrypted secret. Remove must use a code from a **different** confirmed device; only the last device accepts its own code (that turns 2FA off).
- Codes single-use for 90s via `acquireLock('totp:used:{userId}:{code}')`; drift ±1 step; all 2FA routes STRICT rate-limited. Client `OtpInput.tsx` auto-submits on 6th digit (no submit button).
- Passkeys via `@simplewebauthn/server`. Stateless challenges ride inside the signed JWT cookie: `eb_2fa` (login) / `eb_pk_reg` (enroll). `authenticatorSelection` omits `authenticatorAttachment` (keeps USB keys + password managers), `residentKey: 'discouraged'`, `userVerification: 'preferred'`. `rpID` = CLIENT_URL hostname (`WEBAUTHN_RP_ID` overrides).
- Login symmetric: `POST /auth/google` returns `{ twoFactorRequired, methods, preferred }`; both methods share a "Try another way" control (hidden if only one method).

### AI Agent
- `POST /api/ai/generate` streams SSE events: `run_start`, `model_active`, `model_switch`, `status`, `tool_start`, `tool_result`, `done`, `error`. 3 runs per 15 min.
- Tools: `find_tools`, `list_zones`, `list_load_balancers`, `create/update/delete/pause/resume_load_balancer`. All execute for real via the REST orchestrators.
- Conversation: client owns transcript, replays as `messages` (≤30 turns × 4000 chars). Client echoes the first `runId` as `conversationId` → one `AiRun` doc per conversation (in-place `$push`+`$slice` update). Stale echo → new standalone doc.
- Safety: before `update/delete/pause/resume` the agent ends its turn with a prose confirmation (zero-tool ending = success, never RCA), calling the tool only after an explicit yes. Loading but not calling a mutating tool is a legitimate pause.
- Failures: tool fails twice → stop run; 409 conflict → stop on first attempt (never rename/re-target); final model call with `RCA_PROMPT` (no tools) writes the root-cause paragraph. Outcomes: `success` | `failure`.
- Ladder: free OpenRouter tier (quality-gated large MoE only) → Mistral (ordered by measured rps). Both via `ChatOpenAI` with different `baseURL`. `tryConsume` paces in Redis; router moves down, never waits.

### Cloudflare integration
- Required token permissions: Workers Scripts Edit, Account Analytics Read, Zone Read, DNS Edit (raw-IP origins). Optional: Workers Routes Read.
- One Cloudflare account may link to exactly one EdgeBalancer account: a deterministic HMAC-SHA256 fingerprint of the account ID (`cloudflareAccountHash`, sparse-unique) + a pre-save 409 check on both the manual and OAuth connect paths. Disconnecting OAuth clears the fingerprint. Backfill existing users before the unique index builds.
- Hostname conflict check (`assertHostnameAvailable`) = Custom Domains + Worker Routes. Custom Domain silently beats a Route over the same hostname; `*` wildcards matched, path ignored; routes with no `script` are bypass rules (not conflicts). Route check skipped (warning, never error) on 403/404 or missing zoneId.
- Updates use Worker Versions + Deployments API (not script re-deploy); hostname change = detach → re-attach. KV not used or bound.

### Sessions (history)
Every successful create/edit saves a `Session` with the full Worker JS + config snapshot. Immutable logs — marked `isActive: false` on update/delete, never edited.

## Verification (run before ship)
Client:
```bash
cd client && npx tsc --noEmit && npm test -- --runInBand
```
Server:
```bash
cd server && npx tsc --ignoreDeprecations 6.0 --noEmit && npm run build && npm test
```
Test notes:
- Client tests require `--runInBand`; Cloudflare + Firebase mocked.
- Server tests are integration: real MongoDB via `mongodb-memory-server`, Redis mocked. Two users in one test must get distinct `firebaseUid` values (unique index — nulls collide).
- AI tests need no API keys and make no network calls (provider + router services mocked; `/api/ai/generate` never exercised).
- Worker generator tests are unit-level per strategy template.

## Sync Rules
- AGENTS.md ↔ root CLAUDE.md must remain byte-identical mirrors — never update one without the other.
- Keep this file under 300 lines.

## graphify
Knowledge graph at `graphify-out/`.
- Default codebase search: `graphify query "<question>"` — before any grep/glob/file-read; fall back to raw search only when it returns nothing.
- Read `graphify-out/GRAPH_REPORT.md` for god nodes/communities before architecture questions; navigate `graphify-out/wiki/index.md` if present.
- After modifying code files: `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"`