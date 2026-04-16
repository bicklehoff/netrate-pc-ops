# D8 Pass 7 — Scheduled Tasks / Cron / Ingest Inventory

**Audit:** Site Audit 2026 · Dimension 8 (Static data / stale-by-deploy) · Pass 7
**Date:** 2026-04-16
**Produced by:** PC Dev agent (codebase inventory pass)
**Status:** Complete. Findings ready for driver review.
**Scope:** All cron routes (`src/app/api/cron/**`), GitHub Actions (`/.github/workflows/**`), and ingest scripts (`scripts/**`) that drive scheduled data updates.

---

## 1. Scope — Identified Scheduled Jobs

| Type | Path | Schedule | Triggered By | Status |
|------|------|----------|--------------|--------|
| **Vercel Cron** | `/api/cron/fred-snapshot` | `0 23 * * 1-5` (11 PM UTC = 5 PM MT daily weekdays) | `vercel.json` | ✓ Examined |
| **Vercel Cron** | `/api/cron/health-check` | `0 14 * * 1-5` (2 PM UTC = 8 AM MT daily weekdays) | `vercel.json` | ✓ Examined |
| **Vercel Cron** | `/api/cron/calendar-seed` | `0 8 * * 1` (8 AM UTC = 2 AM MT Mondays) | `vercel.json` | ✓ Examined |
| **Vercel Cron** | `/api/cron/scenario-alerts` | `0 13 * * 1-5` (1 PM UTC = 7 AM MT daily weekdays) | `vercel.json` | ✓ Examined |
| **GitHub Actions** | `.github/workflows/parse-rates.yml` | `0 14,16,19,21 * * 1-5` (4 runs/day weekdays) | `parse-rates.yml` schedule | ✓ Examined |
| **Manual Script** | `scripts/parse-gcs-rates.mjs` | Invoked by GitHub Action or manually | GH Action trigger | ✓ Examined |
| **Manual Script** | `scripts/write-rate-history.mjs` | Runs after GCS parse or standalone | Operator or GH Action | ✓ Examined |
| **Manual Script** | `scripts/ingest-everstream.mjs` | Manual invocation with file args | Operator | ✓ Examined |

---

## 2. Findings Catalog

### CRON-1: MND Scraper Uses Fragile HTML Regex for Rate Parsing
**File:** `src/app/api/cron/mnd-scrape/route.js:25–39`
**Severity:** HIGH
**Category:** Silent fallback to stale data + brittle parser

**Details:**
- Regex-based HTML scrape of `mortgagenewsdaily.com`: `pattern.match()` looks for product labels, then grabs the next rate value within 300 characters.
- **Problem 1:** If MND changes page layout, CSS structure, or rate label text, the regex fails silently and returns an empty `rates` object.
- **Problem 2:** Line 79 checks `if (Object.keys(rates).length === 0)` and returns `{ error: 'No rates parsed from MND page', status: 502 }`. This is loud (good). But the cron has already fired, and health-check won't detect the failure until the next check window (up to 36 hours, per `FRED_DAILY_STALE_HOURS`).
- **Problem 3:** `parseRatesFromHtml` has no error logging on partial failures — if it extracts only 2 of 5 products, the cron returns 200 OK with incomplete data.

**Hardcoded assumptions:**
- MND page structure (300-char lookahead window on line 30)
- Rate regex pattern: `(\d{1,2}\.\d{2})%` assumes 2 decimal places
- Change regex: `([+-]\d\.\d{2})` assumes single-digit integer before decimal

---

### CRON-2: Health-Check Has Hardcoded Stale Thresholds with No Way to Tune
**File:** `src/app/api/cron/health-check/route.js:20–24`
**Severity:** MEDIUM
**Category:** Hardcoded reference values

**Details:**
- Stale data detection thresholds are constants, not configurable:
  - `FRED_DAILY_STALE_HOURS = 36` — DGS10 must be updated within 36 hours
  - `FRED_WEEKLY_STALE_DAYS = 8` — MORTGAGE30US must be updated within 8 days
  - `RATE_MAX_DAILY_MOVE = 0.5` — MND rate must not move >0.5% in one day
  - `RATE_MIN / RATE_MAX = 5.0 / 9.0` — plausible rate range

