# Market Watch Integration — OpenClaude Spec

## Overview

OpenClaude monitors MBS Live (mbslive.net) throughout the day and pushes market data updates to the NetRate website. The website already has skeleton UI for this data (market ticker, rate trends, market updates section) — all currently hardcoded.

## Architecture

```
MBS Live → OpenClaude (monitors, extracts, rewrites)
                ↓
          market.json (structured data)
                ↓
          GCS bucket (gs://netrate-rates/live/market.json)
                ↓
          Next.js ISR (revalidate every 5 min)
                ↓
          Homepage: ticker, trends, market updates
```

## Data Schema: `market.json`

```json
{
  "updatedAt": "2026-03-13T14:30:00-07:00",
  "ticker": {
    "treasury10yr": {
      "value": 4.136,
      "change": 0.04,
      "direction": "up"
    },
    "umbs50": {
      "value": 99.81,
      "change": -0.16,
      "direction": "down"
    },
    "freddieMac30yr": {
      "value": 6.37,
      "source": "Freddie Mac PMMS"
    },
    "sp500": {
      "value": 5842,
      "changePct": 0.3,
      "direction": "up"
    }
  },
  "rateTrend": {
    "weeks": 8,
    "dataPoints": [6.875, 6.75, 6.625, 6.5, 6.375, 6.25, 6.125, 5.875],
    "direction": "down",
    "commentary": "The 30-year fixed has dropped 0.375% over the last 8 weeks. If the Fed holds in March, wholesale pricing should stay favorable through Q2."
  },
  "marketUpdates": [
    {
      "date": "2026-03-13",
      "headline": "UMBS prices drop after stronger-than-expected retail sales",
      "sentiment": "negative",
      "source": "MBS Live"
    },
    {
      "date": "2026-03-12",
      "headline": "CPI comes in at 2.8% — slightly above expectations",
      "sentiment": "cautious",
      "source": "MBS Live"
    }
  ],
  "economicCalendar": [
    {
      "date": "2026-03-14",
      "time": "8:30 AM ET",
      "event": "Producer Price Index (PPI)",
      "forecast": "0.3%",
      "previous": "0.4%",
      "impact": "high"
    }
  ]
}
```

## Sentiment Color Mapping

| Sentiment  | Color Class   | Dot Color    | Meaning                              |
|------------|---------------|--------------|--------------------------------------|
| `positive` | `bg-green-600`| Green        | Good for rates (rates going down)    |
| `negative` | `bg-red-500`  | Red          | Bad for rates (rates going up)       |
| `cautious` | `bg-amber-500`| Amber        | Watch — could go either way          |
| `neutral`  | `bg-brand`    | Teal         | Informational update                 |

## OpenClaude Responsibilities

### 1. Monitor MBS Live (mbslive.net)
- Check for price changes on UMBS 5.0 coupon (primary mortgage-backed security)
- Track 10-year Treasury yield movements
- Read economic calendar entries for upcoming data releases
- Read market commentary / news headlines

### 2. Extract Data
- **Ticker values**: UMBS 5.0 price + change, 10-yr Treasury yield + change, S&P 500
- **Freddie Mac 30-yr avg**: Updated weekly (Thursday), pull from freddiemac.com PMMS
- **Economic calendar**: Next 3-5 upcoming events with forecast, previous, and impact level
- **Market commentary**: Headlines from MBS Live news section

### 3. Rewrite in NetRate Voice
Market updates should be rewritten in plain English for borrowers:
- NO jargon (avoid "MBS", "basis points", "spread")
- Focus on what it means for rates: "Rates ticked up after..."
- Short (1 sentence per update)
- Include sentiment tag (positive/negative/cautious/neutral)
- Attribute source but don't quote verbatim

**Examples:**
- MBS Live: "UMBS 5.0 down 16 ticks on strong retail sales print"
  → NetRate: "Mortgage rates edged higher after retail sales data came in stronger than expected."

- MBS Live: "10yr auction tails by 1bp, but demand solid overall"
  → NetRate: "Treasury auction showed decent demand — rates holding steady for now."

### 4. Push to GCS
Upload `market.json` to `gs://netrate-rates/live/market.json`
Using the same upload mechanism as rate data (see `scripts/upload-to-gcs.js`).

### 5. Update Frequency
| Data              | Frequency           | Source                |
|-------------------|---------------------|-----------------------|
| UMBS/Treasury     | Every 30-60 min     | MBS Live              |
| Market updates    | When news breaks     | MBS Live              |
| Freddie Mac avg   | Weekly (Thursday)    | freddiemac.com        |
| Economic calendar | Daily refresh        | MBS Live / econoday   |
| Rate trend        | Weekly               | Historical data       |

## Website Integration (PC Dev Side)

### Changes needed:

1. **Homepage (`src/app/page.js`)**:
   - Fetch `market.json` from GCS alongside rate data
   - Replace hardcoded ticker values with live data
   - Replace hardcoded market updates with live data
   - Replace hardcoded sparkline with `rateTrend.dataPoints`
   - Replace hardcoded commentary with `rateTrend.commentary`

2. **API route** (optional):
   - `GET /api/market` — returns cached market.json
   - Useful for client-side refresh without full page reload

3. **Fallback**: If market.json fetch fails, use current hardcoded values

## GCS File Structure (Updated)

```
gs://netrate-rates/
├── live/
│   ├── manifest.json       ← rate data manifest
│   ├── sunwest.json        ← Sunwest rate data
│   ├── amwest.json         ← AmWest rate data (archive)
│   └── market.json         ← Market watch data (NEW)
```

## Next Steps

1. **PC Dev**: Build `fetchMarketData()` in homepage, wire to ticker + market section
2. **OpenClaude**: Build monitoring workflow that:
   - Scrapes MBS Live at configured intervals
   - Extracts ticker data, news, calendar
   - Rewrites headlines in NetRate voice
   - Assembles market.json
   - Uploads to GCS via service account
3. **PC Dev**: Add `/api/market` endpoint for client-side updates
4. **PC Dev**: Consider adding "Last updated X min ago" to ticker
