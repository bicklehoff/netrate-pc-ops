/**
 * Migration 020: D9d reference-data schema + seed loan-limit tables.
 *
 * Two phases:
 *   1. Run the DDL from 020_ref_loan_limits.sql (idempotent via CREATE IF
 *      NOT EXISTS).
 *   2. Seed the 2026 dataset from src/data/county-loan-limits.js. Uses
 *      INSERT ON CONFLICT DO NOTHING so re-running the migration is safe.
 *
 * Run against prod:      node scripts/_run-migration-020.mjs
 * Rehearse on branch:    PC_DATABASE_URL=<branch-url> node scripts/_run-migration-020.mjs
 * Dry-run (DDL only):    node scripts/_run-migration-020.mjs --dry-run
 */

import { neon } from '@neondatabase/serverless';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import 'dotenv/config';

const require = createRequire(import.meta.url);

const DATABASE_URL = process.env.DATABASE_URL || process.env.PC_DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL or PC_DATABASE_URL must be set');
  process.exit(1);
}

const dryRun = process.argv.includes('--dry-run');
const sql = neon(DATABASE_URL);

const host = new URL(DATABASE_URL).host;
console.log(`Migration 020 (D9d · ref_loan_limits)${dryRun ? ' (DRY RUN)' : ''}`);
console.log(`Target: ${host}`);

// ─── Phase 1: DDL ─────────────────────────────────────────────────────

const migrationPath = path.join(
  process.cwd(),
  'prisma',
  'migrations',
  '020_ref_loan_limits.sql'
);
const migrationSql = fs.readFileSync(migrationPath, 'utf8');
const cleaned = migrationSql
  .replace(/^\s*BEGIN\s*;\s*$/m, '')
  .replace(/^\s*COMMIT\s*;\s*$/m, '');
const withoutComments = cleaned
  .split('\n')
  .map((l) => l.replace(/--.*$/, '').trimEnd())
  .filter((l) => l.length > 0)
  .join('\n');

const statements = [];
{
  let buf = '';
  let depth = 0;
  let inStr = false;
  for (let i = 0; i < withoutComments.length; i++) {
    const ch = withoutComments[i];
    if (inStr) {
      if (ch === "'") {
        if (withoutComments[i + 1] === "'") { buf += "''"; i++; continue; }
        inStr = false;
      }
      buf += ch;
      continue;
    }
    if (ch === "'") { inStr = true; buf += ch; continue; }
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ';' && depth === 0) {
      const s = buf.trim();
      if (s) statements.push(s);
      buf = '';
    } else {
      buf += ch;
    }
  }
  const tail = buf.trim();
  if (tail) statements.push(tail);
}

console.log(`\n--- Phase 1: DDL (${statements.length} statements) ---`);
for (let i = 0; i < statements.length; i++) {
  const preview = statements[i].split('\n').find((l) => l.trim())?.trim().slice(0, 80) || '(empty)';
  process.stdout.write(`  [${i + 1}/${statements.length}] ${preview}... `);
  try {
    await sql.query(statements[i]);
    console.log('OK');
  } catch (err) {
    console.log(`FAIL: ${err.message}`);
    process.exit(1);
  }
}

if (dryRun) {
  console.log('\n(DRY RUN — DDL applied but seed skipped. Re-run without --dry-run to seed data.)');
  process.exit(0);
}

// ─── Phase 2: seed from county-loan-limits.js ─────────────────────────

console.log('\n--- Phase 2: seed 2026 dataset ---');

const cll = require(path.join(process.cwd(), 'src', 'data', 'county-loan-limits.js'));
const EFFECTIVE_FROM = `${cll.YEAR}-01-01`;
const SOURCE = `FHFA ${cll.YEAR} Conforming Loan Limits (generated 2026-03-20)`;

// Baseline row (1 per year)
const baseline = await sql`
  INSERT INTO ref_conforming_baselines (
    effective_from, effective_to,
    baseline_1unit, baseline_2unit, baseline_3unit, baseline_4unit,
    high_balance_ceiling_1unit, high_balance_ceiling_2unit,
    high_balance_ceiling_3unit, high_balance_ceiling_4unit,
    source
  ) VALUES (
    ${EFFECTIVE_FROM}, NULL,
    ${cll.BASELINE_1UNIT}, ${cll.BASELINE_2UNIT}, ${cll.BASELINE_3UNIT}, ${cll.BASELINE_4UNIT},
    ${cll.HIGH_BALANCE_CEILING_1UNIT}, ${cll.HIGH_BALANCE_CEILING_2UNIT},
    ${cll.HIGH_BALANCE_CEILING_3UNIT}, ${cll.HIGH_BALANCE_CEILING_4UNIT},
    ${SOURCE}
  )
  ON CONFLICT (effective_from) DO NOTHING
  RETURNING id
`;
console.log(`  baseline row: ${baseline.length ? 'inserted' : 'already present'}`);

