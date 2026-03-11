# Dev Brief: Rate Tool Engagement Layer (Print, Charts, Break-Even)

**From:** Marketing (pc-marketing) + Dev (pc-dev)
**To:** Dev (pc-dev)
**Date:** 2026-03-11
**Priority:** Next website build phase (after or alongside HECM Explorer)
**Status:** Approved by David, ready for Dev execution

---

## Why We're Building This

The rate tool works — it shows rates, adjustments, and costs transparently. But right now it's a table of numbers. Borrowers look, compare, and leave. Nothing goes home with them.

The gap: **people shop rates across 3-5 lenders.** If ours is the only one that gives them a branded, personalized report with visual proof of savings — that's the one they show their spouse. That's the one they call back about.

Three features, in dependency order:

1. **Rate vs. Cost Chart** — Visual storytelling for the rate/cost tradeoff (makes the table click)
2. **Print/Download Rate Quote** — Branded PDF they take with them (the leave-behind)
3. **Refi Break-Even Visualizer** — The chart that sells the deal (cumulative savings over time)

The break-even chart is the closer. But it needs the print view to be deliverable and the cost chart to make the tradeoff intuitive. All three ship together.

---

## Feature 1: Rate vs. Cost Chart

### What It Does

A visual chart showing the relationship between rate and upfront cost. Replaces the mental math of reading a table — borrowers instantly see the tradeoff: lower rate = higher upfront cost, higher rate = lender credit.

### Where It Goes

New component inserted between the rate table and the recoup analysis section in `RateResults.js`. Only renders when `scenario.loanAmount > 0`.

### New Files (2)

```
src/components/RateTool/RateCostChart.js    -- Recharts AreaChart component
src/components/RateTool/chartHelpers.js     -- Shared formatters + chart config
```

### Component Spec: RateCostChart.js

**Chart Type:** Recharts `AreaChart` (or `ComposedChart` with area + reference line)

**Data:** Uses same `priceRates()` output already computed in RateResults. Pass `visibleRates` as prop.

**Axes:**
- X-axis: Rate (e.g., 6.250%, 6.375%, 6.500%...)
- Y-axis: Net cost in dollars (negative = credit to borrower, positive = cost to borrower)

**Visual Elements:**
- Area fill: green below zero (credit zone), red above zero (cost zone)
- Reference line at $0 (the par line) — labeled "PAR"
- Dot markers on each rate point
- Active dot on hover showing: Rate, Monthly P&I, Net Cost
- If a rate is selected (user clicked "Get This Rate"), highlight that dot

**Sizing:**
- Full width of rate card container
- Height: 200px desktop, 160px mobile
- Responsive via Recharts `ResponsiveContainer`

**Colors:**
- Credit zone: `fill="#dcfce7"` (green-100), `stroke="#16a34a"` (green-600)
- Cost zone: `fill="#fee2e2"` (red-100), `stroke="#dc2626"` (red-600)
- Par line: `stroke="#0891b2"` (brand teal), dashed
- Tooltip: white background, brand border

**Labels:**
- Section header above chart: "Rate vs. Cost Tradeoff"
- Subtitle: "Lower rates cost more upfront. Higher rates earn you a lender credit."
- Left annotation: "← Lender Credit" (green)
- Right annotation: "Discount Points →" (red)

### chartHelpers.js

Shared utilities for all three chart components:

```javascript
export const CHART_COLORS = {
  brand: '#0891b2',
  brandDark: '#164e63',
  green: '#16a34a',
  greenLight: '#dcfce7',
  red: '#dc2626',
  redLight: '#fee2e2',
  gray: '#6b7280',
};

export const fmtDollar = (v) =>
  '$' + Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 0 });

export const fmtRate = (v) => v.toFixed(3) + '%';

export const fmtPI = (v) =>
  '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const TOOLTIP_STYLE = {
  backgroundColor: 'white',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  padding: '8px 12px',
  fontSize: '13px',
};
```

