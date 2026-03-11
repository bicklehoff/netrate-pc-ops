# Dev Brief: HECM Explorer (Borrower-Facing Reverse Mortgage Tool)

**From:** Marketing (pc-marketing)
**To:** Dev (pc-dev)
**Date:** 2026-03-11
**Priority:** Next website build phase
**Status:** Approved by David, ready for Dev execution

---

## Why We're Building This

Marketing research identified a wide-open SEO opportunity in the reverse mortgage space. Bruce Simmons (ALM, Denver) dominates Colorado via radio but nobody — not Bruce, not nationals — publishes cost-transparent content with real math. NetRate already has a HECM lead from an old Locus blog post, proving the channel works.

The strategy: **blog posts drive traffic** (cost transparency, "lower fees = more money" angle) → **interactive tool engages and converts** (HECM Explorer) → **lead capture**. David's angle for HECMs is the same as forward: "I collect less so the borrower gets more." For reverse mortgages this is even more compelling because fees directly reduce borrower equity — it's a zero-sum ratio that compounds.

David is licensed for HECMs and has an active application. This isn't speculative — it's a proven channel getting a real tool.

---

## What to Build

### New Route: `/tools/reverse-mortgage-calculator`

A borrower-friendly, visual, interactive reverse mortgage calculator. The existing `/tools/hecm-optimizer` stays as the MLO tool (unchanged).

### User Flow

```
[Borrower lands on page]
    |
[Input Form] -- Age, Home Value, Existing Mortgage, State
    | (auto-fetches CMT rates, runs optimizer, picks best option)
[Results Dashboard]
    |-- Hero Card: "You could access $X"
    |-- Cost Transparency Section (bar chart + breakdown)
    |-- LOC Growth Chart (line chart, 20-year projection)
    |-- ARM vs Fixed Comparison (side-by-side cards)
    |-- Educational Hints (tooltips + expandable sections)
    |-- Lead Capture (woven in, not a wall)
    |
[Adjust inputs via sliders -> results recalculate instantly]
```

---

## Architecture

### New files to create (10):

```
src/app/tools/reverse-mortgage-calculator/
  page.js                          -- Route wrapper (public, no auth)

src/components/HecmExplorer/
  HecmExplorerPage.js              -- Main orchestrator
  ExplorerInputs.js                -- Simplified input form with sliders
  ExplorerResults.js               -- Results dashboard (cards + charts)
  CostBreakdown.js                 -- Bar chart + itemized costs
  LOCGrowthChart.js                -- Line chart: LOC over 20 years
  ScenarioCards.js                 -- ARM vs Fixed comparison cards
  ExplorerEducation.js             -- Tooltips, expandable explainers
  useHecmEstimate.js               -- Custom hook: inputs -> calculation -> results
  ExplorerPrintView.js             -- Print-friendly output
```

### Existing files to reuse (no changes):

```
src/lib/hecm/calculations.js      -- calculateARMScenario(), calculateFixedScenario()
src/lib/hecm/optimizer.js          -- runOptimizerSweep() (auto-picks best margin)
src/lib/hecm/constants.js          -- UFMIP_RATE, DEFAULT_FHA_LIMIT, DEFAULT_MIP_RATE
src/lib/hecm/plf-table.js          -- PLF_TABLE
src/lib/hecm/rate-sheet.js         -- ASL_PRICING, MH_FIXED_RATES, getLLPAAdjustment()
src/components/RateTool/LeadCapture.js  -- Reuse with source='reverse_mortgage_tool'
/api/portal/mlo/treasury-rates     -- Auto-fetch 1yr + 10yr CMT (already built, 1hr cache)
/api/lead                          -- Lead capture (already built, stores to Prisma)
```

### Files to modify (minor, 3):

```
package.json                       -- Add recharts dependency
src/app/page.js                    -- Update Tools grid card for reverse mortgage
src/app/tools/hecm-optimizer/page.js -- Add cross-link to borrower version
```

### New dependency:

```
npm install recharts
```

Recharts: React-native, tree-shakeable, ~45KB gzipped. Needed for BarChart (cost breakdown) and LineChart (LOC growth).

---

## Component Specs

### 1. HecmExplorerPage.js -- Main Orchestrator

- Client component ('use client')
- Manages borrower input state via useState
- Calls useHecmEstimate hook for calculations
- Renders: heading -> ExplorerInputs -> ExplorerResults (when calculated) -> LeadCapture
- Responsive: single column mobile, two-column desktop (inputs left, results right) OR stacked

### 2. ExplorerInputs.js -- Simplified Inputs with Sliders

| Field | Input Type | Range/Default | Notes |
|-------|-----------|---------------|-------|
| Age | Slider + number | 62-95, default 70 | "Age of youngest borrower" |
| Home Value | Slider + number | $100K-$2M, step $10K, default $500K | Format as currency |
| Existing Mortgage | Number input | $0+, default $0 | "Current mortgage balance, if any" |
| State | Select dropdown | CO, TX, OR (+ CA when ready) | For future state-specific content |

Follow existing Step2Purchase.js slider pattern: native `<input type="range">` with accent-brand, synced bidirectionally with text input.

