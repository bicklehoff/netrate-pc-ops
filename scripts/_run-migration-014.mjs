/**
 * Migration 014: normalize legacy loan value outliers (D7 data cleanup).
 *
 * Five UPDATEs, idempotent (WHERE targets only legacy values). Rollback
 * has no clean marker — but the source values are documented inline in
 * the SQL so a manual UPDATE can reverse if needed.
 *
 * Run: node scripts/_run-migration-014.mjs
 * Dry-run: node scripts/_run-migration-014.mjs --dry-run
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
  '014_loan_legacy_value_cleanup.sql'
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
  `Migration 014 (loan_legacy_value_cleanup) — ${statements.length} statements${dryRun ? ' (DRY RUN)' : ''}`
);

const reportSql = `
  SELECT 'property_type' AS col, property_type AS v, COUNT(*)::int AS n
    FROM loans
   WHERE property_type IN ('sfr','SFH-Detached','sitebuilt','Condo','multi_unit','single_family','condo','2-4unit')
   GROUP BY property_type
  UNION ALL
  SELECT 'occupancy', occupancy, COUNT(*)::int
    FROM loans
   WHERE occupancy IN ('primary_residence','primary')
   GROUP BY occupancy
  UNION ALL
  SELECT 'loan_type', loan_type, COUNT(*)::int
    FROM loans
   WHERE loan_type IN ('Conventional','conventional')
   GROUP BY loan_type
  ORDER BY col, n DESC
`;

const before = await sql.query(reportSql);
console.log('\n--- Pre-run state ---');
for (const r of before) console.log(`  ${r.col.padEnd(14)} ${JSON.stringify(r.v).padEnd(22)} ${r.n}`);

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
    const result = await sql.query(stmt);
    console.log(`OK (${result?.length ?? 0} rows reported)`);
  } catch (err) {
    console.log(`FAIL: ${err.message}`);
    process.exit(1);
  }
}

console.log('\n--- Post-run state ---');
const after = await sql.query(reportSql);
for (const r of after) console.log(`  ${r.col.padEnd(14)} ${JSON.stringify(r.v).padEnd(22)} ${r.n}`);

const legacyStill = after.filter(r =>
  ['sfr','SFH-Detached','sitebuilt','Condo','multi_unit','primary_residence','Conventional'].includes(r.v)
);
if (legacyStill.length === 0) {
  console.log('\nMigration 014 complete. All legacy values cleaned.');
} else {
  console.log('\nWARN: legacy values still present:', legacyStill.map(r => r.v));
}