### Integration Point

In `RateResults.js`, add after the rate table `</div>` and before the recoup analysis:

```jsx
import RateCostChart from './RateCostChart';
// ...
<RateCostChart rates={visibleRates} parIndex={parIdx - showStart} />
```

---

## Feature 2: Print/Download Rate Quote

### What It Does

A "Save My Quote" button that triggers `window.print()`, rendering a branded, print-optimized rate summary. Uses CSS `@media print` to show/hide elements — same pattern as HECM `PrintView.js`.

No PDF library needed. Browser print → "Save as PDF" is universal and free.

### Where It Goes

- Print button: Added to the rate tool header bar (top right, next to the effective date)
- Print view: Hidden `<div>` rendered at the bottom of the RateTool component, visible only in print

### New Files (1)

```
src/components/RateTool/RateQuotePrintView.js  -- Print-optimized rate summary
```

### Existing File Modifications (2)

```
src/components/RateTool/index.js              -- Add print button + render PrintView
src/app/globals.css (or tailwind config)      -- Add @media print utilities if not present
```

### Component Spec: RateQuotePrintView.js

**Props:** `{ scenario, rateData, selectedRate }`

Uses same `calculateLLPA()` and `priceRates()` from engine.js — no new calculations.

**Page Layout (single page target):**

```
┌─────────────────────────────────────────┐
│  NetRate Mortgage LLC                   │
│  David Burson | NMLS 641790 | 1111861   │
│  303-444-5251 | david@netratemortgage   │
│  ─────────────────────────────────────  │
│                                         │
│  YOUR RATE QUOTE                        │
│  Date: March 11, 2026                   │
│                                         │
│  ┌─── Scenario ──────────────────────┐  │
│  │ Purpose: Rate/Term Refi           │  │
│  │ Property: $500,000 | SFR          │  │
│  │ Loan Amount: $400,000 | 80% LTV   │  │
│  │ Credit Score: 760+                │  │
│  │ Current Rate: 7.125%              │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌─── Selected Rate ─────────────────┐  │
│  │ ★ 6.625% — $2,562/mo             │  │
│  │   Credit: 0.25% (+$1,000)        │  │
│  │   Monthly Savings: $237/mo       │  │
│  │   Annual Savings: $2,844         │  │
│  └───────────────────────────────────┘  │
│                                         │
│  COMPARISON: 3 OPTIONS                  │
│  ┌──────────┬──────────┬──────────┐     │
│  │ Low Rate │  PAR     │ Low Cost │     │
│  │ 6.375%   │ 6.625%   │ 6.875%  │     │
│  │ $2,496/mo│ $2,562/mo│ $2,628  │     │
│  │ Cost:    │ Credit:  │ Credit: │     │
│  │  -$2,400 │  +$1,000 │ +$3,200 │     │
│  │ Save $301│ Save $237│ Save $171│     │
│  └──────────┴──────────┴──────────┘     │
│                                         │
│  PRICE ADJUSTMENTS                      │
│  FICO/LTV (760+, ≤80%): -0.250         │
│  Loan Amount: +0.000                    │
│  Total: -0.250 pts                      │
│                                         │
│  ─────────────────────────────────────  │
│  Rates approximate. Not a commitment.   │
│  Contact David for exact quote.         │
│  netratemortgage.com | 303-444-5251     │
└─────────────────────────────────────────┘
```

**Comparison rates:** User-selected. Each row in the rate table gets a "Compare" toggle button (checkbox or outline pill). User can select up to 3 rates. Those 3 become the comparison columns in the print view.

State tracked in RateTool index.js: `const [compareRates, setCompareRates] = useState([])` (array of rate objects, max 3).

If user has selected rates via Compare, those print. If none selected, fall back to auto-pick: Low Rate / PAR / Low Cost. The first-selected or PAR rate is the hero.

