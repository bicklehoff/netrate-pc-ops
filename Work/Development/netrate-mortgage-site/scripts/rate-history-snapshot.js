#!/usr/bin/env node

/**
 * Rate History — Daily Snapshot
 *
 * Computes the best (par) rate for each loan_type + credit_score_tier
 * combination and inserts into the rate_history table.
 *
 * Run after rate sheets are pulled each morning:
 *   node scripts/rate-history-snapshot.js
 *
 * Options:
 *   --date YYYY-MM-DD   Override snapshot date (default: today)
 *   --dry-run            Show what would be inserted without writing to DB
 *   --file <path>        Use a specific JSON file instead of default sunwest.json
 *
 * Default scenario (matches rate tool defaults):
 *   loan_amount = 400,000
 *   ltv = 75
 *   purpose = purchase
 *   property_type = single_family
 */

const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

// Load .env
require('dotenv').config();

// ─── Configuration ──────────────────────────────────────────────

const DEFAULT_SCENARIO = {
  loanAmount: 400000,
  ltv: 75,
  purpose: 'purchase',
  propertyType: 'single_family',
};

// Credit score tiers to snapshot (mid-point FICO for each tier)
const CREDIT_TIERS = [
  { tier: '760+',    fico: 780 },
  { tier: '740-759', fico: 750 },
  { tier: '720-739', fico: 730 },
  { tier: '700-719', fico: 710 },
  { tier: '680-699', fico: 690 },
];

// Loan types to snapshot (currently only 30yr fixed available)
const LOAN_TYPES = [
  { type: '30yr_fixed', term: 360 },
  // Future: { type: '15yr_fixed', term: 180 },
  // Future: { type: 'arm_5_1',   term: 360 },
];

// ─── Pricing Engine (inline — matches src/lib/rates/engine.js) ──

function getFicoBand(fico) {
  if (fico >= 800) return '>=800';
  if (fico >= 780) return '780-799';
  if (fico >= 760) return '760-779';
  if (fico >= 740) return '740-759';
  if (fico >= 720) return '720-739';
  if (fico >= 700) return '700-719';
  if (fico >= 680) return '680-699';
  if (fico >= 660) return '660-679';
  if (fico >= 640) return '640-659';
  return '620-639';
}

function getLtvBandIndex(ltv) {
  if (ltv <= 30) return 0;
  if (ltv <= 60) return 1;
  if (ltv <= 70) return 2;
  if (ltv <= 75) return 3;
  if (ltv <= 80) return 4;
  if (ltv <= 85) return 5;
  if (ltv <= 90) return 6;
  if (ltv <= 95) return 7;
  return 8;
}

function calculateLLPA(scenario, rateData) {
  const { fico, ltv, purpose, propertyType, loanAmount } = scenario;
  const ficoBand = getFicoBand(fico);
  const ltvIdx = getLtvBandIndex(ltv);
  let total = 0;

  let matrix;
  if (purpose === 'purchase') matrix = rateData.purchaseLlpa;
  else if (purpose === 'cashout') matrix = rateData.cashoutLlpa;
  else matrix = rateData.refiLlpa;

  const maxIdx = purpose === 'cashout' ? 4 : 8;
  const useIdx = Math.min(ltvIdx, maxIdx);
  const baseAdj = matrix[ficoBand]?.[useIdx] ?? 0;
  total += baseAdj;

  // Property type adjustments
  if (propertyType === 'condo') {
    const condoAdj = rateData.additionalLlpa.condo[Math.min(ltvIdx, 8)] ?? 0;
    total += condoAdj;
  }

  // Loan amount adjustments
  for (const tier of (rateData.loanAmtAdj || [])) {
    if (loanAmount >= tier.min && loanAmount <= tier.max) {
      total += tier.adj;
      break;
    }
  }

  return total;
}

/**
 * Find the par rate — the rate where adjusted price is closest to 0.
 * Returns { rate, points } where points is the adjusted price at par.
 */
function findParRate(scenario, rateData, lockPeriod = '30day') {
  const llpa = calculateLLPA(scenario, rateData);
  const colIdx = lockPeriod === '45day' ? 2 : 1;

  let bestRate = null;
  let bestPoints = null;
  let bestAbsPoints = Infinity;

  for (const row of rateData.rateTable30yr) {
    const rate = row[0];
    const basePrice = row[colIdx];
    const adjPrice = basePrice + llpa;

    // Skip rates with extreme adjustments
    if (adjPrice < -6 || adjPrice > 5) continue;

    const absPoints = Math.abs(adjPrice);
    if (absPoints < bestAbsPoints) {
      bestAbsPoints = absPoints;
      bestRate = rate;
      bestPoints = adjPrice;
    }
  }

  return { rate: bestRate, points: bestPoints !== null ? -bestPoints : null };
}

