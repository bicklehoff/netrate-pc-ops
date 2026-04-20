/**
 * Migration 016: loan purpose URLA hierarchy (D7 / PR 2).
 *
 * Adds loans.cashout_reason column + normalizes 95 legacy refi_purpose
 * rows to canonical URLA codes. Idempotent.
 *
 * Run: node scripts/_run-migration-016.mjs
 * Dry-run: node scripts/_run-migration-016.mjs --dry-run
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
  '016_loan_purpose_hierarchy.sql'
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
  `Migration 016 (loan_purpose_hierarchy) — ${statements.length} statements${dryRun ? ' (DRY RUN)' : ''}`
);

const reportSql = `
  SELECT 'refi_purpose' AS col, refi_purpose AS v, COUNT(*)::int AS n
    FROM loans WHERE refi_purpose IS NOT NULL GROUP BY refi_purpose
  UNION ALL
  SELECT 'cashout_reason', cashout_reason, COUNT(*)::int
    FROM loans WHERE cashout_reason IS NOT NULL GROUP BY cashout_reason
  ORDER BY col, n DESC
`;

const before = await sql.query(reportSql).catch((e) => {
  // cashout_reason might not exist yet — that's fine on first run
  if (/column.*cashout_reason/i.test(e.message)) {
    return sql.query(`SELECT 'refi_purpose' AS col, refi_purpose AS v, COUNT(*)::int AS n FROM loans WHERE refi_purpose IS NOT NULL GROUP BY refi_purpose ORDER BY n DESC`);
  }
  throw e;
});
console.log('\n--- Pre-run state ---');
for (const r of before) console.log(`  ${r.col.padEnd(16)} ${JSON.stringify(r.v).padEnd(28)} ${r.n}`);

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
for (const r of after) console.log(`  ${r.col.padEnd(16)} ${JSON.stringify(r.v).padEnd(28)} ${r.n}`);

console.log('\nMigration 016 complete. URLA hierarchy established.');
