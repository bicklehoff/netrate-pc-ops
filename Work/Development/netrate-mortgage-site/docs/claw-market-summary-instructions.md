# Morning Market Summary — Instructions for Claw

After your daily market research (9:30 AM MT), push the summary to the website.

## Endpoint

```
POST https://netratemortgage.com/api/market/summary
```

## Headers

```
Content-Type: application/json
x-api-key: <CLAW_API_KEY>
```

## Body

```json
{
  "date": "2026-03-20",
  "headline": "Bonds Rally on Softer Jobs Data",
  "commentary": "Bonds rallied overnight on softer economic data. Rates are slightly better today. If you've been watching and waiting, today's pricing is favorable.",
  "sentiment": "bullish",
  "treasury10yr": 4.32,
  "treasury10yrChg": -0.03,
  "mbs6Coupon": "100.28",
  "mbs6Change": 0.09,
  "upcomingEvents": [
    {
      "date": "Fri Apr 3",
      "name": "March Jobs Report",
      "impact": "Strong jobs = higher rates. Weak jobs = lower rates.",
      "big": true
    },
    {
      "date": "Thu Apr 10",
      "name": "CPI (March)",
      "impact": "If inflation drops below 2.7%, rates could improve. Above 3% means rates go higher."
    },
    {
      "date": "Wed May 6",
      "name": "FOMC Rate Decision",
      "impact": "Markets watching for signals on rate cuts in 2026."
    }
  ],
  "createdBy": "claw"
}
```

## Field Guide

| Field | Required | Description |
|-------|----------|-------------|
| `date` | Yes | YYYY-MM-DD |
| `headline` | Yes | Short headline, max 200 chars |
| `commentary` | Yes | 2-3 sentences, consumer-friendly, no jargon |
| `sentiment` | No | `bullish`, `bearish`, or `neutral` (default: neutral) |
| `treasury10yr` | No | 10yr yield as decimal (e.g. 4.32) |
| `treasury10yrChg` | No | Daily change (e.g. -0.03) |
| `mbs6Coupon` | No | MBS 6.0 price as string (e.g. "100.28") |
| `mbs6Change` | No | MBS daily change (e.g. 0.09) |
| `upcomingEvents` | No | Array of up to 3 events with `date`, `name`, `impact`, optional `big` |
| `createdBy` | No | Defaults to "claw" |

## Behavior

- **Upserts by date** — posting twice for the same date updates the existing entry
- **Commentary style** — plain English for consumers. No "basis points", no "MBS coupon" in the prose. Those go in the structured fields.
- **Skip on holidays** — if markets are closed and no data is available, skip the POST

## Verify

After posting, confirm with:
```
GET https://netratemortgage.com/api/market/summary
```

Should return today's date and your headline.
