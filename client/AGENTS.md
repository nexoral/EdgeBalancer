# client/ — EdgeBalancer Frontend (Agent Instructions)

<subsystem_role>
Global rules, security invariants, and Ponytail principles live in [../AGENTS.md](../AGENTS.md). Read the root first.

**Role** — Next.js 16 (App Router), React 19, TypeScript strict, Tailwind CSS v4, Framer Motion. Handles the user control plane, live AI streaming modal, 2FA/Passkeys authentication flows, and load balancer management dashboards.
</subsystem_role>

<directory_map>
## Directory Map

* **`src/app/`** — Next.js App Router pages
  * `(auth)/login/`, `(auth)/register/` (307 redirect to login), `overview/`, `loadbalancers/`, `sessions/`, `settings/`, `onboarding/`
* **`src/components/`** — React components
  * `auth/` (`OtpInput.tsx` auto-submits on 6th digit, WebAuthn triggers)
  * `dashboard/` (Metrics, overview charts, health indicators)
  * `loadbalancers/` (CRUD forms, Strategy selector, Origin inputs)
  * `layout/` (`Sidebar.tsx`, `Navbar.tsx`, page wrappers)
  * `ui/` (`AiAgentModal.tsx` SSE streaming modal, isolated `AiReplyInput`)
  * `shared/` (Modals, badges, buttons, tooltips)
* **`src/contexts/`** — Client state & authentication
  * `AuthContext.tsx` — Firebase OAuth + session management with httpOnly cookie sync
* **`src/lib/`** — Shared client utilities
  * `api.ts` — Axios singleton (`withCredentials: true`, uses `NEXT_PUBLIC_API_URL`)
  * `aiStream.ts` — SSE reader for AI agent streaming events
  * `cloudRegions.ts` — Region mappings and Cloudflare datacenter metadata
</directory_map>

<hard_rules>
## Hard Rules

* **Server-Only Cloudflare**: Never make Cloudflare API calls from the client. All operations go through backend routes via `api.ts`.
* **Cookie Auth**: Always use `withCredentials: true`. Never attempt to store auth JWTs in `localStorage` or `sessionStorage`.
* **Isolated AI State**: Keep `AiReplyInput` state strictly isolated to prevent re-rendering `AiAgentModal` and causing backdrop blur lag.
* **Passkey / 2FA**:
  * Use `@simplewebauthn/browser` for passkey challenges.
  * In `OtpInput.tsx`, auto-submit strictly on the 6th digit; do not render a manual submit button.
* **Component Architecture**:
  * PascalCase for components (`LoadBalancerCard.tsx`).
  * Avoid heavy client component wrappers around static pages; leverage Server Components where applicable.
</hard_rules>

<commands>
## Commands (from client/)

```bash
npx tsc --noEmit                    # Type check (mandatory before done)
npm test -- --runInBand             # Jest test suite (Cloudflare + Firebase mocked)
npm run dev                         # Local development server
```
</commands>

<done_checklist>
## Done Checklist

- [ ] `npx tsc --noEmit` passes clean with zero errors
- [ ] `npm test -- --runInBand` passes
- [ ] No direct Cloudflare or third-party credential access in client code
- [ ] Auth state and cookie synchronization preserved
</done_checklist>
