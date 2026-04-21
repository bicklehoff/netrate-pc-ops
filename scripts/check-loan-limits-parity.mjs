/**
 * Verifies src/data/county-loan-limits.js matches ref_conforming_baselines +
 * ref_county_loan_limits. Protects against drift between the client-bundled
 * mirror file and the DB source-of-truth after D9d migration 020.
 *
 * The static file is retained for synchronous client-side UX (county dropdowns,
 * high-cost badges on /rates). The DB is authoritative for server-side pricing.
 * This script enforces the invariant that both agree. Run annually when FHFA
 * publishes new limits — update both sources, then re-run this.
 *
 * Usage:
 *   node scripts/check-loan-limits-parity.mjs
 *
 * Exit codes:
 *   0 — parity holds
 *   1 — mismatch found (diffs printed)
 *   2 — setup error (DB unreachable, etc.)
 */

import { neon } from '@neondatabase/serverless';
import { createRequire } from 'node:module';
import 'dotenv/config';

const require = createRequire(import.meta.url);

const DATABASE_URL = process.env.DATABASE_URL || process.env.PC_DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL or PC_DATABASE_URL must be set');
  process.exit(2);
}

const sql = neon(DATABASE_URL);
const staticFile = require('../src/data/county-loan-limits.js');

const mismatches = [];

// ─── 1. Baseline + high-balance ceiling ──────────────────────────────

const [baseline] = await sql`
  SELECT baseline_1unit, baseline_2unit, baseline_3unit, baseline_4unit,
         high_balance_ceiling_1unit, high_balance_ceiling_2unit,
         high_balance_ceiling_3unit, high_balance_ceiling_4unit,
         effective_from
    FROM ref_conforming_baselines
   WHERE effective_from <= CURRENT_DATE
     AND (effective_to IS NULL OR effective_to > CURRENT_DATE)
   ORDER BY effective_from DESC
   LIMIT 1
`;

if (!baseline) {
  console.error('No active row in ref_conforming_baselines');
  process.exit(2);
}

const baselineChecks = [
  ['BASELINE_1UNIT',            staticFile.BASELINE_1UNIT,            baseline.baseline_1unit],
  ['BASELINE_2UNIT',            staticFile.BASELINE_2UNIT,            baseline.baseline_2unit],
  ['BASELINE_3UNIT',            staticFile.BASELINE_3UNIT,            baseline.baseline_3unit],
  ['BASELINE_4UNIT',            staticFile.BASELINE_4UNIT,            baseline.baseline_4unit],
  ['HIGH_BALANCE_CEILING_1UNIT', staticFile.HIGH_BALANCE_CEILING_1UNIT, baseline.high_balance_ceiling_1unit],
  ['HIGH_BALANCE_CEILING_2UNIT', staticFile.HIGH_BALANCE_CEILING_2UNIT, baseline.high_balance_ceiling_2unit],
  ['HIGH_BALANCE_CEILING_3UNIT', staticFile.HIGH_BALANCE_CEILING_3UNIT, baseline.high_balance_ceiling_3unit],
  ['HIGH_BALANCE_CEILING_4UNIT', staticFile.HIGH_BALANCE_CEILING_4UNIT, baseline.high_balance_ceiling_4unit],
];

for (const [name, fileVal, dbVal] of baselineChecks) {
  if (fileVal !== dbVal) {
    mismatches.push(`baseline ${name}: file=${fileVal} db=${dbVal}`);
  }
}

// ─── 2. Per-county limits ────────────────────────────────────────────

const dbCounties = await sql`
  SELECT state, county_fips, county_name,
         limit_1unit, limit_2unit, limit_3unit, limit_4unit
    FROM ref_county_loan_limits
   WHERE effective_from <= CURRENT_DATE
     AND (effective_to IS NULL OR effective_to > CURRENT_DATE)
`;

const dbByFips = new Map();
for (const row of dbCounties) {
  dbByFips.set(`${row.state}|${row.county_fips}`, row);
}

const fileStates = staticFile.getStates();
let fileCountyCount = 0;
const seenFips = new Set();

for (const state of fileStates) {
  const counties = staticFile.getCountiesByState(state);
  for (const c of counties) {
    fileCountyCount++;
    const key = `${state}|${c.fips}`;
    seenFips.add(key);
    const dbRow = dbByFips.get(key);
    if (!dbRow) {
      mismatches.push(`${state}/${c.name} (fips ${c.fips}): in file, not in DB`);
      continue;
    }
    const fileLimits = staticFile.getLoanLimits(state, c.name);
    if (!fileLimits) continue;
    const checks = [
      ['1unit', fileLimits.conforming1Unit, dbRow.limit_1unit],
      ['2unit', fileLimits.conforming2Unit, dbRow.limit_2unit],
      ['3unit', fileLimits.conforming3Unit, dbRow.limit_3unit],
      ['4unit', fileLimits.conforming4Unit, dbRow.limit_4unit],
    ];
    for (const [label, fileVal, dbVal] of checks) {
      if (fileVal !== dbVal) {
        mismatches.push(`${state}/${c.name} ${label}: file=${fileVal} db=${dbVal}`);
      }
    }
  }
}

for (const key of dbByFips.keys()) {
  if (!seenFips.has(key)) {
    const row = dbByFips.get(key);
    mismatches.push(`${row.state}/${row.county_name} (fips ${row.county_fips}): in DB, not in file`);
  }
}

// ─── Report ──────────────────────────────────────────────────────────

console.log(`Baseline effective_from: ${baseline.effective_from.toISOString().slice(0, 10)}`);
console.log(`File counties: ${fileCountyCount}`);
console.log(`DB counties:   ${dbCounties.length}`);
console.log('');

if (mismatches.length === 0) {
  console.log('✓ parity holds — file and DB agree');
  process.exit(0);
}

console.error(`✗ ${mismatches.length} mismatch(es):`);
for (const m of mismatches.slice(0, 50)) console.error(`  ${m}`);
if (mismatches.length > 50) console.error(`  ... and ${mismatches.length - 50} more`);
process.exit(1);
