# Zoho OAuth Substrate — Design Note

**Status:** Draft for review
**Author:** PC Dev
**Date:** 2026-04-24
**Tier:** 3 (cross-cutting, multi-consumer, will be coupled to)

## Context

PC currently has 3 active Zoho integrations and is about to add a 4th (Bookings, per Claw relay `relay_modh5ox8988pb1kc`). Each existing integration ships its own copy of the OAuth refresh-token plumbing — ~50 LOC of nearly identical code in 4 files (3 active, 1 stale + 1 orphaned dead).

Current state (pre-substrate):

| File | Status | Refresh code | Cache | Mutex | Errors |
|---|---|---|---|---|---|
| `src/lib/zoho-workdrive.js` | Active | Lines 24–68 | In-mem 50min | None | Untyped |
| `src/lib/zoho-sign.js` | Active | Lines 12–51 | In-mem 50min | None | Untyped |
| `src/lib/zoho-voice.js` | Orphaned (delete) | Lines 8–35 | None | None | Untyped |
| `src/lib/zoho-bookings.js` | Stale (delete) | Lines 17–56 | In-mem 50min | None | Untyped |

The 4th integration (Bookings v2) per Claw's spec needs **Vercel KV cache** + **mutex against refresh stampede**. Adding that to a 4th standalone client would entrench the divergence. David's four-tier framework: when you're building the second (or fourth) of something similar, that's a tier-upgrade trigger.

This note specifies a shared `lib/zoho/oauth.js` substrate that all Zoho clients use, with Bookings as the first consumer and the 2 active legacy clients retrofitted in the same PR.

## Goals

1. Single source of truth for Zoho OAuth refresh.
2. KV-backed token cache (survives Lambda cold starts; in-process cache lost across instances).
3. Refresh-stampede protection (in-process Promise dedup; see trade-offs).
4. Typed errors so route handlers can map to HTTP status codes consistently.
5. Migration path: ~5-line diff per existing consumer.

## Non-goals

