/**
 * Pre-flight queries for the DB Foundation Cleanup bundle.
 *
 * Reads prod DB state for the following planned migrations:
 *   030 — id defaults phase 2 (reconstruct from live state)
 *   032 — id defaults pricing tables
 *   033 — FK indexes
 *   034 — CHECK constraints on 8 categoricals
 *   035 — contacts.email uniqueness
 *   036 — Layer-1c denorm drop
 *
 * NO WRITES. Only SELECT/information_schema queries.
 */

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.PC_DATABASE_URL || process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('PC_DATABASE_URL or DATABASE_URL must be set');
  process.exit(1);
}
const sql = neon(DATABASE_URL);

const log = (title) => console.log(`\n=== ${title} ===`);

// ─── Pre-flight 1: Tables with id UUID + their current default state ──────
// Used to reconstruct migration 030 (and scope migration 032).
log('1. Tables with UUID id columns — current DEFAULT state');
const idCols = await sql`
  SELECT
    c.table_name,
    c.column_default,
    c.is_nullable,
    (SELECT n_live_tup FROM pg_stat_user_tables WHERE relname = c.table_name) AS row_count
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.column_name = 'id'
    AND c.data_type = 'uuid'
  ORDER BY c.table_name
`;
console.log(`  ${idCols.length} tables have UUID id column`);
const withDefault = idCols.filter(r => r.column_default?.includes('gen_random_uuid'));
const withoutDefault = idCols.filter(r => !r.column_default?.includes('gen_random_uuid'));
console.log(`  With gen_random_uuid() DEFAULT: ${withDefault.length}`);
console.log(`  WITHOUT DEFAULT (needs fix):    ${withoutDefault.length}`);
if (withoutDefault.length > 0) {
  console.log(`\n  Tables missing DEFAULT:`);
  for (const r of withoutDefault) console.log(`    - ${r.table_name} (${r.row_count || 0} rows, default: ${r.column_default || 'NULL'})`);
}

// ─── Pre-flight 2: Migration 021 coverage baseline ────────────────────────
// The 7 tables migration 021 handled: loans, contacts, loan_events,
// loan_borrowers, documents, call_logs, staff.
log('2. Migration 021 tables — DEFAULT status');
const mig021Tables = ['loans', 'contacts', 'loan_events', 'loan_borrowers', 'documents', 'call_logs', 'staff'];
const mig021Check = await sql`
  SELECT table_name, column_default
  FROM information_schema.columns
  WHERE table_schema = 'public' AND column_name = 'id'
    AND table_name = ANY(${mig021Tables}::text[])
  ORDER BY table_name
`;
for (const r of mig021Check) {
  const ok = r.column_default?.includes('gen_random_uuid');
  console.log(`  ${ok ? '✓' : '✗'} ${r.table_name}: ${r.column_default || 'NULL'}`);
}

// ─── Pre-flight 3: FK columns without a covering index ────────────────────
log('3. FK columns without covering index');
const unindexedFks = await sql`
  SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS references_table,
    ccu.column_name AS references_column
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND NOT EXISTS (
      SELECT 1
      FROM pg_indexes pi
      WHERE pi.schemaname = 'public'
        AND pi.tablename = tc.table_name
        AND pi.indexdef LIKE '%(' || kcu.column_name || ')%'
    )
  ORDER BY tc.table_name, kcu.column_name
`;
console.log(`  ${unindexedFks.length} unindexed FK columns found`);
for (const r of unindexedFks) {
  console.log(`    ${r.table_name}.${r.column_name} → ${r.references_table}.${r.references_column}`);
}

// ─── Pre-flight 4: CHECK constraint categoricals — distinct values ────────
log('4. Distinct values in categorical columns (for CHECK constraint scoping)');
const categoricals = [
  { table: 'loans',      col: 'status' },
  { table: 'loans',      col: 'purpose' },
  { table: 'loans',      col: 'ball_in_court' },
  { table: 'leads',      col: 'status' },
  { table: 'documents',  col: 'status' },
  { table: 'conditions', col: 'status' },
  { table: 'conditions', col: 'stage' },
  { table: 'loan_tasks', col: 'status' },
];
for (const { table, col } of categoricals) {
  try {
    const q = `SELECT ${col}, COUNT(*)::int AS n FROM ${table} GROUP BY ${col} ORDER BY ${col}`;
    const rows = await sql.query(q);
    const values = rows.map(r => `${JSON.stringify(r[col])}(${r.n})`).join(', ');
    console.log(`  ${table}.${col}: ${values}`);
  } catch (e) {
    console.log(`  ${table}.${col}: ERROR — ${e.message}`);
  }
}

