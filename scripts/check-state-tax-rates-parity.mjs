/**
 * Verifies src/data/county-tax-rates.js STATE_AVERAGES matches
 * ref_state_tax_rates rows (D9d · migration 027). Same pattern as
 * scripts/check-state-closing-costs-parity.mjs — regex-parse the ESM
 * source and diff against the DB.
 *
 * Note: this script does NOT check RefinanceCalc/shared.js STATE_DEFAULTS.
 * That file has drift from the Census Bureau values (different rates
 * for CO/CA/OR/TX) — tracked as a separate D9d follow-up finding.
 *
 * Exit codes:
 *   0 — parity holds
 *   1 — mismatch found
 *   2 — setup error
 */

import { neon } from '@neondatabase/serverless';
import fs from 'node:fs';
import path from 'node:path';
import 'dotenv/config';

const DATABASE_URL = process.env.DATABASE_URL || process.env.PC_DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL or PC_DATABASE_URL must be set');
  process.exit(2);
}

const sql = neon(DATABASE_URL);

// Parse STATE_AVERAGES block from src/data/county-tax-rates.js.
const filePath = path.join(process.cwd(), 'src', 'data', 'county-tax-rates.js');
const fileSrc = fs.readFileSync(filePath, 'utf8');

const blockMatch = fileSrc.match(/const STATE_AVERAGES\s*=\s*\{([\s\S]*?)\};/);
if (!blockMatch) {
  console.error('Could not locate STATE_AVERAGES block in county-tax-rates.js');
  process.exit(2);
}

const entryRe = /([A-Z]{2})\s*:\s*([\d.]+)/g;
const fileValues = new Map();
let m;
while ((m = entryRe.exec(blockMatch[1])) !== null) {
  fileValues.set(m[1], Number(m[2]));
}

if (fileValues.size === 0) {
  console.error('Parsed 0 entries from STATE_AVERAGES — regex out of sync with source shape');
  process.exit(2);
}

const dbRows = await sql`
  SELECT state, rate
    FROM ref_state_tax_rates
   WHERE effective_from <= CURRENT_DATE
     AND (effective_to IS NULL OR effective_to > CURRENT_DATE)
   ORDER BY state
`;

const dbByState = new Map(dbRows.map((r) => [r.state, r.rate]));
const mismatches = [];

for (const [state, fileRate] of fileValues) {
  const dbRate = dbByState.get(state);
  if (dbRate == null) {
    mismatches.push(`${state}: in file (${fileRate}), not in DB`);
    continue;
  }
  // NUMERIC from the DB arrives as string or Number depending on driver
  if (Number(dbRate) !== Number(fileRate)) {
    mismatches.push(`${state}: file=${fileRate} db=${Number(dbRate)}`);
  }
}

for (const [state] of dbByState) {
  if (!fileValues.has(state)) {
    mismatches.push(`${state}: in DB (${dbByState.get(state)}), not in file STATE_AVERAGES`);
  }
}

console.log(`File states: ${fileValues.size}`);
console.log(`DB states:   ${dbRows.length}`);

if (mismatches.length === 0) {
  console.log('\n✓ parity holds — file STATE_AVERAGES and ref_state_tax_rates agree');
  process.exit(0);
}

console.error(`\n✗ ${mismatches.length} mismatch(es):`);
for (const m of mismatches) console.error(`  ${m}`);
process.exit(1);