- Cross-instance distributed mutex via KV `setnx` (deferred — see trade-off #2).
- Migrating existing consumers from `.js` → `.ts` (out of scope; new files only).
- Replacing `twilio-voice.js` or any non-Zoho integration.
- Generic "OAuth substrate" abstraction across non-Zoho providers (YAGNI).

## API

```ts
// src/lib/zoho/oauth.ts

export interface ZohoTokenOptions {
  /** Env var name holding the refresh token, e.g. 'ZOHO_REFRESH_TOKEN' */
  refreshTokenEnv: string;
  /** Cache TTL in minutes; default 55 (Zoho tokens expire at 60min). */
  ttlMinutes?: number;
  /** Bypass cache and force a fresh refresh — use after a 401 from Zoho. */
  forceRefresh?: boolean;
}

export class ZohoOAuthError extends Error {
  constructor(
    message: string,
    public readonly httpStatus?: number,
    public readonly code?: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'ZohoOAuthError';
  }
}

/**
 * Get a valid Zoho access token. KV-cached for ttlMinutes; dedupes concurrent
 * refreshes within a single Lambda instance.
 *
 * @throws ZohoOAuthError on missing config, network error, or refresh failure.
 */
export async function getZohoToken(opts: ZohoTokenOptions): Promise<string>;
```

**Why direct function (not class/factory):** Each call site already knows its env var. No setup ceremony. Easy to mock in tests by overriding the import.

## Cache key strategy

Cache key derived from env var name: `zoho:oauth:{refreshTokenEnv}`.

| Env var | KV key |
|---|---|
| `ZOHO_REFRESH_TOKEN` | `zoho:oauth:ZOHO_REFRESH_TOKEN` |
| `ZOHO_WORKDRIVE_REFRESH_TOKEN` | `zoho:oauth:ZOHO_WORKDRIVE_REFRESH_TOKEN` |
| `ZOHO_SIGN_REFRESH_TOKEN` | `zoho:oauth:ZOHO_SIGN_REFRESH_TOKEN` |

Stored value: `{ token: string, expiresAt: number }` JSON. KV entry TTL set to `ttlMinutes * 60` so KV auto-evicts stale entries; we re-verify `expiresAt` on read for safety.

## Mutex strategy (refresh stampede)

**Chosen:** in-process Promise dedup. When a refresh is in flight, concurrent callers within the same Lambda instance `await` the same Promise.

```ts
const inflight = new Map<string, Promise<string>>();
// ... in refresh path:
if (inflight.has(cacheKey)) return inflight.get(cacheKey)!;
const p = doRefresh(...);
inflight.set(cacheKey, p);
try { return await p; } finally { inflight.delete(cacheKey); }
```

**Why not cross-instance KV mutex (`setnx` lock):** Vercel cold-start fan-out can spawn N instances simultaneously, each missing the cache. KV mutex would serialize them, but adds polling latency (50–200ms) and edge cases (lock held by crashed instance). The actual cost of stampede is N wasted refresh calls, not failures — Zoho's refresh endpoint isn't rate-limited harshly. **Trade-off captured below; revisit if production logs show stampede pain.**

## Error type hierarchy

Single class `ZohoOAuthError` with discriminated state via `httpStatus` + `code`:

| Scenario | `httpStatus` | `code` | `message` |
|---|---|---|---|
| Missing env var | `undefined` | `'config_missing'` | "ZOHO_*_REFRESH_TOKEN not configured" |
| Network/fetch failure | `undefined` | `'network'` | "Zoho token refresh failed: <fetch error>" |
| HTTP non-2xx from Zoho | `<status>` | `'http'` | "Zoho refresh returned <status>" |
| 200 OK but error body | `200` | `<zoho code>` | "Zoho refresh API error: <details>" |

Routes can `if (e instanceof ZohoOAuthError && e.httpStatus === 401)` — bubble as `apiError(503, 'Auth refresh failed')`. Sentry/monitoring groups by `code`.

## Migration shape (per active consumer)

Before (representative — `zoho-workdrive.js`):

```js
let cachedToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  const refreshToken = process.env.ZOHO_WORKDRIVE_REFRESH_TOKEN;
  if (!refreshToken) throw new Error('ZOHO_WORKDRIVE_REFRESH_TOKEN not configured');
  const params = new URLSearchParams({ /* ... */ });
  const res = await fetch('https://accounts.zoho.com/oauth/v2/token', { method: 'POST', body: params });
  if (!res.ok) throw new Error(`Zoho token refresh failed: ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(`Zoho token error: ${data.error}`);
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + 50 * 60 * 1000;
  return cachedToken;
}
```

After:

```js
import { getZohoToken } from '@/lib/zoho/oauth';

