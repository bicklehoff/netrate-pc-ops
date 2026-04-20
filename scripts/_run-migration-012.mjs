/**
 * Migration 012: ref_licensed_states + ref_loan_types (D7-3).
 *
 * DB-backed picklist source for STATES and LOAN_TYPES. Additive — creates
 * two new tables + seed rows, no existing table modified. Idempotent —
 * safe to re-run (CREATE TABLE IF NOT EXISTS + ON CONFLICT DO NOTHING).
 *
 * Run: node scripts/_run-migration-012.mjs
 * Dry-run: node scripts/_run-migration-012.mjs --dry-run
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

const dryRun = process.argv.includes('--dry-run');
const sql = neon(DATABASE_URL);

const migrationPath = path.join(
  process.cwd(),
  'prisma',
  'migrations',
  '012_picklist_refs.sql'
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

// Split on semicolons at top-level depth (ignoring parens AND single-quoted
// string literals — the latter was the bug in the migration-011 runner).
const statements = [];
{
  let buf = '';
  let depth = 0;
  let inStr = false;
  for (let i = 0; i < withoutComments.length; i++) {
    const ch = withoutComments[i];
    if (inStr) {
      if (ch === "'") {
        // Handle doubled single-quote as escape
        if (withoutComments[i + 1] === "'") {
          buf += "''";
          i++;
          continue;
        }
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

console.log(
  `Migration 012 (picklist_refs) — ${statements.length} statements${dryRun ? ' (DRY RUN)' : ''}`
);

const reportSql = `
  SELECT 'ref_licensed_states_table_exists' AS key, count(*)::int AS n
    FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'ref_licensed_states'
  UNION ALL SELECT 'ref_loan_types_table_exists', count(*)::int
    FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'ref_loan_types'
  UNION ALL SELECT 'ref_licensed_states_row_count',
    COALESCE((SELECT count(*)::int FROM ref_licensed_states), 0)
  UNION ALL SELECT 'ref_loan_types_row_count',
    COALESCE((SELECT count(*)::int FROM ref_loan_types), 0)
`;

const before = await sql.query(reportSql).catch(() => []);
console.log('\n--- Pre-run state ---');
for (const r of before) console.log(`  ${r.key.padEnd(40)} ${r.n}`);

if (dryRun) {
  console.log('\n(DRY RUN — no statements executed. Re-run without --dry-run to apply.)');
  process.exit(0);
}

console.log('\n--- Running statements ---');
for (let i = 0; i < statements.length; i++) {
  const stmt = statements[i];
  const preview = stmt.split('\n').find((l) => l.trim())?.trim().slice(0, 80) || '(empty)';
  process.stdout.write(`  [${i + 1}/${statements.length}] ${preview}... `);
  try {
    await sql.query(stmt);
    console.log('OK');
  } catch (err) {
    console.log(`FAIL: ${err.message}`);
    process.exit(1);
  }
}

console.log('\n--- Post-run state ---');
const after = await sql.query(reportSql);
for (const r of after) console.log(`  ${r.key.padEnd(40)} ${r.n}`);

console.log('\nMigration 012 (picklist_refs) complete.');
console.log('  Expect: ref_licensed_states = 51 rows (50 states + DC, 4 active),');
console.log('          ref_loan_types = 11 rows (10 active + 1 legacy nonqm inactive).');
