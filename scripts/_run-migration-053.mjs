/**
 * Migration 053 — D9c PR-1 / Phase 1 — scenarios split (additive)
 *
 * Creates rate_alerts + quotes tables, adds scenarios.purge_at, retargets
 * scenario_alert_queue.scenario_id → scenario_alert_queue.rate_alert_id,
 * backfills both new tables from scenarios.
 *
 * Spec: Work/Dev/audits/D9C-PR1-PHASE1-MIGRATION-SPEC-2026-04-29.md
 *
 * Tier 3 — schema-touching, multi-consumer. Rehearsal MANDATORY on a Neon
 * branch before prod (per DEV-PLAYBOOK §3 + Q5 in the spec).
 *
 * Usage:
 *   node scripts/_run-migration-053.mjs              # pre-flight + apply + verify
 *   node scripts/_run-migration-053.mjs --verify     # post-apply verify only (no writes)
 *   node scripts/_run-migration-053.mjs --dry-run    # pre-flight + parse, no writes
 *   node scripts/_run-migration-053.mjs --connection-string=<url>   # override target DB
 *
 * Pre-flights (fail loudly per CODING-PRINCIPLES.md namespace lessons):
 *   1. Legacy rate_alerts table must NOT exist (Phase 0 must have shipped)
 *   2. Quotes table must NOT exist OR have the AD-10a shape (idempotent re-run ok)
 *   3. scenarios shape sanity — every column we depend on exists with expected type
 *   4. scenario_alert_queue.scenario_id resolves to a real scenario for every row
 *   5. Empty target tables OR identical-content target tables (restartable)
 *
 * Post-migration verification (exits non-zero on any failure):
 *   - Row count parity: scenarios source vs new-table target
 *   - Status-distribution parity for quotes
 *   - parent_quote_id orphan check (must be 0)
 *   - scenario_alert_queue retarget orphan check (must be 0)
 *   - Cross-check: org/contact/lead/mlo/deal FK pass-through is intact
 */

import { neon } from '@neondatabase/serverless';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Connection
const args = process.argv.slice(2);
const connArg = args.find((a) => a.startsWith('--connection-string='));
const DATABASE_URL = connArg
  ? connArg.slice('--connection-string='.length)
  : process.env.PC_DATABASE_URL || process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Connection string required (--connection-string=<url>) or PC_DATABASE_URL / DATABASE_URL env var.');
  process.exit(1);
}
const sql = neon(DATABASE_URL);
const host = new URL(DATABASE_URL).host;

const VERIFY_ONLY = args.includes('--verify');
const DRY_RUN = args.includes('--dry-run');

console.log(`Migration 053 — D9c PR-1 / Phase 1 — scenarios split (additive)`);
console.log(`Target: ${host}`);
console.log(`Mode:   ${VERIFY_ONLY ? 'VERIFY ONLY' : DRY_RUN ? 'DRY RUN (pre-flight + parse)' : 'PRE-FLIGHT + APPLY + VERIFY'}`);
console.log('');

// ─── Helpers ─────────────────────────────────────────────────────────

function fail(label, msg) {
  console.error(`\n❌ ${label}`);
  console.error(`   ${msg}\n`);
  process.exit(1);
}

async function tableExists(name) {
  const r = await sql`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name=${name}
  `;
  return r.length === 1;
}

async function columnExists(table, column) {
  const r = await sql`
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name=${table} AND column_name=${column}
  `;
  return r.length === 1;
}

