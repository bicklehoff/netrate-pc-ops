/**
 * Migration 004: Non-QM pricing schema.
 * Creates nonqm_rate_sheets, nonqm_rate_products, nonqm_adjustment_rules tables.
 * Adds product_family + Non-QM columns to scenarios and loans.
 * Additive only — safe to roll back by dropping the new tables.
 *
 * Run: node scripts/_run-migration-004.mjs
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

const migrationPath = path.join(process.cwd(), 'prisma', 'migrations', '004_nonqm_schema.sql');
const migrationSql = fs.readFileSync(migrationPath, 'utf8');

// Neon serverless's HTTP endpoint doesn't support multi-statement transactions.
// Strip BEGIN/COMMIT and run each statement individually.
const cleaned = migrationSql
  .replace(/^\s*BEGIN\s*;\s*$/m, '')
  .replace(/^\s*COMMIT\s*;\s*$/m, '');

// Strip ALL SQL comments before splitting — inline comments can contain semicolons
// that break a naive split. Safe here because no `--` appears inside string literals.
const withoutComments = cleaned
  .split('\n')
  .map(line => line.replace(/--.*$/, '').trimEnd())
  .filter(line => line.length > 0)
  .join('\n');

// Split on semicolons that end a statement (outside of any quotes).
// This file has no dollar-quoted bodies, so simple split is fine.
const statements = withoutComments
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0);

console.log(`Running migration 004 — ${statements.length} statements`);

for (let i = 0; i < statements.length; i++) {
  const stmt = statements[i];
  const preview = stmt.split('\n').find(l => l.trim())?.trim().slice(0, 80) || '(empty)';
  process.stdout.write(`  [${i + 1}/${statements.length}] ${preview}... `);
  try {
    await sql.query(stmt);
    console.log('OK');
  } catch (err) {
    console.log(`FAIL: ${err.message}`);
    process.exit(1);
  }
}

// ─── Verification ──────────────────────────────────────────────────

console.log('\n--- Verification ---');

const tables = ['nonqm_rate_sheets', 'nonqm_rate_products', 'nonqm_adjustment_rules'];
for (const t of tables) {
  const rows = await sql.query(
    `SELECT count(*)::int AS cnt FROM information_schema.tables WHERE table_name = $1`,
    [t],
  );
  console.log(`  ${t}: ${rows[0].cnt === 1 ? '✅ exists' : '❌ missing'}`);
}

const scenarioCols = await sql.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'scenarios'
    AND column_name IN ('product_family', 'nonqm_tier', 'nonqm_subcategory',
                        'prepay_years', 'bank_statement_months', 'doc_type')
`);
console.log(`  scenarios new columns: ${scenarioCols.length}/6`);

const loanCols = await sql.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'loans'
    AND column_name IN ('product_family', 'nonqm_tier', 'nonqm_subcategory',
                        'dscr_ratio', 'monthly_rent', 'unit_count',
                        'prepay_years', 'bank_statement_months', 'doc_type')
`);
console.log(`  loans new columns: ${loanCols.length}/9`);

const backfillCheck = await sql.query(`
  SELECT
    (SELECT count(*) FROM scenarios WHERE product_family = 'forward')::int AS scen_forward,
    (SELECT count(*) FROM scenarios WHERE product_family IS NULL)::int AS scen_null,
    (SELECT count(*) FROM loans WHERE product_family = 'forward')::int AS loan_forward,
    (SELECT count(*) FROM loans WHERE product_family IS NULL)::int AS loan_null
`);
const b = backfillCheck[0];
console.log(`  scenarios backfilled: ${b.scen_forward} forward, ${b.scen_null} null`);
console.log(`  loans backfilled: ${b.loan_forward} forward, ${b.loan_null} null`);

console.log('\n✅ Migration 004 complete');
