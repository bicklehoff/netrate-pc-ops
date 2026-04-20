/**
 * Migration 011: homepage_rate_cache (D9b.7).
 *
 * Additive — creates one new table for last-known-good homepage rate
 * rows. No existing table modified. Idempotent — safe to re-run
 * (CREATE TABLE IF NOT EXISTS).
 *
 * Run: node scripts/_run-migration-011.mjs
 * Dry-run: node scripts/_run-migration-011.mjs --dry-run
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
  '011_homepage_rate_cache.sql'
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

const statements = [];
{
  let buf = '';
  let depth = 0;
  for (const ch of withoutComments) {
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
  `Migration 011 (homepage_rate_cache) — ${statements.length} statements${dryRun ? ' (DRY RUN)' : ''}`
);

const reportSql = `
  SELECT 'homepage_rate_cache_table_exists' AS key, count(*)::int AS n
    FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'homepage_rate_cache'
  UNION ALL SELECT 'site_scenarios_table_exists', count(*)::int
    FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'site_scenarios'
`;

const before = await sql.query(reportSql);
console.log('\n--- Pre-run state (1 = exists, 0 = does not) ---');
for (const r of before) console.log(`  ${r.key.padEnd(40)} ${r.n}`);

const siteScenariosCheck = before.find((r) => r.key === 'site_scenarios_table_exists');
if (!siteScenariosCheck || siteScenariosCheck.n === 0) {
  console.error('\n✗ site_scenarios table does not exist. Run migration 010 first.');
  process.exit(1);
}

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

console.log('\n✅ Migration 011 (homepage_rate_cache) complete.');
console.log('   Table is empty at rollout — fills on first successful');
console.log('   homepage compute. Homepage DAL writes 4 rows per render');
console.log('   (conv30, conv15, fha30, va30) and reads on failure.');
