# Spec: Benchmark Index Rates on Rate Watch Page

**Author:** pc-dev
**Date:** 2026-04-01
**Status:** Ready for implementation
**Priority:** Next session

---

## What

Add a "Benchmark Indexes" section to the Rate Watch page showing the key rates that drive ARM, HELOC, and Reverse Mortgage pricing. Borrowers and LOs need to see these alongside Treasury Yields.

## Why

- Borrowers with ARMs, HELOCs, or reverse mortgages need to track their index
- Nobody else shows all three indexes in one place alongside live mortgage rates
- Positions NetRate as the go-to rate monitoring page
- SEO value: "current SOFR rate", "prime rate today", "CMT rate" are high-intent search terms

---

## Indexes to Display

| Index | Source | FRED Series | Update Frequency | Used By |
|-------|--------|-------------|-----------------|---------|
| **30-Day Avg SOFR** | FRED | `SOFR30DAYAVG` | Daily | ARMs (5/6, 7/6, 10/6 SOFR) |
| **SOFR (Overnight)** | FRED | `SOFR` | Daily | Reference / context |
| **Prime Rate** | FRED | `DPRIME` | When Fed changes | HELOCs, some consumer loans |
| **Fed Funds Rate** | FRED | `FEDFUNDS` | Monthly (effective) | Drives Prime (Prime = FFR + 3%) |
| **10-Year CMT** | Treasury.gov CSV | Already parsed in `/api/portal/mlo/treasury-rates` | Daily | Reverse mortgages (HECM expected rate) |
| **1-Year CMT** | Treasury.gov CSV | Already parsed in `/api/portal/mlo/treasury-rates` | Daily | Some legacy ARMs |

### Already available (no new data needed)
- **Treasury Yields** (DGS2, DGS5, DGS10, DGS30) — already on Rate Watch via FRED
- **10yr and 1yr CMT** — already parsed in `/api/portal/mlo/treasury-rates` from Treasury.gov CSV

### New FRED series to add
- `SOFR30DAYAVG` — 30-Day Average SOFR
- `SOFR` — Overnight SOFR
- `DPRIME` — Prime Rate
- `FEDFUNDS` — Effective Federal Funds Rate

---

## Implementation

### 1. Expand FRED fetch in `rate-watch/page.js`

Add the 4 new series to the `FRED_SERIES` config and `FRED_FALLBACK` in `getFredData()`. They use the same FRED API, same `FRED_API_KEY` — just different series IDs.

### 2. Fetch CMT rates server-side

Call the Treasury.gov CSV directly from the page server component (same pattern as the FRED fix — don't self-fetch the API route). Extract 1yr and 10yr CMT. The parser logic already exists in `/api/portal/mlo/treasury-rates/route.js` — extract into a shared lib function.

### 3. New component: `BenchmarkIndexes`

**File:** `src/components/RateWatch/BenchmarkIndexes.js`

Layout: Card matching the existing bento grid style. Two-column or three-column grid inside:

```
┌─────────────────────────────────────────────────────┐
│  Benchmark Index Rates                              │
├──────────────┬──────────────┬───────────────────────┤
│  ARM Indexes │ HELOC / Fed  │ Reverse Mortgage      │
│              │              │                       │
│  30d SOFR    │ Prime Rate   │ 10yr CMT              │
│  4.33%       │ 7.50%        │ 4.43%                 │
│  unch        │ unch         │ -0.01                 │
│              │              │                       │
│  SOFR O/N    │ Fed Funds    │ 1yr CMT               │
│  4.31%       │ 4.50%        │ 4.08%                 │
│  -0.01       │ unch         │ +0.02                 │
└──────────────┴──────────────┴───────────────────────┘
```

Each index shows:
- Label (e.g., "30-Day Avg SOFR")
- Sublabel (e.g., "ARM Index")
- Current value with 2-3 decimal places
- Daily change with color (green = down/good for borrowers, red = up)

### 4. Place in page layout

Add as a new row in the bento grid, likely between the Rate Chart (Row 4) and What Happened Today (Row 5). Full-width like the chart, or 2-col + 1-col with something else.

Alternative: Replace or extend the existing Treasury Yields sidebar card to include these. The Treasury Yields card currently shows DGS2/5/10/30 — could add the benchmark indexes below it, but that makes the card very tall.

**Recommended:** Full-width row below the chart. More room, better visual hierarchy, clear separation between "Treasury curve" (existing) and "Benchmark indexes" (new).

### 5. SEO

Add structured data (Dataset schema) for the benchmark rates. Target keywords:
- "current SOFR rate"
- "prime rate today"
- "10 year CMT rate"
- "HELOC rate index"
- "ARM index rate"

---

## Data Sources Summary

| Data | Source | Cost | Auth |
|------|--------|------|------|
| SOFR, SOFR30DAYAVG, DPRIME, FEDFUNDS | FRED API | Free | FRED_API_KEY (already on Vercel) |
| 1yr CMT, 10yr CMT | Treasury.gov CSV | Free | None |
| DGS2/5/10/30 | FRED API | Free | FRED_API_KEY |

**No new API keys or costs required.**

---

## Files to modify/create

1. `src/app/rate-watch/page.js` — add new FRED series + Treasury CMT fetch
2. `src/components/RateWatch/BenchmarkIndexes.js` — **new** component
3. `src/lib/rates/treasury-cmt.js` — **new** shared lib (extract from API route)

## Open questions

- Do we want historical charts for these indexes too? (Could add later)
- Should the benchmark indexes also appear on the homepage rate strip?