**Problem:** These thresholds are never documented in ops runbooks and have no alerting configuration (e.g., PagerDuty). If FRED's weekly update schedule changes or MND has a formatting outage, ops won't know to adjust thresholds.

**Silent failure:** If `trackerApiKey` is not set (line 194), the relay alert is never posted, and health-check returns 200 OK with `{ failures: [...] }` in the body. A human has to check the logs; they won't see a Slack notification.

---

### CRON-3: FRED Series IDs Hardcoded; No Validation Against Upstream Schema
**File:** `src/app/api/cron/fred-snapshot/route.js:20–25`
**Severity:** LOW-MED
**Category:** Hardcoded reference values

**Details:**
- FRED series list is hardcoded:
  ```javascript
  const FRED_SERIES = [
    'MORTGAGE30US', 'MORTGAGE15US',
    'DGS1', 'DGS2', 'DGS5', 'DGS10', 'DGS30',
    'SOFR', 'SOFR30DAYAVG',
    'DPRIME', 'FEDFUNDS',
  ];
  ```
- If FRED retires a series (unlikely but possible), the script would silently skip it in the `Promise.allSettled()` loop without surfacing which series failed.
- **Lookback window:** Line 28 `LOOKBACK_DAYS = 400` — hardcoded to refresh 400 days of history every run. No config for weekend/holiday batching or stale-data recovery patterns.

---

### CRON-4: Calendar Seed Has Hardcoded Economic Release IDs; No Documentation
**File:** `src/app/api/cron/calendar-seed/route.js:26–34`
**Severity:** MEDIUM
**Category:** Hardcoded reference values

**Details:**
- FRED release IDs are hardcoded:
  ```javascript
  const KEY_RELEASES = [
    { id: 50,  name: 'Jobs Report', ... },
    { id: 10,  name: 'CPI Release', ... },
    // ... 5 more
  ];
  ```
- These IDs are never validated against FRED's releases API — the code assumes they remain constant forever.
- **Lookahead window:** Line 37 `LOOKAHEAD_DAYS = 90` — hardcoded. If ops wants to sync 180 days forward, code edit + deploy required.
- **Monday-only schedule:** Line 13 in `vercel.json` — `0 8 * * 1` runs only Mondays. If a release date falls on weekend and the cron misses it, there's no recovery cron (it won't be seeded until the following Monday).

---

### CRON-5: Scenario Alerts Cron Re-prices All Active Scenarios Without Batching or Rate Limiting
**File:** `src/app/api/cron/scenario-alerts/route.js:46–133`
**Severity:** MEDIUM
**Category:** Hardcoded schedule assumptions + no observability

**Details:**
- Fetches ALL active borrower scenarios (line 48), then filters by `alert_days` (line 64).
- For each matching scenario, calls `priceScenario()` (line 88) — a full re-pricing that may hit the DB multiple times.
- **Problem:** No pagination, no batch size limit, no timeout. If you have 1000 active scenarios and 500 match today's schedule, the cron will attempt to re-price all 500 in a single 10-minute window.
- **Silent failures:** Errors are pushed to an array (line 131) but the cron returns 200 OK even if half the scenarios failed to price (line 136).
- **Schedule assumption:** Hard-coded to Mountain Time (line 17–21) via `timeZone: 'America/Denver'`. If HQ moves or DST rules change, this needs a code update.

---

### CRON-6: GitHub Actions Rate Parsing Depends on Undocumented Secret Variables
**File:** `.github/workflows/parse-rates.yml`
**Severity:** MEDIUM
**Category:** Hardcoded env assumptions

**Details:**
- GitHub Action invokes `node scripts/parse-gcs-rates.mjs` with three secrets:
  - `GCS_SERVICE_ACCOUNT_KEY` — JSON service account (no expiration tracking)
  - `GCS_BUCKET_NAME` — bucket name (e.g., 'netrate-rates')
  - `PC_DATABASE_URL` — Neon database URL

