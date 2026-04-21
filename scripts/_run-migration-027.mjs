/**
 * Migration 027: D9d · ref_state_tax_rates + ref_county_tax_rates.
 *
 * State table ships with 50-state + DC seed (source: Census Bureau /
 * Tax Foundation estimates via src/data/county-tax-rates.js).
 * County table ships empty — populated as county-assessor data lands.
 *
 * Fully idempotent.
 *
 * Run against prod:      node scripts/_run-migration-027.mjs
 * Rehearse on branch:    PC_DATABASE_URL=<branch-url> node scripts/_run-migration-027.mjs
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
console.log(`Migration 027 (D9d · ref_tax_rates)`);
console.log(`Target: ${host}`);

const migrationSql = fs.readFileSync(
  path.join(process.cwd(), 'prisma', 'migrations', '027_ref_tax_rates.sql'),
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

const states = await sql`SELECT state, rate FROM ref_state_tax_rates ORDER BY state`;
const [{ count: countyCount }] = await sql`SELECT COUNT(*)::int AS count FROM ref_county_tax_rates`;

console.log(`\n--- Verification ---`);
console.log(`ref_state_tax_rates: ${states.length} rows (expected 51 — 50 states + DC)`);
for (const s of ['CA', 'CO', 'OR', 'TX']) {
  const r = states.find((x) => x.state === s);
  if (r) console.log(`  ${s}: ${(Number(r.rate) * 100).toFixed(2)}%`);
}
console.log(`ref_county_tax_rates: ${countyCount} rows (expected 0 — empty until county-assessor data lands)`);

if (states.length !== 51) {
  console.error(`Expected 51 state rows, got ${states.length}`);
  process.exit(1);
}

console.log('\nMigration 027 complete.');
