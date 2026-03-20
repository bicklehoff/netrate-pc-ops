# Homepage Live Data Wiring — Dev Handoff Brief

**From:** Marketing (March 5-6, 2026)
**For:** WebDev
**Commit:** `8216753` — Homepage redesign deployed (behind password wall)
**Priority:** Ship before password wall comes down

---

## What's Done

The full homepage redesign is committed and deploying. Every section is built with **placeholder data**. This brief tells you exactly what needs to be wired to live sources and how.

---

## Layer 1: Rate Card + Rates Table (LOW effort — already wired)

**What's placeholder:**
- Hero rate card: 4 hardcoded products (30-Yr, 15-Yr, FHA, VA) with Rate + APR
- Below-fold rates table: 6 hardcoded products with Rate, APR, Change, Mo. Payment

**Where live data comes from:**
- `/api/rates` already returns live data from GCS (Claw → GCS → API pipeline, working since Feb 27)
- The rates page (`/rates`) already fetches from this API

**What dev needs to do:**
1. Convert `page.js` homepage to fetch from `/api/rates` (server component fetch or client-side `useEffect`)
2. Map API response fields to the hero rate card (top 4 products: 30-Yr Fixed, 15-Yr Fixed, FHA 30-Yr, VA 30-Yr)
3. Map API response to the full rates table (all 6 products including Jumbo and DSCR)
4. Replace hardcoded "Updated today" / "March 5, 2026" with actual `effectiveDate` from API
5. Calculate "Change" column from previous day's data (or omit if historical data not available yet)

**API response shape (for reference):**
```
GET /api/rates → {
  effectiveDate: "3/5/2026",
  source: "gcs",
  products: {
    "conv30": { rate, apr, points, payment, ... },
    "conv15": { rate, apr, points, payment, ... },
    "fha30": { rate, apr, points, payment, ... },
    "va30": { rate, apr, points, payment, ... },
    "jumbo30": { rate, apr, points, payment, ... },
    ...
  }
}
```

**Important:** APR must ALWAYS accompany displayed rates (compliance requirement).

---

## Layer 2: Market Ticker (MEDIUM effort — new pipeline needed)

**What's placeholder:**
- 10-Yr Treasury: 4.136%
- UMBS 5.0: 99.81
- Nat'l Avg 30-Yr: 6.37% (Freddie Mac)
- NetRate 30-Yr: 5.875%
- S&P 500: 5,842
- Timestamp: Mar 5, 2026 · 3:30 PM ET

**Where live data will come from:**

