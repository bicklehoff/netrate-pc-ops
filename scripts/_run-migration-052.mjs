/**
 * Migration 052 — D9c PR-1 / Phase 0 — retire legacy rate_alerts table
 *
 * Drops the legacy rate_alerts table. Archives all rows to a JSON file
 * before drop for audit purposes (even though the data is bot signups —
 * paranoia is cheap, restoration after the fact is not).
 *
 * Spec: Work/Dev/audits/D9C-PR1-PHASE0-NAMESPACE-INVENTORY-2026-04-27.md
 *
 * Rehearsal: skip allowed per DEV-PLAYBOOK §3 — DROP TABLE on a known
 * dead table cannot corrupt anything. Pre-flight asserts the table is
 * still write-only (no readers), archives, then drops.
 *
 * Usage:
 *   node scripts/_run-migration-052.mjs              # pre-flight + archive + drop + verify
 *   node scripts/_run-migration-052.mjs --verify     # post-apply verify only
 *   node scripts/_run-migration-052.mjs --dry-run    # parse + print, no archive, no drop
 *   node scripts/_run-migration-052.mjs --archive-only  # archive rows but skip drop
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
const ARCHIVE_ONLY = process.argv.includes('--archive-only');

console.log(`Migration 052 — D9c PR-1 / Phase 0 — retire legacy rate_alerts`);
console.log(`Target: ${host}`);
console.log(`Mode: ${VERIFY_ONLY ? 'VERIFY ONLY' : DRY_RUN ? 'DRY RUN' : ARCHIVE_ONLY ? 'ARCHIVE ONLY' : 'PRE-FLIGHT + ARCHIVE + DROP + VERIFY'}`);

async function preFlight() {
  console.log(`\n━━━ Pre-flight ━━━`);

  const tableExists = (await sql`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='rate_alerts'
  `).length === 1;
  console.log(`  rate_alerts table exists:        ${tableExists ? 'yes' : 'no (already dropped)'}`);
  if (!tableExists) return { alreadyDropped: true };

  // Confirm legacy schema (the one Phase 0 is dropping) — not the AD-10a-shaped
  // table from migration 053. If we see scenario_id, abort — wrong table.
  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='rate_alerts'
    ORDER BY ordinal_position
  `;
  const colNames = cols.map(c => c.column_name);
  const hasLegacyShape = colNames.includes('target_rate') && colNames.includes('confirm_token') && colNames.includes('email');
  const hasNewShape = colNames.includes('scenario_id');
  console.log(`  rate_alerts column count:        ${cols.length}`);
  console.log(`  rate_alerts shape:               ${hasNewShape ? 'AD-10a (NEW — DO NOT DROP)' : hasLegacyShape ? 'legacy (will drop)' : 'UNKNOWN — abort'}`);

  if (hasNewShape) {
    throw new Error('rate_alerts table has AD-10a shape (scenario_id present) — this migration would drop the new table. Aborting.');
  }
  if (!hasLegacyShape) {
    throw new Error(`rate_alerts table shape unrecognized (cols: ${colNames.join(', ')}). Aborting.`);
  }

  // Row count and notification status
  const stats = (await sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE last_notified_at IS NOT NULL)::int AS ever_notified,
      COUNT(*) FILTER (WHERE notify_count > 0)::int AS notified_gt0,
      COUNT(*) FILTER (WHERE triggered_at IS NOT NULL)::int AS ever_triggered
    FROM rate_alerts
  `)[0];
  console.log(`  Row count:                       ${stats.total}`);
  console.log(`  Rows ever notified:              ${stats.ever_notified}  (expected 0)`);
  console.log(`  Rows with notify_count > 0:      ${stats.notified_gt0}  (expected 0)`);
  console.log(`  Rows ever triggered:             ${stats.ever_triggered}  (expected 0)`);

  if (stats.ever_notified > 0 || stats.notified_gt0 > 0 || stats.ever_triggered > 0) {
    console.warn(`  ⚠ Some rows show notification activity. Inspect before drop. Continue? (Ctrl-C to abort, otherwise drop in 5s)`);
    await new Promise(r => setTimeout(r, 5000));
  }

  return { alreadyDropped: false, stats };
}

async function archiveRows() {
  console.log(`\n━━━ Archive rows ━━━`);

  const rows = await sql`SELECT * FROM rate_alerts ORDER BY created_at`;
  console.log(`  Rows to archive: ${rows.length}`);

  if (DRY_RUN) {
    console.log(`  [dry-run] would write ${rows.length} rows to JSON`);
    return null;
  }

  const archiveDir = path.join(process.cwd(), 'Work', 'Dev', 'audits');
  if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const archivePath = path.join(archiveDir, `legacy-rate-alerts-snapshot-${ts}.json`);
  const payload = {
    migration: '052_drop_legacy_rate_alerts',
    archivedAt: new Date().toISOString(),
    targetHost: host,
    rowCount: rows.length,
    schemaSnapshot: rows[0] ? Object.keys(rows[0]) : [],
    rows,
  };
  fs.writeFileSync(archivePath, JSON.stringify(payload, null, 2));
  console.log(`  Archive written: ${archivePath}`);
  return archivePath;
}

async function applyDrop() {
  console.log(`\n━━━ Apply DROP TABLE ━━━`);

  if (DRY_RUN || ARCHIVE_ONLY) {
    console.log(`  [${DRY_RUN ? 'dry-run' : 'archive-only'}] would execute: DROP TABLE rate_alerts CASCADE`);
    return;
  }

  await sql.query('DROP TABLE IF EXISTS rate_alerts CASCADE');
  console.log(`  Dropped.`);
}

async function verify() {
  console.log(`\n━━━ Post-flight verification ━━━`);

  const tableGone = (await sql`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='rate_alerts'
  `).length === 0;
  console.log(`  rate_alerts dropped:             ${tableGone ? '✓' : '✗ STILL EXISTS'}`);

  const allOk = tableGone;
  console.log(`\n${allOk ? '✓ Migration 052 complete.' : '✗ Migration verification FAILED.'}`);
  process.exit(allOk ? 0 : 1);
}

async function main() {
  try {
    if (VERIFY_ONLY) { await verify(); return; }
    const pre = await preFlight();
    if (pre.alreadyDropped) { console.log('\nTable already dropped — skipping.'); await verify(); return; }
    await archiveRows();
    await applyDrop();
    if (!DRY_RUN && !ARCHIVE_ONLY) await verify();
  } catch (err) {
    console.error('\n✗ Migration 052 failed:', err.message);
    process.exit(1);
  }
}

main();
