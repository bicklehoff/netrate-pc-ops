/**
 * DB Foundation Cleanup Bundle — runner + verifier
 *
 * Applies 6 migrations in sequence against the database referenced by
 * PC_DATABASE_URL (or DATABASE_URL):
 *
 *   030_id_defaults_phase_2.sql       — idempotent reconstruction
 *   033_fk_indexes.sql                — 24 FK indexes
 *   034_check_constraints.sql         — 7 CHECK constraints
 *   035_contacts_email_unique.sql     — UNIQUE(org, lower(email))
 *   036_layer1c_denorm_drop.sql       — backfill + drop borrower_* cols
 *   038_staff_email_key_rename.sql    — index rename
 *
 * Usage:
 *   node scripts/_run-db-foundation-bundle.mjs              # apply + verify
 *   node scripts/_run-db-foundation-bundle.mjs --verify     # verify only (no writes)
 *   node scripts/_run-db-foundation-bundle.mjs --dry-run    # parse SQL, print statements, don't apply
 *
 * Rehearsal:
 *   Per DEV-PLAYBOOK, data migrations (036) require Neon-branch rehearsal.
 *   Point PC_DATABASE_URL at a Neon branch URL, run this script, inspect.
 *   Then point at prod and re-run.
 *
 * Idempotence:
 *   Every statement is idempotent (IF NOT EXISTS / DROP IF EXISTS / DO
 *   block guards). Safe to replay on any state.
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

console.log(`DB Foundation Cleanup Bundle`);
console.log(`Target: ${host}`);
console.log(`Mode: ${VERIFY_ONLY ? 'VERIFY ONLY' : DRY_RUN ? 'DRY RUN' : 'APPLY + VERIFY'}`);

const MIGRATIONS = [
  { num: '030', file: '030_id_defaults_phase_2.sql',       desc: 'id defaults phase 2 (idempotent reconstruction)' },
  { num: '033', file: '033_fk_indexes.sql',                 desc: '24 FK indexes' },
  { num: '034', file: '034_check_constraints.sql',          desc: '7 CHECK constraints' },
  { num: '035', file: '035_contacts_email_unique.sql',      desc: 'UNIQUE(org, lower(email)) on contacts' },
  { num: '036', file: '036_layer1c_denorm_drop.sql',        desc: 'backfill + drop borrower_* cols (DATA MIGRATION)' },
  { num: '038', file: '038_staff_email_key_rename.sql',     desc: 'rename mlos_email_key → staff_email_key' },
];

// ─── Statement splitter (handles BEGIN/COMMIT + DO $$...$$ blocks) ────────
function splitStatements(src) {
  // Strip line comments only — keep block comments intact (they may be
  // inside a DO $$...$$ block and splitting on ';' within string literals
  // would corrupt them).
  const noLineComments = src
    .split('\n')
    .map(l => {
      // Preserve -- inside a string literal.
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
  let inDollar = null; // the dollar-quote tag we're currently inside, or null

  for (let i = 0; i < noLineComments.length; i++) {
    const ch = noLineComments[i];

    // Dollar-quoted block detection
    if (!inStr) {
      if (inDollar !== null) {
        // Check for closing tag
        const close = `$${inDollar}$`;
        if (noLineComments.substr(i, close.length) === close) {
          buf += close;
          i += close.length - 1;
          inDollar = null;
          continue;
        }
      } else if (ch === '$') {
        // Check for opening $tag$ — tag is any word chars (including empty)
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
  // Filter out bare BEGIN/COMMIT — @neondatabase/serverless handles
  // transactions per-statement; explicit BEGIN/COMMIT wrapped in a
  // multi-statement runner would error.
  return statements.filter(s => !/^\s*(BEGIN|COMMIT|ROLLBACK)\s*$/i.test(s));
}

async function applyMigration(m) {
  const file = path.join(process.cwd(), 'prisma', 'migrations', m.file);
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

  // 030: all UUID id columns have gen_random_uuid() default
  const idDefaults = await sql`
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE column_default LIKE '%gen_random_uuid%')::int AS with_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'id' AND data_type = 'uuid'
  `;
  const { total, with_default } = idDefaults[0];
  console.log(`  030 id defaults: ${with_default}/${total} ${with_default === total ? '✓' : '✗ MISSING'}`);

  // 033: unindexed FK count (should be 0)
  const unindexedFks = await sql`
    SELECT COUNT(*)::int AS n
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
      AND NOT EXISTS (
        SELECT 1 FROM pg_indexes pi
        WHERE pi.schemaname = 'public' AND pi.tablename = tc.table_name
          AND pi.indexdef LIKE '%(' || kcu.column_name || ')%'
      )
  `;
  console.log(`  033 unindexed FKs: ${unindexedFks[0].n} ${unindexedFks[0].n === 0 ? '✓' : '✗ REMAINING'}`);

  // 034: CHECK constraints exist
  const checks = await sql`
    SELECT conname FROM pg_constraint
    WHERE contype = 'c' AND connamespace = 'public'::regnamespace
      AND conname IN (
        'loans_status_check', 'loans_purpose_check', 'loans_ball_in_court_check',
        'leads_status_check', 'documents_status_check',
        'conditions_status_check', 'conditions_stage_check'
      )
    ORDER BY conname
  `;
  console.log(`  034 CHECK constraints: ${checks.length}/7 ${checks.length === 7 ? '✓' : '✗ MISSING'}`);
  if (checks.length < 7) {
    const present = new Set(checks.map(r => r.conname));
    const expected = ['loans_status_check', 'loans_purpose_check', 'loans_ball_in_court_check',
                      'leads_status_check', 'documents_status_check',
                      'conditions_status_check', 'conditions_stage_check'];
    const missing = expected.filter(n => !present.has(n));
    console.log(`    Missing: ${missing.join(', ')}`);
  }

  // 035: unique index on contacts
  const emailIdx = await sql`
    SELECT indexname, indexdef FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'contacts'
      AND indexname = 'contacts_org_email_unique_idx'
  `;
  console.log(`  035 contacts email unique idx: ${emailIdx.length === 1 ? '✓' : '✗ MISSING'}`);

  // 036: borrower_* columns dropped + scenario identity coverage
  const scenCols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'scenarios'
      AND column_name IN ('borrower_name', 'borrower_email', 'borrower_phone')
  `;
  console.log(`  036 borrower_* columns dropped: ${scenCols.length === 0 ? '✓' : `✗ ${scenCols.length} remaining`}`);
  const scenIdentity = await sql`
    SELECT
      COUNT(*)::int                      AS total,
      COUNT(contact_id)::int             AS with_contact,
      COUNT(lead_id)::int                AS with_lead,
      COUNT(*) FILTER (WHERE contact_id IS NULL AND lead_id IS NULL)::int AS orphan
    FROM scenarios
  `;
  console.log(`  036 scenario identity: ${JSON.stringify(scenIdentity[0])}`);

  // 038: staff_email_key index
  const staffIdx = await sql`
    SELECT indexname FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'staff' AND indexdef ILIKE '%email%'
  `;
  const names = staffIdx.map(r => r.indexname);
  const has_new = names.includes('staff_email_key');
  const has_old = names.includes('mlos_email_key');
  console.log(`  038 staff email index: ${has_new && !has_old ? '✓ staff_email_key' : `✗ got ${names.join(',')}`}`);
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
