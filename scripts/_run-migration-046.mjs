/**
 * Migration 046 — prep for loan_borrowers retirement (PR 3a)
 *
 * Four steps, all idempotent:
 *   1. Normalize loan_borrowers.borrower_type 'coborrower' → 'co_borrower'
 *   2. Backfill loan_participants for orphan loan
 *   3. Add 11 MISMO columns to loan_declarations
 *   4. Create loan_demographics satellite
 *
 * Usage:
 *   node scripts/_run-migration-046.mjs              # apply + verify
 *   node scripts/_run-migration-046.mjs --verify     # verify only
 *   node scripts/_run-migration-046.mjs --dry-run    # parse + print
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

console.log(`Migration 046 — loan_borrowers retirement prep (PR 3a)`);
console.log(`Target: ${host}`);
console.log(`Mode: ${VERIFY_ONLY ? 'VERIFY ONLY' : DRY_RUN ? 'DRY RUN' : 'APPLY + VERIFY'}`);

// Statement splitter — handles CHECK constraints w/ parens, string literals,
// multi-statement ALTER TABLE with commas. Same logic as prior runners.
function splitStatements(src) {
  const noLineComments = src
    .split('\n')
    .map(l => {
      let out = '';
      let inStr = false;
      for (let i = 0; i < l.length; i++) {
        const ch = l[i];
        if (inStr) { out += ch; if (ch === "'") inStr = false; continue; }
        if (ch === "'") { out += ch; inStr = true; continue; }
        if (ch === '-' && l[i + 1] === '-') break;
        out += ch;
      }
      return out.trimEnd();
    })
    .join('\n');

  const statements = [];
  let buf = '';
  let depth = 0;
  let inStr = false;
  let inDollar = null;

  for (let i = 0; i < noLineComments.length; i++) {
    const ch = noLineComments[i];
    if (!inStr) {
      if (inDollar !== null) {
        const close = `$${inDollar}$`;
        if (noLineComments.substr(i, close.length) === close) {
          buf += close; i += close.length - 1; inDollar = null; continue;
        }
      } else if (ch === '$') {
        const m = noLineComments.substr(i).match(/^\$([A-Za-z_][A-Za-z0-9_]*|)\$/);
        if (m) { inDollar = m[1]; buf += m[0]; i += m[0].length - 1; continue; }
      }
    }
    if (inDollar !== null) { buf += ch; continue; }
    if (inStr) {
      buf += ch;
      if (ch === "'" && noLineComments[i + 1] !== "'") inStr = false;
      continue;
    }
    if (ch === "'") { buf += ch; inStr = true; continue; }
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ';' && depth === 0) {
      const s = buf.trim(); if (s) statements.push(s); buf = '';
    } else { buf += ch; }
  }
  const tail = buf.trim(); if (tail) statements.push(tail);
  return statements.filter(s => !/^\s*(BEGIN|COMMIT|ROLLBACK)\s*$/i.test(s));
}

async function preFlight() {
  console.log(`\n━━━ Pre-flight ━━━`);
  const [btCount, orphanCount, declCols, demoExists] = await Promise.all([
    sql`SELECT COUNT(*)::int AS n FROM loan_borrowers WHERE borrower_type='coborrower'`,
    sql`
      SELECT COUNT(*)::int AS n FROM loan_borrowers lb
      WHERE NOT EXISTS (
        SELECT 1 FROM loan_participants lp
        WHERE lp.loan_id = lb.loan_id AND lp.contact_id = lb.contact_id
      )
    `,
    sql`
      SELECT COUNT(*)::int AS n FROM information_schema.columns
      WHERE table_name='loan_declarations' AND column_name = ANY(${[
        'applying_for_new_credit','applying_for_other_mortgage','authorize_credit_pull',
        'authorize_verification','deed_in_lieu','family_relationship_seller',
        'pre_foreclosure_sale','prior_property_title_held','priority_lien',
        'undisclosed_borrowing','undisclosed_borrowing_amount'
      ]})
    `,
    sql`SELECT COUNT(*)::int AS n FROM information_schema.tables WHERE table_name='loan_demographics'`,
  ]);
  console.log(`  'coborrower' rows to normalize:     ${btCount[0].n}  (prod expects 1 pre-run, 0 post-run)`);
  console.log(`  orphan loan_borrowers (no participants): ${orphanCount[0].n}  (prod expects 2 pre-run, 0 post-run)`);
  console.log(`  loan_declarations new cols present: ${declCols[0].n}/11  (0 pre-run, 11 post-run)`);
  console.log(`  loan_demographics table exists:     ${demoExists[0].n === 1 ? 'yes' : 'no'}  (no pre-run, yes post-run)`);
}

async function apply() {
  const file = path.join(process.cwd(), 'migrations', '046_loan_borrowers_retirement_prep.sql');
  const src = fs.readFileSync(file, 'utf8');
  const statements = splitStatements(src);
  console.log(`\nStatements to apply: ${statements.length}`);

  if (DRY_RUN) {
    statements.forEach((s, i) => {
      const preview = s.split('\n').find(l => l.trim())?.slice(0, 100) || '';
      console.log(`  [${i + 1}] ${preview}...`);
    });
    return;
  }

  for (let i = 0; i < statements.length; i++) {
    const preview = statements[i].split('\n').find(l => l.trim())?.slice(0, 80) || '(empty)';
    process.stdout.write(`  [${i + 1}/${statements.length}] ${preview}... `);
    try {
      await sql.query(statements[i]);
      console.log('OK');
    } catch (err) {
      console.log('FAIL');
      console.error(`\n  ERROR: ${err.message}`);
      throw err;
    }
  }
}

async function verify() {
  console.log(`\n━━━ Post-flight verification ━━━`);

  // 1. Normalization
  const bt = await sql`
    SELECT borrower_type, COUNT(*)::int AS n FROM loan_borrowers GROUP BY borrower_type ORDER BY borrower_type
  `;
  console.log(`  borrower_type values: ${JSON.stringify(bt)}`);
  const cob = bt.find(r => r.borrower_type === 'coborrower');
  console.log(`  'coborrower' remaining: ${cob ? cob.n : 0} ${cob ? '✗' : '✓'}`);

  // 2. Orphan backfill
  const orphan = await sql`
    SELECT COUNT(*)::int AS n FROM loan_borrowers lb
    WHERE NOT EXISTS (
      SELECT 1 FROM loan_participants lp
      WHERE lp.loan_id = lb.loan_id AND lp.contact_id = lb.contact_id
    )
  `;
  console.log(`  loan_borrowers without matching loan_participants: ${orphan[0].n} ${orphan[0].n === 0 ? '✓' : '✗'}`);
  const newParts = await sql`
    SELECT COUNT(*)::int AS n FROM loan_participants
    WHERE loan_id = '5088c8b2-09ad-4d6c-97bb-371b12cc1fb6'
  `;
  console.log(`  participants for orphan loan 5088c8b2: ${newParts[0].n} ${newParts[0].n === 2 ? '✓ (primary + co-borrower)' : '✗ expected 2'}`);

  // 3. loan_declarations new columns
  const newCols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name='loan_declarations'
      AND column_name = ANY(${[
        'applying_for_new_credit','applying_for_other_mortgage','authorize_credit_pull',
        'authorize_verification','deed_in_lieu','family_relationship_seller',
        'pre_foreclosure_sale','prior_property_title_held','priority_lien',
        'undisclosed_borrowing','undisclosed_borrowing_amount'
      ]})
  `;
  console.log(`  loan_declarations new columns: ${newCols.length}/11 ${newCols.length === 11 ? '✓' : '✗'}`);

  // 4. loan_demographics table
  const demoCols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name='loan_demographics' ORDER BY ordinal_position
  `;
  const expectedDemoCols = [
    'id','loan_id','contact_id','ethnicity','race','sex',
    'refused_to_provide','collected_via','created_at','updated_at'
  ];
  const gotDemo = demoCols.map(c => c.column_name);
  const demoOk = expectedDemoCols.every(c => gotDemo.includes(c));
  console.log(`  loan_demographics table: ${demoCols.length} cols ${demoOk ? '✓' : '✗ expected ' + expectedDemoCols.join(',')}`);
  const demoIdx = await sql`
    SELECT indexname FROM pg_indexes WHERE tablename='loan_demographics'
  `;
  console.log(`  loan_demographics indexes: ${demoIdx.length} ${demoIdx.length >= 3 ? '✓ (PK + 2 idx)' : '✗'}`);

  // Invariant: loan_borrowers row count unchanged
  const lbCount = await sql`SELECT COUNT(*)::int AS n FROM loan_borrowers`;
  console.log(`  loan_borrowers row count: ${lbCount[0].n} (expected 28 — untouched by this migration) ${lbCount[0].n === 28 ? '✓' : '✗'}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────
try {
  if (!VERIFY_ONLY && !DRY_RUN) await preFlight();
  if (!VERIFY_ONLY) await apply();
  if (!DRY_RUN) await verify();
  console.log('\n✓ Migration 046 complete');
} catch (err) {
  console.error('\n✗ Migration 046 failed — inspect output above');
  process.exit(1);
}
