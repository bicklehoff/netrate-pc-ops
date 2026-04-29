/**
 * Migration 056 — Full phone app settings
 *
 * Adds voicemail modes, call routing, SMS auto-reply columns to staff.
 * Adds is_auto_reply flag to sms_messages.
 * Additive-only — idempotent ADD COLUMN IF NOT EXISTS.
 *
 * Usage:
 *   node scripts/_run-migration-056.mjs           # apply + verify
 *   node scripts/_run-migration-056.mjs --verify  # verify only
 *   node scripts/_run-migration-056.mjs --dry-run # print SQL, no apply
 */

import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const DATABASE_URL = process.env.PC_DATABASE_URL || process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('PC_DATABASE_URL or DATABASE_URL required'); process.exit(1); }
const sql = neon(DATABASE_URL);
const host = new URL(DATABASE_URL).host;

const VERIFY_ONLY = process.argv.includes('--verify');
const DRY_RUN = process.argv.includes('--dry-run');

console.log(`Migration 056 — Full phone app settings`);
console.log(`Target: ${host}`);
console.log(`Mode: ${VERIFY_ONLY ? 'VERIFY ONLY' : DRY_RUN ? 'DRY RUN' : 'APPLY + VERIFY'}`);

const STAFF_COLS = [
  'voicemail_mode',
  'voicemail_exception_url',
  'voicemail_exception_until',
  'sms_auto_reply_enabled',
  'sms_auto_reply_message',
  'call_forward_enabled',
  'call_forward_number',
  'dnd_enabled',
];

const STMTS = [
  `ALTER TABLE staff ADD COLUMN IF NOT EXISTS voicemail_mode text NOT NULL DEFAULT 'standard'`,
  `ALTER TABLE staff ADD COLUMN IF NOT EXISTS voicemail_exception_url text`,
  `ALTER TABLE staff ADD COLUMN IF NOT EXISTS voicemail_exception_until date`,
  `ALTER TABLE staff ADD COLUMN IF NOT EXISTS sms_auto_reply_enabled boolean NOT NULL DEFAULT false`,
  `ALTER TABLE staff ADD COLUMN IF NOT EXISTS sms_auto_reply_message text`,
  `ALTER TABLE staff ADD COLUMN IF NOT EXISTS call_forward_enabled boolean NOT NULL DEFAULT false`,
  `ALTER TABLE staff ADD COLUMN IF NOT EXISTS call_forward_number text`,
  `ALTER TABLE staff ADD COLUMN IF NOT EXISTS dnd_enabled boolean NOT NULL DEFAULT false`,
  `ALTER TABLE sms_messages ADD COLUMN IF NOT EXISTS is_auto_reply boolean NOT NULL DEFAULT false`,
];

async function preFlight() {
  console.log(`\n━━━ Pre-flight ━━━`);
  for (const table of ['staff', 'sms_messages']) {
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
  const smsCols = (await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sms_messages'
  `).map(c => c.column_name);

  for (const col of STAFF_COLS) {
    console.log(`  ${col} on staff: ${staffCols.includes(col) ? 'yes (already applied)' : 'no'}`);
  }
  console.log(`  is_auto_reply on sms_messages: ${smsCols.includes('is_auto_reply') ? 'yes (already applied)' : 'no'}`);

  return { staffCols, smsCols };
}

async function apply() {
  console.log(`\n━━━ Apply ━━━`);
  for (const stmt of STMTS) {
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
  `).map(c => c.column_name);
  const smsCols = (await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sms_messages'
  `).map(c => c.column_name);

  let allOk = true;
  for (const col of STAFF_COLS) {
    const ok = staffCols.includes(col);
    console.log(`  ${ok ? '✓' : '✗'} ${col} on staff`);
    if (!ok) allOk = false;
  }
  const smsOk = smsCols.includes('is_auto_reply');
  console.log(`  ${smsOk ? '✓' : '✗'} is_auto_reply on sms_messages`);
  if (!smsOk) allOk = false;

  console.log(`\n${allOk ? '✓ Migration 056 complete.' : '✗ Migration 056 verification FAILED.'}`);
  process.exit(allOk ? 0 : 1);
}

async function main() {
  try {
    const { staffCols, smsCols } = await preFlight();
    const alreadyApplied = STAFF_COLS.every(c => staffCols.includes(c)) && smsCols.includes('is_auto_reply');
    if (alreadyApplied && !VERIFY_ONLY) {
      console.log('\nAll columns already present — skipping apply.');
    } else if (!VERIFY_ONLY) {
      await apply();
    }
    if (!DRY_RUN) await verify();
  } catch (err) {
    console.error('\n✗ Migration 056 failed:', err.message);
    process.exit(1);
  }
}

main();
