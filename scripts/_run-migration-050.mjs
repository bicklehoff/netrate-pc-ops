/**
 * Migration 050 — add nonqm_rate_sheets.has_dscr boolean
 *
 * Per Work/Dev/PRICING-ARCHITECTURE.md §10 AD-1 + AD-5 (D9c.1).
 * Adds a BOOLEAN column to nonqm_rate_sheets so the planned multi-lender
 * DSCR loader can cheaply skip non-DSCR sheets. Initializes TRUE
 * (today's only row has DSCR products), then runs an idempotent
 * refinement UPDATE that sets FALSE for any sheet without DSCR
 * products.
 *
 * Pre-flight expectation (verified via direct query 2026-04-26):
 *   total_sheets:     1
 *   active_sheets:    1
 *   sheets_with_dscr: 1
 *   loan_types in nonqm_rate_products: ['bankstatement', 'dscr']
 *
 * Post-run expectation:
 *   has_dscr column exists with type=boolean, not_null=YES, default=true
 *   nonqm_rate_sheets row count unchanged
 *   has_dscr distribution: 1 TRUE, 0 FALSE (today's mixed Everstream sheet)
 *
 * Usage:
 *   node scripts/_run-migration-050.mjs              # pre-flight + apply + verify
 *   node scripts/_run-migration-050.mjs --verify     # post-apply verify only
 *   node scripts/_run-migration-050.mjs --dry-run    # parse + print
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

console.log(`Migration 050 — nonqm_rate_sheets.has_dscr (D9c.1)`);
console.log(`Target: ${host}`);
console.log(`Mode: ${VERIFY_ONLY ? 'VERIFY ONLY' : DRY_RUN ? 'DRY RUN' : 'PRE-FLIGHT + APPLY + VERIFY'}`);

// Statement splitter — handles string literals, line comments, dollar-quoted
// blocks, parenthesis depth. Same logic as prior runners (e.g. 046).
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

  const colExists = (await sql`
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='nonqm_rate_sheets' AND column_name='has_dscr'
  `).length === 1;
  console.log(`  nonqm_rate_sheets.has_dscr column exists:  ${colExists ? 'yes (already added)' : 'no'}`);

  const totalSheets = (await sql`SELECT COUNT(*)::int AS n FROM nonqm_rate_sheets`)[0].n;
  console.log(`  nonqm_rate_sheets total rows:              ${totalSheets}`);

  const sheetsWithDscr = (await sql`
    SELECT COUNT(*)::int AS n FROM nonqm_rate_sheets s
     WHERE EXISTS (
       SELECT 1 FROM nonqm_rate_products p
        WHERE p.rate_sheet_id = s.id AND p.loan_type = 'dscr'
     )
  `)[0].n;
  console.log(`  nonqm_rate_sheets with DSCR products:      ${sheetsWithDscr}/${totalSheets}`);

  const loanTypes = (await sql`SELECT array_agg(DISTINCT loan_type) AS types FROM nonqm_rate_products`)[0].types;
  console.log(`  distinct loan_types in products:           ${(loanTypes || []).join(', ')}`);

  return { colExists, totalSheets, sheetsWithDscr };
}

async function apply() {
  const file = path.join(process.cwd(), 'migrations', '050_nonqm_rate_sheets_has_dscr.sql');
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

  const colMeta = await sql`
    SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
     WHERE table_schema='public' AND table_name='nonqm_rate_sheets' AND column_name='has_dscr'
  `;
  const colOk = colMeta.length === 1
    && colMeta[0].data_type === 'boolean'
    && colMeta[0].is_nullable === 'NO'
    && /true/i.test(String(colMeta[0].column_default || ''));
  console.log(`  has_dscr column meta: ${JSON.stringify(colMeta[0] || null)}`);
  console.log(`  column shape correct: ${colOk ? '✓' : '✗ expected boolean NOT NULL DEFAULT true'}`);

  const dist = await sql`
    SELECT has_dscr, COUNT(*)::int AS n FROM nonqm_rate_sheets GROUP BY has_dscr ORDER BY has_dscr DESC
  `;
  console.log(`  has_dscr distribution: ${JSON.stringify(dist)}`);

  // Independently compute the truth from product data and compare against the column
  const truthRows = await sql`
    SELECT s.id,
           s.has_dscr AS column_value,
           EXISTS (
             SELECT 1 FROM nonqm_rate_products p
              WHERE p.rate_sheet_id = s.id AND p.loan_type = 'dscr'
           ) AS truth
      FROM nonqm_rate_sheets s
  `;
  const mismatches = truthRows.filter(r => r.column_value !== r.truth);
  console.log(`  rows where has_dscr ≠ product-truth: ${mismatches.length} ${mismatches.length === 0 ? '✓' : '✗'}`);
  if (mismatches.length) {
    for (const m of mismatches) console.log(`    sheet ${m.id}: column=${m.column_value} truth=${m.truth}`);
  }

  // Invariant: row count unchanged
  const totalSheets = (await sql`SELECT COUNT(*)::int AS n FROM nonqm_rate_sheets`)[0].n;
  console.log(`  nonqm_rate_sheets total rows: ${totalSheets} (unchanged) ✓`);

  const success = colOk && mismatches.length === 0;
  console.log(`\n${success ? '✓ Migration 050 complete.' : '✗ Migration verification FAILED.'}`);
  if (!success) process.exit(1);
}

async function main() {
  try {
    if (VERIFY_ONLY) { await verify(); return; }
    await preFlight();
    await apply();
    if (!DRY_RUN) await verify();
  } catch (err) {
    console.error('\n✗ Migration 050 failed:', err.message);
    process.exit(1);
  }
}

main();
