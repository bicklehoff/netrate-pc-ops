/**
 * Migration 042 — satellite FK rewire runner + verifier
 *
 * Applies migrations/042_satellite_contact_fk_rewire.sql. Adds loan_id +
 * contact_id to 5 application-module satellites. All 5 tables are empty
 * today — no backfill required.
 *
 * Usage:
 *   node scripts/_run-migration-042.mjs              # apply + verify
 *   node scripts/_run-migration-042.mjs --verify     # verify only
 *   node scripts/_run-migration-042.mjs --dry-run    # parse + print, no writes
 *
 * Idempotence:
 *   ADD COLUMN IF NOT EXISTS + DO-block NOT NULL promotion + CREATE INDEX
 *   IF NOT EXISTS. Safe to replay on any state.
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

console.log(`Migration 042 — satellite FK rewire (contact_id + loan_id)`);
console.log(`Target: ${host}`);
console.log(`Mode: ${VERIFY_ONLY ? 'VERIFY ONLY' : DRY_RUN ? 'DRY RUN' : 'APPLY + VERIFY'}`);

// Statement splitter — handles DO $$...$$ blocks, string literals,
// BEGIN/COMMIT stripping. Same logic as the foundation bundle runner.
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

async function apply() {
  const file = path.join(process.cwd(), 'migrations', '042_satellite_contact_fk_rewire.sql');
  const src = fs.readFileSync(file, 'utf8');
  const statements = splitStatements(src);
  console.log(`\nStatements to apply: ${statements.length}`);

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

  // NOT NULL tables: loan_employments, loan_declarations — both loan_id + contact_id
  for (const t of ['loan_employments', 'loan_declarations']) {
    const cols = await sql`
      SELECT column_name, is_nullable FROM information_schema.columns
      WHERE table_schema='public' AND table_name=${t}
        AND column_name IN ('loan_id', 'contact_id')
      ORDER BY column_name
    `;
    const loan = cols.find(c => c.column_name === 'loan_id');
    const cont = cols.find(c => c.column_name === 'contact_id');
    const ok = loan && cont && loan.is_nullable === 'NO' && cont.is_nullable === 'NO';
    console.log(`  ${t}: loan_id=${loan?.is_nullable ?? '-'}, contact_id=${cont?.is_nullable ?? '-'} ${ok ? '✓ both NOT NULL' : '✗'}`);
  }

  // NULLABLE tables: loan_assets, loan_liabilities, loan_reos — contact_id only
  for (const t of ['loan_assets', 'loan_liabilities', 'loan_reos']) {
    const col = await sql`
      SELECT is_nullable FROM information_schema.columns
      WHERE table_schema='public' AND table_name=${t} AND column_name='contact_id'
    `;
    console.log(`  ${t}: contact_id=${col[0]?.is_nullable ?? 'MISSING'} ${col[0]?.is_nullable === 'YES' ? '✓ nullable' : '✗'}`);
  }

  // Indexes — expect (contact_id) + (loan_id, contact_id) on each table
  const expectedIdx = [
    'idx_loan_employments_loan_id',
    'idx_loan_employments_contact_id',
    'idx_loan_employments_loan_contact',
    'idx_loan_declarations_loan_id',
    'idx_loan_declarations_contact_id',
    'idx_loan_declarations_loan_contact',
    'idx_loan_assets_contact_id',
    'idx_loan_assets_loan_contact',
    'idx_loan_liabilities_contact_id',
    'idx_loan_liabilities_loan_contact',
    'idx_loan_reos_contact_id',
    'idx_loan_reos_loan_contact',
  ];
  const rows = await sql`
    SELECT indexname FROM pg_indexes
    WHERE schemaname='public' AND indexname = ANY(${expectedIdx})
  `;
  const got = rows.map(r => r.indexname);
  const missing = expectedIdx.filter(n => !got.includes(n));
  console.log(`  indexes: ${got.length}/${expectedIdx.length} ${missing.length === 0 ? '✓' : '✗ missing: ' + missing.join(', ')}`);

  // FK constraints — contact_id should reference contacts(id) on each of the 5 tables
  const fks = await sql`
    SELECT tc.table_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema='public'
      AND ccu.table_name='contacts' AND ccu.column_name='id'
      AND tc.table_name IN ('loan_employments','loan_declarations','loan_assets','loan_liabilities','loan_reos')
      AND kcu.column_name='contact_id'
    ORDER BY tc.table_name
  `;
  console.log(`  contact_id FKs → contacts(id): ${fks.length}/5 ${fks.length === 5 ? '✓' : '✗'}`);
  if (fks.length < 5) {
    const got = new Set(fks.map(r => r.table_name));
    const missing = ['loan_employments','loan_declarations','loan_assets','loan_liabilities','loan_reos']
      .filter(t => !got.has(t));
    console.log(`    Missing: ${missing.join(', ')}`);
  }

  // Row counts — all should still be 0
  const counts = await sql`
    SELECT
      (SELECT COUNT(*)::int FROM loan_employments)  AS le,
      (SELECT COUNT(*)::int FROM loan_declarations) AS ld,
      (SELECT COUNT(*)::int FROM loan_assets)       AS la,
      (SELECT COUNT(*)::int FROM loan_liabilities)  AS lli,
      (SELECT COUNT(*)::int FROM loan_reos)         AS lr
  `;
  console.log(`  row counts: ${JSON.stringify(counts[0])} (all should be 0 — empty tables pre-PR 3)`);
}

// ─── Main ─────────────────────────────────────────────────────────────────
try {
  if (!VERIFY_ONLY) {
    await apply();
  }
  if (!DRY_RUN) {
    await verify();
  }
  console.log('\n✓ Migration 042 complete');
} catch (err) {
  console.error('\n✗ Migration 042 failed — inspect output above');
  process.exit(1);
}
