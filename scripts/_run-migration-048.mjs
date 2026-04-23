/**
 * Migration 048 — drop loan_borrowers (PR 3c)
 *
 * Final retirement of loan_borrowers table and the 3 loan_borrower_id FK
 * columns on satellites. Depends on PR #189 (src/ rewire) being shipped.
 *
 * Rehearsal: MANDATORY on Neon branch per DEV-PLAYBOOK §3 before prod.
 *
 * Usage:
 *   node scripts/_run-migration-048.mjs              # pre-flight + apply + verify
 *   node scripts/_run-migration-048.mjs --verify     # post-apply verify only
 *   node scripts/_run-migration-048.mjs --dry-run    # parse + print
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

console.log(`Migration 048 — drop loan_borrowers (PR 3c)`);
console.log(`Target: ${host}`);
console.log(`Mode: ${VERIFY_ONLY ? 'VERIFY ONLY' : DRY_RUN ? 'DRY RUN' : 'PRE-FLIGHT + APPLY + VERIFY'}`);

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

  // Does the table still exist? (If no, this migration already ran.)
  const tableExists = (await sql`
    SELECT 1 AS exists FROM information_schema.tables
    WHERE table_schema='public' AND table_name='loan_borrowers'
  `).length === 1;
  console.log(`  loan_borrowers table exists:  ${tableExists ? 'yes' : 'no (already dropped)'}`);
  if (!tableExists) return { alreadyDropped: true };

  // Row count (informational — expected ~28 dead backup rows)
  const { count } = (await sql`SELECT COUNT(*)::int AS count FROM loan_borrowers`)[0];
  console.log(`  loan_borrowers row count:     ${count} (dead backup data)`);

  // Verify no other FKs point at loan_borrowers beyond the 3 known satellites
  const fks = await sql`
    SELECT tc.table_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu USING (constraint_schema, constraint_name)
    JOIN information_schema.constraint_column_usage ccu USING (constraint_schema, constraint_name)
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'loan_borrowers'
    ORDER BY tc.table_name
  `;
  const expected = new Set(['loan_declarations', 'loan_employments', 'loan_incomes']);
  const unexpected = fks.filter(f => !expected.has(f.table_name));
  console.log(`  Incoming FKs: ${fks.map(f => f.table_name).join(', ')}`);
  if (unexpected.length > 0) {
    throw new Error(`Unexpected FKs on loan_borrowers from: ${unexpected.map(f => f.table_name).join(', ')} — migration would cascade unexpectedly. Aborting.`);
  }

  // Verify the 3 loan_borrower_id columns are NULLABLE (set by mig 047 A3)
  const cols = await sql`
    SELECT table_name, is_nullable FROM information_schema.columns
    WHERE column_name = 'loan_borrower_id' AND table_schema = 'public'
    ORDER BY table_name
  `;
  console.log(`  Satellite loan_borrower_id nullability: ${JSON.stringify(cols)}`);

  return { alreadyDropped: false, count };
}

async function apply() {
  const file = path.join(process.cwd(), 'migrations', '048_drop_loan_borrowers.sql');
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

  const tableGone = (await sql`
    SELECT 1 AS exists FROM information_schema.tables
    WHERE table_schema='public' AND table_name='loan_borrowers'
  `).length === 0;
  console.log(`  loan_borrowers dropped:          ${tableGone ? '✓' : '✗ STILL EXISTS'}`);

  const cols = await sql`
    SELECT table_name FROM information_schema.columns
    WHERE column_name = 'loan_borrower_id' AND table_schema = 'public'
    ORDER BY table_name
  `;
  console.log(`  loan_borrower_id columns gone:   ${cols.length === 0 ? '✓' : `✗ still on: ${cols.map(c => c.table_name).join(', ')}`}`);

  // Satellites still intact (sanity)
  const satellites = (await sql`
    SELECT
      (SELECT COUNT(*)::int FROM loan_employments)  AS employments,
      (SELECT COUNT(*)::int FROM loan_incomes)      AS incomes,
      (SELECT COUNT(*)::int FROM loan_declarations) AS declarations,
      (SELECT COUNT(*)::int FROM loan_housing_history) AS housing,
      (SELECT COUNT(*)::int FROM loan_participants) AS participants
  `)[0];
  console.log(`  Satellite row counts: ${JSON.stringify(satellites)}`);

  const allOk = tableGone && cols.length === 0;
  console.log(`\n${allOk ? '✓ Migration 048 complete.' : '✗ Migration verification FAILED.'}`);
  process.exit(allOk ? 0 : 1);
}

async function main() {
  try {
    if (VERIFY_ONLY) { await verify(); return; }
    const pre = await preFlight();
    if (pre.alreadyDropped) { console.log('\nTable already dropped — skipping apply, running verify only.'); await verify(); return; }
    await apply();
    if (!DRY_RUN) await verify();
  } catch (err) {
    console.error('\n✗ Migration 048 failed:', err.message);
    process.exit(1);
  }
}

main();
