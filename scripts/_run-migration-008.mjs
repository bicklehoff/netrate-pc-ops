/**
 * Migration 008: UAD Layer-1b3 — borrowers drop + column rename cutover.
 *
 * Run: node scripts/_run-migration-008.mjs
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

const migrationPath = path.join(process.cwd(), 'prisma', 'migrations', '008_layer1b3_borrowers_drop.sql');
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

console.log(`Running migration 008 (Layer-1b3 borrowers drop) — ${statements.length} statements`);

const before = await sql.query(`
  SELECT 'borrowers_exists' AS key,
    (SELECT count(*)::int FROM information_schema.tables WHERE table_name = 'borrowers' AND table_type = 'BASE TABLE') AS n
  UNION ALL SELECT 'loan_contacts_exists',
    (SELECT count(*)::int FROM information_schema.tables WHERE table_name = 'loan_contacts' AND table_type = 'BASE TABLE')
  UNION ALL SELECT 'mlos_view_exists',
    (SELECT count(*)::int FROM information_schema.tables WHERE table_name = 'mlos' AND table_type = 'VIEW')
  UNION ALL SELECT 'loans_total',
    (SELECT count(*)::int FROM loans)
  UNION ALL SELECT 'loans_contact_id_null',
    (SELECT count(*)::int FROM loans WHERE contact_id IS NULL)
  UNION ALL SELECT 'loan_borrowers_total',
    (SELECT count(*)::int FROM loan_borrowers)
`);
console.log('\n--- Pre-run state ---');
for (const r of before) console.log(`  ${r.key.padEnd(32)} ${r.n}`);

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
    process.exit(1);
  }
}

console.log('\n--- Verification ---');

const post = await sql.query(`
  SELECT 'borrowers_exists' AS key,
    (SELECT count(*)::int FROM information_schema.tables WHERE table_name = 'borrowers') AS n
  UNION ALL SELECT 'loan_contacts_exists',
    (SELECT count(*)::int FROM information_schema.tables WHERE table_name = 'loan_contacts')
  UNION ALL SELECT 'mlos_exists',
    (SELECT count(*)::int FROM information_schema.tables WHERE table_name = 'mlos')
  UNION ALL SELECT 'loan_borrowers_contact_id_col',
    (SELECT count(*)::int FROM information_schema.columns WHERE table_name = 'loan_borrowers' AND column_name = 'contact_id')
  UNION ALL SELECT 'loan_borrowers_borrower_id_col',
    (SELECT count(*)::int FROM information_schema.columns WHERE table_name = 'loan_borrowers' AND column_name = 'borrower_id')
  UNION ALL SELECT 'loans_contact_id_col',
    (SELECT count(*)::int FROM information_schema.columns WHERE table_name = 'loans' AND column_name = 'contact_id')
  UNION ALL SELECT 'loans_borrower_id_col',
    (SELECT count(*)::int FROM information_schema.columns WHERE table_name = 'loans' AND column_name = 'borrower_id')
  UNION ALL SELECT 'contacts_borrower_id_col',
    (SELECT count(*)::int FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'borrower_id')
  UNION ALL SELECT 'loan_borrowers_row_count',
    (SELECT count(*)::int FROM loan_borrowers)
  UNION ALL SELECT 'loans_row_count',
    (SELECT count(*)::int FROM loans)
`);
for (const r of post) console.log(`  ${r.key.padEnd(32)} ${r.n}`);

const expected = {
  borrowers_exists: 0,
  loan_contacts_exists: 0,
  mlos_exists: 0,
  loan_borrowers_contact_id_col: 1,
  loan_borrowers_borrower_id_col: 0,
  loans_contact_id_col: 1,
  loans_borrower_id_col: 0,
  contacts_borrower_id_col: 0,
};

let allMatch = true;
for (const [key, want] of Object.entries(expected)) {
  const got = post.find(r => r.key === key)?.n;
  if (got !== want) {
    console.log(`  ❌ ${key}: expected ${want}, got ${got}`);
    allMatch = false;
  }
}

if (!allMatch) {
  console.log('\n❌ Migration 008 verification failed.');
  process.exit(1);
}

console.log('\n✅ Migration 008 (Layer-1b3 borrowers drop) complete.');
console.log('   Next: Prisma schema cleanup (Step 4 of handoff) + deploy code PR.');
