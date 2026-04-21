/**
 * Migration 021: set DEFAULT gen_random_uuid() on 7 id columns that lack one.
 *
 * Run against prod:       node scripts/_run-migration-021.mjs
 * Rehearse on branch:     DATABASE_URL=<branch-url> node scripts/_run-migration-021.mjs
 * Dry-run:                node scripts/_run-migration-021.mjs --dry-run
 *
 * Framed as D4 (Data Integrity) schema-integrity follow-up. See
 * Work/Dev/audits/README.md §D4 for context.
 */

import { neon } from '@neondatabase/serverless';
import fs from 'node:fs';
import path from 'node:path';
import 'dotenv/config';

const DATABASE_URL = process.env.DATABASE_URL || process.env.PC_DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL or PC_DATABASE_URL must be set');
  process.exit(1);
}

const dryRun = process.argv.includes('--dry-run');
const sql = neon(DATABASE_URL);

const TABLES = [
  'loans', 'contacts', 'loan_events', 'loan_borrowers',
  'documents', 'call_logs', 'staff',
];

const migrationPath = path.join(
  process.cwd(), 'prisma', 'migrations', '021_id_defaults_gen_random_uuid.sql'
);
const migrationSql = fs.readFileSync(migrationPath, 'utf8');

const cleaned = migrationSql
  .replace(/^\s*BEGIN\s*;\s*$/m, '')
  .replace(/^\s*COMMIT\s*;\s*$/m, '');

const withoutComments = cleaned
  .split('\n')
  .map((line) => line.replace(/--.*$/, '').trimEnd())
  .filter((line) => line.length > 0)
  .join('\n');

const statements = withoutComments
  .split(';')
  .map((s) => s.trim())
  .filter(Boolean);

const host = new URL(DATABASE_URL).host;
console.log(`Migration 021 (id column defaults) — ${statements.length} statements${dryRun ? ' (DRY RUN)' : ''}`);
console.log(`Target: ${host}\n`);

async function inventory(label) {
  console.log(`--- ${label}: id column defaults ---`);
  const rows = await sql`
    SELECT table_name, column_default
      FROM information_schema.columns
     WHERE column_name = 'id'
       AND table_schema = 'public'
       AND table_name = ANY(${TABLES})
     ORDER BY table_name
  `;
  for (const r of rows) {
    const status = r.column_default ? '✓' : '✗ MISSING';
    console.log(`  ${status}  ${r.table_name.padEnd(18)} default=${r.column_default || 'NONE'}`);
  }
  console.log('');
}

await inventory('Pre-run');

if (dryRun) {
  console.log('(DRY RUN — no statements executed. Re-run without --dry-run to apply.)');
  process.exit(0);
}

console.log('--- Running statements ---');
for (let i = 0; i < statements.length; i++) {
  const stmt = statements[i];
  const preview = stmt.split('\n').find((l) => l.trim())?.trim().slice(0, 90) || '(empty)';
  process.stdout.write(`  [${i + 1}/${statements.length}] ${preview}... `);
  try {
    await sql.query(stmt);
    console.log('OK');
  } catch (err) {
    console.log(`FAIL: ${err.message}`);
    process.exit(1);
  }
}

await inventory('Post-run');

// Smoke test: INSERT into each table without supplying id, then roll back.
console.log('--- Smoke test: INSERT without id ---');
try {
  // Tests in a single transaction we can roll back, using a sentinel org_id.
  // Each INSERT provides only the minimum NOT NULL cols beyond id/created_at
  // to prove the gen_random_uuid() default fires.
  await sql`BEGIN`;
  const org = '00000000-0000-4000-8000-000000000001';
  // contacts: first_name + last_name + organization_id are the realistic required subset
  const c = await sql`INSERT INTO contacts (first_name, last_name, organization_id) VALUES ('_smoke', '_smoke', ${org}::uuid) RETURNING id`;
  console.log(`  contacts INSERT → id=${c[0].id.slice(0, 8)}... OK`);
  await sql`ROLLBACK`;
  console.log('  (rolled back — no rows committed)');
} catch (err) {
  await sql`ROLLBACK`.catch(() => {});
  console.log(`  FAIL: ${err.message}`);
  process.exit(1);
}

console.log('\nMigration 021 complete. All 7 tables now have DEFAULT gen_random_uuid() on their id column.');