**Refi additions (only when `scenario.purpose !== 'purchase'`):**
- Monthly savings per rate
- Annual savings
- Break-even months (cost / monthly savings)
- "Break-even" row in comparison table

**Print CSS:**
```css
@media print {
  .no-print { display: none !important; }
  .print-only { display: block !important; }
  @page { margin: 0.5in; size: letter; }
}
```

### Print Button in index.js

Add to the header bar (top right area):

```jsx
<button
  onClick={() => window.print()}
  className="text-xs bg-white/20 text-white px-3 py-1.5 rounded hover:bg-white/30 transition-colors no-print"
>
  🖨 Print My Quote
</button>
```

The entire RateTool body gets `className="no-print"` and the PrintView gets `className="hidden print:block"` (same pattern as HECM).

---

## Feature 3: Refi Break-Even Visualizer

### What It Does

A line chart showing cumulative savings over time for a refinance. The "aha moment" chart — borrowers see the crossover point where savings exceed cost, then the line keeps climbing. This is the chart that sells the deal.

### Where It Goes

New section below the recoup analysis cards, only visible for refinance scenarios (`scenario.purpose !== 'purchase'`). Also included in the print view.

### New Files (1)

```
src/components/RateTool/BreakEvenChart.js   -- Recharts LineChart + annotation
```

### Component Spec: BreakEvenChart.js

**Props:** `{ rate, scenario, rateData }`

Where `rate` is the selected or par rate object from `priceRates()`.

**Calculation (inline, no new engine function):**

```javascript
// Net cost = lender fees + credit/charge dollars + third-party costs
const lenderFees = rateData.lender.lenderFees;
const thirdParty = scenario.thirdPartyCosts || 2800;
// creditDollars is negative when lender gives credit (reduces cost)
const netCost = lenderFees + thirdParty - rate.creditDollars;  // creditDollars negative = subtract = reduce cost

// Monthly savings
const currentPI = calculatePI(scenario.currentRate, scenario.loanAmount);
const monthlySavings = currentPI - rate.monthlyPI;

// Calculate break-even point
const breakEvenMonth = monthlySavings > 0 ? Math.ceil(netCost / monthlySavings) : null;

// Dynamic horizon: extend to break-even + 50% padding (min 12 months, max 120)
const horizon = breakEvenMonth
  ? Math.min(Math.max(Math.ceil(breakEvenMonth * 1.5), 12), 120)
  : 60;

// Build data points: month 0 to horizon
const data = [];
for (let m = 0; m <= horizon; m++) {
  const cumulativeSavings = monthlySavings * m;
  const netPosition = cumulativeSavings - netCost;
  data.push({ month: m, savings: cumulativeSavings, cost: netCost, net: netPosition });
}
```

**Chart Type:** Recharts `ComposedChart`

**Elements:**
- **Line 1:** Cumulative savings (green, solid) — rises linearly from $0
- **Line 2:** Total cost (red, dashed, flat) — horizontal line at `netCost`
- **Filled area:** Green fill between savings line and cost line AFTER break-even point
- **Reference dot:** At the break-even month — large teal dot with label
- **X-axis:** Months (0, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60) — labeled "Months After Refinance"
- **Y-axis:** Dollars — labeled with $ formatter

**Annotations:**
- Break-even callout: "Break even in {N} months" with arrow pointing to crossover
- After break-even: "Every month after = ${savings}/mo in your pocket"
- 5-year total: "5-Year Net Savings: ${total}" (bold, brand color)

**Hero stats above chart (flex row):**

