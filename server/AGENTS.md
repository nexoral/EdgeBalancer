# server/ — EdgeBalancer Backend (Agent Instructions)

<subsystem_role>
Global rules, security invariants, and Ponytail principles live in [../AGENTS.md](../AGENTS.md). Read the root first.

**Role** — Fastify 5 REST API & Cloudflare Worker orchestrator. TS strict, Mongoose, Redis lock manager, BullMQ, LangChain AI agent loop, and WebAuthn server.
</subsystem_role>

<directory_map>
## Directory Map

* **`src/index.ts` & `src/app.ts`** — Fastify bootstrap, plugin registration, and server lifecycle
* **`src/modules/`** — Domain modules (preferred architectural pattern)
  * `controllers/` (one kebab-case file per op: `assign-domain.controller.ts`)
  * `orchestrators/` (multi-step operations with full rollback semantics: `create-load-balancer.orchestrator.ts`)
  * `services/` (pure business logic)
* **`src/routes/` & `src/controllers/`** — Flat legacy routes for auth, cloudflare, user, and AI
* **`src/services/`** — Shared operational services
  * `CloudflareClient.ts` (AES decrypts token, wraps CF API v4)
  * `workerGenerator/` (Compiles Worker JS from `workerTemplates/`)
  * `workerDeployment.service.ts`, `workerDeletion.service.ts`, `workerDomain.service.ts`
  * `totpService.ts` (`hasTotp()` is single source of truth for 2FA state)
  * `compaction.service.ts` (Surgical AI context compaction)
* **`src/models/`** — Mongoose data models
  * `User.ts`, `LoadBalancer.ts`, `Session.ts` (immutable deploy histories), `AiRun.ts`
* **`src/utils/`** — Cryptography and resilience
  * `encryption.ts` (AES-256-GCM, fail-fast on non-64-hex key)
  * `jwt.ts`, `resourceLock.ts` (`acquireLock` via Redis SET NX), `retry.ts`
</directory_map>

<hard_rules>
## Hard Rules

* **Create Lock & Rollback Invariants**:
  * Claim `lb:create:{accountId}:{scriptName}` via `acquireLock` (Redis SET NX); release in `finally`.
  * Rollback runs **only while holding the lock** to prevent deleting winning concurrent Workers. Fail-open if Redis is down.
* **Credentials & Encryption**:
  * AES-256-GCM encrypted at rest (IV + GCM tag stored alongside ciphertext).
  * `ENCRYPTION_KEY` must be exactly 64 hex characters — fail fast at boot if invalid.
* **Idempotency & Cancellation**:
  * POST/PUT LB routes must pass through `fastifyIdempotency`.
  * Multi-step orchestrators must check `cancellation.throwIfCancelled()` between external steps.
* **Cloudflare API Invariants**:
  * Single CF account maps to single EB user via HMAC-SHA256 fingerprint (`cloudflareAccountHash`).
  * Custom Domains silently beat Routes on hostname conflicts; bypass routes without scripts are ignored.
  * Updates must use Worker Versions + Deployments API (not full script re-deploy).
* **AI Tool Execution**:
  * Destructive AI tools execute for real by calling the exact same orchestrators as REST routes.
  * Stop runs immediately on 409 conflict; stop on second tool failure.
</hard_rules>

<commands>
## Commands (from server/)

```bash
npx tsc --ignoreDeprecations 6.0 --noEmit   # Type check (mandatory)
npm run build                              # Compile tsc & copy workerTemplates
npm test                                   # Integration tests (in-memory Mongo, mocked Redis)
```
</commands>

<done_checklist>
## Done Checklist

- [ ] `npx tsc --ignoreDeprecations 6.0 --noEmit` clean
- [ ] `npm run build` succeeds
- [ ] Integration tests pass (`npm test`)
- [ ] Rollback and cancellation paths verified for multi-step mutations
- [ ] Sensitive tokens never logged in plaintext or error traces
</done_checklist>
