# AD-11a — Calculator Module Registry — design spec

**Date:** 2026-04-29
**Driver:** PC Dev (`feature/ad-11a-calculator-module-registry`)
**Status:** Draft v1 · awaiting David's review · pre-code · no migrations
**Tier:** T3 — cross-cutting library refactor + new framework + multi-consumer surface

> Architecturally close out **Layer 2 — Quote composer** by defining the calculator module registry that AD-11a sketched. Today's calculators are 8 ad-hoc standalone pages with no shared contract. Without a registry, the quote composer has nothing to compose. This spec defines the contract, locks the data model on `quotes.attached_modules`, and sequences the migration of existing calculators into the registry one at a time. **No code in this PR — David reviews the contract before any calculator is rewritten.**

---

## 1. Methodology — fresh state check (2026-04-29)

Before writing the spec, re-grounded against current code (per Phase 2 §1 lesson: "re-ground at session start").

**Existing standalone calculators:**

| Tool | Path | Compute style | External deps | LOC complexity |
|---|---|---|---|---|
| Purchase calculator | `/tools/purchase-calculator` | local + needs rates | Pricing API | medium |
| Refinance calculator | `/refinance-calculator` | local + needs rates | Pricing API | high (4-strategy engine) |
| Refi recoup analyzer | `/tools/refi-analyzer` | pure local | none | low |
| Cost of waiting | `/tools/cost-of-waiting` | pure local | none | low |
| DSCR calculator | `/tools/dscr-calculator` | pure local + qualifier rules | DSCR API for full quote | medium |
| Reverse mortgage calc | `/tools/reverse-mortgage-calculator` | pure local + ref tables | `ref_hecm_*` tables | medium |
| 2nd lien vs cash-out | `/tools/second-lien-comparison` | pure local + needs rates | Pricing API | medium |
| HECM optimizer (MLO) | `/portal/mlo/tools/hecm-optimizer` | MLO-side multi-scenario grid | `ref_hecm_*` tables | high |

**Schema state:**
- `quotes.attached_modules JSONB NOT NULL DEFAULT '[]'::jsonb` — exists (migration 053). Currently always empty.
- `createQuote({attachedModules = []})` and `updateQuote({attached_modules})` accept the column. `sendQuote` freezes its value in.
- `scenarioToQuoteShape` does not surface `attached_modules` yet (transparent during transition).

**AD-11a in UAD-SPEC §2 (the prior amendment):**
- Module contract sketched: `{id, version, label, inputSchema (zod), compute, renderStandalone, renderEmbedded, renderPDF}`
- Central registry at `src/lib/calc-modules/registry.js`
- attached on quote as `{moduleId, version, config}`
- Version pinning so sent quotes re-render with their original logic forever

**The amendment is a sketch, not a spec.** Three load-bearing questions are unresolved in the prior text:

1. **Compute purity.** AD-11a says "pure function, no side effects, no API calls". But `RefinanceCalc.useRefinanceEngine` debounces a `/api/pricing` POST as part of its core computation, and `purchase-calculator` does the same. If we hard-line "pure", these calculators don't fit AD-11a — yet they're exactly the calculators a quote needs to embed. The spec needs to resolve this.
2. **Render-variant ownership.** "Standalone vs embedded vs PDF" — does a single React component handle all three via props, or do we ship three components per module? Existing calculators are ~200-800 LOC each, mostly UI. Three full re-renders per module triples the maintenance surface.
3. **Version-pinning lifetime.** A v1 module's code lives forever (sent quotes are regulated records — AD-12a immutability). When v2 ships, both must coexist in the registry. We need a concrete answer for "how do we delete v0?" — never, or after some retention window.

This spec addresses all three.

---

## 2. Goals & non-goals