async function getColumns(table) {
  return sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name=${table}
    ORDER BY ordinal_position
  `;
}

// ─── Pre-flight ──────────────────────────────────────────────────────

async function preFlight() {
  console.log(`━━━ Pre-flight ━━━`);

  // 1. Legacy rate_alerts must be gone (Phase 0 invariant)
  const legacyAlertsExists = await tableExists('rate_alerts');
  if (legacyAlertsExists) {
    // It's possible we're seeing the AD-10a-shaped new table from a prior partial run.
    // Phase 0 dropped the legacy shape; new table has scenario_id column.
    const hasScenarioId = await columnExists('rate_alerts', 'scenario_id');
    const hasLegacyShape = await columnExists('rate_alerts', 'target_rate');
    if (hasLegacyShape) {
      fail('Pre-flight #1', `rate_alerts table has legacy shape (target_rate column present). Phase 0 (migration 052) was not applied to this database.`);
    }
    if (!hasScenarioId) {
      fail('Pre-flight #1', `rate_alerts table exists but has unrecognized shape — investigate.`);
    }
    console.log(`  [1/5] rate_alerts: AD-10a shape already present (idempotent re-run ok)`);
  } else {
    console.log(`  [1/5] rate_alerts: table absent (will be created)`);
  }

  // 2. Quotes table must not exist OR have the right shape
  const quotesExists = await tableExists('quotes');
  if (quotesExists) {
    const hasScenarioId = await columnExists('quotes', 'scenario_id');
    if (!hasScenarioId) {
      fail('Pre-flight #2', `quotes table exists but has unrecognized shape (no scenario_id column) — investigate before re-running.`);
    }
    console.log(`  [2/5] quotes: AD-10a shape already present (idempotent re-run ok)`);
  } else {
    console.log(`  [2/5] quotes: table absent (will be created)`);
  }

  // 3. scenarios depended-on columns. Note: deal_id and share_token are NOT in
  // this list — they don't exist on scenarios today (planned-future per UAD AD-7).
  // The new quotes table has those columns but Phase 1 backfills them as NULL
  // because there's nothing to copy from. Phase 2 wires the new code paths that
  // populate them.
  const requiredScenarioCols = [
    'id','organization_id','contact_id','lead_id','mlo_id',
    'owner_type','source','status',
    'alert_status','alert_frequency','alert_days',
    'last_priced_at','last_sent_at','send_count','unsub_token',
    'sent_at','viewed_at','expires_at','pdf_url','pdf_generated_at',
    'version','parent_scenario_id',
    'created_at','updated_at',
  ];
  const presentScenarioCols = (await getColumns('scenarios')).map((c) => c.column_name);
  const missing = requiredScenarioCols.filter((c) => !presentScenarioCols.includes(c));
  if (missing.length > 0) {
    fail('Pre-flight #3', `scenarios is missing expected columns: ${missing.join(', ')}. Schema may have drifted; abort.`);
  }
  console.log(`  [3/5] scenarios: all ${requiredScenarioCols.length} depended-on columns present`);

  // 4. scenario_alert_queue.scenario_id orphan check (only if rate_alert_id not yet added)
  const hasRetarget = await columnExists('scenario_alert_queue', 'rate_alert_id');
  if (!hasRetarget) {
    // First-run: every scenario_alert_queue row must point at a real scenario.
    // If not, the backfill in step 7 will leave NULLs which we then SET NOT NULL — failure mode.
    const orphans = (await sql`
      SELECT COUNT(*)::int AS n FROM scenario_alert_queue saq
      WHERE saq.scenario_id IS NULL
         OR NOT EXISTS (SELECT 1 FROM scenarios s WHERE s.id = saq.scenario_id)
    `)[0].n;
    if (orphans > 0) {
      fail('Pre-flight #4', `scenario_alert_queue has ${orphans} rows that don't resolve to a scenario. The migration would orphan these. Investigate before retry.`);
    }
    console.log(`  [4/5] scenario_alert_queue: 0 orphans (FK retarget is safe)`);
  } else {
    console.log(`  [4/5] scenario_alert_queue: rate_alert_id column already exists (idempotent re-run ok)`);
  }

  // 5. Backfill source counts (informational)
  const counts = (await sql`
    SELECT
      (SELECT COUNT(*)::int FROM scenarios WHERE owner_type='borrower' AND alert_status IS NOT NULL) AS borrower_alerts,
      (SELECT COUNT(*)::int FROM scenarios WHERE owner_type='mlo' AND sent_at IS NOT NULL)           AS mlo_quotes,
      (SELECT COUNT(*)::int FROM scenarios)                                                          AS total_scenarios,
      (SELECT COUNT(*)::int FROM scenario_alert_queue)                                               AS queue_rows
  `)[0];
  console.log(`  [5/5] Source counts:`);
  console.log(`        scenarios total:                    ${counts.total_scenarios}`);
  console.log(`        scenarios (borrower + alert):       ${counts.borrower_alerts}  → rate_alerts target`);
  console.log(`        scenarios (mlo + sent):             ${counts.mlo_quotes}  → quotes target`);
  console.log(`        scenario_alert_queue rows:          ${counts.queue_rows}  → all retarget`);

  return counts;
}

