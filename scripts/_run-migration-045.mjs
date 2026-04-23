/**
 * Migration 045 — drop dead duplicate columns on loans
 *
 * Drops loans.dscr_ratio and loans.unit_count. Both 0 rows, zero src/
 * readers/writers (audited 2026-04-23). Idempotent via IF EXISTS.
 *
 * Usage:
 *   node scripts/_run-migration-045.mjs              # apply + verify
 *   node scripts/_run-migration-045.mjs --verify     # verify only
 *   node scripts/_run-migration-045.mjs --dry-run    # parse + print
 */

import { neon } from '@neondatabase/serverless';
import fs from 'node:fs';
import path from 'node:path';
import 'dotenv/config';

const DATABASE_URL = process.env.PC_DATABASE_URL || process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('PC_DATABASE_URL or DATABASE_URL must be set');
  process.exit(1);
}
const sql = neon(DATABASE_URL);
const host = new URL(DATABASE_URL).host;

const VERIFY_ONLY = process.argv.includes('--verify');
const DRY_RUN = process.argv.includes('--dry-run');

console.log(`Migration 045 — drop dead loans columns`);
console.log(`Target: ${host}`);
console.log(`Mode: ${VERIFY_ONLY ? 'VERIFY ONLY' : DRY_RUN ? 'DRY RUN' : 'APPLY + VERIFY'}`);

// Simple splitter — no DO blocks or string literals with ; in this migration.
function splitStatements(src) {
  return src
    .split('\n')
    .map(l => l.replace(/--.*$/, '').trimEnd())
    .join('\n')
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

async function preFlightCheck() {
  // Confirm 0 rows before drop — belt and suspenders safety check.
  const check = await sql`
    SELECT
      (SELECT COUNT(*)::int FROM loans WHERE dscr_ratio IS NOT NULL) AS dscr_populated,
      (SELECT COUNT(*)::int FROM loans WHERE unit_count IS NOT NULL) AS unit_populated
  `;
  const { dscr_populated, unit_populated } = check[0];
  console.log(`\n━━━ Pre-flight check ━━━`);
  console.log(`  loans.dscr_ratio populated rows: ${dscr_populated} (expected 0)`);
  console.log(`  loans.unit_count populated rows: ${unit_populated} (expected 0)`);
  if (dscr_populated > 0 || unit_populated > 0) {
    console.error(`\n✗ ABORT: columns have data. Backfill/migrate before dropping.`);
    process.exit(1);
  }
}

async function apply() {
  const file = path.join(process.cwd(), 'migrations', '045_drop_dead_loans_columns.sql');
  const src = fs.readFileSync(file, 'utf8');
  const statements = splitStatements(src);
  console.log(`\nStatements to apply: ${statements.length}`);

  if (DRY_RUN) {
    for (let i = 0; i < statements.length; i++) {
      console.log(`  [${i + 1}] ${statements[i]}`);
    }
    return;
  }

  for (let i = 0; i < statements.length; i++) {
    process.stdout.write(`  [${i + 1}/${statements.length}] ${statements[i]}... `);
    try {
      await sql.query(statements[i]);
      console.log('OK');
    } catch (err) {
      console.log(`FAIL`);
      console.error(`\n  ERROR: ${err.message}`);
      throw err;
    }
  }
}

async function verify() {
  console.log(`\n━━━ Verification ━━━`);

  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='loans'
      AND column_name IN ('dscr_ratio', 'unit_count')
  `;
  console.log(`  loans.dscr_ratio present: ${cols.some(c => c.column_name === 'dscr_ratio') ? '✗ still exists' : '✓ dropped'}`);
  console.log(`  loans.unit_count present: ${cols.some(c => c.column_name === 'unit_count') ? '✗ still exists' : '✓ dropped'}`);

  // Column count on loans
  const colCount = await sql`
    SELECT COUNT(*)::int AS n FROM information_schema.columns
    WHERE table_schema='public' AND table_name='loans'
  `;
  console.log(`  loans total columns: ${colCount[0].n} (was 97 pre-drop, expected 95)`);

  // Spot-check that related columns still live in their right homes
  const relatedOK = await sql`
    SELECT
      EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='loan_dscr' AND column_name='dscr_ratio') AS loan_dscr_has_ratio,
      EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='scenarios' AND column_name='dscr_ratio') AS scenarios_has_ratio,
      EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='loans' AND column_name='num_units') AS loans_has_num_units
  `;
  console.log(`  related columns intact: ${JSON.stringify(relatedOK[0])}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────
try {
  if (!VERIFY_ONLY && !DRY_RUN) {
    await preFlightCheck();
  }
  if (!VERIFY_ONLY) {
    await apply();
  }
  if (!DRY_RUN) {
    await verify();
  }
  console.log('\n✓ Migration 045 complete');
} catch (err) {
  console.error('\n✗ Migration 045 failed — inspect output above');
  process.exit(1);
}
