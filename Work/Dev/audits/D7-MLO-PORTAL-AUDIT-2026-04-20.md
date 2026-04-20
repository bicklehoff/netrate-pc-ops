# D7 · MLO Portal — Current-State Audit + PR Plan

**Audit:** FoH April · Dimension 7 (MLO Portal UX)
**Date:** 2026-04-20
**Status:** Audit complete · rewrites the aspirational "PRs 16–19" plan from [`README.md`](./README.md) §12
**Driver:** PC Dev (`serene-moore-db1d26` worktree, branch `audit/d7-mlo-portal`)
**Supersedes:** [PIPELINE-UI-SPEC.md](../PIPELINE-UI-SPEC.md) (Stitch-mockup-driven narrow update, pre-dates D9a + design-system lock)
**Does not supersede:** [PASS-6-MLO-PORTAL-INVENTORY-2026-04-16.md](./PASS-6-MLO-PORTAL-INVENTORY-2026-04-16.md) — that pass cataloged static-data findings only; this audit covers layout, IA, design-token adherence, data-model alignment, and UX flows, and references Pass 6 residuals by ID.

---

## 1 · Why this audit exists

D7 was blocked on D9a Layer 1 (new Contact/Deal identity schema) + D8 Pass 6 (MLO portal static-data inventory). Both landed:

- D9a 1a–1c shipped PRs #86 / #87 / #88 / #90 / #91 (2026-04-17). `borrowers` table dropped, `mlos` renamed to `staff`, `loans.borrower_id` → `contact_id`, scenarios stop writing denormalized `borrower_name/email/phone` strings.
- D8 Pass 6 inventory filed 2026-04-16 (15 findings). PR #113 shipped 4 of 15 (status picklist consolidated to `src/lib/constants/loan-statuses.js`, `HOUSE_FEE_RATE` consolidated to `src/lib/payroll.js`).

The legacy D7 plan was "PRs 16–19 per portal-rebuild backlog" (IA: pipeline, lead detail, quote builder, dashboard). Verified 2026-04-20: **no `portal-rebuild` project exists in TrackerPortal**; the scope lived only in audit README prose. The `PIPELINE-UI-SPEC.md` doc scopes a narrow summary-card + pagination update driven by a Stitch mockup that references the retired Stitch design system (teal `#00647c`), not the locked [DESIGN-SYSTEM.md](../DESIGN-SYSTEM.md) (brand blue `#2E6BA8`).

**We need a rewritten D7 plan grounded in current-state reality.** This doc is that.

---

## 2 · Scope walked

All MLO portal code inspected under:

**Route surfaces (21 files):**
`src/app/portal/mlo/{page,layout}.js`, `loans/[id]/page.js`, `leads/{[id]/page,page}.js`, `contacts/{[id]/page,page}.js`, `scenario-alerts/page.js`, `quotes/{[id]/page,page}.js`, `tools/{quote-generator,hecm-optimizer}/page.js`, `accounts/page.js`, `backlog/{[id]/page,page}.js`, `messages/page.js`, `marketing/page.js`, `gbp-checklist/page.js`, `login/page.js`, `phone-popout/{layout,page}.js`.

**Portal components (key files):**
`MloHeader.js`, `MloNav.js`, `PipelineTable.js` (781 LOC), `LoanDetailView.js` + `LoanDetailViewLegacy.js` (653 LOC each), `Core/LoanDetailShell.js` + `LoanSidebar.js` + `StatusHeader.js` + `sections/*.js` (10 section files), `QuoteGenerator/{QuoteWizard,QuoteScenarioForm,QuoteRateResults,QuoteFeeEditor,EligibilityPanel,QuotePDF}.js`, `PipelineTable.js`, `PayrollSection.js`, `CompensationSection.js`, `LeadKanban.js`, `LeadsTable.js`, `PrequalLetter/*.js`, `HecmOptimizer/*.js`.

**APIs backing the UI (verified for schema alignment):** `/api/portal/mlo/pipeline`, `/api/portal/mlo/loans/[id]`, and neighbors.

---

## 3 · Information architecture — current state

### 3.1 Nav inventory (`src/components/Portal/MloNav.js`)

Left sidebar, `bg-gray-900` dark rail (collapses to 56px icon-only <md, expands to 192px ≥md).

| # | Label | Path | Notes |
|---|---|---|---|
| 1 | Pipeline | `/portal/mlo` | Loan pipeline dashboard |
| 2 | Comms | `/portal/mlo/messages` | SMS threads |
| 3 | **Borrowers** | `/portal/mlo/contacts` | **Label says "Borrowers" but URL/data is `contacts`. Post-D9a the unified table is `contacts`; the nav label ignores that.** |
| 4 | Leads | `/portal/mlo/leads` | Lead funnel |
| 5 | Alerts | `/portal/mlo/scenario-alerts` | Scenario alert queue |
| 6 | Partners | `/portal/mlo/accounts` | Service providers / companies |
| 7 | Backlog | `/portal/mlo/backlog` | Internal dev backlog |
| 8 | HECM | `/portal/mlo/tools/hecm-optimizer` | Reverse optimizer |
| 9 | Quotes | `/portal/mlo/quotes` + `/portal/mlo/tools/quote-generator` | Quote list + builder share one nav entry |
| 10 | Marketing | `/portal/mlo/marketing` | Admin-only |

