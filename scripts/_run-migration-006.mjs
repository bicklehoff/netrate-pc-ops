/**
 * Migration 006: UAD Layer-1b1 — data fill.
 *
 * Merges borrower auth/PII into contacts (3 cases), populates
 * loan_participants from loan_contacts + loan_borrowers, backfills
 * scenarios.contact_id. All idempotent — safe to re-run.
 *
 * Does NOT drop tables or rename anything. Zero code impact.
 * Layer-1b2 (separate migration) handles cutover + drops.
 *
 * Run: node scripts/_run-migration-006.mjs
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

const migrationPath = path.join(process.cwd(), 'prisma', 'migrations', '006_layer1b1_data_fill.sql');
const migrationSql = fs.readFileSync(migrationPath, 'utf8');

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

console.log(`Running migration 006 (Layer-1b1 data fill) — ${statements.length} statements`);

// Pre-run counts for drift detection
const before = await sql.query(`
  SELECT 'borrowers' AS tbl, count(*)::int AS n FROM borrowers
  UNION ALL SELECT 'contacts', count(*)::int FROM contacts
  UNION ALL SELECT 'loan_participants', count(*)::int FROM loan_participants
  UNION ALL SELECT 'scenarios_with_contact_id',
    (SELECT count(*)::int FROM scenarios WHERE contact_id IS NOT NULL)
`);
console.log('\n--- Pre-run counts ---');
for (const r of before) console.log(`  ${r.tbl.padEnd(32)} ${r.n}`);

console.log('\n--- Running statements ---');
for (let i = 0; i < statements.length; i++) {
  const stmt = statements[i];
  const preview = stmt.split('\n').find(l => l.trim())?.trim().slice(0, 80) || '(empty)';
  process.stdout.write(`  [${i + 1}/${statements.length}] ${preview}... `);
  try {
    await sql.query(stmt);
    console.log('OK');
  } catch (err) {
    console.log(`FAIL: ${err.message}`);
    console.log(`\n  Full statement:\n${stmt}\n`);
    process.exit(1);
  }
}

// ─── Verification ──────────────────────────────────────────────────

console.log('\n--- Post-run counts + deltas ---');
const after = await sql.query(`
  SELECT 'borrowers' AS tbl, count(*)::int AS n FROM borrowers
  UNION ALL SELECT 'contacts', count(*)::int FROM contacts
  UNION ALL SELECT 'loan_participants', count(*)::int FROM loan_participants
  UNION ALL SELECT 'scenarios_with_contact_id',
    (SELECT count(*)::int FROM scenarios WHERE contact_id IS NOT NULL)
`);

const beforeMap = Object.fromEntries(before.map(r => [r.tbl, r.n]));
for (const r of after) {
  const delta = r.n - beforeMap[r.tbl];
  const deltaStr = delta > 0 ? `(+${delta})` : delta < 0 ? `(${delta})` : '(no change)';
  console.log(`  ${r.tbl.padEnd(32)} ${r.n}  ${deltaStr}`);
}

console.log('\n--- Merge integrity checks ---');

const withPassword = await sql.query(`
  SELECT count(*)::int AS n FROM contacts WHERE password_hash IS NOT NULL
`);
console.log(`  contacts.password_hash populated:      ${withPassword[0].n} rows (should be 0 — production had no portal sessions)`);

const withSsn = await sql.query(`
  SELECT count(*)::int AS n FROM contacts WHERE ssn_encrypted IS NOT NULL
`);
console.log(`  contacts.ssn_encrypted populated:      ${withSsn[0].n} rows`);

const borrowersWithContact = await sql.query(`
  SELECT count(*)::int AS n FROM borrowers b
  WHERE EXISTS (SELECT 1 FROM contacts c WHERE c.borrower_id = b.id)
`);
console.log(`  borrowers with a contact mapping:      ${borrowersWithContact[0].n}/837 (should be 837)`);

const orphanBorrowers = await sql.query(`
  SELECT count(*)::int AS n FROM borrowers b
  WHERE NOT EXISTS (SELECT 1 FROM contacts c WHERE c.borrower_id = b.id)
`);
console.log(`  borrowers WITHOUT contact (should be 0):  ${orphanBorrowers[0].n}`);

const participantRoles = await sql.query(`
  SELECT role, count(*)::int AS n FROM loan_participants GROUP BY role ORDER BY n DESC
`);
console.log(`\n  loan_participants role distribution:`);
for (const r of participantRoles) console.log(`    ${r.role.padEnd(24)} ${r.n}`);

console.log('\n✅ Migration 006 (Layer-1b1 data fill) complete');
console.log('   Next: Layer-1b2 — mlos→staff rename, column renames, NextAuth update, drops');
