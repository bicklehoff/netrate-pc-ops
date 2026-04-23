/**
 * Migration 047 — loan_borrowers data transform (PR 3b)
 *
 * Applies the DDL gaps + 8 data-transform steps defined in
 * migrations/047_loan_borrowers_data_transform.sql.
 *
 * Rehearsal: MANDATORY on Neon branch per DEV-PLAYBOOK §3 before
 * running against prod.
 *
 * Usage:
 *   node scripts/_run-migration-047.mjs              # apply + verify
 *   node scripts/_run-migration-047.mjs --verify     # verify only
 *   node scripts/_run-migration-047.mjs --dry-run    # parse + print
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

console.log(`Migration 047 — loan_borrowers data transform (PR 3b)`);
console.log(`Target: ${host}`);
console.log(`Mode: ${VERIFY_ONLY ? 'VERIFY ONLY' : DRY_RUN ? 'DRY RUN' : 'APPLY + VERIFY'}`);

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

// Snapshot of source-of-truth counts from loan_borrowers
async function preFlight() {
  console.log(`\n━━━ Pre-flight (expected data to migrate) ━━━`);
  const r = (await sql`
    SELECT
      COUNT(*)::int                                        AS lb_total,
      COUNT(marital_status)::int                           AS lb_marital,
      COUNT(current_address)::int                          AS lb_addr,
      COUNT(previous_address)::int                         AS lb_prev_addr,
      COUNT(employer_name)::int                            AS lb_employer,
      COUNT(CASE WHEN monthly_base_income IS NOT NULL
                 OR other_monthly_income IS NOT NULL THEN 1 END)::int AS lb_income,
      COUNT(declarations)::int                             AS lb_decl,
      COUNT(CASE WHEN declarations ? 'hmdaEthnicity' OR declarations ? 'hmdaRace' OR declarations ? 'hmdaSex' THEN 1 END)::int AS lb_hmda,
      COUNT(CASE WHEN declarations ? 'citizenshipStatus'
                 AND declarations->>'citizenshipStatus' IS NOT NULL THEN 1 END)::int AS lb_citizenship
    FROM loan_borrowers
  `)[0];
  console.log(`  loan_borrowers total:             ${r.lb_total}`);
  console.log(`  marital_status populated:         ${r.lb_marital}  → loan_participants UPDATE targets`);
  console.log(`  current_address populated:        ${r.lb_addr}  → loan_housing_history INSERTs`);
  console.log(`  previous_address populated:       ${r.lb_prev_addr}  → loan_housing_history INSERTs`);
  console.log(`  employer_name populated:          ${r.lb_employer}  → loan_employments INSERTs`);
  console.log(`  income (base or other) populated: ${r.lb_income}  → loan_incomes INSERTs`);
  console.log(`  declarations populated:           ${r.lb_decl}  → loan_declarations INSERTs`);
  console.log(`  HMDA keys in declarations:        ${r.lb_hmda}  → loan_demographics INSERTs`);
  console.log(`  citizenshipStatus in declarations:${r.lb_citizenship}  → contacts.us_citizenship_indicator UPDATEs (bounded by where current value IS NULL)`);
  return r;
}

async function apply() {
  const file = path.join(process.cwd(), 'migrations', '047_loan_borrowers_data_transform.sql');
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

async function verify(expected) {
  console.log(`\n━━━ Post-flight verification ━━━`);

  // Part A: DDL completed
  const incomesColsLoanId = await sql`
    SELECT is_nullable FROM information_schema.columns
    WHERE table_schema='public' AND table_name='loan_incomes' AND column_name='loan_id'
  `;
  console.log(`  A1 loan_incomes.loan_id:          ${incomesColsLoanId[0]?.is_nullable === 'NO' ? '✓ NOT NULL' : '✗'}`);
  const participantsMarital = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='loan_participants' AND column_name='marital_status'
  `;
  console.log(`  A2 loan_participants.marital_status exists: ${participantsMarital.length === 1 ? '✓' : '✗'}`);
  const nullableChecks = await sql`
    SELECT table_name, is_nullable FROM information_schema.columns
    WHERE table_schema='public' AND column_name='loan_borrower_id'
      AND table_name IN ('loan_employments','loan_declarations','loan_incomes')
    ORDER BY table_name
  `;
  console.log(`  A3 loan_borrower_id nullability:  ${JSON.stringify(nullableChecks)}`);

  // Part B: row-count invariants
  const counts = (await sql`
    SELECT
      (SELECT COUNT(*)::int FROM loan_participants WHERE marital_status IS NOT NULL) AS participants_marital,
      (SELECT COUNT(*)::int FROM loan_housing_history WHERE housing_type='current')  AS hh_current,
      (SELECT COUNT(*)::int FROM loan_housing_history WHERE housing_type='previous') AS hh_previous,
      (SELECT COUNT(*)::int FROM loan_employments)                                   AS employments,
      (SELECT COUNT(*)::int FROM loan_incomes)                                       AS incomes,
      (SELECT COUNT(*)::int FROM loan_declarations)                                  AS declarations,
      (SELECT COUNT(*)::int FROM loan_demographics)                                  AS demographics,
      (SELECT COUNT(*)::int FROM loan_borrowers)                                     AS loan_borrowers_still
  `)[0];

  const check = (label, got, expected, note='') => {
    const ok = got === expected;
    console.log(`  ${label}: ${got}/${expected} ${ok ? '✓' : '✗ MISMATCH'} ${note}`);
    return ok;
  };

  let allOk = true;
  allOk &= check('B1 participants with marital_status  ', counts.participants_marital, expected.lb_marital);
  allOk &= check('B2 housing_history current addresses ', counts.hh_current, expected.lb_addr);
  allOk &= check('B3 housing_history previous addresses', counts.hh_previous, expected.lb_prev_addr);
  allOk &= check('B4 loan_employments rows             ', counts.employments, expected.lb_employer);
  allOk &= check('B5 loan_incomes rows                 ', counts.incomes, expected.lb_income);
  allOk &= check('B6 loan_declarations rows            ', counts.declarations, expected.lb_decl);
  allOk &= check('B7 loan_demographics rows            ', counts.demographics, expected.lb_hmda);
  allOk &= check('    loan_borrowers untouched          ', counts.loan_borrowers_still, expected.lb_total, '(backup preserved)');

  // Spot-check: for a random populated loan_borrower, verify every
  // non-null source field has a satellite row.
  const spot = (await sql`
    SELECT id, loan_id, contact_id,
           marital_status IS NOT NULL AS has_marital,
           current_address IS NOT NULL AS has_addr,
           employer_name IS NOT NULL AS has_emp,
           monthly_base_income IS NOT NULL AS has_income,
           declarations IS NOT NULL AS has_decl
    FROM loan_borrowers
    WHERE declarations IS NOT NULL
       OR current_address IS NOT NULL
       OR employer_name IS NOT NULL
    ORDER BY random() LIMIT 3
  `);
  console.log(`\n  Spot-check (3 random populated loan_borrower rows):`);
  for (const lb of spot) {
    const sats = (await sql`
      SELECT
        (SELECT COUNT(*)::int FROM loan_housing_history WHERE loan_id=${lb.loan_id} AND contact_id=${lb.contact_id} AND housing_type='current') AS hh,
        (SELECT COUNT(*)::int FROM loan_employments WHERE loan_id=${lb.loan_id} AND contact_id=${lb.contact_id}) AS emp,
        (SELECT COUNT(*)::int FROM loan_incomes WHERE loan_id=${lb.loan_id} AND contact_id=${lb.contact_id}) AS inc,
        (SELECT COUNT(*)::int FROM loan_declarations WHERE loan_id=${lb.loan_id} AND contact_id=${lb.contact_id}) AS decl,
        (SELECT marital_status FROM loan_participants WHERE loan_id=${lb.loan_id} AND contact_id=${lb.contact_id}) AS part_marital
    `)[0];
    const expectHH = lb.has_addr ? 1 : 0;
    const expectEmp = lb.has_emp ? 1 : 0;
    const expectInc = lb.has_income ? 1 : 0;
    const expectDecl = lb.has_decl ? 1 : 0;
    const ok = sats.hh === expectHH && sats.emp === expectEmp && sats.inc === expectInc && sats.decl === expectDecl && (!lb.has_marital || sats.part_marital != null);
    console.log(`    loan_borrowers.${lb.id.slice(0,8)}: HH=${sats.hh}/${expectHH} EMP=${sats.emp}/${expectEmp} INC=${sats.inc}/${expectInc} DECL=${sats.decl}/${expectDecl} marital=${sats.part_marital ?? 'NULL'} ${ok ? '✓' : '✗'}`);
    if (!ok) allOk = false;
  }

  if (!allOk) {
    console.error('\n✗ Verification FAILED — data transform did not preserve all populated fields');
    throw new Error('verification failed');
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────
try {
  const expected = await preFlight();
  if (!VERIFY_ONLY) await apply();
  if (!DRY_RUN) await verify(expected);
  console.log('\n✓ Migration 047 complete');
} catch (err) {
  console.error('\n✗ Migration 047 failed — inspect output above');
  process.exit(1);
}
