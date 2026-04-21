/**
 * Migration 022: D9d · ref_fha_ufmip table + HUD ML 2015-01 seed.
 *
 * Schema-only migration with inline INSERT ... ON CONFLICT DO NOTHING.
 * Fully idempotent: re-running against a DB that already has the table
 * and the seed rows is a no-op.
 *
 * No consumer retirement here — src/lib/rates/pricing-v2.js and
 * src/lib/quotes/fee-builder.js keep reading FHA_UFMIP_RATE from
 * src/lib/constants/fha.js until the follow-up PR wires them to the
 * new src/lib/rates/ref-fha-ufmip.js DAL.
 *
 * Run against prod:      node scripts/_run-migration-022.mjs
 * Rehearse on branch:    PC_DATABASE_URL=<branch-url> node scripts/_run-migration-022.mjs
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

const sql = neon(DATABASE_URL);
const host = new URL(DATABASE_URL).host;
console.log(`Migration 022 (D9d · ref_fha_ufmip)`);
console.log(`Target: ${host}`);

const migrationPath = path.join(
  process.cwd(),
  'prisma',
  'migrations',
  '022_ref_fha_ufmip.sql'
);
const migrationSql = fs.readFileSync(migrationPath, 'utf8');

// Strip outer BEGIN/COMMIT + SQL-line comments, split on top-level semicolons.
const cleaned = migrationSql
  .replace(/^\s*BEGIN\s*;\s*$/m, '')
  .replace(/^\s*COMMIT\s*;\s*$/m, '');
const withoutComments = cleaned
  .split('\n')
  .map((l) => l.replace(/--.*$/, '').trimEnd())
  .filter((l) => l.length > 0)
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

console.log(`\n--- Applying ${statements.length} statements ---`);
for (let i = 0; i < statements.length; i++) {
  const preview = statements[i].split('\n').find((l) => l.trim())?.trim().slice(0, 80) || '(empty)';
  process.stdout.write(`  [${i + 1}/${statements.length}] ${preview}... `);
  try {
    await sql.query(statements[i]);
    console.log('OK');
  } catch (err) {
    console.log(`FAIL: ${err.message}`);
    process.exit(1);
  }
}

// ─── Verification ────────────────────────────────────────────────────

const rows = await sql`
  SELECT loan_purpose, case_type, rate, effective_from, source
    FROM ref_fha_ufmip
   ORDER BY loan_purpose, case_type
`;
console.log(`\n--- Verification: ${rows.length} row(s) in ref_fha_ufmip ---`);
for (const r of rows) {
  const ef = r.effective_from instanceof Date ? r.effective_from.toISOString().slice(0, 10) : r.effective_from;
  console.log(`  ${r.loan_purpose.padEnd(10)} ${r.case_type.padEnd(10)} rate=${Number(r.rate).toFixed(4)}  eff=${ef}  src="${r.source}"`);
}

if (rows.length !== 4) {
  console.error(`\nExpected 4 seed rows, got ${rows.length}`);
  process.exit(1);
}

console.log('\nMigration 022 complete.');