Pages that exist but are **not in nav**: `/portal/mlo/loans/[id]` (loan detail, reached via table row click only), `/portal/mlo/leads/[id]`, `/portal/mlo/contacts/[id]`, `/portal/mlo/quotes/[id]`, `/portal/mlo/gbp-checklist`, `/portal/mlo/phone-popout`.

### 3.2 IA findings

| ID | Finding | Impact |
|---|---|---|
| **IA-1** | Nav label "Borrowers" for `/contacts` route. **Resolved 2026-04-20 (David):** intentional. "Borrower" is a user-facing role label; `contacts` is the schema module. A borrower is a contact in borrower-role. No change — this finding is closed. | closed |
| **IA-2** | Quotes nav entry matches **both** `/quotes` (quote list) and `/tools/quote-generator` (quote wizard launcher). No entry for completed-deal quotes vs. in-progress. | Navigation ambiguity. |
| **IA-3** | "Backlog" in MLO nav. This is internal dev backlog, not MLO-facing work. Appears alongside Pipeline/Leads/Partners for all MLOs. | Scope pollution. Belongs in an admin-only or dev-only area. |
| **IA-4** | No entry for "Today" / "Tasks" / "Calendar" — MLO's daily queue is absent from IA. `loan_tasks` table exists in schema but has no top-level surface. | No landing page answers "what do I do today." |
| **IA-5** | "HECM" is a lone tool entry; "Quotes" is also tool-like. No grouped "Tools" submenu. | Flat nav gets unwieldy as tools grow (DSCR calc, Bank Statement calc en route). |
| **IA-6** | `Comms` is messages-only (SMS). Dialer lives as a floating panel regardless of page. No call history surface in nav. | Call logs (`CallLog` table) are invisible except on Contact detail. |
| **IA-7** | Dark nav rail (`bg-gray-900`) is not in [DESIGN-SYSTEM.md](../DESIGN-SYSTEM.md). Homepage uses brand tokens on light backgrounds. | Out-of-system color. Decision: dark-rail-as-portal-convention (document it) OR convert nav to light surface (align with design system). |

### 3.3 Shell layout (`src/app/portal/mlo/layout.js`)

- `fixed inset-0 z-50` — portal owns the viewport, body scroll locked.
- Flex column: `MloHeader` (`h-12` fixed) → flex row (`MloNav` + content `flex-1 overflow-y-auto px-6 py-6`).
- Floating `PhonePanel` + `IncomingCallPopup` layered over everything.

Shell is functional, minimal. No per-page breadcrumb slot — each page rolls its own (e.g. `LoanDetailShell.js:169` builds its own breadcrumb row).

---

## 4 · Per-surface layout inventory

### 4.1 Pipeline (`src/app/portal/mlo/page.js`, 547 LOC)

**Structure top to bottom:**
1. Title block "Loan Pipeline" + greeting + right-aligned "Import XML" button + `Active N` / `Total N` pills.
2. **Tier-1 summary cards** — Active / Settled / Cancelled / All as 4 big-number buttons in a row.
3. Row with summary cards (left) + LO filter `<select>` + search `<input>` (right, `ml-auto`).
4. **Tier-2 status drill-down pills** — visible only when tier-1 has multiple statuses.
5. Error banner (if any) / empty-state card / `PipelineTable` + pagination row.
6. Floating `BulkActionBar` (dark, bottom-center, appears on row selection).

**Findings:**