| Data Point | Source | How to Get It |
|---|---|---|
| 10-Yr Treasury | Public (FRED API or scraped) | FRED API is free, `DGS10` series, daily |
| UMBS 5.0 | MBS Live (David's subscription) | Claw scrapes → GCS |
| Nat'l Avg 30-Yr | Freddie Mac PMMS | Public, weekly release (Thursdays), available via FRED `MORTGAGE30US` |
| NetRate 30-Yr | `/api/rates` | Already have this — pull from existing rate pipeline |
| S&P 500 | Public (Yahoo Finance, Alpha Vantage, etc.) | Free APIs available |
| Timestamp | Server-side | Generate from `effectiveDate` or current time |

**Recommended approach — two phases:**

**Phase A (quick win):** Wire "NetRate 30-Yr" from existing `/api/rates` pipeline. The rest stays as manually-updated placeholder for now.

**Phase B (full pipeline):** Extend Claw's GCS upload to include a `market.json` manifest alongside rate data:
```json
// market.json — Claw uploads daily alongside rate files
{
  "timestamp": "2026-03-06T15:30:00Z",
  "treasury10yr": { "value": 4.136, "change": 0.04, "direction": "up" },
  "umbs50": { "value": 99.81, "change": -0.16, "direction": "down" },
  "nationalAvg30yr": { "value": 6.37, "source": "Freddie Mac PMMS" },
  "sp500": { "value": 5842, "change": 0.3, "changeType": "percent", "direction": "up" }
}
```

Then create `/api/market` endpoint that reads `market.json` from GCS (same pattern as `/api/rates` using `fetchGCSFile()`).

**Claw relay needed:** Tell Claw to add market data scraping to its daily routine and upload `market.json` to the same GCS bucket.

**Ticker animation note:** The CSS animation (`ticker-scroll` in `globals.css`) works by duplicating content — the `[0, 1].map()` in `page.js` renders two identical copies. When wiring live data, keep this pattern (render the data block twice).

---

## Layer 3: Rate Comparison Chart (HIGHER effort — needs historical data)

**What's placeholder:**
- 6 data points (Oct → Now) for both National Avg and NetRate lines
- Hardcoded SVG path coordinates
- "0.50% below the national average" badge

**The challenge:** We don't have historical rate data yet. The current pipeline only stores today's rates.

**What dev needs to do — two phases:**

**Phase A (start accumulating):**
1. Create a `rate_history` table in Neon Postgres (or a `rate-history/` folder in GCS):
   ```sql
   CREATE TABLE rate_history (
     id SERIAL PRIMARY KEY,
     date DATE NOT NULL,
     netrate_30yr DECIMAL(5,3),
     national_avg_30yr DECIMAL(5,3),
     created_at TIMESTAMP DEFAULT NOW()
   );
   ```
2. Add a daily job (Claw cron or Vercel cron) that snapshots today's 30-yr rate + Freddie Mac national avg into this table
3. After 1-2 weeks of data accumulation, we'll have enough points for a real chart

**Phase B (render dynamic chart):**
1. Create `/api/rate-history` endpoint returning last 6 months of weekly data points
2. Convert hardcoded SVG path coordinates to computed values based on actual data
3. The SVG viewBox is `0 0 700 180` with Y-axis mapping:
   - Y=40 → 7.0%, Y=70 → 6.5%, Y=100 → 6.0%, Y=130 → 5.5%
   - X=80 (oldest) → X=650 (newest), 6 data points evenly spaced
4. Dynamically compute the "X.XX% below national average" badge

**Interim solution:** Keep the placeholder chart as-is (it's representative of the real gap). Add a small "Illustrative" label if David wants, or just leave it — the shape is directionally correct.

---

## File Reference

| File | What's in it |
|---|---|
| `src/app/page.js` | Full homepage — ticker (lines 7-47), hero (49-163), chart (165-246), rates table (251-223), everything below |
| `src/app/globals.css` | Ticker animation keyframes (`ticker-scroll`, 30s loop, pause on hover) |
| `src/components/TrustBar.js` | Dark stats bar (11 lenders, 13 years, $26.6M, 87.7%) |
| `src/app/layout.js` | Nav links updated (Rates, Tools /#tools, Market /#market, About) |
| `.agents/product-marketing-context.md` | Brand voice and positioning reference |
| `src/lib/gcs.js` | Existing GCS fetch helper (use same pattern for market data) |

---

## Priority Order

1. **Wire rate card + rates table** from `/api/rates` (quick, high impact, existing pipeline)
2. **Wire NetRate 30-Yr in ticker** from `/api/rates` (quick win for Phase A)
3. **Start rate history accumulation** (low effort, needs to run for weeks before chart is useful)
4. **Relay to Claw** for `market.json` pipeline (enables full ticker)
5. **Build `/api/market` endpoint** (after Claw delivers market.json)
6. **Dynamic chart rendering** (after enough historical data accumulates)

---

## Design Decisions to Preserve

- **Transparency over teasing** — mini rate table shows Rate + APR, not just a big rate number
- **"Compare Your Options →"** CTA copy — David approved after multiple iterations
- **Green checkmarks** — "No application / No credit pull / Just rates" (proactive, not negative)
- **Ticker pauses on hover** — intentional UX, keep this behavior
- **Chart shows gap** — teal shaded area between national avg and NetRate lines = savings visualization
- **APR always shown** — compliance requirement, never display rate without APR

---

*Written by Marketing session, March 6, 2026. Questions → check SESSION-LOG March 5-6 entry or MCP context layer.*
