# Rate Sheet Pipeline — PC Side Spec

**Status:** Project — foundation for pricing engine
**Priority:** HIGH — pricing engine depends on this
**Actor:** pc-dev

---

## Overview

PC is responsible for parsing raw rate sheets and feeding the pricing engine. OC (OpenClaw on Lenovo Legion) handles authentication and downloading raw files to GCS. PC pulls raw files, parses them, and serves normalized data.

---

## Pipeline Flow

```
OC (scheduled 6 AM) → logs in → downloads raw rate sheets → uploads to GCS
    ↓
OC (intraday) → Marketing monitors reprice inbox → if >25bps → Cliq to OC → OC pulls fresh → GCS
    ↓
PC detects new file in GCS → runs lender-specific parser → normalized JSON
    ↓
Pricing engine consumes normalized data → serves all calculators
```

---

## GCS Structure

```
gs://netrate-rates/
├── raw/                          ← OC uploads here (raw files, untouched)
│   ├── amwest/
│   │   ├── 2026-03-20_0600.xlsx  ← morning pull
│   │   ├── 2026-03-20_1415.xlsx  ← intraday reprice
│   │   └── ...
│   ├── [lender2]/
│   └── [lender3]/
├── parsed/                       ← PC writes here (normalized JSON)
│   ├── amwest/
│   │   ├── 2026-03-20_0600.json
│   │   └── latest.json           ← always points to most recent
│   └── [lender2]/
└── archive/                      ← rolled after 30 days
```

---

## Normalized Rate Sheet Format (Output of Parser)

```json
{
  "lender": "AmWest Funding",
  "lenderId": "amwest",
  "sheetDate": "2026-03-20",
  "sheetTime": "06:00",
  "parsedAt": "2026-03-20T06:05:00Z",
  "expiresAt": "2026-03-20T17:00:00Z",
  "lenderFees": 1295,
  "programs": [
    {
      "id": "conv30",
      "name": "Conventional 30yr Fixed",
      "type": "conventional",
      "term": 30,
      "productType": "fixed",
      "eligibility": {
        "minCredit": 620,
        "maxLTV": 97,
        "propertyTypes": ["sfr", "condo", "townhouse", "2unit", "3unit", "4unit"],
        "occupancy": ["primary", "secondary", "investment"],
        "states": ["ALL"],
        "maxLoanAmount": null,
        "notes": null
      },
      "rates": [
        { "rate": 5.250, "price": 98.500 },
        { "rate": 5.375, "price": 99.000 },
        { "rate": 5.500, "price": 99.500 },
        { "rate": 5.625, "price": 99.875 },
        { "rate": 5.750, "price": 100.125 },
        { "rate": 5.875, "price": 100.375 },
        { "rate": 6.000, "price": 100.625 }
      ],
      "llpas": [
        {
          "name": "credit_ltv",
          "grid": {
            ">=740": { "<=60": 0.000, "60.01-70": -0.250, "70.01-75": -0.250, "75.01-80": -0.375 },
            "720-739": { "<=60": -0.125, "60.01-70": -0.375, "70.01-75": -0.500, "75.01-80": -0.625 }
          }
        },
        { "name": "property_type", "adjustments": { "condo": -0.375, "2unit": -0.500 } },
        { "name": "loan_purpose", "adjustments": { "cashout": -0.375 } }
      ],
      "lockDays": [15, 30, 45, 60]
    },
    {
      "id": "amwest_fast_track",
      "name": "AmWest Fast Track",
      "type": "conventional",
      "term": 30,
      "productType": "fixed",
      "eligibility": {
        "minCredit": null,
        "maxLTV": null,
        "propertyTypes": null,
        "occupancy": null,
        "states": null,
        "maxLoanAmount": null,
        "notes": "Fast Track eligibility per rate sheet — specific requirements TBD from raw sheet"
      },
      "rates": [],
      "llpas": [],
      "lockDays": [15, 30, 45, 60]
    }
  ]
}
```

---

## Parser Architecture

```
src/lib/rates/
├── parsers/
│   ├── amwest.js          ← AmWest-specific parser (reads raw Excel/PDF → normalized JSON)
│   ├── [lender2].js       ← one parser per lender
│   └── index.js           ← parser registry: lenderId → parser function
├── engine.js              ← existing pricing engine (reads normalized JSON)
├── pipeline.js            ← GCS watcher: detect new raw files → run parser → write parsed JSON
└── llpa.js                ← LLPA lookup logic (shared across lenders for GSE standard adjustments)
```

### Parser interface (each lender implements):
```javascript
// parsers/amwest.js
export function parse(rawBuffer, filename) {
  // Read Excel/PDF buffer
  // Extract programs, rates, LLPAs, eligibility rules
  // Return normalized JSON (format above)
}

export const lenderId = 'amwest';
export const fileType = 'xlsx'; // or 'pdf', 'csv'
```

---

## GCS Watcher

Two modes:

### 1. API endpoint (triggered by OC after upload)
```
POST /api/rates/ingest
{ "lender": "amwest", "filename": "2026-03-20_0600.xlsx" }
```
- Pulls raw file from GCS
- Runs lender parser
- Writes normalized JSON to `parsed/[lender]/latest.json`
- Updates pricing engine cache
- Returns success + summary

### 2. Scheduled check (fallback)
- Cron every 15 min during business hours
- Lists `raw/[lender]/` in GCS
- Compares against last parsed timestamp
- If new file exists → parse it

---

## Reprice Detection

When a new rate sheet is parsed mid-day:
- Compare against previous `latest.json` for that lender
- Calculate delta on par rate
- If > 25bps change → flag as significant reprice
- Update Rate Watch page timestamp: "Rates updated at 2:15 PM"
- Optional: trigger Strike Rate alert check (rates may have hit someone's target)

---

## Lender Onboarding Checklist

For each new lender:
1. [ ] Get sample raw rate sheet (from OC or David)
2. [ ] Identify format (Excel, PDF, CSV)
3. [ ] Build parser in `src/lib/rates/parsers/[lender].js`
4. [ ] Map programs + eligibility rules
5. [ ] Map LLPAs (or use GSE standard + lender overlay)
6. [ ] Test against 3+ historical sheets for consistency
7. [ ] Add to parser registry
8. [ ] Create GCS folder structure
9. [ ] Tell OC to start uploading raw files for this lender

---

## Current State

- ✅ GCS connection working (`src/lib/gcs.js`)
- ✅ AmWest rate data flowing (but parsed on Claw side)
- ✅ Rate Tool consuming parsed data
- ❌ Raw file parser on PC (need to build)
- ❌ GCS watcher / ingest API (need to build)
- ❌ Multi-lender support (need sample sheets)
- ❌ Program eligibility filtering (need to build)

---

## Dependencies

- **OC:** Switch from uploading parsed JSON to uploading raw files to `raw/[lender]/`
- **Marketing (Claw):** Scheduled task to monitor reprice inbox hourly → Cliq trigger to OC
- **OC:** 6 AM scheduled task for morning pull (all lenders)

---

*Created: 2026-03-20 | Actor: pc-dev*