| ID | Finding | Severity |
|---|---|---|
| **PL-1** | `page.js:393,397,400,411,424` — uses `border-primary`, `text-primary`, `focus:ring-primary/30`, `focus:border-primary`. **`primary` is NOT a Tailwind token** in `tailwind.config.js` (only `brand`, `go`, `accent`, `ink`, `surface`, `deep` exist). These classes render as no-ops — active tier-1 card borders + filter focus rings are silently missing. | **HIGH — live visual bug** |
| **PL-2** | Tier-1 summary cards use `border-slate-200`, `text-slate-900`, `text-slate-400`. Elsewhere on the page `text-gray-*`, `bg-gray-*`. Mixed `slate` / `gray` utility scales with no system rationale. | Medium (visual drift) |
| **PL-3** | Bulk action bar is `bg-gray-900 text-white` (dark). Delete button is `bg-red-900/60`. No design-system hex for destructive action. | Medium |
| **PL-4** | Tier-1 cards are keyboard-accessible buttons but have no aria-pressed / aria-label for screen readers; selected state communicated by color only (and that color doesn't render — see PL-1). | Medium (a11y) |
| **PL-5** | LO filter + search live inline with summary cards on one row. On narrow viewports (e.g. laptop with phone panel open), layout breaks — no responsive stack. | Medium |
| **PL-6** | Pagination + pageSize below the table. Total count hidden in the pageSize row ("of N loans"). No skeleton for data refetch (only initial load). | Low |
| **PL-7** | Header's `Active N` / `Total N` pills duplicate information in the tier-1 cards. Redundant. | Low |
| **PL-8** | No per-column filter chips visible from the page — column filtering is delegated to `PipelineTable` but has no summary row of active filters ("Clear all filters"). | Medium (UX discoverability) |

### 4.2 Pipeline table (`src/components/Portal/PipelineTable.js`, 781 LOC)

Spec in [PIPELINE-UI-SPEC.md](../PIPELINE-UI-SPEC.md) called out: summary cards (shipped in page.js), borrower+email column, LO avatar, pagination (shipped), filter + export buttons, row spacing, hover bg. Verified — most of the spec has shipped or is close.

**Additional findings:**

| ID | Finding | Severity |
|---|---|---|
| **PT-1** | `PipelineTable.js:547` — LO avatar background hardcoded to `#0891b2` (cyan-600, the old retired brand). | Medium (token) |
| **PT-2** | `PipelineTable.js:341-343` — reads `loan.borrower_name`, `loan.borrower_email`, `loan.borrower_phone`. These are **denormalized strings produced by the pipeline API's transform** (`/api/portal/mlo/pipeline/route.js:74-76` flattens the `contacts` JOIN into `borrower_*` fields). Field naming is misleading post-D9a — the data comes from `contacts`, not a borrower record. | Low (semantic cruft, not a runtime bug) |
| **PT-3** | Column definitions are inline arrays in the component (not imported from a shared config). Column visibility picker exists but saves to localStorage, not per-user DB preference. | Low |
| **PT-4** | "Borrower" column heading. **Resolved 2026-04-20 (David):** same as IA-1 — "borrower" is a role label, kept as-is. | closed |

### 4.3 Loan detail (`src/app/portal/mlo/loans/[id]/page.js` → `Core/LoanDetailShell.js`, 229 LOC)

**Structure:**
- 2-pane flex: `LoanSidebar` (left, section navigator) + main column.
- Main column: breadcrumb → `StatusHeader` → section content (one of ~10 sections via `?section=` query param).
- Sections: `overview`, `loan-info`, `borrower`, `application`, `processing`, `conditions`, `documents`, `notes`, `payroll`, `post-close`.
- Prequal-letter modal mounts on first open, stays mounted (persistent form state).

**Findings:**

| ID | Finding | Severity |
|---|---|---|
| **LD-1** | Two implementations coexist: `LoanDetailView.js` (653 LOC) + `LoanDetailViewLegacy.js` (653 LOC) + new `Core/LoanDetailShell.js`. Only `LoanDetailShell` is wired from the page. `LoanDetailView.js` + `LoanDetailViewLegacy.js` are unreferenced dead code. | Medium (dead code, confusion risk) |
| **LD-2** | `LoanDetailShell.js:183` — reads `loan.borrower.last_name`. API must return a nested `borrower` object (not just flat fields). Needs verification that post-D9a, the `/api/portal/mlo/loans/[id]` endpoint still returns a `borrower`-shaped nested object. Same pattern in `StatusHeader.js:55-57`, `BorrowerSection.js:35-36`, `OverviewSection.js:119-120`, `PostCloseSection.js:291`. | Medium — API contract / field-naming consistency |
| **LD-3** | `Core/sections/ApplicationSection.js` contains **15+ ad-hoc hex values** (`#005ac0`, `#f2f4f5`, `#191c1d`, `#d8e2ff`, `#004494`) that are neither brand tokens nor design-system utilities. A wholesale retheming of this section is required. | **HIGH — design-token violations** |
| **LD-4** | `Core/StatusHeader.js:8-22` — own local `STATUS_LABELS` + `STATUS_COLORS` maps, **duplicating** `src/lib/constants/loan-statuses.js` (consolidated in PR #113). Pass 6 MLO-5 residual. | Medium (Pass 6 MLO-5) |
| **LD-5** | `Core/sections/NotesActivitySection.js:9` — own local `STATUS_LABELS`. Same Pass 6 MLO-5 residual. | Medium |
| **LD-6** | `Core/sections/DocumentsSection.js:20-28` — inline `DOC_STATUS_COLORS` + `DOC_STATUS_LABELS`. Pass 6 MLO-5 residual. | Medium |
| **LD-7** | Breadcrumb is built bespoke in the shell (lines 169-188). No reusable breadcrumb component. Other portal pages don't have breadcrumbs at all. | Low |
| **LD-8** | Section content capped at `max-w-4xl`. Tables in Conditions / Documents / Notes can exceed this and scroll horizontally within the 4xl constraint. | Low |

### 4.4 Lead detail (`src/app/portal/mlo/leads/[id]/page.js`, 468 LOC)

Hand-rolled 2-column layout (scenario inputs on left, pricing results on right). Has its own action bar with **4 different button colors**: gray border (Save), `bg-go` (Run Quote), `bg-cyan-700` (Generate Quote), `bg-purple-600` (Convert to Loan). Plus a secondary "actions" row with portal invite / needs list.

**Findings:**

| ID | Finding | Severity |
|---|---|---|
| **LE-1** | Own hardcoded `PURPOSES`, `PROPERTY_TYPES`, `OCCUPANCY`, `STATES` constants at top of file. **Pass 6 MLO-3 residual** — still divergent from quote form, strike rate form, pipeline form, etc. | **HIGH (Pass 6 MLO-3)** |
| **LE-2** | Action-bar CTA color palette (green / cyan / purple) violates design system. `bg-cyan-700 Generate Quote` and `bg-purple-600 Convert to Loan` are ad-hoc colors. Design-system rule: primary action = `go` green, secondary = ghost/outline, not rainbow. | **HIGH (token)** |
| **LE-3** | Two overlapping quote actions: "Run Quote" (inline pricing) + "Generate Quote" (redirect to quote wizard). Unclear separation of concerns for MLO. | Medium (UX) |
| **LE-4** | 2-column grid fixed at `grid-cols-2` (no responsive stack). | Medium |
| **LE-5** | "Send Portal Invite" / "Send Needs List" buttons use emoji (🔗 📋) as icons. Design-system direction is SVG icons (per MloNav, MloHeader). | Low (consistency) |

### 4.5 Quote builder (`tools/quote-generator/page.js` → `QuoteWizard.js` → `QuoteScenarioForm.js`, 507 LOC)

**Wizard steps:** Scenario → Rate Selection → Fees & Preview.

**Findings:**

| ID | Finding | Severity |
|---|---|---|
| **QB-1** | `QuoteScenarioForm.js:6-20` — hardcoded `STATES`, `LOAN_TYPES`, `PURPOSES`, `TERMS`, `LOCK_DAYS`. Pass 6 MLO-2 residual — diverges from LE-1, StrikeRateForm, Pipeline. | **HIGH (Pass 6 MLO-2)** |
| **QB-2** | `QuoteScenarioForm.js:394` — FHA UFMIP hardcoded as `Math.round(effectiveLoan * 0.0175)` in JSX display. Also at `src/lib/quotes/fee-builder.js:91` (`FHA_UFMIP_RATE = 0.0175`) and `src/lib/rates/pricing-v2.js:374` (fallback). Three separate hardcodes of a regulatory value that can change. Pass 6 MLO-11 + Pass 1 B3. | **HIGH (regulatory, 3-way dup)** |
| **QB-3** | **`QuoteWizard.js:16-71` duplicates date helpers from `QuoteScenarioForm.js:64-108`** — `defaultClosingDate` / `defaultFundingDate` vs `getDefaultClosingDate` / `deriveFromClosing`. The wizard's own defaults diverge from the form's. This is NEW cruft since Pass 6 was written — Pass 6 caught MLO-9/10 in one file, and the pattern spread to a second. | **HIGH (duplication regression)** |
| **QB-4** | Date-rule logic: `CO+TX purchase = same day`, `CA+OR + all refi = +3 business days`. Hardcoded in both files. No source of truth. Candidate for `ref_funding_rules` table (D9d scope). | Medium (Pass 6 MLO-10) |
| **QB-5** | `QuoteGenerator/QuotePDF.js:13` — `const BRAND = '#0891b2'`. PDF output brands the quote with retired cyan, not current brand blue `#2E6BA8`. User-facing regression. | **HIGH (token — borrower sees it)** |
| **QB-6** | StepIndicator (`src/components/Portal/StepIndicator.js`) is shared across `/apply` and `/tools/quote-generator` but its design language hasn't been verified against DESIGN-SYSTEM.md. | Low |
| **QB-7** | Wizard state held in `QuoteWizard.js:80-101` initializes `borrower_name`, `borrower_email`, `borrower_phone`, `contact_id`. UAD target reads identity from `contact_id` only; denormalized strings are legacy prefill. Fine for v1 transition; document as cruft. | Low (semantic) |

### 4.6 Quote list + detail (`/quotes/page.js`, `/quotes/[id]/page.js`)

**Findings:**

| ID | Finding | Severity |
|---|---|---|
| **QL-1** | `quotes/page.js:46,55,69,90` + `quotes/[id]/page.js:39-41` — cyan-600 buttons, cyan-500 focus rings. Design-token violation. | Medium |
| **QL-2** | Quote list rows read `q.borrower_name`, `q.borrower_email` (denormalized from scenarios table). The D9a discipline rewrites scenarios to write `contact_id`, not `borrower_*` strings. UI has no fallback path when `contact_id` is set and `borrower_*` is null for future scenarios. Needs `contact_id` resolution. | Medium (post-D9a gap) |
| **QL-3** | Quote detail is 39 LOC wizard init — minimal. Worth verifying it renders post-D9a data. | Low |

### 4.7 Contacts / Leads / Partners / Backlog list pages

**Findings (consolidated, all medium-low):**

| ID | Finding |
|---|---|
| **LP-1** | `contacts/page.js:28`, `contacts/[id]/page.js:19,30` — `bg-cyan-100 text-cyan-800` + `bg-teal-100` status badges. Token violations. |
| **LP-2** | `backlog/page.js:56`, `backlog/[id]/page.js:25` — `bg-teal-50 text-teal-700` product-type tags. Token violations. |
| **LP-3** | `contacts/[id]/page.js:353-364` — `contact.co_borrower_name`, `contact.co_borrower_email` fields. Legitimate for D9a (co-borrower stored as Contact row with a relationship), but UAD AD-6 says co-borrower is a separate Contact linked via `deal_participants`. Verify whether these fields on the `contacts` row are legacy carry-forward or current design. |

### 4.8 HECM optimizer (`tools/hecm-optimizer/page.js` + `HecmOptimizer/*`)

Pervasive cyan-50/100/800/600 usage across `ScenarioTable.js`, `OptimizerGrid.js`, `BorrowerInputs.js`, `FeesSection.js`, `PrintView.js`, `SaveLoadModal.js`. **Full component-system re-theming required.** See §5 for consolidated token-violation totals.

---

## 5 · Design-token adherence — consolidated findings

Authoritative tokens are in [DESIGN-SYSTEM.md](../DESIGN-SYSTEM.md) (mirror of `tailwind.config.js`): `brand` (blue `#2E6BA8`), `go` (green `#059669`), `accent` (yellow `#FFC220`), `ink` (text), `surface` (bg).

**Violation classes found in MLO portal code:**

| Type | Count (files) | Examples |
|---|---|---|
| Hardcoded hex `#0891b2` (retired cyan) | 3 files | `PipelineTable.js:547`, `QuotePDF.js:13`, `ScenarioTable.js`, `OptimizerGrid.js` |
| Hardcoded hex (ad-hoc, non-token) | 1 file × 15+ sites | `Core/sections/ApplicationSection.js` (`#005ac0`, `#f2f4f5`, `#191c1d`, `#d8e2ff`, `#004494`) |
| Tailwind `cyan-*` classes | 10+ files | `leads/[id]/page.js`, `quotes/page.js`, `contacts/*`, `HecmOptimizer/*`, `CoBorrowerPrompt.js`, `SaveLoadModal.js`, `tools/hecm-optimizer/page.js` |
| Tailwind `teal-*` classes | 4 files | `backlog/{[id],page}.js`, `contacts/[id]/page.js`, `Dialer/ContactCard.js:292` |
| Tailwind `purple-*` (ad-hoc) | 1 file | `leads/[id]/page.js` "Convert to Loan" button |
| **Dead class — undefined token** | 1 file (live bug) | `page.js` (Pipeline): `primary` is not defined in tailwind.config.js. `border-primary`, `text-primary`, `focus:ring-primary/30` render nothing. |
| `slate-*` vs `gray-*` scale drift | several files | Pipeline mixes both without rule |

**Token-migration candidates (Tailwind class → design token):**
- `cyan-600` bg/text → `bg-brand text-brand`
- `cyan-100 text-cyan-800` badge → `bg-brand/10 text-brand` (per DESIGN-SYSTEM.md example)
- `teal-50/100 text-teal-700` chip → not a brand pattern; reclassify as `accent` (yellow) for highlights or `brand.light` for subtle fill
- `purple-*` → remove, use `go` or `brand` per action class
- `primary` (dead) → `brand` (intended by author based on context)

---

## 6 · Data-model alignment — D9a state

### 6.1 Schema state verified 2026-04-20

- ✅ `contacts` table is canonical identity (no `borrowers` table)
- ✅ `staff` table replaces `mlos` (`/api/portal/mlo/pipeline` line 40: `LEFT JOIN staff m`)
- ✅ `loans.contact_id` replaces `loans.borrower_id` (line 39: `LEFT JOIN contacts b ON l.contact_id = b.id`)
- ❌ `loan_borrowers` junction table **still named `loan_borrowers`** (not yet renamed to `deal_participants` per UAD Layer 1 plan)
- ❌ `loans` table **still named `loans`** (not renamed to `deals` per UAD plan)
- Partial: scenarios carry both `contact_id` (new discipline) and `borrower_name/email/phone` columns (kept for soak until 2026-05-01 per session handoff)

### 6.2 API transform cruft

`/api/portal/mlo/pipeline/route.js:74-76` SELECTs `contacts` JOIN with aliases `b.first_name AS borrower_first_name` etc., then the JS transform flattens to a response shape with `borrower_name`, `borrower_email`, `borrower_phone` strings. This preserves the old UI contract — **but the field names on the response now lie about the source**. The data comes from `contacts`, not a borrower table.

**Decision needed for D7:** rename the API response shape to `contact_*` (coordinated with UI migration) OR document the `borrower_*` response field names as intentional legacy aliases. Recommend the rename — cleanup before new tools depend on misleading names.

### 6.3 Language: "borrower" as a role label

**Decision 2026-04-20 (David):** "Borrower" is the correct user-facing label when a Contact is acting in borrower role. `contacts` is the schema module; "borrower" is one of several roles (borrower, co-borrower, realtor, partner). UI copy stays as "Borrower" / "Borrowers" for the borrower-role surfaces. No rename of user-visible copy required in D7.

Prop names and variable names (`borrower_name`, `loan.borrower`) are separate — those reflect API response shape, not user copy, and are addressed independently (see §6.2).

---

## 7 · Pass 6 residuals — status after PR #113

| Pass 6 ID | Finding | Status after PR #113 | Belongs in D7? |
|---|---|---|---|
| MLO-1 | `mlo/page.js` ALL_STATUSES / STATUS_LABELS / TIER1_FILTERS | ✅ extracted to `loan-statuses.js` | no (done) |
| MLO-2 | QuoteScenarioForm STATES/LOAN_TYPES/PURPOSES/TERMS/LOCK_DAYS | ❌ still hardcoded | **yes (QB-1)** |
| MLO-3 | `leads/[id]/page.js` PURPOSES/PROPERTY_TYPES/OCCUPANCY/STATES | ❌ still hardcoded | **yes (LE-1)** |
| MLO-4 | PipelineTable STATUS_LABELS/COLORS | ✅ imported from `loan-statuses.js` | no (done) |
| MLO-5 | LoanDetailView STATUS_LABELS/COLORS/DOC_TYPES/EVENT_ICONS | ❌ `StatusHeader.js`, `NotesActivitySection.js`, `DocumentsSection.js` still inline | **yes (LD-4/5/6)** |
| MLO-6 | StrikeRateForm LOAN_TYPES | ❌ still hardcoded (public component, cross-boundary) | partial (shared with non-MLO) |
| MLO-7 | scenario-alerts STATUS_FILTERS | ❌ still separate | document as intentional |
| MLO-8 | HOUSE_FEE_RATE in PayrollSection | ✅ extracted to `src/lib/payroll.js` | no (done) |
| MLO-9 | Closing-date algorithm | ❌ still inline — **and now duplicated in QuoteWizard** (QB-3 regression) | **yes (QB-3, QB-4)** |
| MLO-10 | Funding-date state/purpose rules | ❌ still inline, duplicated | **yes (QB-4)** |
| MLO-11 | FHA UFMIP `0.0175` in JSX | ❌ still hardcoded; joined by 2 more sites (`fee-builder.js`, `pricing-v2.js`) | **yes (QB-2)** |
| MLO-12 | HOUSE_FEE_RATE in CompensationSection | ✅ imports from `payroll.js` | no (done) |
| MLO-13 | Generic welcome copy | acceptable | no |
| MLO-14 | `isExpiringSoon(7 days)` magic number | ❌ still inline | low-priority D7 |
| MLO-15 | Fallback closing date "15" | ❌ still inline | low-priority D7 |

**Score:** 4 of 15 shipped (27%). 6 remain for D7. 1 regression found (MLO-9 duplicated into QuoteWizard).

---

## 8 · Rewritten D7 PR plan

The legacy "PRs 16–19 pipeline / lead detail / quote builder / dashboard" framing is retired. Replaced with surface-scoped, risk-ordered PRs.

### PR D7-1 · Pipeline dashboard — live bug + system lock (**ship first**)

**Scope:**
- PL-1: fix dead `primary` Tailwind classes — convert to `brand` (confirmed 2026-04-20 by David: `primary` was intended as `brand`). **Live visual bug.**
- PL-2: resolve `slate` vs `gray` drift — standardize on `ink.mid` / `surface.alt` / design tokens.
- PT-1: replace `#0891b2` avatar hex with brand token.
- PL-3: bulk action bar — verify dark palette is intentional (floating dark toolbar is a common pattern — document or retheme).
- PL-5: responsive stack for summary-card row at narrow viewports.
- **Does NOT change:** table column definitions, column headings (IA-1 / PT-4 closed — "Borrower" is the correct role label), API contract, data model.

**Deliverable size:** ~15 file edits, no API changes. 1 PR. Green build.

### PR D7-2 · Loan detail — dead-code delete + consolidations

**Scope:**
- LD-1: delete `LoanDetailView.js` + `LoanDetailViewLegacy.js` if unused (verify with grep before delete).
- LD-3: retheme `Core/sections/ApplicationSection.js` — replace all 15+ ad-hoc hex with brand/go/ink/surface tokens.
- LD-4/5/6: remove inline `STATUS_LABELS` / `DOC_STATUS_LABELS` / `STATUS_COLORS` from `StatusHeader.js`, `NotesActivitySection.js`, `DocumentsSection.js`; import from `src/lib/constants/loan-statuses.js` (+ add doc-status constants to same module if not present). Closes Pass 6 MLO-5.
- LD-2: audit `/api/portal/mlo/loans/[id]` response — is `loan.borrower` returned as a nested object? If yes, document as intentional D9a-era transform; if no, fix the UI read.

**Deliverable size:** ~20 file edits, 2 deletions. 1 PR.

### PR D7-3 · Picklist consolidation + date-rule dedup (closes Pass 6 MLO-2/3/9/10)

**Source-of-truth split (resolved 2026-04-20):**
- **DB-driven:** `STATES`, `LOAN_TYPES` — values change independently of code deploy.
- **Constants-driven:** `PURPOSES`, `PROPERTY_TYPES`, `OCCUPANCY`, `TERMS`, `LOCK_DAYS` — URLA enums / display option sets, stable.

**Scope — DB layer:**
- New table `ref_licensed_states` (code, name, display_order, is_active). Seed from current `LICENSED_STATES = ['CO', 'CA', 'OR', 'TX']` at `src/lib/constants/company.js:69`. Add the 46 remaining US state codes as `is_active=false` so the picklist can surface them read-only for property-state fields (licensed vs property-located are different picklists).
- New table `ref_loan_types` (code, display_label, sort_order, category, is_active). Curated, not derived from `rate_products.loan_type` — `rate_products` can carry stale types from retired lenders; portal wants admin-controlled labels. Seed from current hardcoded sets (conv, fha, va, usda, dscr, bank_statement, hecm, heloc, jumbo) with proper display labels.
- Consider cross-referencing `ref_loan_types.code` with `rate_products.loan_type` at seed time to catch divergence (MLO-6 jumbo vs bankstatement).
- DAL: `src/lib/picklists/db-loader.js` with cached SELECTs (React-query or simple in-memory cache).

**Scope — constants layer:**
- `src/lib/constants/picklists.js` — export `PURPOSES`, `PROPERTY_TYPES`, `OCCUPANCY`, `TERMS`, `LOCK_DAYS` as typed arrays with `{ value, label }` objects.

**Scope — date rules:**
- QB-3 / QB-4 / MLO-9/10: extract `defaultClosingDate`, `defaultFundingDate`, `deriveFromClosing` into `src/lib/dates/quote-defaults.js`. Delete duplicate in QuoteWizard.js.

**Consumers to update:**
- `src/components/Portal/QuoteGenerator/QuoteScenarioForm.js` (MLO-2)
- `src/app/portal/mlo/leads/[id]/page.js` (MLO-3)
- `src/components/Portal/QuoteGenerator/QuoteWizard.js` (date dup)
- `src/components/RateTool/StrikeRateForm.js` (MLO-6 — public component)
- Pipeline page state filter (if applicable)

**Deliverable size:** 2 new DB tables + seed migrations, 2 new source files (`picklists.js`, `db-loader.js`, `quote-defaults.js`), ~15 file edits. 1 PR (or split DB-migration from UI-consumer swap if preview testing wants serialization).

**MLO-6 alias resolution:** include both `jumbo` and `bank_statement` as separate `ref_loan_types` codes with distinct labels. `jumbo` is a category (high-balance conv/non-QM); `bank_statement` is a doc-type-driven non-QM product. They're not aliases — they're different things.

### PR D7-4 · FHA UFMIP single source (closes Pass 6 MLO-11 + Pass 1 B3)

**Scope:**
- QB-2: extract FHA UFMIP rate to `src/lib/rates/fha-ufmip.js` (or `src/lib/constants/fha.js`). Single export `FHA_UFMIP_RATE = 0.0175`.
- Consumers: `QuoteScenarioForm.js:394`, `fee-builder.js:91`, `pricing-v2.js:374`. All 3 import.
- Add comment documenting HUD source + last-verified date.
- Optional (scope call): emit a console warn in dev mode if the rate is queried past a known HUD revision date, to force a proactive check.

**Deliverable size:** 4 file edits, 1 new file. 1 PR.

**Rationale for splitting from PR D7-3:** crosses UI + pricing engine layers; wants its own commit for rollback clarity.

### PR D7-5 · Lead detail retheme + action-bar simplification

**Scope:**
- LE-2: collapse the 4-color action bar — primary CTA = `go` (Convert to Loan), secondary CTAs = ghost style, remove cyan + purple.
- LE-3: merge "Run Quote" inline with "Generate Quote" into one flow (decision with David; product question).
- LE-4: responsive stack for the 2-column scenario+pricing grid at narrow viewports.
- LE-5: emoji → SVG icons for portal-invite / needs-list buttons.
- LP-1: retheme contact status badges to brand tokens.

**Deliverable size:** ~8 file edits. 1 PR.

### PR D7-6 · Quote PDF retheme (borrower-visible regression)

**Scope:**
- QB-5: change `BRAND = '#0891b2'` → `BRAND = '#2E6BA8'` in `QuotePDF.js`. Add secondary tokens for go / accent where used. Verify PDF renders correctly (headless render + visual diff).
- Add the PDF brand color to DESIGN-SYSTEM.md "Email Templates" section (extend to cover PDF).

**Deliverable size:** 1-2 file edits. 1 PR. Ships with the others — low-risk.

### Deferred — nav/IA redesign (dedicated session)

**Decision 2026-04-20 (David):** nav and information-architecture redesign is pulled out of D7 entirely. It requires a consultation session to decide direction — David cares about module layout and wants to work through it together. This is NOT a D7 PR; it's a dedicated planning session scheduled separately.

Items that belong to the IA session (IA-2 through IA-7):
- IA-2: Quotes nav matches both `/quotes` and `/tools/quote-generator` — disambiguate.
- IA-3: "Backlog" in MLO nav — belongs in admin-only or dev-only area?
- IA-4: No "Today" / "Tasks" / "Calendar" landing — `loan_tasks` has no surface.
- IA-5: Tools flat in nav — grouped submenu needed?
- IA-6: Call history has no nav entry despite `CallLog` table existing.
- IA-7: Dark nav rail (`bg-gray-900`) — keep (document in DESIGN-SYSTEM.md as portal convention) or retheme to light surface?

(IA-1 closed — "Borrowers" is the correct role label.)

### Other deferred items (post-D7 or out of scope)

- **HECM optimizer retheme** — ~7 files, large cyan surface. Own PR after D7 core ships.
- **Quote list / quote detail (QL-*)** — low-traffic surfaces; bundle with or after D7-5.
- **API response rename** — `borrower_*` → `contact_*` on `/api/portal/mlo/pipeline` and `/api/portal/mlo/loans/[id]` response shapes. Discussion in §6.2 — semantic cruft, not breakage. Bundle with nav/IA session or ship after.

---

## 9 · Acceptance criteria for D7 "done"

D7 is done when **all** are true:

1. MLO portal uses zero `cyan-*`, `teal-*`, `sky-*`, `purple-*` Tailwind classes except where explicitly justified and documented (design-system extension).
2. Zero hardcoded hex values in MLO portal code except `#FFFFFF` / `#000000` (no ad-hoc colors).
3. Zero undefined Tailwind tokens in use (no dead `primary` classes).
4. All Pass 6 picklist / constants findings closed OR explicitly deferred to D9d with rationale (MLO-2, -3, -5, -6, -9, -10, -11 addressed).
5. `LoanDetailView.js` + `LoanDetailViewLegacy.js` deleted if unreferenced.
6. Quote PDF brand matches DESIGN-SYSTEM.md brand.
7. Every MLO page renders on small (≤1280px) viewports without layout break.
8. No regressions on pipeline load, loan detail, quote wizard, lead detail flows — smoke-tested on production.

The IA redesign (PR D7-7 candidates) is explicitly **out of D7's "done" definition** — it's a follow-on informed by D9 Layer 2.

---

## 10 · Cross-references

- [DESIGN-SYSTEM.md](../DESIGN-SYSTEM.md) — authoritative tokens, mirror of tailwind.config.js
- [PASS-6-MLO-PORTAL-INVENTORY-2026-04-16.md](./PASS-6-MLO-PORTAL-INVENTORY-2026-04-16.md) — original static-data inventory
- [UAD-SPEC.md](../UAD-SPEC.md) — Contact/Deal/Scenario architecture (target state)
- [UAD-LAYER-1-MIGRATION-PLAN.md](../UAD-LAYER-1-MIGRATION-PLAN.md) — Layer 1 rename plan (partially shipped as D9a)
- [PIPELINE-UI-SPEC.md](../PIPELINE-UI-SPEC.md) — retired Stitch-mockup narrow update (superseded by PR D7-1)
- [README.md](./README.md) §6 D7 — audit dimension status (to be updated to reflect this audit)

---

## 11 · Open questions for driver

| # | Question | Status |
|---|---|---|
| 1 | Nav label / column heading: "Borrowers" vs "Contacts" vs "Primary Borrower"? | ✅ **Resolved 2026-04-20:** "Borrower" is the user-facing role label, `contacts` is the schema module. No copy change. |
| 2 | `primary` Tailwind class — was it meant to be `brand`? | ✅ **Resolved 2026-04-20:** yes, `brand`. PR D7-1 replaces. |
| 3 | Dark nav rail — keep or retheme? | 🔜 **Deferred to nav/IA session.** |
| 4 | Loan type canonical codes — include `jumbo`? `bankstatement`? both? | ⏳ Open — blocks PR D7-3. Resolve per-code call when picklist consolidation ships. |
| 5 | `borrower_*` API response fields — rename to `contact_*` now or later? | 🔜 **Deferred** — bundle with nav/IA session or ship after. |
| 6 | PR ordering preference. | ✅ **Confirmed** — D7-1 first (live bug), D7-4 split out separately (crosses pricing layer). |
| 7 | Shared-picklist source — constants file vs DB table? | ✅ **Resolved 2026-04-20:** split per PR D7-3 §. STATES + LOAN_TYPES → DB (`ref_licensed_states`, `ref_loan_types`); PURPOSES / PROPERTY_TYPES / OCCUPANCY / TERMS / LOCK_DAYS → constants. |

---

## 12 · Change log

- **2026-04-20 (v1)** — initial audit filed. Grounded in current HEAD state (post-PR #115). Rewrites D7 PR plan as 6 surface-scoped PRs + a deferred block (IA + copy + API rename + HECM). Supersedes `PIPELINE-UI-SPEC.md` (Stitch-mockup narrow update pre-dating D9a + design-system lock).
- **2026-04-20 (v1.1)** — collaborative review with David. Decisions: (1) "Borrower" is the user-facing role label, `contacts` is the schema module — IA-1 / PT-4 closed. (2) `primary` class confirmed as intended-`brand`. (3) Nav/IA redesign (IA-2 through IA-7) pulled out of D7 entirely → dedicated consultation session. (4) PR D7-4 split confirmed (FHA UFMIP own PR). (5) Picklist split confirmed (Q7): STATES + LOAN_TYPES → DB tables (`ref_licensed_states`, `ref_loan_types`), remaining picklists → constants. PR D7-3 scope rewritten accordingly; MLO-6 alias resolved as "jumbo and bank_statement are distinct codes, not aliases."
