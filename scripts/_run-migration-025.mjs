/**
 * Migration 025: D9d · HECM scalar reference tables.
 *
 * Creates three tables (ref_hecm_limits, ref_hecm_ufmip,
 * ref_hecm_annual_mip) with single-row seeds mirroring
 * src/lib/hecm/constants.js. Fully idempotent.
 *
 * Run against prod:      node scripts/_run-migration-025.mjs
 * Rehearse on branch:    PC_DATABASE_URL=<branch-url> node scripts/_run-migration-025.mjs
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
console.log(`Migration 025 (D9d · HECM scalars)`);
console.log(`Target: ${host}`);

const migrationSql = fs.readFileSync(
  path.join(process.cwd(), 'prisma', 'migrations', '025_ref_hecm_scalars.sql'),
  'utf8'
);

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

const limits = await sql`SELECT effective_from, max_claim_amount, source FROM ref_hecm_limits ORDER BY effective_from`;
const ufmip = await sql`SELECT effective_from, rate, source FROM ref_hecm_ufmip ORDER BY effective_from`;
const annual = await sql`SELECT effective_from, rate, source FROM ref_hecm_annual_mip ORDER BY effective_from`;

console.log('\n--- Verification ---');
console.log(`ref_hecm_limits (${limits.length} row):`);
for (const r of limits) {
  const ef = r.effective_from instanceof Date ? r.effective_from.toISOString().slice(0, 10) : r.effective_from;
  console.log(`  MCA=$${r.max_claim_amount}  eff=${ef}  src="${r.source}"`);
}
console.log(`ref_hecm_ufmip (${ufmip.length} row):`);
for (const r of ufmip) {
  const ef = r.effective_from instanceof Date ? r.effective_from.toISOString().slice(0, 10) : r.effective_from;
  console.log(`  rate=${Number(r.rate).toFixed(4)}  eff=${ef}  src="${r.source}"`);
}
console.log(`ref_hecm_annual_mip (${annual.length} row):`);
for (const r of annual) {
  const ef = r.effective_from instanceof Date ? r.effective_from.toISOString().slice(0, 10) : r.effective_from;
  console.log(`  rate=${Number(r.rate).toFixed(4)}  eff=${ef}  src="${r.source}"`);
}

if (limits.length < 1 || ufmip.length < 1 || annual.length < 1) {
  console.error('\nExpected ≥1 row in each HECM scalar table');
  process.exit(1);
}

console.log('\nMigration 025 complete.');