// County rows — parse the private COUNTY_DATA structure. Each value of
// cll.getCountiesByState(state) gives us normalized rows; we pull the raw
// array from module exports to preserve high-cost 4-unit limits.
const states = cll.getStates();
let totalCounties = 0;
let inserted = 0;
let skipped = 0;

// Build one flat array, then batch-insert 100 at a time.
const allRows = [];
for (const state of states) {
  const counties = cll.getCountiesByState(state);
  for (const c of counties) {
    const lim = cll.getLoanLimits(state, c.name);
    if (!lim) continue;
    totalCounties++;
    const isHighCost = !lim.isBaseline;
    allRows.push({
      state,
      county_fips: c.fips,
      county_name: c.name,
      county_name_norm: normalizeCounty(c.name),
      limit_1unit: lim.conforming1Unit,
      limit_2unit: lim.conforming2Unit,
      limit_3unit: lim.conforming3Unit,
      limit_4unit: lim.conforming4Unit,
      is_high_cost: isHighCost,
    });
  }
}

const BATCH_SIZE = 100;
console.log(`  seeding ${allRows.length} counties in batches of ${BATCH_SIZE}...`);
for (let offset = 0; offset < allRows.length; offset += BATCH_SIZE) {
  const batch = allRows.slice(offset, offset + BATCH_SIZE);

  // Manual VALUES construction since @neondatabase/serverless tagged templates
  // don't support UNNEST cleanly for multi-row inserts.
  const values = batch.map((r, i) => {
    const base = i * 11;
    return `($${base + 1}::date, NULL, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, ` +
           `$${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11})`;
  }).join(',\n    ');

  const params = [];
  for (const r of batch) {
    params.push(
      EFFECTIVE_FROM,
      r.state, r.county_fips, r.county_name, r.county_name_norm,
      r.limit_1unit, r.limit_2unit, r.limit_3unit, r.limit_4unit,
      r.is_high_cost, SOURCE
    );
  }

  const query = `
    INSERT INTO ref_county_loan_limits (
      effective_from, effective_to,
      state, county_fips, county_name, county_name_norm,
      limit_1unit, limit_2unit, limit_3unit, limit_4unit,
      is_high_cost, source
    ) VALUES
    ${values}
    ON CONFLICT (state, county_fips, effective_from) DO NOTHING
    RETURNING id
  `;

  const res = await sql.query(query, params);
  inserted += res.length;
  skipped += (batch.length - res.length);
  process.stdout.write(`\r    batch ${offset / BATCH_SIZE + 1}/${Math.ceil(allRows.length / BATCH_SIZE)}  (inserted ${inserted}, skipped ${skipped})`);
}
console.log('');

// ─── Post-run inventory ───────────────────────────────────────────────

console.log('\n--- Post-run inventory ---');
const bCount = await sql`SELECT COUNT(*)::int AS n FROM ref_conforming_baselines`;
const cCount = await sql`SELECT COUNT(*)::int AS n FROM ref_county_loan_limits`;
const byState = await sql`
  SELECT state, COUNT(*)::int AS n, SUM(CASE WHEN is_high_cost THEN 1 ELSE 0 END)::int AS high_cost
    FROM ref_county_loan_limits
   GROUP BY state
   HAVING state IN ('CO', 'CA', 'TX', 'OR')
   ORDER BY state
`;
const sample = await sql`
  SELECT state, county_name, limit_1unit, is_high_cost
    FROM ref_county_loan_limits
   WHERE state = 'CA' AND county_name = 'San Francisco'
   LIMIT 1
`;
console.log(`  ref_conforming_baselines rows:      ${bCount[0].n}`);
console.log(`  ref_county_loan_limits rows:        ${cCount[0].n}`);
console.log(`  by licensed state (CO/CA/TX/OR):`);
for (const r of byState) {
  console.log(`    ${r.state}:  ${r.n} counties  (${r.high_cost} high-cost)`);
}
if (sample.length) {
  const s = sample[0];
  console.log(`  sample — ${s.state}/${s.county_name}: 1unit=${s.limit_1unit.toLocaleString()}  high_cost=${s.is_high_cost}`);
}

console.log('\nMigration 020 complete.');

// ─── Helpers ──────────────────────────────────────────────────────────

function normalizeCounty(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+county$/i, '')
    .replace(/\s+parish$/i, '')
    .replace(/\s+borough$/i, '')
    .replace(/\s+census area$/i, '')
    .replace(/\s+municipio$/i, '')
    .replace(/\s+municipality$/i, '');
}