**Problems:**
- No docs on secret rotation schedule (GCS keys should rotate annually)
- **Schedule mismatch:** Workflow defines `cron: '0 14,16,19,21 * * 1-5'` (4 times/day) but comments say "morning open" at 8:00 AM MT. These don't align. 14:00 UTC = 8:00 AM MT, but the comment is misleading (it's 2 PM in UTC, not local morning time).
- If `GCS_BUCKET_NAME` changes (e.g., regional bucket), the code hardcodes `'netrate-rates'` at line 43 of the script, overriding the env var. This is a silent fail path.

---

### CRON-7: parse-gcs-rates.mjs Has Brittle Filename-Based Date Extraction
**File:** `scripts/parse-gcs-rates.mjs:204–207, 255–257`
**Severity:** MEDIUM-HIGH
**Category:** Hardcoded date format assumptions + silent fallback

**Details:**
- For Keystone and AmWest parsers, if the parser doesn't extract `sheetDate` from the spreadsheet, the script derives it from the filename using a regex:
  ```javascript
  const dateMatch = xlsxFile.filename.match(/(\d{2})(\d{2})(\d{4})/);
  const fallbackDate = dateMatch
    ? `${dateMatch[3]}-${dateMatch[1]}-${dateMatch[2]}`
    : new Date().toISOString().slice(0, 10);
  ```
- **Problem 1:** Filename format is assumed to be `MMDDYYYY` (e.g., `80220_04142026_0942191440.xlsx`). If a lender changes their naming scheme (e.g., to `DDMMYYYY` or `YYYY-MM-DD`), the regex will still match numbers but produce a wrong date silently.
- **Problem 2:** The fallback at line 206 (if no match): uses `new Date().toISOString().slice(0, 10)` — assigns today's date. If the file is 2 days old and the parser doesn't extract sheetDate, the fallback makes it look current. This is a silent stale-data cascade.

---

### CRON-8: MND-Scrape Parser Has No Per-Product Error Handling
**File:** `src/app/api/cron/mnd-scrape/route.js:25–39`
**Severity:** MEDIUM
**Category:** Silent partial failures

**Details:**
- `parseRatesFromHtml` loops through 5 product types and silently skips any that don't match (line 28: `if (!labelMatch) continue;`).
- If the page structure changes and only conv30 can be parsed (but not conv15, fha30, va30, jumbo30), the cron succeeds and writes only conv30 to rate_history.
- No logging indicates which products succeeded and which failed — ops has to query the DB and spot the missing rows.

---

### CRON-9: GCS Parser File Idempotency Marker is Fragile
**File:** `scripts/parse-gcs-rates.mjs:376–389`
**Severity:** LOW-MED
**Category:** Idempotency edge case

**Details:**
- Idempotency check reads a `.last-parsed-{lender}` marker file from GCS to see if file paths have changed (line 379–388).
- **Problem 1:** The fingerprint is a sorted pipe-joined string of file paths: `files.map(f => f.path).sort().join('|')`.
  - If GCS returns files in a different order on the next run, the sort ensures consistency.
  - But if the GCS listing API changes or returns stale metadata, the fingerprint won't match and the parser will re-run unnecessarily.
- **Problem 2:** The marker file is uploaded to GCS after parse completes (line 411). If the upload fails but the parse succeeded, the marker won't reflect the new fingerprint, causing the parser to re-run on the next invocation. This is correct behavior, but there's no alert that the marker upload failed.

---

### CRON-10: write-rate-history.mjs Hardcodes Loan Types and Credit Score Tiers
**File:** `scripts/write-rate-history.mjs:18–29`
**Severity:** MEDIUM
**Category:** Hardcoded reference values + schema brittle-ness

