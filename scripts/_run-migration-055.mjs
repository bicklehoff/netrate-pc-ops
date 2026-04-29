/**
 * Migration 055 — Voicemail support
 *
 * Adds voicemail_greeting_url to staff.
 * Adds voicemail_heard_at + transcription_text to call_logs.
 * Additive-only — idempotent ADD COLUMN IF NOT EXISTS.
 *
 * Usage:
 *   node scripts/_run-migration-055.mjs           # apply + verify
 *   node scripts/_run-migration-055.mjs --verify  # verify only
 *   node scripts/_run-migration-055.mjs --dry-run # print SQL, no apply
 */

import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const DATABASE_URL = process.env.PC_DATABASE_URL || process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('PC_DATABASE_URL or DATABASE_URL required'); process.exit(1); }
const sql = neon(DATABASE_URL);
const host = new URL(DATABASE_URL).host;

const VERIFY_ONLY = process.argv.includes('--verify');
const DRY_RUN = process.argv.includes('--dry-run');

console.log(`Migration 055 — Voicemail support`);
console.log(`Target: ${host}`);
console.log(`Mode: ${VERIFY_ONLY ? 'VERIFY ONLY' : DRY_RUN ? 'DRY RUN' : 'APPLY + VERIFY'}`);

async function preFlight() {
  console.log(`\n━━━ Pre-flight ━━━`);
  for (const table of ['staff', 'call_logs']) {
    const exists = (await sql`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ${table}
    `).length === 1;
    console.log(`  ${table} table exists: ${exists ? '✓' : '✗ MISSING — abort'}`);
    if (!exists) throw new Error(`${table} table not found`);
  }

  const staffCols = (await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'staff'
  `).map(c => c.column_name);
  const logCols = (await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'call_logs'
  `).map(c => c.column_name);

  console.log(`  voicemail_greeting_url on staff:     ${staffCols.includes('voicemail_greeting_url') ? 'yes (already applied)' : 'no'}`);
  console.log(`  voicemail_heard_at on call_logs:     ${logCols.includes('voicemail_heard_at') ? 'yes (already applied)' : 'no'}`);
  console.log(`  transcription_text on call_logs:     ${logCols.includes('transcription_text') ? 'yes (already applied)' : 'no'}`);

  return { staffCols, logCols };
}

async function apply() {
  console.log(`\n━━━ Apply ━━━`);
  const stmts = [
    `ALTER TABLE staff ADD COLUMN IF NOT EXISTS voicemail_greeting_url text`,
    `ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS voicemail_heard_at timestamptz`,
    `ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS transcription_text text`,
  ];
  for (const stmt of stmts) {
    console.log(`  SQL: ${stmt}`);
    if (!DRY_RUN) await sql.query(stmt);
  }
  if (DRY_RUN) console.log(`  [dry-run] skipping execution`);
  else console.log(`  Applied.`);
}

async function verify() {
  console.log(`\n━━━ Post-flight verification ━━━`);
  const staffCols = (await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'staff'
      AND column_name = 'voicemail_greeting_url'
  `).map(c => c.column_name);
  const logCols = (await sql`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'call_logs'
      AND column_name IN ('voicemail_heard_at', 'transcription_text')
  `);
  const logMap = Object.fromEntries(logCols.map(c => [c.column_name, c.data_type]));

  const checks = {
    'voicemail_greeting_url on staff (text)':       staffCols.includes('voicemail_greeting_url'),
    'voicemail_heard_at on call_logs (timestamptz)': logMap.voicemail_heard_at === 'timestamp with time zone',
    'transcription_text on call_logs (text)':        logMap.transcription_text === 'text',
  };
  for (const [label, ok] of Object.entries(checks)) {
    console.log(`  ${ok ? '✓' : '✗'} ${label}`);
  }
  const allOk = Object.values(checks).every(Boolean);
  console.log(`\n${allOk ? '✓ Migration 055 complete.' : '✗ Migration 055 verification FAILED.'}`);
  process.exit(allOk ? 0 : 1);
}

async function main() {
  try {
    const { staffCols, logCols } = await preFlight();
    const alreadyApplied = staffCols.includes('voicemail_greeting_url') &&
      logCols.includes('voicemail_heard_at') && logCols.includes('transcription_text');
    if (alreadyApplied && !VERIFY_ONLY) {
      console.log('\nAll columns already present — skipping apply.');
    } else if (!VERIFY_ONLY) {
      await apply();
    }
    if (!DRY_RUN) await verify();
  } catch (err) {
    console.error('\n✗ Migration 055 failed:', err.message);
    process.exit(1);
  }
}

main();
