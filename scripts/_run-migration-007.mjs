/**
 * Migration 007: UAD Layer-1b2a — mlos → staff rename + scenarios lead_id backfill.
 *
 * Zero-downtime: creates backward-compat `mlos` view over `staff`, so code
 * using `FROM mlos` keeps working until the code sweep lands.
 *
 * Run: node scripts/_run-migration-007.mjs
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

const migrationPath = path.join(process.cwd(), 'prisma', 'migrations', '007_layer1b2a_staff_rename.sql');
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

console.log(`Running migration 007 (Layer-1b2a staff rename) — ${statements.length} statements`);

const before = await sql.query(`
  SELECT 'mlos_as_table' AS key, count(*)::int AS n
    FROM information_schema.tables WHERE table_name = 'mlos' AND table_type = 'BASE TABLE'
  UNION ALL SELECT 'staff_as_table',
    (SELECT count(*)::int FROM information_schema.tables WHERE table_name = 'staff' AND table_type = 'BASE TABLE')
  UNION ALL SELECT 'scenarios_with_contact_id',
    (SELECT count(*)::int FROM scenarios WHERE contact_id IS NOT NULL)
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

const tableCheck = await sql.query(`
  SELECT table_name, table_type FROM information_schema.tables
  WHERE table_name IN ('mlos', 'staff')
  ORDER BY table_name
`);
for (const r of tableCheck) {
  console.log(`  ${r.table_name.padEnd(12)} ${r.table_type}`);
}

const staffCols = await sql.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'staff'
    AND column_name IN ('license_states', 'commission_rate', 'is_active', 'phone')
`);
console.log(`\n  staff new columns:           ${staffCols.length}/4 added`);

// Sanity: mlos view must return same rows as staff table
const mlosCount = await sql.query(`SELECT count(*)::int AS n FROM mlos`);
const staffCount = await sql.query(`SELECT count(*)::int AS n FROM staff`);
console.log(`  mlos view rows:              ${mlosCount[0].n}`);
console.log(`  staff table rows:            ${staffCount[0].n}`);
console.log(`  ${mlosCount[0].n === staffCount[0].n ? '✅ match' : '❌ mismatch'}`);

const scenariosContactId = await sql.query(`
  SELECT count(*)::int AS n FROM scenarios WHERE contact_id IS NOT NULL
`);
const scenariosDelta = scenariosContactId[0].n - before.find(r => r.key === 'scenarios_with_contact_id').n;
console.log(`  scenarios with contact_id:   ${scenariosContactId[0].n} (+${scenariosDelta} from backfill)`);

console.log('\n✅ Migration 007 (Layer-1b2a staff rename) complete');
console.log('   Next: deploy code with FROM staff (merge PR) — view provides compatibility during the window');
console.log('   Then: Layer-1b3 — drop mlos view, borrowers tables, loans.borrower_id rename');