// ─── Pre-flight 5: contacts.email uniqueness (per org) ────────────────────
log('5. contacts (organization_id, lower(email)) duplicates');
const emailDupes = await sql`
  SELECT organization_id, lower(email) AS email_lower, COUNT(*)::int AS n
  FROM contacts
  WHERE email IS NOT NULL AND email <> ''
  GROUP BY organization_id, lower(email)
  HAVING COUNT(*) > 1
  ORDER BY n DESC, email_lower
`;
console.log(`  Duplicate (org, email) pairs: ${emailDupes.length}`);
if (emailDupes.length > 0) {
  console.log(`  Top 10:`);
  for (const r of emailDupes.slice(0, 10)) console.log(`    org=${r.organization_id} email=${r.email_lower} (${r.n} rows)`);
} else {
  console.log(`  ✓ Safe to add UNIQUE(organization_id, lower(email)) WHERE email IS NOT NULL`);
}

// ─── Pre-flight 6: scenarios Layer-1c denorm cleanup ──────────────────────
log('6. scenarios — Layer-1c denorm state');
const scenStats = await sql`
  SELECT
    COUNT(*)::int                                              AS total,
    COUNT(contact_id)::int                                     AS with_contact_id,
    COUNT(lead_id)::int                                        AS with_lead_id,
    COUNT(*) FILTER (WHERE borrower_name IS NOT NULL)::int     AS with_borrower_name,
    COUNT(*) FILTER (WHERE borrower_email IS NOT NULL)::int    AS with_borrower_email,
    COUNT(*) FILTER (WHERE borrower_phone IS NOT NULL)::int    AS with_borrower_phone,
    COUNT(*) FILTER (
      WHERE contact_id IS NULL
        AND (borrower_name IS NOT NULL OR borrower_email IS NOT NULL OR borrower_phone IS NOT NULL)
    )::int AS needs_backfill_no_contact,
    COUNT(*) FILTER (
      WHERE contact_id IS NULL AND lead_id IS NULL
        AND (borrower_name IS NOT NULL OR borrower_email IS NOT NULL OR borrower_phone IS NOT NULL)
    )::int AS orphan_identity_rows
  FROM scenarios
`;
console.log(`  ${JSON.stringify(scenStats[0], null, 2)}`);

// Show the specific rows needing backfill
log('6a. scenarios needing contact_id backfill (no contact, has denorm email)');
const backfillCandidates = await sql`
  SELECT id, lead_id, borrower_name, borrower_email, borrower_phone, organization_id
  FROM scenarios
  WHERE contact_id IS NULL
    AND (borrower_email IS NOT NULL OR borrower_phone IS NOT NULL)
  ORDER BY created_at DESC
  LIMIT 50
`;
console.log(`  ${backfillCandidates.length} candidates shown (max 50):`);
for (const r of backfillCandidates) {
  console.log(`    scenario=${r.id.slice(0,8)} lead=${r.lead_id?.slice(0,8) ?? '-'} name=${r.borrower_name ?? '-'} email=${r.borrower_email ?? '-'} phone=${r.borrower_phone ?? '-'}`);
}

// ─── Pre-flight 7: Dead tables ────────────────────────────────────────────
log('7. Dead-table candidates — lead_quotes, rate_alerts');
for (const t of ['lead_quotes', 'rate_alerts']) {
  try {
    const rows = await sql.query(`SELECT COUNT(*)::int AS n FROM ${t}`);
    console.log(`  ${t}: ${rows[0].n} rows`);
  } catch (e) {
    console.log(`  ${t}: ERROR — ${e.message}`);
  }
}

// ─── Pre-flight 8: staff_email_key index name check ──────────────────────
log('8. Staff email unique-index name');
const idxName = await sql`
  SELECT indexname, indexdef
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename = 'staff'
    AND indexdef ILIKE '%email%'
`;
for (const r of idxName) console.log(`  ${r.indexname}: ${r.indexdef}`);

// ─── Pre-flight 9: Pricing tables — id + default ─────────────────────────
log('9. Pricing-domain tables — id + DEFAULT state (for migration 032)');
const pricingTables = ['rate_lenders', 'rate_products', 'rate_prices', 'adjustment_rules', 'fee_templates',
                       'nonqm_rate_sheets', 'nonqm_rate_products', 'nonqm_rate_prices',
                       'nonqm_adjustment_rules', 'nonqm_srp_rules'];
for (const t of pricingTables) {
  try {
    const cols = await sql.query(`
      SELECT column_name, column_default, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'id'
    `, [t]);
    if (cols.length === 0) console.log(`  ${t}: NO id column or table doesn't exist`);
    else {
      const c = cols[0];
      const ok = c.column_default?.includes('gen_random_uuid');
      console.log(`  ${ok ? '✓' : '✗'} ${t}: type=${c.data_type} default=${c.column_default || 'NULL'}`);
    }
  } catch (e) {
    console.log(`  ${t}: ERROR — ${e.message}`);
  }
}

console.log('\n✓ Pre-flight complete');