```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ Monthly       │ Refi Cost    │ Break Even   │ Post-Recoup  │
│ Savings       │              │              │ Savings/yr   │
│ $237/mo       │ $1,495       │ 6.3 months   │ $2,844/yr    │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

**Sizing:**
- Full width of rate card container
- Height: 280px desktop, 220px mobile
- `ResponsiveContainer`

**Edge cases:**
- If `monthlySavings <= 0`: Don't render chart. Show message: "Your current rate is already competitive — a refinance wouldn't save you money at this rate."
- If `breakEvenMonth > 60`: Extend chart to `breakEvenMonth + 12` months, show warning: "Break-even is over 5 years. Consider a lower-cost rate option."
- If rate has lender credit (not cost): Cost line is near $0, break-even is near instant. Show: "This rate earns you a credit — you save from day one."

### Interactivity

**Rate selector above chart:** Small dropdown or pill buttons showing 3 rates (same Low Rate / PAR / Low Cost from print view). Clicking one recalculates the chart. This lets borrowers visually compare: "Do I want to pay more upfront and save more monthly, or take the credit and save less?"

Default: PAR rate (or selected rate if user clicked "Get This Rate").

### Integration Points

**In RateResults.js:** Add after recoup analysis section:

```jsx
import BreakEvenChart from './BreakEvenChart';
// ... (only for refi)
{currentPI && scenario.loanAmount > 0 && (
  <BreakEvenChart
    rates={visibleRates}
    parIndex={parIdx - showStart}
    scenario={scenario}
    rateData={rateData}
    selectedRate={selectedRate}
  />
)}
```

**In RateQuotePrintView.js:** Static version of the chart stats (no interactive chart in print — just the hero stats row + text summary):

```
BREAK-EVEN ANALYSIS
Rate: 6.625% | Monthly Savings: $237
Lender Fees: $1,495 | Third-Party Costs: $2,800 (CO) | Credit: +$1,000
Net Refi Cost: $3,295 | Break Even: 13.9 months
"You recover the full cost of refinancing in under 14 months,
then save $237 every month for the life of the loan."
```

---

## Feature 4: Third-Party Fee Estimates (State Defaults + Override)

### What It Does

Adds estimated third-party closing costs to the break-even calculation and print view. Pre-fills by state, user can adjust.

### New File (1)

```
src/lib/rates/closing-costs.js    -- State-level default estimates + helpers
```

### Data Structure

```javascript
// State-level third-party cost estimates (title, appraisal, recording, etc.)
// These are ESTIMATES — actual fees vary by county, title company, and loan amount.
export const THIRD_PARTY_DEFAULTS = {
  CO: { total: 2800, label: 'Colorado estimate' },
  TX: { total: 3200, label: 'Texas estimate' },
  OR: { total: 2600, label: 'Oregon estimate' },
  CA: { total: 3400, label: 'California estimate' },  // future
};

export const DEFAULT_THIRD_PARTY = 2800; // fallback if no state selected

export function getThirdPartyCosts(state) {
  return THIRD_PARTY_DEFAULTS[state]?.total || DEFAULT_THIRD_PARTY;
}
```

### Integration

**ScenarioForm.js** — Add two new fields:
- **State** dropdown (CO, TX, OR) — auto-fills third-party estimate
- **Estimated Third-Party Costs** number input — pre-filled from state default, user can override

These values flow into the scenario object: `scenario.state`, `scenario.thirdPartyCosts`

**BreakEvenChart.js** — Include third-party costs in total refi cost:
```javascript
const totalRefiCost = Math.abs(rate.creditDollars) + lenderFees + scenario.thirdPartyCosts;
```

**RateQuotePrintView.js** — Show as separate line item:
```
COST BREAKDOWN
  Lender Fees:           $1,495
  Credit/Charge:         +$1,000 (credit)
  Third-Party Costs:     $2,800 (CO estimate)
  ─────────────────────────────
  Net Refi Cost:         $3,295
