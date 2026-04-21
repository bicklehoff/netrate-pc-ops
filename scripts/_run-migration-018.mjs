/**
 * Migration 018: drop legacy borrower_quotes + saved_scenarios tables.
 *
 * Run against prod: node scripts/_run-migration-018.mjs
 * Rehearse on branch: DATABASE_URL=<branch-url> node scripts/_run-migration-018.mjs
 * Dry-run: node scripts/_run-migration-018.mjs --dry-run
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

const migrationPath = path.join(
  process.cwd(),
  'prisma',
  'migrations',
  '018_drop_legacy_quote_tables.sql'
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

// Semicolon splitter that tolerates single-quoted string literals.
const statements = [];
{
  let buf = '';
  let depth = 0;
  let inStr = false;
  for (let i = 0; i < withoutComments.length; i++) {
    const ch = withoutComments[i];
    if (inStr) {
      if (ch === "'") {
        if (withoutComments[i + 1] === "'") { buf += "''"; i++; continue; }
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

const host = new URL(DATABASE_URL).host;
console.log(
  `Migration 018 (drop legacy quote tables) — ${statements.length} statements${dryRun ? ' (DRY RUN)' : ''}`
);
console.log(`Target: ${host}`);

// Pre-run inventory
async function inventory(label) {
  const tables = await sql`
    SELECT table_name
      FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name IN ('borrower_quotes', 'saved_scenarios', 'scenarios', 'scenario_alert_queue')
     ORDER BY table_name
  `;
  console.log(`\n--- ${label}: tables present ---`);
  for (const t of tables) console.log(`  ${t.table_name}`);

  // scenario_alert_queue FK target
  const saqFk = await sql`
    SELECT ccu.table_name AS parent_table
      FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
     WHERE tc.constraint_type = 'FOREIGN KEY'
       AND tc.table_name = 'scenario_alert_queue'
  `;
  console.log(`  scenario_alert_queue.scenario_id FK target: ${saqFk[0]?.parent_table ?? '(none)'}`);

  // scenario_alert_queue row count
  const saqCount = await sql`SELECT COUNT(*)::int AS n FROM scenario_alert_queue`;
  console.log(`  scenario_alert_queue rows: ${saqCount[0].n}`);

  // orphans: alert queue rows whose scenario_id is missing from scenarios
  const orphans = await sql`
    SELECT COUNT(*)::int AS n
      FROM scenario_alert_queue saq
      LEFT JOIN scenarios s ON s.id = saq.scenario_id
     WHERE s.id IS NULL
  `;
  console.log(`  alert queue rows with no parent in scenarios: ${orphans[0].n}`);
}

await inventory('Pre-run');

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

await inventory('Post-run');

console.log('\nMigration 018 complete. Legacy quote tables dropped; scenario_alert_queue FK redirected to scenarios.');