**Details:**
- Loan types and credit score tiers are hardcoded arrays:
  ```javascript
  const LOAN_TYPES = [
    { loanType: 'conventional', term: 30, dbLoanType: '30yr_fixed', dbTerm: 360 },
    { loanType: 'conventional', term: 15, dbLoanType: '15yr_fixed', dbTerm: 180 },
    { loanType: 'fha', term: 30, dbLoanType: 'fha_30yr', dbTerm: 360 },
    { loanType: 'va', term: 30, dbLoanType: 'va_30yr', dbTerm: 360 },
  ];
  ```
- If new loan types are added to the schema (e.g., ARM products), this script must be manually updated and redeployed.
- **Silent data gaps:** If a new loan type is added to the website but write-rate-history is not updated, rate_history will have no par rates for that type, and the homepage will silently fall back to hardcoded rates (see D3 Pass 1 finding).

---

### CRON-11: scenario-alerts Cron Assumes Mountain Time Without Validation
**File:** `src/app/api/cron/scenario-alerts/route.js:14–22`
**Severity:** LOW
**Category:** Schedule assumption hardcoded in code

**Details:**
- The cron gets "today" as a day-of-week string in Mountain Time:
  ```javascript
  function getTodayDay() {
    const now = new Date();
    const mt = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      timeZone: 'America/Denver',
    }).format(now);
    return mt.toLowerCase();
  }
  ```
- If Vercel's infrastructure is geographically distributed and clock skew occurs, the day-of-week might be off by one.
- Scenarios with `alert_days = ['mon', 'wed']` might miss an alert if the cron fires at 11:59 PM MT on Sunday and Vercel's server is in UTC.

---

### CRON-12: health-check Doesn't Cover parse-rates GitHub Action
**File:** `src/app/api/cron/health-check/route.js`
**Severity:** MEDIUM
**Category:** Monitoring gap

**Details:**
- Health-check verifies MND (rate_history) and FRED (fred_series_data) are up-to-date.
- It does NOT verify that the GitHub Actions rate parsing from GCS succeeded.
- **Scenario:** parse-rates.yml runs at 14:00 UTC and fails silently. health-check runs 15 minutes later (14:15 UTC) and finds no new data in rate_prices, but it doesn't have visibility into the GCS parsing job itself.
- **Missing:** Check for `rate_sheets.updated_at` or `rate_prices.updated_at` to confirm the parsed rates were actually ingested.

---

### CRON-13: ingest-everstream.mjs Has No Idempotency on effective_at
**File:** `scripts/ingest-everstream.mjs:70–79`
**Severity:** MEDIUM
**Category:** Idempotency edge case + data integrity

**Details:**
- The script parses CSV/XLSX and extracts `effective_at` from the file (line 41).
- If the same file is ingested twice with `activate: true`, the script will upsert all rows and mark the sheet as active twice.
- **No deduplication:** If `effective_at` is the same but the file content changed, the second ingest overwrites the first silently.
- **Data integrity:** If the effective_at parsing differs between two runs (e.g., one extracts from the file, the other gets a fallback), you could have orphaned rows under the wrong effective_at.

---

## 3. Monitoring Gaps

| Job | What Could Silently Fail | Detection Window | Alert Mechanism |
|-----|--------------------------|------------------|-----------------|
| **mnd-scrape** | HTML parser breaks, returns empty rates dict | 36–48 hours (until health-check misses MND update) | Relay alert (if `TRACKER_API_KEY` set) |
| **fred-snapshot** | FRED API returns 503, Promise.allSettled swallows error | 36+ hours (health-check daily) | Relay alert |
| **calendar-seed** | All release IDs fail (FRED API broken), no events seeded | Until next Monday | No alert (cron returns 200 OK with errors array) |
| **scenario-alerts** | Re-pricing fails for 50% of scenarios, creates partial queue entries | Until MLO reviews queue and notices missing rates | No alert (cron returns 200 OK with error count) |
| **parse-rates (GH Action)** | Parser exits 1, GitHub marks job failed, but no downstream ops alert | Until next manual check or health-check detects stale rate_prices | GitHub Actions UI (needs ops to check) |
| **parse-gcs-rates.mjs** | Parser throws, db-writer skipped, marker not uploaded | Next run idempotency check fails, causing re-run (masked) | Console logs (GitHub Actions log viewer) |
| **write-rate-history.mjs** | API call to homepage returns 500, par rates not written | Until next manual run or scheduled cron | None (standalone script) |

