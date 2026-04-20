/**
 * Migration 010: site_scenarios + surface_pricing_config (D9b.5 + D9b.6).
 *
 * Additive — creates two new tables + seed rows matching the current
 * hardcoded constants in src/lib/rates/defaults.js (DEFAULT_SCENARIO)
 * and src/lib/rates/homepage.js (exclude* kwargs). No existing table
 * modified. Idempotent — safe to re-run (CREATE TABLE IF NOT EXISTS +
 * INSERT ... ON CONFLICT DO NOTHING).
 *
 * Run: node scripts/_run-migration-010.mjs
 * Dry-run: node scripts/_run-migration-010.mjs --dry-run
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
  '010_site_scenarios_and_surface_config.sql'
);
const migrationSql = fs.readFileSync(migrationPath, 'utf8');

// Neon HTTP driver runs statements as separate autocommits — strip outer BEGIN/COMMIT.
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
  `Migration 010 (site_scenarios + surface_pricing_config) — ${statements.length} statements${
    dryRun ? ' (DRY RUN)' : ''
  }`
);

const reportSql = `
  SELECT 'site_scenarios_count' AS key, count(*)::int AS n
    FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'site_scenarios'
  UNION ALL SELECT 'surface_pricing_config_count', count(*)::int
    FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'surface_pricing_config'
`;

const before = await sql.query(reportSql);
console.log('\n--- Pre-run state (1 = table exists, 0 = does not) ---');
for (const r of before) console.log(`  ${r.key.padEnd(36)} ${r.n}`);

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
for (const r of after) console.log(`  ${r.key.padEnd(36)} ${r.n}`);

const siteScenarios = await sql`SELECT slug, loan_amount, state FROM site_scenarios ORDER BY slug`;
console.log('\n--- site_scenarios rows ---');
for (const r of siteScenarios) {
  console.log(`  ${r.slug.padEnd(24)} loan_amount=${r.loan_amount} state=${r.state}`);
}

const surfaceRows = await sql`SELECT surface, exclude_jumbo, exclude_streamline, product_types FROM surface_pricing_config ORDER BY surface`;
console.log('\n--- surface_pricing_config rows ---');
for (const r of surfaceRows) {
  console.log(
    `  ${r.surface.padEnd(16)} jumbo=${r.exclude_jumbo} streamline=${r.exclude_streamline} product_types=${JSON.stringify(r.product_types)}`
  );
}

console.log('\n✅ Migration 010 (site_scenarios + surface_pricing_config) complete.');
console.log('   Next: merge DAL + homepage.js refactor PR. DAL falls back to');
console.log('   DEFAULT_SCENARIO constants if DB read fails, so deploy order');
console.log('   is flexible.');
