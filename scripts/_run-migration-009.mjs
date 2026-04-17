/**
 * Migration 009: UAD Layer-1c — scenarios.contact_id backfill + discipline.
 *
 * Run: node scripts/_run-migration-009.mjs
 * Dry-run (reports pre/post counts without executing): node scripts/_run-migration-009.mjs --dry-run
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

const migrationPath = path.join(process.cwd(), 'prisma', 'migrations', '009_layer1c_scenarios_contact_fill.sql');
const migrationSql = fs.readFileSync(migrationPath, 'utf8');

// Neon HTTP driver runs statements as separate autocommits — strip outer BEGIN/COMMIT.
const cleaned = migrationSql
  .replace(/^\s*BEGIN\s*;\s*$/m, '')
  .replace(/^\s*COMMIT\s*;\s*$/m, '');

const withoutComments = cleaned
  .split('\n')
  .map(line => line.replace(/--.*$/, '').trimEnd())
  .filter(line => line.length > 0)
  .join('\n');

// Split on semicolons NOT inside CTEs. The migration uses a multi-statement
// WITH ... INSERT ... UPDATE block — we split on trailing `;` at column 0 only.
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

console.log(`Migration 009 (Layer-1c scenarios.contact_id backfill) — ${statements.length} statements${dryRun ? ' (DRY RUN)' : ''}`);

const reportSql = `
  SELECT 'scenarios_total' AS key, count(*)::int AS n FROM scenarios
  UNION ALL SELECT 'scenarios_contact_id_populated', count(*)::int FROM scenarios WHERE contact_id IS NOT NULL
  UNION ALL SELECT 'scenarios_contact_id_null', count(*)::int FROM scenarios WHERE contact_id IS NULL
  UNION ALL SELECT 'scenarios_null_with_lead_converted', count(*)::int FROM scenarios s WHERE s.contact_id IS NULL AND s.lead_id IS NOT NULL AND EXISTS (SELECT 1 FROM leads l WHERE l.id = s.lead_id AND l.contact_id IS NOT NULL)
  UNION ALL SELECT 'scenarios_null_email_matchable', count(*)::int FROM scenarios s WHERE s.contact_id IS NULL AND s.borrower_email IS NOT NULL AND s.borrower_email != '' AND EXISTS (SELECT 1 FROM contacts c WHERE lower(c.email) = lower(s.borrower_email) AND c.organization_id = s.organization_id)
  UNION ALL SELECT 'scenarios_null_with_unconverted_lead', count(*)::int FROM scenarios s WHERE s.contact_id IS NULL AND s.lead_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM leads l WHERE l.id = s.lead_id AND l.contact_id IS NOT NULL)
  UNION ALL SELECT 'scenarios_truly_anonymous', count(*)::int FROM scenarios WHERE contact_id IS NULL AND lead_id IS NULL
  UNION ALL SELECT 'contacts_total', count(*)::int FROM contacts
`;

const before = await sql.query(reportSql);
console.log('\n--- Pre-run state ---');
for (const r of before) console.log(`  ${r.key.padEnd(42)} ${r.n}`);

if (dryRun) {
  console.log('\n(DRY RUN — no statements executed. Re-run without --dry-run to apply.)');
  process.exit(0);
}

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

console.log('\n--- Post-run state ---');
const after = await sql.query(reportSql);
for (const r of after) console.log(`  ${r.key.padEnd(42)} ${r.n}`);

// Verify expectations
const beforeMap = Object.fromEntries(before.map(r => [r.key, r.n]));
const afterMap = Object.fromEntries(after.map(r => [r.key, r.n]));

const moved = afterMap.scenarios_contact_id_populated - beforeMap.scenarios_contact_id_populated;

console.log('\n--- Summary ---');
console.log(`  Scenarios newly linked (Steps 1+2):         ${moved}`);
console.log(`  Remaining NULL with unconverted lead:       ${afterMap.scenarios_null_with_unconverted_lead} (legitimate — lead not yet converted)`);
console.log(`  Remaining NULL truly anonymous:             ${afterMap.scenarios_truly_anonymous} (legitimate — no lead, no email)`);

if (afterMap.scenarios_null_with_lead_converted > 0) {
  console.log(`\n  ⚠️  ${afterMap.scenarios_null_with_lead_converted} scenarios have a converted lead but still null contact_id.`);
  console.log('     Investigate — Step 1 should have linked these.');
  process.exit(1);
}

if (afterMap.scenarios_null_email_matchable > 0) {
  console.log(`\n  ⚠️  ${afterMap.scenarios_null_email_matchable} scenarios have an email matching an existing contact but were not linked.`);
  console.log('     Investigate — Step 2 should have linked these.');
  process.exit(1);
}

console.log('\n✅ Migration 009 (Layer-1c scenarios.contact_id bridge catchup) complete.');
console.log('   Next: deploy DAL rewrite so identity reads flow contact → lead → legacy.');
