/**
 * Migration 054 — SMS MMS image support
 *
 * Adds media_url, media_content_type, media_purged_at to sms_messages.
 * Additive-only — no data backfill, no destructive operations.
 * Rehearsal not required per DEV-PLAYBOOK §3 (ADD COLUMN IF NOT EXISTS is
 * idempotent and cannot corrupt existing data).
 *
 * Usage:
 *   node scripts/_run-migration-054.mjs           # apply + verify
 *   node scripts/_run-migration-054.mjs --verify  # verify only
 *   node scripts/_run-migration-054.mjs --dry-run # print SQL, no apply
 */

import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const DATABASE_URL = process.env.PC_DATABASE_URL || process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('PC_DATABASE_URL or DATABASE_URL required'); process.exit(1); }
const sql = neon(DATABASE_URL);
const host = new URL(DATABASE_URL).host;

const VERIFY_ONLY = process.argv.includes('--verify');
const DRY_RUN = process.argv.includes('--dry-run');

console.log(`Migration 054 — SMS MMS image support`);
console.log(`Target: ${host}`);
console.log(`Mode: ${VERIFY_ONLY ? 'VERIFY ONLY' : DRY_RUN ? 'DRY RUN' : 'APPLY + VERIFY'}`);

async function preFlight() {
  console.log(`\n━━━ Pre-flight ━━━`);
  const tableExists = (await sql`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'sms_messages'
  `).length === 1;
  console.log(`  sms_messages table exists:   ${tableExists ? '✓' : '✗ MISSING — abort'}`);
  if (!tableExists) throw new Error('sms_messages table not found');

  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sms_messages'
    ORDER BY ordinal_position
  `;
  const colNames = cols.map(c => c.column_name);
  console.log(`  Current columns (${cols.length}):    ${colNames.join(', ')}`);
  console.log(`  media_url present:           ${colNames.includes('media_url') ? 'yes (already applied)' : 'no'}`);
  console.log(`  media_content_type present:  ${colNames.includes('media_content_type') ? 'yes (already applied)' : 'no'}`);
  console.log(`  media_purged_at present:     ${colNames.includes('media_purged_at') ? 'yes (already applied)' : 'no'}`);
  return colNames;
}

async function apply() {
  console.log(`\n━━━ Apply ━━━`);
  const stmt = `
    ALTER TABLE sms_messages
      ADD COLUMN IF NOT EXISTS media_url          text,
      ADD COLUMN IF NOT EXISTS media_content_type text,
      ADD COLUMN IF NOT EXISTS media_purged_at    timestamptz
  `;
  console.log(`  SQL: ${stmt.trim()}`);
  if (DRY_RUN) { console.log(`  [dry-run] skipping execution`); return; }
  await sql.query(stmt);
  console.log(`  Applied.`);
}

async function verify() {
  console.log(`\n━━━ Post-flight verification ━━━`);
  const cols = await sql`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sms_messages'
      AND column_name IN ('media_url', 'media_content_type', 'media_purged_at')
    ORDER BY column_name
  `;
  const found = Object.fromEntries(cols.map(c => [c.column_name, c.data_type]));
  const checks = {
    'media_url (text)':           found.media_url === 'text',
    'media_content_type (text)':  found.media_content_type === 'text',
    'media_purged_at (timestamptz)': found.media_purged_at === 'timestamp with time zone',
  };
  for (const [label, ok] of Object.entries(checks)) {
    console.log(`  ${ok ? '✓' : '✗'} ${label}`);
  }
  const allOk = Object.values(checks).every(Boolean);
  console.log(`\n${allOk ? '✓ Migration 054 complete.' : '✗ Migration 054 verification FAILED.'}`);
  process.exit(allOk ? 0 : 1);
}

async function main() {
  try {
    const colNames = await preFlight();
    const alreadyApplied = ['media_url', 'media_content_type', 'media_purged_at']
      .every(c => colNames.includes(c));
    if (alreadyApplied && !VERIFY_ONLY) {
      console.log('\nAll columns already present — skipping apply.');
    } else if (!VERIFY_ONLY) {
      await apply();
    }
    if (!DRY_RUN) await verify();
  } catch (err) {
    console.error('\n✗ Migration 054 failed:', err.message);
    process.exit(1);
  }
}

main();
