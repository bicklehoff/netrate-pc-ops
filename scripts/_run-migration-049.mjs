/**
 * Migration 049 — drop rate_lenders.price_format
 *
 * Retires the price-format conversion branch in pricing-v2.js. All
 * active lenders normalize to 100-based on parser output; the column
 * is unused at runtime after the companion code change ships.
 *
 * ORDER OF OPERATIONS (important):
 *   1. Merge the PR → Vercel deploys code that no longer reads
 *      rl.price_format.
 *   2. After Vercel Ready, run this script against prod.
 *   3. Verify pricing output unchanged.
 *
 * Running this script BEFORE the code deploys will 500 the pricing
 * engine (db-loader still selects the column).
 *
 * Usage:
 *   node scripts/_run-migration-049.mjs              # pre-flight + apply + verify
 *   node scripts/_run-migration-049.mjs --verify     # post-apply verify only
 *   node scripts/_run-migration-049.mjs --dry-run    # parse + print
 */

import { neon } from '@neondatabase/serverless';
import fs from 'node:fs';
import path from 'node:path';
import 'dotenv/config';

const DATABASE_URL = process.env.PC_DATABASE_URL || process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('PC_DATABASE_URL or DATABASE_URL required'); process.exit(1); }
const sql = neon(DATABASE_URL);
const host = new URL(DATABASE_URL).host;

const VERIFY_ONLY = process.argv.includes('--verify');
const DRY_RUN = process.argv.includes('--dry-run');

console.log(`Migration 049 — drop rate_lenders.price_format`);
console.log(`Target: ${host}`);
console.log(`Mode: ${VERIFY_ONLY ? 'VERIFY ONLY' : DRY_RUN ? 'DRY RUN' : 'PRE-FLIGHT + APPLY + VERIFY'}`);

async function preFlight() {
  console.log(`\n━━━ Pre-flight checks ━━━`);

  const colExists = (await sql`
    SELECT 1 AS exists FROM information_schema.columns
    WHERE table_schema='public' AND table_name='rate_lenders' AND column_name='price_format'
  `).length === 1;
  console.log(`  rate_lenders.price_format column exists:  ${colExists ? 'yes' : 'no (already dropped)'}`);
  if (!colExists) return { alreadyDropped: true };

  // Informational — current values (should all be 100-based or excluded)
  const values = await sql`
    SELECT name, code, price_format, status FROM rate_lenders ORDER BY name
  `;
  console.log(`  Current values:`);
  for (const r of values) console.log(`    ${r.name.padEnd(30)} fmt=${r.price_format}  status=${r.status}`);

  return { alreadyDropped: false };
}

async function apply() {
  const file = path.join(process.cwd(), 'migrations', '049_drop_rate_lenders_price_format.sql');
  const src = fs.readFileSync(file, 'utf8');
  // Strip SQL line comments, then treat the remainder as one statement
  // (a single ALTER TABLE ... DROP COLUMN). No need for a splitter.
  const body = src
    .split('\n')
    .map(l => l.replace(/--.*$/, '').trimEnd())
    .filter(l => l.length > 0)
    .join('\n')
    .trim();
  if (!body) { console.log('Empty migration body.'); return; }

  console.log(`\nStatement to apply:\n  ${body.replace(/\n/g, ' ').slice(0, 120)}`);

  if (DRY_RUN) return;

  process.stdout.write(`\nApplying... `);
  try {
    await sql.query(body);
    console.log('OK');
  } catch (err) {
    console.log('FAIL');
    console.error(`\n  ERROR: ${err.message}`);
    throw err;
  }
}

async function verify() {
  console.log(`\n━━━ Post-flight verification ━━━`);

  const colGone = (await sql`
    SELECT 1 AS exists FROM information_schema.columns
    WHERE table_schema='public' AND table_name='rate_lenders' AND column_name='price_format'
  `).length === 0;
  console.log(`  rate_lenders.price_format dropped:  ${colGone ? '✓' : '✗ STILL EXISTS'}`);

  const lenderCount = (await sql`SELECT COUNT(*)::int AS n FROM rate_lenders WHERE status='active'`)[0].n;
  console.log(`  Active lenders (sanity):            ${lenderCount}`);

  console.log(`\n${colGone ? '✓ Migration 049 complete.' : '✗ Migration verification FAILED.'}`);
  process.exit(colGone ? 0 : 1);
}

async function main() {
  try {
    if (VERIFY_ONLY) { await verify(); return; }
    const pre = await preFlight();
    if (pre.alreadyDropped) { console.log('\nColumn already dropped — skipping apply, running verify only.'); await verify(); return; }
    await apply();
    if (!DRY_RUN) await verify();
  } catch (err) {
    console.error('\n✗ Migration 049 failed:', err.message);
    process.exit(1);
  }
}

main();