Behavior: Results recalculate on every input change (debounced ~300ms for sliders). No "Calculate" button -- instant feedback.

### 3. useHecmEstimate.js -- Custom Calculation Hook

```javascript
// Pseudo-code
function useHecmEstimate({ age, homeValue, existingLiens }) {
  // Fetch CMT rates on mount (existing /api/portal/mlo/treasury-rates)
  // Auto-calculate origination fee via calcOriginationFee(homeValue)
  // Standard third-party costs: $2,835.85 (from HECM optimizer defaults)
  // Run runOptimizerSweep() to find best margin (targetComp: $5,000)
  // Calculate ARM scenario with borrowerBest margin
  // Calculate Fixed scenario for comparison (7.810% mid-range)
  // Return { arm, fixed, sweep, cmtDate }
}
```

Key: This wraps the existing calculation engine. No new math -- just auto-fills what the MLO would manually enter.

### 4. ExplorerResults.js -- Results Dashboard

**Section A -- Hero Card:**
- Large number: "You could access up to $120,400"
- Subtitle with rate, age, home value
- Brand teal gradient/border

**Section B -- Cost Transparency (CostBreakdown.js):**
- Horizontal bar chart (Recharts BarChart): UFMIP, Origination, Third-Party, Lender Credit
- Below: "NetRate charges [$X] in origination -- compared to HUD max of $6,000"
- Expandable: "Why do costs matter?"

**Section C -- LOC Growth (LOCGrowthChart.js):**
- Line chart (Recharts LineChart): LOC balance over 20 years
- X: Years (0, 5, 10, 15, 20) | Y: Dollar amount
- Two lines: "Available now" flat + "Growing LOC" curve
- Hover tooltips with exact values

**Section D -- ARM vs Fixed (ScenarioCards.js):**
- Two side-by-side cards showing rate, cash, growth
- Highlight recommended option
- One-liner each: "Best for flexibility" / "Best for certainty"

**Section E -- Lead Capture (inline):**
- "Want a personalized quote with exact numbers?"
- Reuse LeadCapture component, source='reverse_mortgage_tool'

### 5. ExplorerEducation.js -- Contextual Tooltips

Info icons next to key terms, expand on click:
- UFMIP, Origination Fee, LOC Growth, ARM vs Fixed, Principal Limit Factor
- Follow RateEducation.js pattern (useState toggle, no external library)

### 6. ExplorerPrintView.js -- Print Output

- Hidden on screen, visible on print (follow PrintView.js pattern)
- NetRate branding, borrower inputs, key results, disclaimer
- NO broker comp or internal data

---

## Homepage Integration

Update Tools & Calculators grid (src/app/page.js, ~lines 396-458):
- Change reverse mortgage card link: `/tools/hecm-optimizer` -> `/tools/reverse-mortgage-calculator`
- Update description: "See how much equity you could access -- interactive calculator with real-time rates"
- Add cross-links between optimizer and explorer

---

## SEO / Meta

- Title: "Reverse Mortgage Calculator -- See How Much You Could Access | NetRate Mortgage"
- Description: "Free reverse mortgage calculator for Colorado, Texas, and Oregon homeowners. Enter your age and home value to see personalized estimates with transparent costs."
- Structured data: FAQPage schema for educational content

---

## Open Questions for David (Dev can start without these)

1. **NetRate's HECM origination fee** -- What does David charge? Tool should show real number vs. HUD max as selling point. Use placeholder until answered.
2. **Target comp** -- $5,000 default in optimizer. Correct for borrower-facing auto-recommendation?
3. **Third-party costs** -- $2,835.85 standard from HECM optimizer defaults. Use as estimate default?
4. **States** -- CO, TX, OR active. Add CA as "Coming Soon"?

---

## Verification Plan

1. Unit test useHecmEstimate: known inputs should match HECM Optimizer output
2. Visual check: mobile (375px), tablet (768px), desktop (1280px)
3. Slider responsiveness: rapid adjustment, no jank
4. CMT rate fetch: verify treasury-rates API, handle offline
5. Lead capture: test lead appears in DB with source='reverse_mortgage_tool'
6. Charts: LOC growth curve reasonable, costs sum correctly
7. Print: clean PDF-friendly output
8. Cross-links: homepage card -> new tool, optimizer <-> explorer
9. Edge cases: age 62, age 95+, FHA limit, $0 liens, high liens (shortfall)

---

## Future Phases (Marketing will brief separately)

- **Phase 2:** Forward mortgage visualization (add charts to Rate Tool)
- **Phase 3:** Blog infrastructure (5 reverse mortgage SEO posts)
- **Phase 4:** Cross-tool integration (blog -> calculator deep links, progressive lead capture)

---

## Marketing Context

This tool is the conversion engine for a reverse mortgage content strategy. The blog posts (Phase 3) target search gaps nobody is filling -- cost transparency, "lower fees = more money" math, comparison content. Every post will link to this calculator as proof. The calculator itself is the product differentiator: "Don't take our word for it -- run your own numbers."

Bruce Simmons spends $50K+/yr on radio. NetRate spends $0 and lets the tools do the selling. That's the positioning.