async function getAccessToken() {
  return getZohoToken({ refreshTokenEnv: 'ZOHO_WORKDRIVE_REFRESH_TOKEN' });
}
```

Net: ~30 LOC removed per consumer, single helper retained for site-local naming.

## Tier 3 testing plan

Per the four-tier framework: **parity checks span the abstraction's surface area**. Not unit tests for unit testing's sake.

1. **Build passes** with no type errors after retrofit.
2. **Smoke test against production Zoho Mail/WorkDrive/Sign:**
   - `getZohoToken({ refreshTokenEnv: 'ZOHO_WORKDRIVE_REFRESH_TOKEN' })` returns a token (length > 50, starts with `1000.`).
   - Calling `listFolder()` (existing WorkDrive route) succeeds end-to-end.
   - Calling Sign upload (existing route) succeeds end-to-end.
3. **Cache verification:** second call within 55 min returns cached token (no Zoho API hit). Verify via Vercel function logs.
4. **Stampede simulation:** trigger 5 concurrent calls in the same Lambda; expect 1 Zoho refresh call, 5 successful returns.
5. **Cold-state behavior:** delete KV cache key, call once, confirm fresh refresh + KV write.

Tests live in `scripts/test-zoho-oauth.mjs` (similar to existing `_test-*.mjs` convention). Manual run during PR; not blocking CI.

## Out of scope / deferred (with done-criteria)

| Item | Done-criteria | When |
|---|---|---|
| Cross-instance KV mutex | Trigger: PR 1's stampede `console.warn` shows ≥ 5 suppression events / minute sustained for ≥ 24h in Vercel function logs (search Vercel logs for `[zoho-oauth] stampede suppressed`). Implement as `setnx` lock with 30s TTL + polling at that point. | Reactive — self-triggered by built-in instrumentation |
| `zoho-voice.js` deletion | File removed; no imports remain. Currently orphaned (zero importers) so trivially deletable in PR 1. | PR 1 (this work) |
| `zoho-bookings.js` (stale) deletion | File removed; 2 callers (`api/bookings/slots`, `api/bookings/book`) removed; no broken imports remain. | PR 1 (this work) |
| `ZOHO_BOOKINGS_REFRESH_TOKEN` env retirement | Vercel env var deleted across all 3 targets (production/preview/development); confirm `git grep ZOHO_BOOKINGS_REFRESH_TOKEN` returns zero matches. | PR 2 (after new bookings client confirmed working with `ZOHO_REFRESH_TOKEN`) |

## Trade-offs (numbered)

1. **Direct function over class/factory.** Lower ergonomic overhead at call sites (no `new ZohoOAuth(...)` boilerplate); worse if many consumers want different defaults. Acceptable because consumer count is bounded (~3) and per-call options cover the variation.
2. **In-process dedup over KV mutex.** Simpler, lower latency, no edge cases around stale locks. Cost: cold-start fan-out causes N wasted refreshes. We accept this cost; Zoho refresh isn't precious. **Active stampede instrumentation built in (PR 1):** the dedup map emits `console.warn` (visible in Vercel function logs) every time a concurrent refresh is suppressed, including cache key + per-process suppression count. Converts the deferred KV-mutex item from passive "we'll watch the logs" into an actively-triggered follow-up. See deferred table below for done-criteria.
3. **`.js` with JSDoc (not `.ts`).** Codebase has no `tsconfig.json` (only `jsconfig.json` with path aliases) and `src/lib/` is uniformly `.js`. Bootstrapping TypeScript for one file would be the kind of scope creep the framework warns against. JSDoc gives ~80% of TS's IDE benefits without the infrastructure tax. Original Claw spec said `.ts` — overridden because Claw didn't know our project setup. If TS migration happens project-wide later, this file is trivial to convert (mechanical, no type debt accumulated).
4. **No `lib/zoho/index.ts` re-export barrel.** Direct import path `@/lib/zoho/oauth` is explicit and tree-shakable. Adds 1 directory level vs current flat `lib/zoho-*.js`.
5. **No retry-with-backoff in the substrate.** Zoho refresh failures are mostly config/permanent. Caller can call `getZohoToken({ forceRefresh: true })` once on a 401 from a downstream API call. Retry loops belong in higher layers.

## Migration order in PR 1

1. Add `src/lib/zoho/oauth.js` (substrate + tests + stampede counter with `console.warn` on suppression).
2. Retrofit `zoho-workdrive.js` (single import + 5-line `getAccessToken`).
3. Retrofit `zoho-sign.js` (same shape).
4. Delete `zoho-voice.js` (orphaned).
5. Delete `zoho-bookings.js` + `src/app/api/bookings/slots/route.js` + `src/app/api/bookings/book/route.js`.
6. Smoke test WorkDrive + Sign on prod via existing routes.
7. Open PR with this design note linked in the description.

## References

- David's four-tier framework (this conversation, 2026-04-24)
- Claw relay `relay_modh5ox8988pb1kc` — Phase 0 complete + env values
- Claw relay `relay_mod5wravdehcpl2l` — full booking widget brief (acceptance criteria, gotchas)
- `Work/Dev/CLAUDE.md` — Tier 3 rigor expectations
- Zoho OAuth docs — `https://www.zoho.com/accounts/protocol/oauth/web-server-applications.html`
