/**
 * Migration 015: unify loans.property_type on pricing-native vocab.
 *
 * Run: node scripts/_run-migration-015.mjs
 * Dry-run: node scripts/_run-migration-015.mjs --dry-run
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
  '015_property_type_unification.sql'
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

console.log(
  `Migration 015 (property_type_unification) — ${statements.length} statements${dryRun ? ' (DRY RUN)' : ''}`
);

const reportSql = `
  SELECT property_type AS v, COUNT(*)::int AS n
    FROM loans
   WHERE property_type IS NOT NULL
   GROUP BY property_type
   ORDER BY n DESC
`;

const before = await sql.query(reportSql);
console.log('\n--- Pre-run state ---');
for (const r of before) console.log(`  ${JSON.stringify(r.v).padEnd(20)} ${r.n}`);

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
for (const r of after) console.log(`  ${JSON.stringify(r.v).padEnd(20)} ${r.n}`);

const legacyStill = after.filter(r =>
  ['single_family','SFH-Detached','SFH-Attached','sitebuilt','2-4unit','townhouse'].includes(r.v)
);
if (legacyStill.length === 0) {
  console.log('\nMigration 015 complete. All values on pricing-native vocab.');
} else {
  console.log('\nWARN: legacy values still present:', legacyStill.map(r => r.v));
}
