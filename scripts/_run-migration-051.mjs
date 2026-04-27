/**
 * Migration 051 — rename rule_type 'prepay' → 'prepay_joint'
 *
 * Distinguishes Everstream's joint (term × structure) prepay model from
 * ResiCentral's additive (prepay_term + prepay_structure) model.
 * See migrations/051_prepay_joint_rename.sql for full rationale.
 *
 * Pre-flight expectation:
 *   - Some nonqm_adjustment_rules rows have rule_type = 'prepay' (Everstream)
 *   - No rows have rule_type = 'prepay_joint'
 *
 * Post-run expectation:
 *   - Zero rows with rule_type = 'prepay'
 *   - Same count now have rule_type = 'prepay_joint'
 *
 * Usage:
 *   node scripts/_run-migration-051.mjs              # pre-flight + apply + verify
 *   node scripts/_run-migration-051.mjs --verify     # post-apply verify only
 *   node scripts/_run-migration-051.mjs --dry-run    # show SQL, no apply
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
const DRY_RUN    = process.argv.includes('--dry-run');

console.log(`Migration 051 — prepay → prepay_joint rename`);
console.log(`Target: ${host}`);
console.log(`Mode: ${VERIFY_ONLY ? 'VERIFY ONLY' : DRY_RUN ? 'DRY RUN' : 'PRE-FLIGHT + APPLY + VERIFY'}`);

async function preFlight() {
  console.log(`\n━━━ Pre-flight ━━━`);

  const prepayRows = (await sql`
    SELECT COUNT(*)::int AS n FROM nonqm_adjustment_rules WHERE rule_type = 'prepay'
  `)[0].n;
  console.log(`  rule_type = 'prepay' rows (to rename):     ${prepayRows}`);

  const prepayJointRows = (await sql`
    SELECT COUNT(*)::int AS n FROM nonqm_adjustment_rules WHERE rule_type = 'prepay_joint'
  `)[0].n;
  console.log(`  rule_type = 'prepay_joint' rows (existing): ${prepayJointRows}`);

  const lenderBreakdown = await sql`
    SELECT lender_code, COUNT(*)::int AS n
      FROM nonqm_adjustment_rules
     WHERE rule_type = 'prepay'
     GROUP BY lender_code
     ORDER BY lender_code
  `;
  if (lenderBreakdown.length) {
    console.log(`  'prepay' breakdown by lender:`);
    for (const r of lenderBreakdown) console.log(`    ${r.lender_code}: ${r.n} rows`);
  }

  if (prepayRows === 0 && prepayJointRows > 0) {
    console.log(`\n  ✓ Already migrated — nothing to do.`);
  } else if (prepayRows === 0) {
    console.log(`\n  ⚠ No 'prepay' rows found and no 'prepay_joint' rows. Unexpected state.`);
  }

  return { prepayRows, prepayJointRows };
}

async function apply({ prepayRows }) {
  if (prepayRows === 0) {
    console.log(`\nNothing to apply (0 'prepay' rows).`);
    return;
  }

  const file = path.join(process.cwd(), 'migrations', '051_prepay_joint_rename.sql');
  const src = fs.readFileSync(file, 'utf8');
  // Strip comments, find the UPDATE statement.
  const updateStmt = src
    .split('\n')
    .filter(l => !l.trimStart().startsWith('--') && l.trim())
    .join('\n')
    .trim();

  console.log(`\nSQL to apply:\n  ${updateStmt.split('\n').join('\n  ')}`);

  if (DRY_RUN) {
    console.log(`\n[DRY RUN] — not applied.`);
    return;
  }

  process.stdout.write(`\nApplying... `);
  try {
    await sql.query(updateStmt);
    console.log('OK');
  } catch (err) {
    console.log('FAIL');
    console.error(`\n  ERROR: ${err.message}`);
    throw err;
  }
}

async function verify({ prepayRows: expected }) {
  console.log(`\n━━━ Post-flight verification ━━━`);

  const remaining = (await sql`
    SELECT COUNT(*)::int AS n FROM nonqm_adjustment_rules WHERE rule_type = 'prepay'
  `)[0].n;
  const renamed = (await sql`
    SELECT COUNT(*)::int AS n FROM nonqm_adjustment_rules WHERE rule_type = 'prepay_joint'
  `)[0].n;

  console.log(`  rule_type = 'prepay' remaining:    ${remaining} ${remaining === 0 ? '✓' : '✗ expected 0'}`);
  console.log(`  rule_type = 'prepay_joint' count:  ${renamed}   ${renamed === expected ? '✓' : `✗ expected ${expected}`}`);

  const lenderBreakdown = await sql`
    SELECT lender_code, COUNT(*)::int AS n
      FROM nonqm_adjustment_rules
     WHERE rule_type = 'prepay_joint'
     GROUP BY lender_code
     ORDER BY lender_code
  `;
  if (lenderBreakdown.length) {
    console.log(`  'prepay_joint' breakdown by lender:`);
    for (const r of lenderBreakdown) console.log(`    ${r.lender_code}: ${r.n} rows`);
  }

  const success = remaining === 0 && renamed === expected;
  console.log(`\n${success ? '✓ Migration 051 complete.' : '✗ Migration verification FAILED.'}`);
  if (!success) process.exit(1);
}

async function main() {
  try {
    if (VERIFY_ONLY) {
      // In verify-only mode we don't know the original count; use current prepay_joint count as expected.
      const n = (await sql`SELECT COUNT(*)::int AS n FROM nonqm_adjustment_rules WHERE rule_type = 'prepay_joint'`)[0].n;
      await verify({ prepayRows: n });
      return;
    }
    const state = await preFlight();
    await apply(state);
    if (!DRY_RUN) await verify(state);
  } catch (err) {
    console.error('\n✗ Migration 051 failed:', err.message);
    process.exit(1);
  }
}

main();
