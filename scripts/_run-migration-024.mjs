/**
 * Migration 024: D9d · ref_state_closing_costs + 4-state seed
 * (CO, TX, OR, CA).
 *
 * Fully idempotent via CREATE IF NOT EXISTS + ON CONFLICT DO NOTHING.
 * Mirrors src/lib/rates/closing-costs.js; drift is caught by
 * scripts/check-state-closing-costs-parity.mjs.
 *
 * Run against prod:      node scripts/_run-migration-024.mjs
 * Rehearse on branch:    PC_DATABASE_URL=<branch-url> node scripts/_run-migration-024.mjs
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
console.log(`Migration 024 (D9d · ref_state_closing_costs)`);
console.log(`Target: ${host}`);

const migrationSql = fs.readFileSync(
  path.join(process.cwd(), 'prisma', 'migrations', '024_ref_state_closing_costs.sql'),
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

const rows = await sql`
  SELECT state, third_party_cost, effective_from, source
    FROM ref_state_closing_costs
   ORDER BY state
`;
console.log(`\n--- Verification: ${rows.length} row(s) in ref_state_closing_costs ---`);
for (const r of rows) {
  const ef = r.effective_from instanceof Date ? r.effective_from.toISOString().slice(0, 10) : r.effective_from;
  console.log(`  ${r.state}  $${r.third_party_cost}  eff=${ef}  src="${r.source}"`);
}

if (rows.length !== 4) {
  console.error(`\nExpected 4 seed rows, got ${rows.length}`);
  process.exit(1);
}

console.log('\nMigration 024 complete.');
