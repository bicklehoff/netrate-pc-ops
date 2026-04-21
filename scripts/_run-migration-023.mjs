/**
 * Migration 023: D9d · ref_va_funding_fee table (schema only, no seed).
 *
 * Fully idempotent via CREATE IF NOT EXISTS. No seed — per D9d spec §8
 * Q2 the grid is populated when VA pricing becomes a real product.
 *
 * Run against prod:      node scripts/_run-migration-023.mjs
 * Rehearse on branch:    PC_DATABASE_URL=<branch-url> node scripts/_run-migration-023.mjs
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
console.log(`Migration 023 (D9d · ref_va_funding_fee — empty schema)`);
console.log(`Target: ${host}`);

const migrationPath = path.join(
  process.cwd(),
  'prisma',
  'migrations',
  '023_ref_va_funding_fee.sql'
);
const migrationSql = fs.readFileSync(migrationPath, 'utf8');

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

const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM ref_va_funding_fee`;
console.log(`\n--- Verification: ref_va_funding_fee row count = ${count} (expected 0 — seed deferred per spec §8 Q2) ---`);

console.log('\nMigration 023 complete.');
