/**
 * Migration 005: UAD Layer 1a — additive foundation.
 *
 * Adds contacts columns, creates loan_participants and service_provider_*
 * tables. NO table renames — mlos stays as mlos (rename deferred to Layer-1b
 * alongside the 17 raw-SQL call sites that reference FROM mlos).
 *
 * Zero code impact — all existing code continues to work.
 *
 * Run: node scripts/_run-migration-005.mjs
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

const migrationPath = path.join(process.cwd(), 'prisma', 'migrations', '005_layer1a_uad_additive.sql');
const migrationSql = fs.readFileSync(migrationPath, 'utf8');

// Neon serverless HTTP can't run BEGIN/COMMIT in a single round-trip.
// Strip them and run each statement individually. This migration is
// additive-only and uses IF NOT EXISTS / IF EXISTS guards, so a failure
// mid-way leaves a recoverable partial state (re-run is safe).
const cleaned = migrationSql
  .replace(/^\s*BEGIN\s*;\s*$/m, '')
  .replace(/^\s*COMMIT\s*;\s*$/m, '');

const withoutComments = cleaned
  .split('\n')
  .map(line => line.replace(/--.*$/, '').trimEnd())
  .filter(line => line.length > 0)
  .join('\n');

const statements = withoutComments
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0);

console.log(`Running migration 005 (Layer-1a additive) — ${statements.length} statements`);

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

const tables = ['loan_participants', 'service_provider_accounts', 'service_provider_contacts', 'loan_service_providers'];
for (const t of tables) {
  const rows = await sql.query(
    `SELECT count(*)::int AS cnt FROM information_schema.tables WHERE table_name = $1`,
    [t],
  );
  console.log(`  ${t.padEnd(28)} ${rows[0].cnt === 1 ? '✅ exists' : '❌ missing'}`);
}

const mlosStillExists = await sql.query(
  `SELECT count(*)::int AS cnt FROM information_schema.tables WHERE table_name = 'mlos'`,
);
console.log(`  mlos (unchanged in 1a)       ${mlosStillExists[0].cnt === 1 ? '✅ still exists' : '❌ gone unexpectedly'}`);

const contactCols = await sql.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'contacts'
    AND column_name IN ('dob_encrypted', 'ssn_encrypted', 'ssn_last_four',
                        'phone_verified', 'password_hash', 'magic_token',
                        'magic_expires', 'sms_code', 'sms_code_expires',
                        'sms_attempts', 'sms_locked_until', 'legal_first_name',
                        'legal_last_name', 'nickname', 'role',
                        'communication_prefs', 'marketing_stage')
`);
console.log(`  contacts new columns:        ${contactCols.length}/17 added`);

// Row count sanity — existing data unchanged
const rowCounts = await sql.query(`
  SELECT 'borrowers' AS tbl, count(*)::int AS n FROM borrowers
  UNION ALL SELECT 'contacts', count(*)::int FROM contacts
  UNION ALL SELECT 'mlos', count(*)::int FROM mlos
  UNION ALL SELECT 'loans', count(*)::int FROM loans
  UNION ALL SELECT 'loan_participants', count(*)::int FROM loan_participants
`);
console.log('\n--- Row counts post-migration ---');
for (const r of rowCounts) {
  console.log(`  ${r.tbl.padEnd(28)} ${r.n}`);
}

console.log('\n✅ Migration 005 (Layer-1a additive) complete');
console.log('   Next: update Prisma schema with additive changes (new Contact fields + LoanParticipant + service_provider_* models)');
console.log('   Then: Layer-1b (separate PR) for mlos→staff rename, data merge, code sweep, drops');