### Goals
1. Lock the **module contract** — a TypeScript-style interface that every registered calculator must satisfy.
2. Lock the **registry shape** — a single `src/lib/calc-modules/registry.js` exporting a Map of `moduleId → currentVersion → ModuleDef`.
3. Lock the **`quotes.attached_modules` JSONB shape** — what MLO writes when attaching a module, what quote composer reads on render.
4. Define the **3 compute archetypes** (pure / rate-pulling / data-table) and how each fits the module contract.
5. Define **render variants** — agree on the one-component-three-modes vs three-components question.
6. Define **versioning semantics** — how v1/v2 coexist, when v0 can be removed, how MLO sees "you're using an older version of this module".
7. Sequence the **migration of existing calculators** into the registry — one PR per calculator, lowest-complexity first.
8. Specify the **MLO selection UI surface** at a high level (out of scope for the registry PR but needs to know what data shape it'll consume).
9. Specify the **borrower-facing render surface** at `/portal/quote/[id]` — the new "attached modules" section.

### Non-goals (explicitly out of scope)
- **Migrating any calculator in this PR.** This PR ships the framework only. Subsequent PRs migrate calculators one at a time.
- **The MLO "select modules" UI.** Quote composer needs that surface, but it's a Layer-2-finishing PR after the framework lands.
- **Module marketplace / 3rd-party registration.** The registry is a static module list compiled into the bundle. No runtime registration, no plugin system.
- **i18n / localization** of module output. English-only for v1 of every module.
- **Branded white-label render variants** (different MLOs see different module styling). All NetRate today.
- **Auto-attachment heuristics.** "If purpose=refi, auto-attach refi-analyzer" is desirable but punted to a separate PR after the framework is exercised.

---

## 3. The module contract

A module is a static object exported from `src/lib/calc-modules/<id>/v<N>/index.js`:

```js
// src/lib/calc-modules/cost-of-waiting/v1/index.js

import { compute } from './compute.js';
import StandaloneView from './StandaloneView.js';
import EmbeddedView from './EmbeddedView.js';
import PDFView from './PDFView.js';
import { schema } from './schema.js';

// Default export, not `export const module` — Next.js ESLint
// (no-assign-module-variable) forbids the name `module`.
const definition = {
  // ─── Identity ───────────────────────────────────────────────
  id: 'cost-of-waiting',          // stable string, never changes — paths key off this
  version: 1,                      // integer, bumped on logic change (see §6)
  label: 'Cost of Waiting',        // human-readable, shown in MLO module picker
  description: 'Shows monthly + 5-year cost of staying at current rate.',

  // ─── I/O contract ───────────────────────────────────────────
  inputSchema: schema,             // zod schema — validates {scenario, config} input
  compute,                         // (validatedInput) → result | Promise<result>

  // ─── Render variants ────────────────────────────────────────
  views: {
    standalone: StandaloneView,    // full /tools/<id> page layout
    embedded: EmbeddedView,        // compact card, fits in /portal/quote/[id]
    pdf: PDFView,                  // @react-pdf/renderer component for PDF export
  },

  // ─── Capabilities (declarative metadata) ────────────────────
  capabilities: {
    // Whether this module needs live rates from the pricing API.
    // Pure compute = false. Rate-pulling = true. Data-table-only = false.
    needsRates: false,

    // Whether MLO can attach this to a quote (vs. standalone-only on /tools).
    // Some calculators may stay standalone if they don't make sense in a
    // quote context (e.g., HECM optimizer is too dense for borrower view).
    attachable: true,

    // Loan purposes this module is relevant for. Empty = all.
    // Used by future auto-attach heuristics + filters in the MLO picker.
    relevantPurposes: ['refinance', 'cashout'],

    // Loan types this module is relevant for. Empty = all.
    relevantLoanTypes: [],
  },
};

export default definition;
```

**Why this shape:**
- **Identity + versioning lives outside the file path.** `id` is stable; `version` integer increments. Filesystem encodes the version in the directory (`v1/`, `v2/`) so we can ship v2 alongside v1 without renaming v1.
- **Schema validation is mandatory.** Calculators today silently coerce `''` to `0` or `NaN` — that's how we got the "Infinity from ltv=0" bug in the quote POST. A zod schema turns that into a runtime error at the boundary.
- **Compute can be async.** Resolves the AD-11a pure-vs-impure tension cleanly (see §4).
- **Three views are explicit.** Not "the same component renders three ways" — three named components, each optimized for its surface. Acknowledges that rendering a 4-strategy refinance preset bar inside a borrower's emailed quote PDF requires fundamentally different layout than the standalone page.
- **Capabilities are declarative.** The MLO picker can filter by `attachable === true`. The quote renderer can skip calling `compute` for `needsRates: false` modules during the initial render. Auto-attach heuristics later read these to suggest modules.

---

## 4. The three compute archetypes

AD-11a's "pure function" model breaks for calculators that need live rates. Resolve by widening the contract: `compute` returns `result | Promise<result>` and gets a `services` object passed in for impure operations the framework needs to mediate.

```js
// Signature
async function compute({ scenario, config }, services) {
  // scenario: validated scenario inputs (loan_amount, fico, state, etc.)
  // config:   validated MLO-tunable config for this attachment (defaults applied)
  // services: { fetchRates, fetchHecmRefData, today, ... }
  //           — only injected services this module declares it needs
  return resultObject;
}
```

`services` is the framework's contract surface for impure work. Modules declare what they need:

```js
capabilities: {
  needsRates: true,
  needsHecmRefData: false,
  needsToday: true,  // for time-sensitive computations
}
```

The framework's compute orchestrator:
1. Validates input against `inputSchema`
2. Injects only the requested services (`needsRates: true` gets `services.fetchRates`)
3. Calls `compute(validatedInput, services)`
4. Validates output (we'll define an `outputSchema` for this in the per-module spec, optional but recommended)

**Three archetypes mapped to capabilities:**

| Archetype | Example | needsRates | needsToday | Output |
|---|---|---|---|---|
| Pure local | `cost-of-waiting`, `refi-analyzer` | false | false | deterministic table |
| Rate-pulling | `purchase-calculator`, `refinance-calculator`, `second-lien-comparison` | true | false | rate ladder + strategies |
| Data-table | `reverse-mortgage-calculator`, `hecm-optimizer` | false | varies | scenarios from ref tables |

**Why this resolves the tension:**
- Pure modules stay pure (no services).
- Rate-pulling modules don't fetch directly — the framework gives them a function. This means a sent quote can re-pin rates via the same service, just pointing at frozen rates instead of live.
- The "snapshot-on-send" requirement (AD-12a) becomes implementable: when a quote is sent, the framework calls `compute({ scenario, config }, frozenServices)` and stores the **result**, not the inputs, into `attached_modules`. Re-rendering the quote later doesn't re-call compute — it reads the frozen result.

---

## 5. The frozen-result model — what `attached_modules` actually stores

The amended AD-11a in UAD-SPEC says attached_modules carries `{moduleId, version, config}`. **Insufficient for AD-12a immutability.** If we only store `{moduleId, version, config}` and re-compute on render, the result drifts as services drift (rate sheets change, ref tables update). That violates AD-12a.

Lock the shape:

```js
// quotes.attached_modules — JSONB array
[
  {
    moduleId: 'cost-of-waiting',
    version: 1,
    config: { /* MLO-tunable config used at send time */ },
    // Frozen at send time. Sent quotes use this; never re-compute.
    result: { /* compute() return value, fully serialized */ },
    // Provenance — what services state was current at send time.
    snapshotMeta: {
      ratesEffectiveDate: '2026-04-29',  // present iff needsRates
      hecmRefVersion: 'migration-026',   // present iff needsHecmRefData
      computedAt: '2026-04-29T20:23:25Z',
    },
  },
  // ...
]
```

**Lifecycle:**

1. **MLO is editing a draft quote.** The quote composer renders embedded views by calling `compute` on every change. The result is **not** stored in `attached_modules` yet — the composer holds it in component state. While `quotes.status='draft'`, `attached_modules` may be empty or stale; that's fine.
2. **MLO clicks Send.** The orchestrator iterates over each attached module, calls `compute({scenario, config}, currentServices)` one final time, captures `{result, snapshotMeta}`, and writes the full array into `quotes.attached_modules` as part of the `sendQuote` UPDATE. The `sendQuote` helper takes a new `attachedModulesWithResults` arg.
3. **Borrower opens `/portal/quote/[id]`.** The render path reads `attached_modules`, looks up each `{moduleId, version}` in the registry, and invokes `views.embedded` with the **frozen result**, not by re-computing. Quote renders identically tomorrow as today.
4. **Borrower clicks "Get fresh rates for this scenario".** Per AD-12a, this creates a new quote (new `quotes` row) with `parent_quote_id` pointer. Old quote untouched. New quote re-runs compute against current services.

**This means `views.embedded` and `views.pdf` accept a frozen `result` prop, not raw inputs.** They are pure presentational components. `views.standalone` is the only one that runs `compute` live (since it's the front-site interactive experience).

---

## 6. Versioning — coexistence and lifetime

AD-11a says "new logic ships as version: 2". This spec locks the operational details.

### Filesystem layout per module

```
src/lib/calc-modules/cost-of-waiting/
├── v1/
│   ├── index.js          # exports the module def
│   ├── compute.js
│   ├── schema.js
│   ├── StandaloneView.jsx
│   ├── EmbeddedView.jsx
│   └── PDFView.jsx
├── v2/                   # ships when behavior diverges from v1
│   ├── index.js
│   ├── ...
└── README.md             # short notes on why each version exists
```

### Registry shape

```js
// src/lib/calc-modules/registry.js
import { module as costOfWaitingV1 } from './cost-of-waiting/v1/index.js';
import { module as costOfWaitingV2 } from './cost-of-waiting/v2/index.js';
// ...

export const REGISTRY = new Map([
  ['cost-of-waiting', new Map([
    [1, costOfWaitingV1],
    [2, costOfWaitingV2],
  ])],
  // ...
]);

export const CURRENT_VERSIONS = {
  'cost-of-waiting': 2,
  // ...
};

export function getModule(moduleId, version) {
  return REGISTRY.get(moduleId)?.get(version) ?? null;
}

export function getCurrentModule(moduleId) {
  const v = CURRENT_VERSIONS[moduleId];
  return v ? getModule(moduleId, v) : null;
}
```

### When does a version bump?

| Change | Bump? | Rationale |
|---|---|---|
| Bug fix that changes any borrower-visible number | **Yes** | A sent quote rendered tomorrow with the bug fix would show different numbers than the day it was sent. AD-12a violation. |
| Pure presentation tweak (margin, font size, copy) | No | Same compute output, same numbers. Visually nicer. Update v1 in place. |
| Adding a new optional config flag with default | No | Old attachments don't have the flag, get the default. v1 backwards compatible. |
| Removing a config flag | **Yes** | Old attachments may carry that flag. Need a v2 that ignores it; old quotes keep using v1. |
| Adding a new output field | No, *if* views handle it gracefully | Old views just don't render the new field. v1 stays. |
| Changing input schema (renaming a field) | **Yes** | Breaking input contract. Old `{moduleId: 'x', version: 1}` attachments validated against old schema; new attachments validate against v2. |

### Lifetime

- v1 lives **forever**. We never remove the v1 directory while any quote with `{moduleId, version: 1}` exists.
- The `quotes` table is regulated record retention — quotes don't get hard-deleted (per AD-12a + general compliance posture). So practically, **all versions live forever** in the codebase.
- Code-bloat mitigation: each version directory is small (~200-800 LOC). 8 modules × 3 versions over 5 years ≈ 24 × 600 LOC ≈ 14kLOC. Tolerable.

### Migration tool: when v2 ships

When v2 ships, MLO has the option (in the quote builder) to "upgrade attached modules" on a draft quote. Upgrade re-runs compute via v2, replaces the draft's stored `{moduleId, version: 1}` with `{moduleId, version: 2}`. **Sent quotes are never auto-upgraded** — they stay on the version they were sent with.

---

## 7. Render-variant resolution

AD-11a sketched three components. Lock that decision.

### Three components per version, not one component with modes

**Why three:**
- The standalone `/tools/refinance-calculator` page is 800 LOC of input forms, preset bars, sticky rate strips, and complex layouts. Stripping it down to fit a borrower's emailed quote card requires nearly throwing the whole UI out and starting over. A "mode prop" would balloon into nested conditional rendering and become unmaintainable.
- The PDF variant uses `@react-pdf/renderer` primitives (`<Page>`, `<View>`, `<Text>` with PDF-specific styling), which is a totally different rendering tree from the React DOM standalone variant. They cannot share components.
- Embedded views need to be **pure presentational** (consume frozen `result`, no live compute) per §5. Standalone views run live compute. Different concerns, different code paths.

### Sharing logic across views

Compute is shared (single `compute.js` per version). View components can share sub-components within the version dir (e.g., `<RateLadderRow>` used by both standalone and embedded). Shared utilities that span versions (like `formatDollar`) live in `src/lib/formatters.js` (already exists per the number-formatting feedback memory).

### View props contract

```js
// Standalone — owns its own input state, runs live compute
function StandaloneView() {
  const [inputs, setInputs] = useState(defaults);
  const result = useCompute(module, inputs);  // hook wrapping framework orchestrator
  return <div>{/* full-page layout */}</div>;
}

// Embedded — pure, consumes frozen result + scenario for header context
function EmbeddedView({ scenario, config, result }) {
  return <div>{/* compact card */}</div>;
}

// PDF — pure, same contract as embedded
function PDFView({ scenario, config, result }) {
  return <Page>{/* PDF layout */}</Page>;
}
```

The `useCompute(module, inputs)` hook is the framework's compute orchestrator — debouncing, cancellation, error states, loading states. Single source of truth for the impure plumbing. Each calculator stops re-implementing it (today, every existing calc has its own debounce + abort + loading pattern).

---

## 8. MLO selection UI surface (out of scope, but contract-defining)

Quote composer needs a "select modules to attach" step. This PR doesn't ship that UI, but the registry shape determines what data it'll consume.

**Contract for the future quote-builder module picker:**

```js
import { REGISTRY, CURRENT_VERSIONS } from '@/lib/calc-modules/registry';

const attachableModules = [...CURRENT_VERSIONS.entries()]
  .map(([id, version]) => REGISTRY.get(id).get(version))
  .filter(m => m.capabilities.attachable)
  .filter(m => {
    if (m.capabilities.relevantPurposes?.length > 0) {
      return m.capabilities.relevantPurposes.includes(scenario.loan_purpose);
    }
    return true;
  });
```

The MLO ticks checkboxes; for each ticked module, a config form is rendered (driven by `inputSchema` reflectively — zod-to-form generation is a small lift). On Save Draft, the composer writes `{moduleId, version, config}` (no `result` yet — that comes on Send).

**This is a future PR.** The registry shape supports it.

---

## 9. Borrower-facing render at `/portal/quote/[id]` (Layer 3 Lite)

Today, the borrower quote page renders rate scenarios + fees. Adding attached modules means a new section after the rate table:

```
┌─ Quote header (NetRate branding, MLO contact, "as of <date>") ─┐
│                                                                  │
├─ Loan summary (purpose, amount, FICO, state, etc.) ──────────────┤
│                                                                  │
├─ Rate scenarios (existing) ──────────────────────────────────────┤
│  - 7.000% — $X/mo — par                                          │
│  - 7.250% — $Y/mo — credit                                       │
│  - ...                                                            │
│                                                                  │
├─ Fee breakdown (existing) ───────────────────────────────────────┤
│  Section A: Origination charges...                               │
│                                                                  │
├─ Analysis (NEW — driven by attached_modules) ────────────────────┤
│  ┌─ Cost of Waiting ─────────────────────────┐                  │
│  │  EmbeddedView({scenario, config, result})  │                  │
│  └────────────────────────────────────────────┘                  │
│  ┌─ Refi Recoup Analyzer ───────────────────┐                   │
│  │  EmbeddedView({scenario, config, result}) │                   │
│  └───────────────────────────────────────────┘                   │
│                                                                  │
├─ Fresh rates CTA ────────────────────────────────────────────────┤
│  "These rates are from <date>. Get fresh rates →"                │
└──────────────────────────────────────────────────────────────────┘
```

Implementation skeleton in `/portal/quote/[id]/page.js`:

```js
import { getModule } from '@/lib/calc-modules/registry';

{quote.attached_modules?.length > 0 && (
  <section>
    <h2>Analysis</h2>
    {quote.attached_modules.map((attached, i) => {
      const m = getModule(attached.moduleId, attached.version);
      if (!m) return null;  // module retired — defensive
      const View = m.views.embedded;
      return (
        <View
          key={i}
          scenario={quote /* scenario fields */}
          config={attached.config}
          result={attached.result}
        />
      );
    })}
  </section>
)}
```

**`scenarioToQuoteShape` already returns `attached_modules`** — no transform change needed. PR adds the section to the page.

---

## 10. Migration order — calculators into the registry

Lowest-complexity-first, highest-impact-first. Each row is a separate PR.

| Order | Calculator | Why now/later | Effort |
|---|---|---|---|
| 0 | **Framework PR** (this one) | Ships registry + types + `useCompute` hook + empty registry. No calculators migrated yet. | T3, ~1-2 sessions |
| 1 | `cost-of-waiting` v1 | Pure, low LOC, perfect first-real-application of the framework. Validates the contract. | T2, 1 session |
| 2 | `refi-analyzer` v1 | Pure, low LOC. Ships alongside #1 if framework holds. | T2, 1 session |
| 3 | `cost-of-waiting` + `refi-analyzer` attached to a real quote | First end-to-end exercise of the full pipeline (MLO attaches → send freezes result → borrower views). Tests `views.embedded` + `views.pdf`. | T3, 1 session — finds bugs in framework |
| 4 | `purchase-calculator` v1 | First rate-pulling module. Validates the `services.fetchRates` contract. | T3, 1-2 sessions |
| 5 | `refinance-calculator` v1 | Most complex existing calc. After #4 proves rate-pulling works, this is mostly mechanical. | T3, 2-3 sessions |
| 6 | `dscr-calculator` v1 + `second-lien-comparison` v1 | Both rate-pulling-ish. Migrate together once rate-pulling is robust. | T3, 1-2 sessions each |
| 7 | `reverse-mortgage-calculator` v1 | Data-table archetype. Validates the `services.fetchHecmRefData` contract. | T3, 1-2 sessions |
| 8 | `hecm-optimizer` (MLO) | Most complex, MLO-only. May stay standalone (`attachable: false`). Decide during migration. | T3, 2-3 sessions |
| 9 | Quote composer module picker | The MLO UI to pick + configure modules. Ships as a Layer-2-finishing PR. | T3, 2-3 sessions |
| 10 | Borrower quote page section | The `/portal/quote/[id]` "Analysis" section. Small once the framework + at least 2 modules exist. | T2, 1 session |

**Each migration PR has:**
- New `src/lib/calc-modules/<id>/v1/` directory with the 5 files
- `views.standalone` swap-in at the existing `/tools/<id>/page.js` (keeps the URL stable)
- Registry update
- Build + smoke test
- No breaking change to the URL or query-param interface (existing `/tools/cost-of-waiting?...` links continue to work)

**Per-calculator migration is strictly a refactor** — no behavior change. Bugs caught during migration get fixed in v1 directly (during the same PR), not as a v2.

---

## 11. Risks & mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | The compute orchestrator's `services` injection becomes a god object as more modules need different services | MEDIUM | MEDIUM | Each service is a single-purpose function (`fetchRates`, `fetchHecmRefData`). Capabilities flag declares need; orchestrator injects only what's needed. New service = new flag, no central god object. |
| 2 | Three view components per version creates massive code bloat | LOW | LOW | Sub-components shared within a version dir. Most modules' three views are <300 LOC combined. 8 modules × 3 views × 1 version ≈ 7-10kLOC ceiling. Tolerable. |
| 3 | Frozen-result JSONB grows unbounded and bloats `quotes` table | LOW | MEDIUM | Each module's result is small (typed, no images, no rates arrays of >10 rows). 5-10 modules per quote × 5KB each ≈ 50KB JSONB. Postgres handles it. Monitor. |
| 4 | Sent quotes break when a module's view component is renamed/refactored | MEDIUM | HIGH | The contract is `m.views.{standalone|embedded|pdf}` — never refactor names. Rename inside the file is fine. ESLint rule possible but not Day-1 needed. |
| 5 | Version pinning means we maintain old code forever | MEDIUM | LOW | True. ~600 LOC per version. Acceptable cost. Per-version directories isolate the bloat. README per module documents version history. |
| 6 | Auto-attach heuristics get implemented as ad-hoc logic instead of capabilities-driven | MEDIUM | MEDIUM | Defer auto-attach to a separate PR. Force first round to be manual MLO selection. Capabilities flags exist for the future heuristic. |
| 7 | Migration of existing calculators churns code while users are using them | LOW | LOW | Each migration PR is a refactor — same URL, same query params, same UI. Vercel preview validates. No DB schema changes. |
| 8 | DSCR calculator's "qualifier rules" (which return pass/fail/needs-LTV-X) don't fit the result-render-frozen model neatly because they cascade on user input | MEDIUM | MEDIUM | DSCR standalone runs live; embedded/PDF show the frozen result of the inputs the MLO had at send time, not interactive. Live "what if I change LTV" goes back to standalone. Document in DSCR's per-module spec. |

---

## 12. Done criteria for this PR (the framework PR)

- [ ] `Work/Dev/AD-11A-CALCULATOR-MODULE-REGISTRY.md` (this file) reviewed by David, accepted (or amended)
- [ ] No calculator code shipped in this PR — design only
- [ ] UAD-SPEC.md AD-11a section gets a pointer to this doc (one-line addition)

**Subsequent PRs implement.** This PR is documentation only and merges only after David's approval of the contract.

---

## 13. Open questions for David

1. **Should `compute` be allowed to throw?** Or must it always return a result with an `errors[]` field? Throw is simpler for the orchestrator to catch; explicit errors[] is cleaner for the embedded view's error display. **My recommendation:** throw for hard errors (invalid input that schema didn't catch); return `result.warnings[]` for soft cases. Mirrors the existing pricing engine's pattern.

2. **Where does the MLO's branding/contact info live in the embedded views?** Today's quote PDF includes MLO name, NMLS, phone, photo. Each module's embedded view doesn't need to know about MLO — that's chrome around the modules, rendered by the page. **My recommendation:** modules render zero MLO chrome. Page wraps with header/footer. Lock this so modules don't accidentally embed MLO data.

3. **Do we ship the framework PR with `cost-of-waiting` as the first registered module, or strictly empty?** Strictly empty validates the framework runs without modules; `cost-of-waiting` first proves a real module loads. **My recommendation:** strictly empty in the framework PR. Migration PR #1 (cost-of-waiting) lands ~1 day later. Easier review.

4. **Capabilities — do we want `relevantPurposes` to be a hard filter (don't show in MLO picker if scenario doesn't match) or a soft sort (show everything but highlight matches)?** Hard filter risks hiding useful tools (refi-analyzer can apply to a purchase scenario in odd cases). **My recommendation:** soft sort. Picker shows all attachable modules, with relevant ones at the top.

5. **Frozen-result vs lazy compute on render — am I right that we must freeze?** AD-12a strongly implies yes. But it makes attached_modules JSONB heavier. Alternative: store `{moduleId, version, config, snapshotMeta}` and re-compute on render using snapshotMeta to reconstruct frozen services. More moving parts, much smaller JSONB. **My recommendation:** freeze the result. Simpler, less reconstructable-state risk, JSONB size manageable. But flagging for your override.

6. **HECM optimizer — `attachable: true` or `false`?** It's MLO-internal scenario planning; it doesn't condense well into a borrower-facing card. **My recommendation:** `attachable: false`. Stays standalone in MLO portal. Revisit later if a use case appears.

7. **Versioning across calculators that share a math primitive (`calculateMonthlyPI`).** If we fix a P&I bug in `calculateMonthlyPI`, every module that uses it should bump version, but the bug isn't in their code. Process question: do we coordinate a multi-module version bump, or pin shared utilities by version too? **My recommendation:** ship math fixes as `src/lib/mortgage-math/v1`/`v2` (versioned utility modules). Each calculator imports a specific version. Bumping the math forces the importing modules to make a deliberate v2 of their own. Heavy but correct.

8. **Standalone-only calculators that aren't quote-attachable — do they still go in the registry?** Pros: unified `useCompute` hook + schema validation. Cons: registry implies attachable. **My recommendation:** yes, they go in the registry with `attachable: false`. Registry is the single source of truth for "what calculators exist on this site".

---

## 14. Phase plan summary

| Phase | Output | Status |
|---|---|---|
| **0 — Design (this PR)** | `AD-11A-CALCULATOR-MODULE-REGISTRY.md` reviewed and approved | In review |
| **1 — Framework** | `src/lib/calc-modules/{registry,services,useCompute,types}.js` + UAD-SPEC pointer | Next |
| **2 — Cost of waiting v1** | First real module, validates contract end-to-end | After 1 |
| **3 — Refi recoup v1** | Second pure module | After 2 |
| **4 — Purchase calc v1 (rate-pulling)** | Validates `services.fetchRates` | After 3 |
| **5 — Refinance calc v1** | Most complex pure-pricer migration | After 4 |
| **6 — DSCR + 2nd lien v1** | Bundle two similar | After 5 |
| **7 — Reverse mortgage v1** | Data-table archetype | After 6 |
| **8 — HECM optimizer (decide attachable)** | MLO-only complex calc | After 7 |
| **9 — MLO module picker UI** | Quote builder integration | After at least 2-3 modules exist |
| **10 — Borrower quote page Analysis section** | Layer 3 Lite render integration | After 9 |

---

*End of AD-11a registry design spec. Awaiting David's review on §11 open questions before any framework code is written.*