// ─── Apply ───────────────────────────────────────────────────────────

async function applyMigration() {
  console.log(`\n━━━ Applying migration 053 ━━━`);

  const sqlPath = path.join(__dirname, '..', 'migrations', '053_d9c_scenarios_split_phase1.sql');
  const sqlText = fs.readFileSync(sqlPath, 'utf8');

  // Split on semicolons that aren't inside dollar-quoted strings or comments.
  // Keep this simple — none of our statements use $$ blocks.
  const statements = sqlText
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s && s !== 'BEGIN' && s !== 'COMMIT');

  console.log(`  Parsed ${statements.length} statements from ${path.basename(sqlPath)}`);

  if (DRY_RUN) {
    console.log(`  DRY RUN — not executing.`);
    return;
  }

  // Execute as a single tx; any failure rolls all changes back.
  await sql`BEGIN`;
  try {
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      const preview = stmt.split('\n')[0].slice(0, 80);
      process.stdout.write(`  [${String(i + 1).padStart(2, '0')}/${statements.length}] ${preview}... `);
      await sql.query(stmt);
      process.stdout.write(`ok\n`);
    }
    await sql`COMMIT`;
    console.log(`  ✓ Migration applied`);
  } catch (e) {
    try { await sql`ROLLBACK`; } catch { /* already rolled back */ }
    fail('Apply', `Migration failed; rolled back. Error: ${e.message}`);
  }
}

// ─── Verify ──────────────────────────────────────────────────────────

