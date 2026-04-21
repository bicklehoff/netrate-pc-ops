/**
 * Migration 019: NonQM vocab canonicalization.
 *
 * Run against prod: node scripts/_run-migration-019.mjs
 * Rehearse on branch: DATABASE_URL=<branch-url> node scripts/_run-migration-019.mjs
 * Dry-run: node scripts/_run-migration-019.mjs --dry-run
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
  '019_nonqm_vocab_canonicalize.sql'
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

const host = new URL(DATABASE_URL).host;
console.log(
  `Migration 019 (NonQM vocab canonicalize) — ${statements.length} statements${dryRun ? ' (DRY RUN)' : ''}`
);
console.log(`Target: ${host}`);

async function inventory(label) {
  const nonqmOcc = await sql`
    SELECT occupancy, COUNT(*)::int AS n
      FROM nonqm_adjustment_rules
     GROUP BY occupancy
     ORDER BY occupancy NULLS LAST
  `;
  const nonqmLp = await sql`
    SELECT loan_purpose, COUNT(*)::int AS n
      FROM nonqm_adjustment_rules
     GROUP BY loan_purpose
     ORDER BY loan_purpose NULLS LAST
  `;
  const scLp = await sql`
    SELECT loan_purpose, COUNT(*)::int AS n
      FROM scenarios
     GROUP BY loan_purpose
     ORDER BY loan_purpose NULLS LAST
  `;
  console.log(`\n--- ${label} ---`);
  console.log('  nonqm_adjustment_rules.occupancy:');
  for (const r of nonqmOcc) console.log(`    ${String(r.occupancy ?? '(null)').padEnd(12)} ${r.n}`);
  console.log('  nonqm_adjustment_rules.loan_purpose:');
  for (const r of nonqmLp) console.log(`    ${String(r.loan_purpose ?? '(null)').padEnd(12)} ${r.n}`);
  console.log('  scenarios.loan_purpose:');
  for (const r of scLp) console.log(`    ${String(r.loan_purpose ?? '(null)').padEnd(12)} ${r.n}`);
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

console.log('\nMigration 019 complete. NonQM rules now use canonical vocab; scenarios.loan_purpose flat.');
