/**
 * D9e Phase 1 PR 1 — additive schema bundle runner + verifier
 *
 * Applies 4 migrations in sequence against the database referenced by
 * PC_DATABASE_URL (or DATABASE_URL):
 *
 *   039_loan_housing_history.sql       — new satellite (per-person housing)
 *   040_loan_staff_assignments.sql     — new junction + backfill from loans.mlo_id
 *   041_contacts_mismo_columns.sql     — 8 new cols + 2 CHECK constraints
 *   044_soft_delete_columns.sql        — deleted_at + partial indexes on 4 tables
 *
 * Usage:
 *   node scripts/_run-d9e-phase1-pr1.mjs              # apply + verify
 *   node scripts/_run-d9e-phase1-pr1.mjs --verify     # verify only
 *   node scripts/_run-d9e-phase1-pr1.mjs --dry-run    # parse + print, no writes
 *
 * Rehearsal:
 *   Pure-additive, no data transform. Skip rehearsal per DEV-PLAYBOOK.
 *   040 includes an INSERT backfill but it's idempotent (UNIQUE +
 *   NOT EXISTS guards).
 *
 * Idempotence:
 *   Every statement is idempotent (IF NOT EXISTS / NOT EXISTS guards /
 *   DO-block constraint lookup). Safe to replay on any state.
 */

import { neon } from '@neondatabase/serverless';
import fs from 'node:fs';
import path from 'node:path';
import 'dotenv/config';

const DATABASE_URL = process.env.PC_DATABASE_URL || process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('PC_DATABASE_URL or DATABASE_URL must be set');
  process.exit(1);
}
const sql = neon(DATABASE_URL);
const host = new URL(DATABASE_URL).host;

const VERIFY_ONLY = process.argv.includes('--verify');
const DRY_RUN = process.argv.includes('--dry-run');

console.log(`D9e Phase 1 PR 1 — additive schema bundle`);
console.log(`Target: ${host}`);
console.log(`Mode: ${VERIFY_ONLY ? 'VERIFY ONLY' : DRY_RUN ? 'DRY RUN' : 'APPLY + VERIFY'}`);

const MIGRATIONS = [
  { num: '039', file: '039_loan_housing_history.sql',    desc: 'loan_housing_history satellite (new table)' },
  { num: '040', file: '040_loan_staff_assignments.sql',  desc: 'loan_staff_assignments junction + MLO backfill' },
  { num: '041', file: '041_contacts_mismo_columns.sql',  desc: 'contacts MISMO columns (8 new + 2 CHECK)' },
  { num: '044', file: '044_soft_delete_columns.sql',     desc: 'soft-delete columns + partial indexes' },
];

// Statement splitter — same logic as _run-db-foundation-bundle.mjs so
// DO $$ ... $$ blocks and embedded semicolons survive intact.
function splitStatements(src) {
  const noLineComments = src
    .split('\n')
    .map(l => {
      let out = '';
      let inStr = false;
      for (let i = 0; i < l.length; i++) {
        const ch = l[i];
        if (inStr) {
          out += ch;
          if (ch === "'") inStr = false;
          continue;
        }
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
          buf += close;
          i += close.length - 1;
          inDollar = null;
          continue;
        }
      } else if (ch === '$') {
        const m = noLineComments.substr(i).match(/^\$([A-Za-z_][A-Za-z0-9_]*|)\$/);
        if (m) {
          inDollar = m[1];
          buf += m[0];
          i += m[0].length - 1;
          continue;
        }
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
      const s = buf.trim();
      if (s) statements.push(s);
      buf = '';
    } else {
      buf += ch;
    }
  }
  const tail = buf.trim();
  if (tail) statements.push(tail);
  return statements.filter(s => !/^\s*(BEGIN|COMMIT|ROLLBACK)\s*$/i.test(s));
}

async function applyMigration(m) {
  const file = path.join(process.cwd(), 'migrations', m.file);
  const src = fs.readFileSync(file, 'utf8');
  const statements = splitStatements(src);

  console.log(`\n━━━ ${m.num}: ${m.desc} ━━━`);
  console.log(`  File: ${m.file}`);
  console.log(`  Statements: ${statements.length}`);

  if (DRY_RUN) {
    for (let i = 0; i < statements.length; i++) {
      const preview = statements[i].split('\n').find(l => l.trim())?.slice(0, 100) || '';
      console.log(`  [${i + 1}] ${preview}...`);
    }
    return;
  }

  for (let i = 0; i < statements.length; i++) {
    const preview = statements[i].split('\n').find(l => l.trim())?.slice(0, 80) || '(empty)';
    process.stdout.write(`  [${i + 1}/${statements.length}] ${preview}... `);
    try {
      await sql.query(statements[i]);
      console.log('OK');
    } catch (err) {
      console.log(`FAIL`);
      console.error(`\n  ERROR: ${err.message}`);
      throw err;
    }
  }
}