```

### Why This Matters

Without third-party fees, the break-even chart understates the true cost. A 6-month break-even becomes 14 months when you add title + appraisal. Being upfront about this is the NetRate way — and it still looks good because the savings compound over time.

---

## Architecture Summary

### New files to create (5):

```
src/components/RateTool/RateCostChart.js       -- Rate vs. cost area chart
src/components/RateTool/chartHelpers.js        -- Shared chart config + formatters
src/components/RateTool/BreakEvenChart.js       -- Cumulative savings line chart
src/components/RateTool/RateQuotePrintView.js   -- Print-optimized rate summary
src/lib/rates/closing-costs.js                 -- State-level third-party cost defaults
```

### Existing files to modify (3):

```
src/components/RateTool/index.js       -- Add print button, compareRates state, render PrintView
src/components/RateTool/RateResults.js -- Add RateCostChart, BreakEvenChart, Compare toggles
src/components/RateTool/ScenarioForm.js -- Add State dropdown + third-party costs input
```

### Dependency:

```
npm install recharts    (if not already added for HECM Explorer)
```

Recharts is already planned for HECM Explorer. If building these features in the same phase, single install covers both.

### No new API routes. No new database tables. No migrations.

All data comes from the existing `priceRates()` engine output and scenario state that's already computed client-side.

---

## User Flow After Build

```
[Borrower enters scenario]
  ↓
[Rate table renders (existing)]
  ↓
[Rate vs. Cost chart renders below table — instant visual "aha"]
  ↓
[Recoup analysis cards (existing, for refi)]
  ↓
[Break-Even chart renders — shows savings over time, interactive rate selector]
  ↓
[Borrower clicks "Save Quote" → branded PDF with scenario, 3 rates, break-even stats]
  ↓
[Takes PDF home, shows spouse, calls David]
```

---

## Conversion Psychology

The current rate tool asks: "Which rate do you want?" — that's a decision question.

These features reframe it as: "Look how much you'll save." — that's a motivation statement.

- **Cost chart**: "I understand the tradeoff now" → confidence
- **Break-even chart**: "I'll make my money back in 14 months" → urgency
- **Print quote**: "I can show this to my spouse tonight" → action

The break-even chart is the closer. David was right — that's the report you sell. The other two make it land.

---

## Print View Generates Leads Without a Form

Key insight: The print quote has David's name, phone, and email on every page. It's a branded leave-behind that follows the borrower home. The borrower doesn't need to fill out a lead form — they have the quote, they have the number. When they're ready, they call.

This complements the existing lead capture forms (which capture "ready now" leads) by also capturing "shopping and comparing" borrowers who aren't ready to give their phone number yet.

---

## David's Decisions (Answered 2026-03-11)

1. **Lender fees** — Separate line item. Must be aware of lender fees on rate sheets (varies by lender/product).
2. **Chart time horizon** — Dynamic. Chart extends until break-even is reached, not a fixed timeframe. The point is showing the payoff moment, not an arbitrary window.
3. **Rate comparison in print** — User picks. Add a "Compare" button on rate table rows. User selects up to 3 rates. Those 3 are the ones that print. (Replaces the auto-pick of Low Rate / PAR / Low Cost.)
4. **Button label** — "Print My Quote"
5. **Third-party fees** — State-level defaults + user override. Pre-fill estimated third-party fees by state (CO ~$2,800, TX ~$3,200, OR ~$2,600). User can adjust via input/slider. Transparent and honest. Fees included in break-even calculation and print view as separate line item.

---

## Verification Plan

1. Rate vs. Cost chart: verify data matches table (same rates, same dollar amounts)
2. Break-even chart: manually calculate break-even for known scenario, compare to chart
3. Print view: test in Chrome print preview, verify single-page fit, check all data matches screen
4. Edge cases: purchase scenario (no break-even), very low savings (long break-even), lender credit rate (instant break-even)
5. Mobile: all charts responsive at 375px, print still works from mobile
6. Recharts bundle size: verify tree-shaking, check build output
7. Existing functionality: rate table, lead capture, recoup cards all still work unchanged

---

*This brief covers the Rate Tool engagement layer. All three features ship together as they depend on each other for the full conversion story: understand → visualize → take home.*