// ─── Main ──────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const dateIdx = args.indexOf('--date');
  const fileIdx = args.indexOf('--file');

  // Determine snapshot date
  const today = new Date();
  const snapshotDate = dateIdx >= 0 && args[dateIdx + 1]
    ? args[dateIdx + 1]
    : `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // Load rate data
  const defaultFile = path.join(__dirname, '..', 'src', 'data', 'rates', 'sunwest.json');
  const rateFile = fileIdx >= 0 && args[fileIdx + 1] ? args[fileIdx + 1] : defaultFile;

  if (!fs.existsSync(rateFile)) {
    console.error(`Rate file not found: ${rateFile}`);
    process.exit(1);
  }

  const rateData = JSON.parse(fs.readFileSync(rateFile, 'utf-8'));
  const lenderName = rateData.lender?.name || 'Unknown';

  console.log(`Rate History Snapshot`);
  console.log(`─────────────────────`);
  console.log(`Date:   ${snapshotDate}`);
  console.log(`Lender: ${lenderName}`);
  console.log(`File:   ${path.basename(rateFile)}`);
  console.log(`Mode:   ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log();

  // Compute par rates for each tier × loan type
  const rows = [];

  for (const lt of LOAN_TYPES) {
    for (const ct of CREDIT_TIERS) {
      const scenario = {
        fico: ct.fico,
        ltv: DEFAULT_SCENARIO.ltv,
        purpose: DEFAULT_SCENARIO.purpose,
        propertyType: DEFAULT_SCENARIO.propertyType,
        loanAmount: DEFAULT_SCENARIO.loanAmount,
      };

      const par = findParRate(scenario, rateData);

      if (par.rate === null) {
        console.warn(`  ⚠ No valid rate for ${lt.type} / ${ct.tier}`);
        continue;
      }

      const row = {
        date: snapshotDate,
        loan_type: lt.type,
        term: lt.term,
        credit_score_tier: ct.tier,
        rate: par.rate,
        apr: null, // TODO: compute APR when we have fee data
        points: par.points ? Math.round(par.points * 1000) / 1000 : 0,
        loan_amount: DEFAULT_SCENARIO.loanAmount,
        ltv: DEFAULT_SCENARIO.ltv,
        lender: lenderName,
        loan_purpose: DEFAULT_SCENARIO.purpose,
        property_type: DEFAULT_SCENARIO.propertyType,
      };

      rows.push(row);
      const pointsStr = row.points >= 0
        ? `+${row.points.toFixed(3)} credit`
        : `${row.points.toFixed(3)} cost`;
      console.log(`  ${lt.type} | ${ct.tier} → ${par.rate}% (${pointsStr})`);
    }
  }

  console.log(`\n${rows.length} rows to insert.`);

  if (dryRun) {
    console.log('\nDry run — no data written.');
    return;
  }

  // Connect to DB and insert
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('DATABASE_URL not found in environment');
    process.exit(1);
  }

  const sql = neon(DATABASE_URL);

  // Check for existing data on this date to avoid duplicates
  const existing = await sql`
    SELECT COUNT(*) as count FROM rate_history
    WHERE date = ${snapshotDate}::date
  `;

  if (parseInt(existing[0].count) > 0) {
    console.log(`\n⚠ Data already exists for ${snapshotDate} (${existing[0].count} rows).`);
    console.log('Skipping insert. Use a different date or delete existing rows first.');
    return;
  }

  // Insert all rows
  for (const row of rows) {
    await sql`
      INSERT INTO rate_history (date, loan_type, term, credit_score_tier, rate, apr, points, loan_amount, ltv, lender, loan_purpose, property_type)
      VALUES (
        ${row.date}::date,
        ${row.loan_type},
        ${row.term},
        ${row.credit_score_tier},
        ${row.rate},
        ${row.apr},
        ${row.points},
        ${row.loan_amount},
        ${row.ltv},
        ${row.lender},
        ${row.loan_purpose},
        ${row.property_type}
      )
    `;
  }

  console.log(`\n✓ ${rows.length} rows inserted into rate_history.`);

  // Verify
  const verify = await sql`
    SELECT COUNT(*) as count FROM rate_history WHERE date = ${snapshotDate}::date
  `;
  console.log(`✓ Verified: ${verify[0].count} rows for ${snapshotDate}.`);
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