async function verify() {
  console.log(`\n━━━ Verification ━━━`);

  // 039: loan_housing_history table exists with expected shape
  const hhCols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'loan_housing_history'
    ORDER BY ordinal_position
  `;
  const hhExpected = [
    'id', 'loan_id', 'contact_id', 'housing_type', 'address',
    'residency_type', 'years', 'months', 'monthly_rent', 'ordinal',
    'created_at', 'updated_at'
  ];
  const hhNames = hhCols.map(c => c.column_name);
  const hhOk = hhExpected.every(c => hhNames.includes(c));
  console.log(`  039 loan_housing_history columns: ${hhOk ? '✓' : '✗'} (${hhCols.length} cols, expected ${hhExpected.length})`);
  if (!hhOk) console.log(`    Got: ${hhNames.join(', ')}`);

  // 040: loan_staff_assignments exists + MLO backfill matches loans.mlo_id
  const lsaCount = await sql`SELECT COUNT(*)::int AS n FROM loan_staff_assignments`;
  const mloCount = await sql`SELECT COUNT(*)::int AS n FROM loans WHERE mlo_id IS NOT NULL`;
  const mloBackfill = await sql`
    SELECT COUNT(*)::int AS n FROM loan_staff_assignments WHERE role = 'mlo' AND is_primary = true
  `;
  console.log(`  040 loan_staff_assignments total rows: ${lsaCount[0].n}`);
  console.log(`  040 MLO backfill: ${mloBackfill[0].n}/${mloCount[0].n} ${mloBackfill[0].n === mloCount[0].n ? '✓' : '✗ MISMATCH'}`);

  const lsaIndexes = await sql`
    SELECT indexname FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'loan_staff_assignments'
  `;
  const expectedIdx = ['idx_loan_staff_assignments_loan_id', 'idx_loan_staff_assignments_staff_id'];
  const gotIdx = lsaIndexes.map(r => r.indexname);
  const idxOk = expectedIdx.every(n => gotIdx.includes(n));
  console.log(`  040 loan_staff_assignments indexes: ${idxOk ? '✓' : '✗'} (${lsaIndexes.length} total)`);

  // 041: contacts has the 8 new columns + 2 CHECK constraints
  const contactsExpected = [
    'suffix', 'middle_name', 'preferred_contact_method',
    'language_preference', 'us_citizenship_indicator',
    'date_citizenship_established', 'num_dependents', 'dependent_ages'
  ];
  const contactCols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contacts'
      AND column_name = ANY(${contactsExpected})
  `;
  const cnames = contactCols.map(c => c.column_name);
  const cOk = contactsExpected.every(n => cnames.includes(n));
  console.log(`  041 contacts new columns: ${contactCols.length}/${contactsExpected.length} ${cOk ? '✓' : '✗'}`);
  if (!cOk) {
    const missing = contactsExpected.filter(n => !cnames.includes(n));
    console.log(`    Missing: ${missing.join(', ')}`);
  }
  const contactChecks = await sql`
    SELECT conname FROM pg_constraint
    WHERE conname IN ('contacts_preferred_contact_method_check', 'contacts_us_citizenship_indicator_check')
  `;
  console.log(`  041 contacts CHECK constraints: ${contactChecks.length}/2 ${contactChecks.length === 2 ? '✓' : '✗'}`);

  // 044: deleted_at present on 4 tables, partial indexes present
  const softCols = await sql`
    SELECT table_name FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('loans', 'contacts', 'scenarios', 'loan_participants')
      AND column_name = 'deleted_at'
    ORDER BY table_name
  `;
  console.log(`  044 deleted_at columns: ${softCols.length}/4 ${softCols.length === 4 ? '✓' : '✗'}`);
  const liveIdx = await sql`
    SELECT indexname FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname IN ('idx_loans_live', 'idx_contacts_live', 'idx_scenarios_live', 'idx_loan_participants_live')
    ORDER BY indexname
  `;
  console.log(`  044 live partial indexes: ${liveIdx.length}/4 ${liveIdx.length === 4 ? '✓' : '✗'}`);

  // Sanity: deleted_at is not set on any existing rows (fresh state check)
  const tombstones = await sql`
    SELECT
      (SELECT COUNT(*)::int FROM loans             WHERE deleted_at IS NOT NULL) AS loans_deleted,
      (SELECT COUNT(*)::int FROM contacts          WHERE deleted_at IS NOT NULL) AS contacts_deleted,
      (SELECT COUNT(*)::int FROM scenarios         WHERE deleted_at IS NOT NULL) AS scenarios_deleted,
      (SELECT COUNT(*)::int FROM loan_participants WHERE deleted_at IS NOT NULL) AS participants_deleted
  `;
  console.log(`  044 existing tombstones: ${JSON.stringify(tombstones[0])} (expected all 0 on fresh apply)`);
}

// ─── Main ─────────────────────────────────────────────────────────────────
try {
  if (!VERIFY_ONLY) {
    for (const m of MIGRATIONS) {
      await applyMigration(m);
    }
  }
  if (!DRY_RUN) {
    await verify();
  }
  console.log('\n✓ Bundle complete');
} catch (err) {
  console.error('\n✗ Bundle failed — inspect output above');
  process.exit(1);
}
