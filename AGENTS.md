# EdgeBalancer — Agent Instructions

<system_overview>
**EdgeBalancer** — SaaS control plane for deploying and managing Cloudflare Worker-based load balancers without writing Worker code. Users connect a Cloudflare account, configure origins + routing strategy, and EdgeBalancer generates, deploys, and manages Cloudflare Workers via the Cloudflare API v4.

> For the full system architecture, zero-grep directory map, and anti-hallucination context, read [ARCHITECTURE.md](ARCHITECTURE.md).
</system_overview>

<subsystems_map>
## Subsystems & Scoped Guides

When working in a subsystem, read its scoped `AGENTS.md` for local rules and architecture:

* **`client/`** — Frontend control plane ([client/AGENTS.md](client/AGENTS.md))
  * Next.js 16 (App Router), React 19, TS strict, Tailwind v4, SSE reader, WebAuthn passkeys
* **`server/`** — Backend REST API & Worker orchestrator ([server/AGENTS.md](server/AGENTS.md))
  * Fastify 5, TS strict, Mongoose, Redis rollback locks, Cloudflare Worker generator/deployer
* **`k8s/`** — Production Kubernetes manifests
  * Deployment and service definitions
</subsystems_map>

<constraints>
## Constraints — never violate

* **Cloudflare API server-only**: Never call CF APIs from the client. All calls route via Fastify backend with httpOnly cookies (`withCredentials: true`).
* **Credentials AES-256-GCM**: Cloudflare tokens encrypted at rest. IV + GCM tag stored alongside. `ENCRYPTION_KEY` must be exactly 64 hex chars — fail fast otherwise.
* **Auth**: Firebase OAuth (Google + GitHub) → JWT in httpOnly cookie (24h). Identity anchor is Firebase `uid`. 2FA challenge tokens carry `stage` and `authenticate` rejects any token with `stage`.
* **LB Names**: 3–50 chars, lowercase + hyphens, locked after creation. `scriptName` derived from name, unique per user (`{userId, scriptName}`).
* **2FA**: Authenticator TOTP + WebAuthn passkeys only. 2FA is on iff ≥1 confirmed device (`hasTotp()` is single source of truth). Single-use TOTP lock 90s.
* **Cloudflare Link**: One CF account per EdgeBalancer account (`cloudflareAccountHash` sparse-unique).
* **Worker Updates**: Use Worker Versions + Deployments API (not script re-deploy). Hostname change = detach → re-attach.
* **AI Tool Execution**: Destructive AI tools execute for real via the exact same REST orchestrators (identical rollback).
</constraints>

<rules>
## Rules — non-negotiable

1. **Code Decision Ladder**: Before writing code, evaluate in order:
   (1) Does it need to exist? (2) Already in this codebase? (3) Standard lib / platform native? (4) Already-installed dep — never add a dep for a few lines. (5) One line? Write one line. (6) Otherwise: minimum code that works.
2. **Deletion beats addition**: Keep values in the form the platform already gives — no unnecessary conversions or wrappers.
3. **Map scope before writing**: List every place your change must reach (callers, tests, fixtures, config, exports) and what it could break. That is scope. Extra features are not.
4. **Bug fix protocol**: Grep every caller of the touched function first, fix the root cause once in shared code — never patch each callsite separately.
5. **Safeguards preserved**: Code moved or merged keeps its error handling and validation — never silently drop safeguards.
6. **Hard safety floor**: Never lazy about validation at trust boundaries, error handling that prevents data loss, security, or anything the user asked for.
7. **Edge cases**: Between options of equal size, take the one correct on edge cases.
8. **Tests with new logic**: New non-trivial logic (branch, loop, parser, security, whole new script) leaves one small test or assert-based self-check.
9. **No unnecessary comments**: Code must be self-explanatory. The only exception: `// ponytail: <ceiling> — <upgrade path>` to mark deliberate shortcuts.
10. **Reply discipline**: End every implementation reply with 1–2 lines: what was skipped/not checked + any risk the user must know.
</rules>

<code_standards>
## Code standards

* **API contract**: All REST responses follow `{ success, data, message }`.
* **Naming**:
  * Module files: `kebab-case.{controller,orchestrator,service,types}.ts`
  * Flat routes/controllers: `camelCase.ts`
  * React components: `PascalCase.tsx`
  * Mongoose interfaces: `I` prefix (`IUser`, `ILoadBalancer`)
* **Create lock & rollback**: Orchestrators claim `lb:create:{accountId}:{scriptName}` via Redis SET NX. Rollback runs **only while holding the lock**.
* **Idempotency**: POST/PUT routes use `fastifyIdempotency` with `Idempotency-Key` header. Check `cancellation.throwIfCancelled()` between multi-step operations.
* **Sessions (history)**: Every successful create/edit saves an immutable `Session` snapshot. Set `isActive: false` on update/delete, never edit in place.

## Don't (anti-patterns)

```ts
// ❌ Never call Cloudflare API from client — all calls route via Fastify backend
axios.get('https://api.cloudflare.com/client/v4/...');
// ❌ Never mutate Workers without holding the Redis name lock
await cloudflareClient.deployWorker(scriptName, code);
// ❌ Never edit Session snapshots in-place — mark isActive: false and create new
await Session.findByIdAndUpdate(id, { $set: newConfig });
// ❌ Never hardcode ENCRYPTION_KEY length checks loosely — must fail fast on !== 64 hex chars
```
</code_standards>

<testing_and_verification>
## Verification (run before ship)

```bash
# Client
cd client && npx tsc --noEmit && npm test -- --runInBand

# Server
cd server && npx tsc --ignoreDeprecations 6.0 --noEmit && npm run build && npm test
```

## Graphify Knowledge Graph
After modifying code files in this session, keep graph current:
```bash
python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"
```
</testing_and_verification>

<governance>
## Ask before action

Always ask user permission before:
* `git commit` or `git push` — confirm message, branch, and remote.
* Dropping MongoDB collections or indexes (e.g. `dropIndex`).
* Deploying Cloudflare Workers to live production outside automated test mocks.
* Spawning autonomous subagents for exploratory tasks.

Do NOT ask permission for:
* `npx tsc --noEmit` or `npm run build` — run immediately to verify changes.
* Running unit or scoped integration tests (`npm test`).
* Codebase searches (`graphify query`, grep, reading files).

## Subagent delegation (when approved)

When user approves deploying subagents:
1. Subagent must read the target subsystem's `AGENTS.md` before starting work.
2. Root DOs & DON'Ts summary.
3. Pointer to [ARCHITECTURE.md](ARCHITECTURE.md) for full system architecture and zero-grep directory maps.
4. Scope boundary: Subagents may only read code, edit files, and run typecheck/build verification.
5. Prohibited actions: Subagents must NOT execute `git commit`, `git push`, live Cloudflare mutations, or database migrations. Subagents report completed file diffs back to the parent agent.

## Never assume

* Clarify operational requirements mid-task rather than guessing — wrong assumptions waste time.
* Never forge challenge tokens or bypass trust boundaries.

## Git

* Commits: conventional format (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`).
* One logical change per commit.
</governance>

<done_checklist>
## Done checklist

- [ ] `tsc --noEmit` passes clean (client + server)
- [ ] `npm run build` passes on server
- [ ] Tests pass (`npm test`)
- [ ] No regression in rollback or cancellation paths
- [ ] Ponytail decision ladder followed (deletion > addition, minimal code)
- [ ] Error handling and trust boundaries intact
- [ ] Graphify rebuild executed if code changed
- [ ] Implementation reply ends with skipped items & risks
</done_checklist>
