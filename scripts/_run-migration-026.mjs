/**
 * Migration 026: D9d · ref_hecm_plf (HECM Principal Limit Factor grid).
 *
 * Two phases:
 *   1. Apply DDL from 026_ref_hecm_plf.sql (CREATE TABLE IF NOT EXISTS).
 *   2. Seed the 4,864-cell PLF grid from src/lib/hecm/plf-table.js,
 *      regex-parsed (the source file uses ESM `export` which plain
 *      Node can't require, and the project has no TS/esbuild runner).
 *      Batch-inserts in chunks of 500 rows via multi-row VALUES.
 *      Fully idempotent: INSERT ... ON CONFLICT DO NOTHING.
 *
 * Flags:
 *   --dry-run   parse + validate only, no SQL writes
 *
 * Run against prod:      node scripts/_run-migration-026.mjs
 * Rehearse on branch:    PC_DATABASE_URL=<branch-url> node scripts/_run-migration-026.mjs
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
const host = new URL(DATABASE_URL).host;
console.log(`Migration 026 (D9d · ref_hecm_plf)${dryRun ? ' [DRY RUN]' : ''}`);
console.log(`Target: ${host}`);

const EFFECTIVE_FROM = '2017-10-02';
const SOURCE = 'HUD ML 2017-12';

// ─── Phase 1: parse PLF_TABLE from src/lib/hecm/plf-table.js ─────────

const plfSrc = fs.readFileSync(
  path.join(process.cwd(), 'src', 'lib', 'hecm', 'plf-table.js'),
  'utf8'
);

const rows = [];
const lineRe = /"(\d+\.\d+)"\s*:\s*\{([^}]+)\}/g;
const pairRe = /(\d+)\s*:\s*([\d.]+)/g;

let lineMatch;
while ((lineMatch = lineRe.exec(plfSrc)) !== null) {
  const rateStr = lineMatch[1];
  const ratePct = Number(rateStr);
  const rateBps = Math.round(ratePct * 100); // 3.000 -> 300, 18.875 -> 1888
  const pairs = lineMatch[2];
  let pairMatch;
  while ((pairMatch = pairRe.exec(pairs)) !== null) {
    const age = Number(pairMatch[1]);
    const factor = Number(pairMatch[2]);
    if (!Number.isFinite(factor) || factor < 0 || factor > 1) {
      console.error(`Invalid factor: rate=${rateStr} age=${age} factor=${factor}`);
      process.exit(1);
    }
    rows.push({ rateBps, age, factor });
  }
}

console.log(`\nParsed ${rows.length} PLF cells from plf-table.js`);

// Validate shape
const expectedRows = 128 * 38;
if (rows.length !== expectedRows) {
  console.error(`Expected ${expectedRows} rows (128 rates × 38 ages), got ${rows.length}`);
  process.exit(1);
}

// Distribution sanity
const rateSet = new Set(rows.map((r) => r.rateBps));
const ageSet = new Set(rows.map((r) => r.age));
console.log(`  distinct rates: ${rateSet.size}`);
console.log(`  distinct ages:  ${ageSet.size}`);
console.log(`  rate range:     ${Math.min(...rateSet)}–${Math.max(...rateSet)} bps`);
console.log(`  age range:      ${Math.min(...ageSet)}–${Math.max(...ageSet)}`);

if (dryRun) {
  console.log('\n(DRY RUN — no SQL writes. Re-run without --dry-run to apply.)');
  process.exit(0);
}

// ─── Phase 2: DDL ────────────────────────────────────────────────────

const migrationSql = fs.readFileSync(
  path.join(process.cwd(), 'prisma', 'migrations', '026_ref_hecm_plf.sql'),
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

console.log(`\n--- Phase 1 DDL: ${statements.length} statements ---`);
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

// ─── Phase 3: batch seed ─────────────────────────────────────────────

const BATCH = 500;
let inserted = 0;
console.log(`\n--- Phase 2 seed: ${rows.length} rows in batches of ${BATCH} ---`);
for (let i = 0; i < rows.length; i += BATCH) {
  const chunk = rows.slice(i, i + BATCH);
  const params = [];
  const placeholders = [];
  chunk.forEach((r, idx) => {
    const base = idx * 5;
    placeholders.push(`($${base + 1}::date, $${base + 2}::int, $${base + 3}::int, $${base + 4}::numeric, $${base + 5}::text)`);
    params.push(EFFECTIVE_FROM, r.rateBps, r.age, r.factor, SOURCE);
  });
  const q = `
    INSERT INTO ref_hecm_plf (effective_from, expected_rate_bps, age, plf_factor, source)
    VALUES ${placeholders.join(', ')}
    ON CONFLICT (effective_from, expected_rate_bps, age) DO NOTHING
  `;
  try {
    const result = await sql.query(q, params);
    const rowCount = result.rowCount ?? chunk.length;
    inserted += rowCount;
    process.stdout.write(`  batch ${Math.floor(i / BATCH) + 1}: ${rowCount} rows inserted (of ${chunk.length} submitted)\r`);
  } catch (err) {
    console.log(`\nBatch ${Math.floor(i / BATCH) + 1} FAILED: ${err.message}`);
    process.exit(1);
  }
}

console.log('');

// ─── Verification ────────────────────────────────────────────────────

const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM ref_hecm_plf WHERE effective_from = ${EFFECTIVE_FROM}`;
console.log(`\n--- Verification: ${count} rows in ref_hecm_plf (effective ${EFFECTIVE_FROM}) ---`);
if (count !== expectedRows) {
  console.error(`Expected ${expectedRows}, got ${count}`);
  process.exit(1);
}

// Sample: spot-check known values
const spot = await sql`
  SELECT expected_rate_bps, age, plf_factor
    FROM ref_hecm_plf
   WHERE effective_from = ${EFFECTIVE_FROM}
     AND expected_rate_bps = 650
     AND age = 74
   LIMIT 1
`;
if (spot.length) {
  console.log(`  spot-check (6.500% / age 74): plf=${Number(spot[0].plf_factor).toFixed(4)}`);
}

console.log('\nMigration 026 complete.');
