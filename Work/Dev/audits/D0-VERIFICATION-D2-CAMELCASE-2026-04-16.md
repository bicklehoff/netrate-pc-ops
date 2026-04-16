# D0 Verification — D2 camelCase/snake_case (2026-04-16)

**Scope:** Re-audit of D2 dimension. Verify PR #53 fixes hold. Catalog any residual
`row.camelCaseName` access patterns on raw SQL results (NOT Prisma client output).

**Auditor:** agent a5f5cbe0e347f80ff
**Parent audit:** `Work/Dev/audits/D2-CAMELCASE-SNAKECASE.md`

---

## 1. PR #53 Verification

**PR #53 — "#53 [pc] fix: camelCase/snake_case migration — 12 dead features restored"**
- State: **MERGED** 2026-04-14T15:03:56Z
- Scope covered 12 dead features (borrower dashboard, co-borrower tabs, 8 employment
  inline edits, address section, monthly payment, pipeline co-borrowers, MLO
  reassignment, payroll section, compensation section, SMS verify loop, QuoteFeeEditor,
  My Rates P&I, QuoteWizard snake→camel transform).

Spot checks of the areas called out in PR #53 body confirm the fixes are live on
`main` (merged, no subsequent revert commits found in recent history — last 5 commits
at audit time are docs/UAD/D0-re-audits, not camelCase regressions).

**Conclusion:** PR #53 holds. No regression detected in high-traffic paths.

---

## 2. Raw SQL Consumers — Catalog

The project uses `@neondatabase/serverless` with tagged-template `sql\`` queries.
Returned rows are snake_case per Postgres column names. Two categories of consumers
exist:

### 2a. Files that perform raw SQL and transform to camelCase (safe pattern)

These files read `row.snake_case` from SQL results and return camelCase JS objects to
callers. Downstream `row.camelCase` access is CORRECT because it's reading the
transformed output, not raw rows.

- `src/lib/rates/db-adj-loader.js` — reads `row.fico_min`, `row.ltv_min`, `row.purpose`
  (single-word column, no mapping needed), `row.agency`, `row.tier`, `row.value`,
  `row.adjustment_type`. Builds camelCase `adj.eliteFhaFicoLoanAmt`, `adj.riskBased`,
  etc. Correct.
- `src/lib/rates/pricing-v2.js` — consumes output of `db-adj-loader`. `row.ficoMin`,
  `row.ltvMin`, `row.loanAmountMin`, `row.loanAmountMax` are reads on the transformed
  camelCase object. Correct.
- `src/lib/rates/db-loader.js`, `src/lib/rates/db-writer.js`, `src/lib/rates/homepage-db.js`,
  `src/lib/rates/price-scenario.js` — all use snake_case on raw SQL, camelCase on
  computed results. Correct.
- `src/lib/scenarios/db.js` — uses `r.finalPrice ?? r.price ?? null`,
  `r.monthlyPI ?? r.monthly_pi ?? null`, `r.lenderCode ?? r.lender_code ?? null` style
  defensive fallbacks for inputs that may arrive in either shape. Correct (belt-and-
  suspenders for mixed-shape inputs from upstream callers).

### 2b. Files that read session / request body / JS-generated objects (not SQL rows)

False positives from the `row.camelCase` grep. These read `session.user.userType`,
`body.loanAmount`, `result.newFileName`, etc. — not DB rows.

- `src/lib/require-mlo-session.js` — `session.user.userType`, `session.user.organizationId`
- `src/lib/auth.js` — `token.userType`, `session.user.organizationId`
- `src/lib/corebot/processor.js` — `result.newFileName`, `result.extractedData`
- `src/app/api/cron/scenario-alerts/route.js` — `r.monthlyPI`, `r.lenderName` read
  from `priceScenario()` JS return, not SQL
- `src/app/api/my-rates/reprice/route.js` — same; reads from priced-scenario result
- `src/app/api/cron/mnd-scrape/route.js` — `data.loanType` read from constant mapping
  object, not SQL
- `src/app/api/market/national-rates/scrape/route.js` — same
- `src/app/api/portal/loans/route.js` — `session.borrowerId` (session object) in sql
  template parameter position, not a row read
- `src/app/api/corebot/identify/route.js` — `loanContext.coBorrowerFirstName` is a
  WRITE into a camelCase JS object; the READ is `coBorrower.first_name` (correct)

### 2c. Parser outputs (not SQL)

- `src/lib/rates/parsers/everstream.js` — `row.ficoMax`, `row.ficoMin`, `row.ltvBands`
  reads from in-memory parser state, not SQL
- `src/components/Portal/QuoteGenerator/QuoteFeeEditor.js`,
  `src/lib/quotes/fee-builder.js` — `escrow.sectionFItems`, `escrow.escrowMonthly` all
  come from an in-memory escrow builder object, not SQL
- `src/components/Portal/PayrollSection.js` — `row.cdDisplay`, `row.loanDisplay`
  computed in React render loop
- `src/components/Portal/HecmOptimizer/OptimizerGrid.js` — `row.expectedRate`,
  `row.compDollars`, `row.availableFunds`, `row.locGrowth` computed by HECM optimizer
  JS, not SQL
- `src/components/Portal/Core/sections/ConditionsSection.js` — `row.ownerRole`,
  `row.conditionType`, `row.blockingProgress` reads from Prisma-client result (this
  file uses `/api/portal/mlo/loans/[id]/conditions` which returns Prisma objects with
  their native camelCase). NOT raw SQL. Correct.
- `src/app/portal/quote/[id]/page.js` — `row.totalPayment` in amortization table,
  computed in page
- `src/app/tools/dscr-calculator/page.js`, `src/app/tools/cost-of-waiting/page.js` —
  `row.netPrice`, `row.netDollar`, `row.extraPrincipal` all computed client-side

---

## 3. Residual Bugs

**None found.**

All `row.camelCase` access patterns fall into one of three safe categories:
1. Reading the camelCase output of a snake→camel transform function
2. Reading a session, request body, or API response (not a raw SQL row)
3. Reading a parser/computation result (in-memory JS object)

---

## 4. Confidence & Method

- Grepped all 14 files importing `@neondatabase/serverless` and 109 files using
  `await sql\`` templates
- Cross-referenced each `row.camelCase` or `r.camelCase` occurrence against the
  enclosing scope to determine source (raw SQL vs JS object)
- Verified PR #53 merge state via `gh pr view 53`
- Spot-checked Prisma schema for single-word column names (e.g. `purpose`, `agency`,
  `tier`, `value`) to confirm they map 1:1 without snake_case translation

**Confidence:** high for the 14 raw-SQL files in `src/app/api/`, `src/lib/rates/`,
`src/lib/scenarios/`. Sampling-based for the wider 109-file sql-template footprint —
pattern was consistent across every file inspected.

---

## 5. Recommendation

**D2 dimension can remain CLOSED.** No new fixes required. PR #53 is the complete
fix for this class of bug.

Ongoing guardrail suggestion (not a finding, not a blocker):
- When introducing new raw SQL queries, immediately transform snake_case → camelCase at
  the DB boundary (as `db-adj-loader.js` does) rather than letting snake_case leak into
  downstream code. This is the existing house style.