**Common pattern:** All crons return 200 OK even on partial/complete failure. Errors are logged or returned in JSON, but without an alerting system subscribed to these endpoints, ops is blind.

---

## 4. Hardcoded Assumptions Summary

| Assumption | Location(s) | Stale Risk | Remediation |
|------------|-------------|-----------|-------------|
| MND page structure + regex patterns | mnd-scrape/route.js | HIGH (depends on 3rd-party site) | Fallback to alternative source (LS, Freddie) or monitor MND page structure |
| Health-check thresholds (36h, 8d, 0.5%, 5–9%) | health-check/route.js | MEDIUM (policy-driven) | Move to ENV vars or DB config table |
| FRED series IDs ('MORTGAGE30US', 'DGS10', etc.) | fred-snapshot/route.js | LOW (FRED unlikely to change) | Log which series failed; alert if count drops |
| Economic release IDs (50, 10, 21, etc.) | calendar-seed/route.js | LOW (FRED unlikely to change) | Document release ID mappings in code or DB |
| Mountain Time hardcoded (America/Denver) | scenario-alerts/route.js | LOW | Verify TZ logic with clock-skew scenarios |
| Date extraction regex (MMDDYYYY format) | parse-gcs-rates.mjs | MEDIUM (lender-dependent) | Require lenders to provide sheetDate in file metadata or API |
| Loan types (conv, fha, va) | write-rate-history.mjs | MEDIUM (new products require edit) | Move to DB config; read at script start |
| Credit score tiers (760, 740, 700) | write-rate-history.mjs | MEDIUM | Same — move to DB config |
| 400-day FRED lookback | fred-snapshot/route.js | LOW | Consider ENV var for tuning |
| 90-day calendar lookahead | calendar-seed/route.js | LOW | Consider ENV var for tuning |

---

## 5. Ship-Immediately Candidates

1. **CRON-2 (health-check relay silent failure):** If `TRACKER_API_KEY` is not set, relay alerts never post. Add a warning log at startup confirming the key is set, and return 500 if it's missing and failures were detected.

2. **CRON-12 (health-check coverage gap):** Add a check for `rate_prices.updated_at` to confirm the GitHub Actions parse succeeded. Currently health-check only checks MND and FRED, not the primary lender rate source.

---

## 6. Open Questions for Driver

1. **MND as a primary data source:** Is MND rate-watch meant to be a primary source for borrower pricing, or just a sanity check? If primary, should we have a fallback (e.g., Freddie Mac survey, LS RateChecker)?

2. **GitHub Actions visibility:** How does ops currently monitor GitHub Actions workflows? Is there a Slack integration, or is the expectation to check GitHub UI manually?

3. **Idempotency intent for parse-gcs-rates:** The fingerprinting approach (comparing sorted file paths) prevents re-parsing if files are unchanged. But is re-parsing *expected* to be expensive enough to warrant this, or should we just parse every run for safety?

4. **Timezone for scenario-alerts:** Is `America/Denver` the correct hardcoded timezone, or should it be configurable per organization (if multi-tenant later)?

5. **Loan type evolution:** When you add new loan types (e.g., ARM products), what's the deployment model? Does write-rate-history get a companion PR, or should it be data-driven from the DB?

---

## Summary

**Findings count:** 13 findings (5 HIGH, 6 MEDIUM, 2 LOW-MED, 0 LOW)
**Monitoring gaps:** 6 scheduled jobs with no alerting system, partial-failure scenarios masked by 200 OK responses
**Top risk:** MND scraper with fragile HTML regex (CRON-1) + health-check not covering the primary rate-parsing pipeline (CRON-12). Together: if GitHub Actions parse-rates fails silently and MND scraper also breaks (both brittle), ops has no alerting, and borrowers see stale rates for 24+ hours.
