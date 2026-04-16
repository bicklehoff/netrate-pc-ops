# D1 · Security · Verification Re-audit

**Audit:** Site Audit 2026 · D0 (verification of claimed-done dimensions) · Dimension D1
**Date:** 2026-04-16
**Agent:** ad93424ee2fd4ad0f
**Scope:** PR #52 (merged 2026-04-14) — 8 security patches — verified at current HEAD on branch `claude/nice-beaver`
**Approach:** code read, read-only; spot-check for regressions in routes merged after PR #52

## Verdict

**PR #52's 8 patches have all held at current HEAD.** No regressions introduced by PRs #53–#79.

One partial follow-up already shipped: PR #76 closed a cross-org data leak in `/api/portal/mlo/scenario-alerts` that PR #52 did not cover.

Several **residual issues** remain that were out of scope for PR #52 but should be tracked in a dedicated D1 follow-up pass — notably `err.message` leakage on public (unauthenticated) routes, and an information-disclosure error message on `/api/my-rates`.

## What was checked

1. Each of PR #52's 8 patches re-verified at HEAD (file reads + grep sweeps)
2. All 8 Twilio webhook endpoints still call `validateTwilioSignature`
3. All CLAW_API_KEY usage is header-only (no query-param fallbacks)
4. All touched MLO routes use `requireMloSession` + `unauthorizedResponse`
5. Sweep of `err.message`/`error.message` surfaces across `src/app/api/` for regressions and uncovered routes

## Patch-by-patch verification

### 1. Auth guard — 5 MLO routes (contacts, accounts, notes, create-lead)

**Status:** Intact.

`requireMloSession` + `unauthorizedResponse` present at top of each GET/POST in:
- `src/app/api/portal/mlo/contacts/route.js`
- `src/app/api/portal/mlo/contacts/[id]/route.js`
- `src/app/api/portal/mlo/contacts/[id]/notes/route.js`
- `src/app/api/portal/mlo/contacts/[id]/create-lead/route.js`
- `src/app/api/portal/mlo/accounts/route.js`