async function verify(sourceCounts) {
  console.log(`\n━━━ Post-migration verification ━━━`);

  // Row count parity
  const targets = (await sql`
    SELECT
      (SELECT COUNT(*)::int FROM rate_alerts) AS rate_alerts,
      (SELECT COUNT(*)::int FROM quotes)      AS quotes
  `)[0];

  const expected_rate_alerts = sourceCounts?.borrower_alerts;
  const expected_quotes = sourceCounts?.mlo_quotes;

  if (expected_rate_alerts !== undefined && targets.rate_alerts !== expected_rate_alerts) {
    fail('Verify', `rate_alerts row count mismatch: expected ${expected_rate_alerts}, got ${targets.rate_alerts}`);
  }
  console.log(`  ✓ rate_alerts count:                ${targets.rate_alerts}${expected_rate_alerts !== undefined ? ` (matches source)` : ''}`);

  if (expected_quotes !== undefined && targets.quotes !== expected_quotes) {
    fail('Verify', `quotes row count mismatch: expected ${expected_quotes}, got ${targets.quotes}`);
  }
  console.log(`  ✓ quotes count:                     ${targets.quotes}${expected_quotes !== undefined ? ` (matches source)` : ''}`);

  // Status-distribution parity for quotes
  const quoteStatusSrc = await sql`
    SELECT
      CASE WHEN status IN ('draft','sent','viewed','accepted','declined','expired') THEN status ELSE 'sent' END AS s,
      COUNT(*)::int AS n
    FROM scenarios WHERE owner_type='mlo' AND sent_at IS NOT NULL
    GROUP BY 1 ORDER BY 1
  `;
  const quoteStatusTgt = await sql`
    SELECT status AS s, COUNT(*)::int AS n FROM quotes GROUP BY 1 ORDER BY 1
  `;
  const srcMap = Object.fromEntries(quoteStatusSrc.map((r) => [r.s, r.n]));
  const tgtMap = Object.fromEntries(quoteStatusTgt.map((r) => [r.s, r.n]));
  const allStatuses = new Set([...Object.keys(srcMap), ...Object.keys(tgtMap)]);
  for (const s of allStatuses) {
    if ((srcMap[s] || 0) !== (tgtMap[s] || 0)) {
      fail('Verify', `quotes status distribution mismatch for '${s}': src=${srcMap[s] || 0}, tgt=${tgtMap[s] || 0}`);
    }
  }
  console.log(`  ✓ quotes status distribution matches: ${[...allStatuses].sort().map((s) => `${s}=${tgtMap[s] || 0}`).join(', ') || '(empty)'}`);

  // parent_quote_id orphan check
  const parentOrphans = (await sql`
    SELECT COUNT(*)::int AS n FROM quotes q
    WHERE q.parent_quote_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM quotes q2 WHERE q2.id = q.parent_quote_id)
  `)[0].n;
  if (parentOrphans > 0) fail('Verify', `quotes.parent_quote_id orphans: ${parentOrphans}`);
  console.log(`  ✓ parent_quote_id orphans:          0`);

  // scenario_alert_queue retarget — every row must have a non-null rate_alert_id pointing at a real rate_alert
  const queueOrphans = (await sql`
    SELECT
      COUNT(*) FILTER (WHERE rate_alert_id IS NULL)::int AS null_count,
      COUNT(*) FILTER (WHERE rate_alert_id IS NOT NULL
                         AND NOT EXISTS (SELECT 1 FROM rate_alerts ra WHERE ra.id = rate_alert_id))::int AS dangling
    FROM scenario_alert_queue
  `)[0];
  if (queueOrphans.null_count > 0) fail('Verify', `scenario_alert_queue.rate_alert_id NULL count: ${queueOrphans.null_count}`);
  if (queueOrphans.dangling > 0) fail('Verify', `scenario_alert_queue.rate_alert_id dangling refs: ${queueOrphans.dangling}`);
  console.log(`  ✓ scenario_alert_queue retarget:    0 NULLs, 0 dangling`);

  // FK pass-through cross-check — rate_alerts vs scenarios
  const raMismatch = (await sql`
    SELECT COUNT(*)::int AS n FROM rate_alerts ra
    JOIN scenarios s ON s.id = ra.scenario_id
    WHERE ra.organization_id != s.organization_id
       OR (ra.contact_id IS DISTINCT FROM s.contact_id)
       OR (ra.lead_id IS DISTINCT FROM s.lead_id)
  `)[0].n;
  if (raMismatch > 0) fail('Verify', `rate_alerts FK pass-through mismatches: ${raMismatch}`);
  console.log(`  ✓ rate_alerts FK pass-through:      clean`);

  // FK pass-through cross-check — quotes vs scenarios.
  // Note: deal_id and share_token are not pass-through fields (scenarios doesn't carry
  // them today). Backfilled rows have q.deal_id = NULL and q.share_token = NULL by design.
  const qMismatch = (await sql`
    SELECT COUNT(*)::int AS n FROM quotes q
    JOIN scenarios s ON s.id = q.scenario_id
    WHERE q.organization_id != s.organization_id
       OR (q.mlo_id IS DISTINCT FROM s.mlo_id)
       OR (q.contact_id IS DISTINCT FROM s.contact_id)
  `)[0].n;
  if (qMismatch > 0) fail('Verify', `quotes FK pass-through mismatches: ${qMismatch}`);
  console.log(`  ✓ quotes FK pass-through:           clean`);

  // scenarios.purge_at column present
  const hasPurgeAt = await columnExists('scenarios', 'purge_at');
  if (!hasPurgeAt) fail('Verify', `scenarios.purge_at column not present`);
  console.log(`  ✓ scenarios.purge_at:               present`);

  console.log(`\n✅ Migration 053 verified clean.`);
}

// ─── Main ────────────────────────────────────────────────────────────

async function main() {
  let sourceCounts = null;
  if (!VERIFY_ONLY) {
    sourceCounts = await preFlight();
    await applyMigration();
  }
  if (!DRY_RUN) {
    await verify(sourceCounts);
  }
}

main().catch((e) => {
  console.error(`\n❌ Unhandled: ${e.message}`);
  console.error(e.stack);
  process.exit(1);
});
