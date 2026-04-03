/**
 * Write today's par rates to rate_history DB table.
 *
 * Computes par rates via the pricing engine (same as homepage) for multiple
 * credit score tiers and loan types, then upserts into rate_history.
 *
 * Run standalone: node scripts/write-rate-history.mjs
 * Or call from parse-gcs-rates.mjs after parsing.
 */

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

// ─── Scenarios ───────────────────────────────────────────────────

const LOAN_TYPES = [
  { loanType: 'conventional', term: 30, dbLoanType: '30yr_fixed', dbTerm: 360 },
  { loanType: 'conventional', term: 15, dbLoanType: '15yr_fixed', dbTerm: 180 },
  { loanType: 'fha', term: 30, dbLoanType: 'fha_30yr', dbTerm: 360 },
  { loanType: 'va', term: 30, dbLoanType: 'va_30yr', dbTerm: 360 },
];

const CREDIT_TIERS = [
  { label: '760+', score: 760 },
  { label: '740', score: 740 },
  { label: '700', score: 700 },
];

// ─── Compute par rate via API ────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_SITE_URL
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.netratemortgage.com');

async function computeParRate(loanType, term, creditScore) {
  try {
    const res = await fetch(`${API_BASE}/api/pricing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        loanAmount: 400000,
        loanPurpose: 'purchase',
        loanType,
        creditScore,
        propertyValue: 533333,
        propertyType: 'sfr',
        occupancy: 'primary',
        term,
        productType: 'fixed',
        lockDays: 30,
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.results?.length) return null;

    // Find par — lowest absolute costPoints (fees in)
    const par = data.results.reduce((best, r) =>
      Math.abs(r.costPoints) < Math.abs(best.costPoints) ? r : best
    );

    // Display cost excludes lender fee (matching MND/Freddie)
    return {
      rate: par.rate,
      apr: par.apr,
      points: Math.round(par.costBeforeFees * 1000) / 1000,
      lender: par.lender,
    };
  } catch (err) {
    console.error(`  Error pricing ${loanType} ${term}yr ${creditScore}:`, err.message);
    return null;
  }
}

// ─── Write to DB ─────────────────────────────────────────────────

async function upsertRateHistory(date, rows) {
  let inserted = 0;
  let updated = 0;

  for (const row of rows) {
    // Check if exists
    const existing = await sql`
      SELECT id FROM rate_history
      WHERE date = ${date}
        AND loan_type = ${row.loanType}
        AND credit_score_tier = ${row.creditScoreTier}
    `;

    if (existing.length > 0) {
      await sql`
        UPDATE rate_history
        SET rate = ${row.rate},
            apr = ${row.apr},
            points = ${row.points},
            lender = ${row.lender},
            loan_amount = ${row.loanAmount},
            ltv = ${row.ltv},
            loan_purpose = ${row.loanPurpose},
            property_type = ${row.propertyType}
        WHERE id = ${existing[0].id}
      `;
      updated++;
    } else {
      await sql`
        INSERT INTO rate_history (date, loan_type, term, credit_score_tier, rate, apr, points, lender, loan_amount, ltv, loan_purpose, property_type)
        VALUES (${date}, ${row.loanType}, ${row.term}, ${row.creditScoreTier}, ${row.rate}, ${row.apr}, ${row.points}, ${row.lender}, ${row.loanAmount}, ${row.ltv}, ${row.loanPurpose}, ${row.propertyType})
      `;
      inserted++;
    }
  }

  return { inserted, updated };
}

// ─── Main ────────────────────────────────────────────────────────

export async function writeRateHistory(allPrograms, date) {
  console.log(`\nWriting rate history for ${date}...`);

  const rows = [];

  for (const lt of LOAN_TYPES) {
    for (const tier of CREDIT_TIERS) {
      const par = await computeParRate(lt.loanType, lt.term, tier.score);
      if (!par) {
        console.log(`  ⚠ No par rate for ${lt.dbLoanType} ${tier.label}`);
        continue;
      }

      rows.push({
        loanType: lt.dbLoanType,
        term: lt.dbTerm,
        creditScoreTier: tier.label,
        rate: par.rate,
        apr: par.apr,
        points: par.points,
        lender: par.lender,
        loanAmount: 400000,
        ltv: 75,
        loanPurpose: 'purchase',
        propertyType: 'single_family',
      });

      console.log(`  ${lt.dbLoanType} ${tier.label}: ${par.rate}% (${par.lender})`);
    }
  }

  const { inserted, updated } = await upsertRateHistory(date, rows);
  console.log(`  ✓ ${inserted} inserted, ${updated} updated (${rows.length} total)\n`);

  return rows;
}

// ─── CLI entry point ─────────────────────────────────────────────

async function main() {
  // Load parsed rates
  const { createRequire } = await import('module');
  const require = createRequire(import.meta.url);
  const parsedRates = require('../src/data/parsed-rates.json');

  if (!parsedRates?.lenders?.length) {
    console.error('No parsed rate data found. Run parse-gcs-rates.mjs first.');
    process.exit(1);
  }

  const date = parsedRates.date || new Date().toISOString().slice(0, 10);
  await writeRateHistory(parsedRates.lenders, date);
}

// Run if called directly
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  main().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
  });
}