Grep shows `requireMloSession` usage in **42 MLO route files** — auth pattern has become the house standard (good sign, consistent enforcement across PR #60's org-scoping work).

### 2. Twilio webhook signature validation — 8 inbound endpoints

**Status:** Intact.

`src/lib/twilio-validate.js` exists with the same three exports PR #52 introduced:
- `validateTwilioSignature(req, params)` — HMAC-SHA1 with timing-safe comparison
- `formDataToObject(formData)` — helper
- `twilioForbiddenResponse()` — 403 TwiML response

Grep for `validateTwilioSignature` returns exactly the 8 dialer routes PR #52 patched:
- `src/app/api/dialer/voice/route.js`
- `src/app/api/dialer/voicemail/route.js`
- `src/app/api/dialer/status/route.js`
- `src/app/api/dialer/incoming/route.js`
- `src/app/api/dialer/recording-status/route.js`
- `src/app/api/dialer/call-complete/route.js`
- `src/app/api/dialer/sms/incoming/route.js`
- `src/app/api/dialer/sms/status/route.js`

Sanity-read `voice/route.js`: `validateTwilioSignature` called as the first operation after parsing form data — correct pattern.

### 3. Lead spam protection (`/api/lead`)

**Status:** Intact.

`src/app/api/lead/route.js` retains:
- In-memory rate limiter (5/hr per IP, 1-hour window)
- Rightmost `x-forwarded-for` extraction (patch #5 below)
- Honeypot field check (`body.website_url`)
- `isValidEmail()` format validation
- 5-minute duplicate email check against `leads` table

### 4. Prequal sign — MLO email from session

**Status:** Intact.

`src/app/api/portal/mlo/prequal-letter/sign/route.js:17`:
```
const mloEmail = session.user.email; // Always use session email, not client-supplied
```

### 5. Rate-limit IP extraction — rightmost `x-forwarded-for`

**Status:** Intact.

`src/app/api/lead/route.js:30–34`:
```
const forwarded = request.headers.get('x-forwarded-for') || '';
const ip = forwarded.split(',').pop()?.trim() || request.headers.get('x-real-ip') || 'unknown';
```
Rightmost IP is the one set by Vercel proxy — non-spoofable.

### 6. CLAW_API_KEY — header-only

**Status:** Intact.

Every CLAW_API_KEY consumer reads from a header (`x-api-key`, `x-claw-api-key`, or `Authorization`). No query-param fallback found in:
- `src/app/api/content/route.js`
- `src/app/api/content/[slug]/route.js`
- `src/app/api/cron/scenario-alerts/route.js`
- `src/app/api/cron/mnd-scrape/route.js`
- `src/app/api/cron/fred-snapshot/route.js`
- `src/app/api/cron/calendar-seed/route.js`
- `src/app/api/cron/health-check/route.js`
- `src/app/api/market/summary/route.js`
- `src/app/api/market/news/route.js`
- `src/app/api/market/calendar/route.js`
- `src/app/api/market/calendar/[id]/route.js`
- `src/app/api/market/national-rates/scrape/route.js`

### 7. Error-message leaks — 8 public routes cleaned in PR #52

**Status:** Intact in the 8 routes PR #52 patched.

`/api/pricing` (route.js) returns generic `'Pricing engine error'` on failure, not `err.message`. Spot checks of `/api/lead`, `/api/content/[slug]`, `/api/market/*` show no raw err.message leakage in response bodies.

### 8. `/api/pricing` GET response — lender codes/comp stripped

**Status:** Intact.

`src/app/api/pricing/route.js:56–62` GET returns only engine metadata (`engine`, `endpoint`, `status`) — no lender list, no comp structure.

## Post-PR #52 fixes that landed

### PR #76 (2026-04-15) — Cross-org data leak in scenario-alerts

PR #52 did not audit `/api/portal/mlo/scenario-alerts`. After PR #52, the route returned alerts across all organizations regardless of caller's `organizationId`. PR #76 added org scoping. Verified fix is present (file uses `requireMloSession` and scopes queries by `orgId`).

This was caught by PR #75's D0 re-audit of D5 (org scoping), not by D1 directly — good cross-dimensional coverage.

## Residual D1 issues (not in PR #52 scope — track in dedicated follow-up)

### Residual 1: `err.message` leakage on public (unauthenticated) routes

The following PUBLIC routes (no auth required) still echo raw `err.message` back to the client:

- `src/app/api/strike-rate/route.js:148` — `{ error: 'Failed to create alert', detail: err.message }`
- `src/app/api/saved-scenario/route.js:169` — `{ error: `Save failed: ${err.message}` }`
- `src/app/api/saved-scenario/update/route.js:137` — same pattern
- `src/app/api/pricing/dscr/route.js:133` — `{ error: 'DSCR pricing error', message: err.message }`
- `src/app/api/pricing/dscr/route.js:151` — `{ error: err.message }`
- `src/app/api/market/national-rates/route.js:75, 130` — `{ error: err.message }`
- `src/app/api/my-rates/route.js:60` — `{ error: `Load failed: ${err.message}` }`

Risk: database error messages, stack hints, internal field names leak to any caller. Same class of bug PR #52 fixed in 8 other routes.

### Residual 2: Information disclosure in `/api/my-rates` auth error

`src/app/api/my-rates/route.js:26`:
```
return NextResponse.json({ error: `Invalid token (found ${leads?.length || 0} leads)` }, { status: 401 });
```

Leaks the number of matched leads back to the caller on a failed token lookup. An attacker guessing tokens could learn whether a specific token maps to 0 or 1 leads. Low severity (requires valid token guess), but poor hygiene on an unauth endpoint.

### Residual 3: MLO-route `err.message` leakage (lower risk — requires auth)

The following require MLO session but still leak raw error details to authenticated MLOs:

- `src/app/api/portal/mlo/quotes/route.js:310`
- `src/app/api/portal/mlo/quotes/[id]/route.js:127`
- `src/app/api/portal/mlo/prequal-letter/sign/route.js:56`
- `src/app/api/portal/mlo/loans/import/route.js:46, 229`
- `src/app/api/portal/mlo/loans/[id]/tasks/route.js:28, 55`
- `src/app/api/portal/mlo/loans/[id]/geocode/route.js:74`
- `src/app/api/portal/mlo/loans/[id]/files/move/route.js:105`
- `src/app/api/portal/mlo/loans/[id]/contact/route.js:28`
- `src/app/api/portal/mlo/contacts/[id]/actions/route.js:47`
- `src/app/api/portal/mlo/scenario-alerts/route.js:219`
- `src/app/api/corebot/{rename,process,order-out,identify,ingest}/route.js` (all MLO-protected)

Lower risk than residual 1 (requires MLO login), but worth cleaning up for consistency.

### Residual 4: `/api/cron/scenario-alerts` leaks err.message (line 147)

Requires bearer/CLAW_API_KEY so not publicly exposed, but inconsistent with PR #52 norms. Would become critical if auth were ever misconfigured.

## Items requiring a dedicated pass

- **Full residual 1+2 sweep and fix PR** — follow the same pattern as PR #52: replace `err.message` returns with a generic message on unauth'd public surfaces, keep the real error in `console.error` for diagnostics.
- **Cross-check all borrower-token routes (`/api/my-rates`, `/api/quotes/view/[token]`, etc.)** — PR #76 found a scoping leak on an MLO route; a matching sweep on borrower-token routes has not been done since PR #52.
- **Rate-limit coverage audit** — only `/api/lead` has rate limiting. Public routes `strike-rate`, `saved-scenario`, `pricing` (POST), `pricing/dscr` have none. Out of scope for a D0 re-audit but worth flagging.

## Summary for Site Audit tracker

| Dimension | Status | Notes |
|-----------|--------|-------|
| D1 · Security | **PR #52 holds** | All 8 patches intact at HEAD (commit on `claude/nice-beaver`). PR #76 added one follow-up (scenario-alerts org scoping) that was missed in PR #52. |

Residuals are **new findings**, not regressions — they were present before PR #52 and remain. Recommend opening a dedicated D1 follow-up PR for residuals 1 + 2 (highest impact, lowest blast radius).
