/**
 * D9e Scoping Data Gathering
 *
 * Reads live prod DB state for the D9e scoping session:
 *   - All 97 columns on `loans` with row-population statistics
 *   - Every UAD §7.1 module satellite table (row counts + columns)
 *   - Junction state: loan_borrowers vs loan_participants (row counts,
 *     column overlap, FK cardinality)
 *   - loans.status distribution (for lifecycle harmonization)
 *
 * NO WRITES. Read-only.
 */

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.PC_DATABASE_URL || process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL required'); process.exit(1); }
const sql = neon(DATABASE_URL);

const log = (title) => console.log(`\n━━━ ${title} ━━━`);

// ─── 1. `loans` column inventory with population rate ─────────────
log('1. `loans` column inventory — population rate per column');
const loansCols = await sql`
  SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='loans'
  ORDER BY ordinal_position
`;
const loanRowCount = (await sql`SELECT COUNT(*)::int AS n FROM loans`)[0].n;
console.log(`  Total columns: ${loansCols.length}`);
console.log(`  Total rows:    ${loanRowCount}`);

// For each column, count how many rows have non-null values
const colStats = [];
for (const col of loansCols) {
  const q = `SELECT COUNT(${col.column_name})::int AS n FROM loans`;
  try {
    const r = await sql.query(q);
    const filled = r[0].n;
    const pct = loanRowCount > 0 ? Math.round((filled / loanRowCount) * 100) : 0;
    colStats.push({ name: col.column_name, type: col.data_type, filled, pct });
  } catch (e) {
    colStats.push({ name: col.column_name, type: col.data_type, filled: 'ERR', pct: 0, err: e.message });
  }
}

// Group by population band
const bands = { dense: [], mid: [], sparse: [], empty: [] };
for (const c of colStats) {
  if (c.filled === 'ERR') continue;
  if (c.pct >= 80) bands.dense.push(c);
  else if (c.pct >= 20) bands.mid.push(c);
  else if (c.pct > 0) bands.sparse.push(c);
  else bands.empty.push(c);
}
console.log(`\n  Dense (≥80% filled, ${bands.dense.length}):`);
for (const c of bands.dense) console.log(`    ${c.pct.toString().padStart(3)}% ${c.name.padEnd(35)} ${c.type}`);
console.log(`\n  Mid (20-80% filled, ${bands.mid.length}):`);
for (const c of bands.mid) console.log(`    ${c.pct.toString().padStart(3)}% ${c.name.padEnd(35)} ${c.type}`);
console.log(`\n  Sparse (<20% filled, ${bands.sparse.length}):`);
for (const c of bands.sparse) console.log(`    ${c.pct.toString().padStart(3)}% ${c.name.padEnd(35)} ${c.type}`);
console.log(`\n  Empty (0 rows populated, ${bands.empty.length}):`);
for (const c of bands.empty) console.log(`      ${c.name.padEnd(35)} ${c.type}`);

// ─── 2. Satellite table inventory ─────────────────────────────────
log('2. UAD §7.1 satellite tables — row counts + column counts');
const satellites = [
  'loan_dates', 'loan_conv', 'loan_fha', 'loan_va', 'loan_hecm', 'loan_dscr',
  'loan_transactions', 'loan_employments', 'loan_incomes',
  'loan_assets', 'loan_liabilities', 'loan_reos', 'loan_declarations',
];
for (const t of satellites) {
  try {
    const r = await sql.query(`SELECT COUNT(*)::int AS n FROM ${t}`);
    const cols = await sql`SELECT COUNT(*)::int AS n FROM information_schema.columns WHERE table_schema='public' AND table_name=${t}`;
    const distinctLoans = await sql.query(`
      SELECT COUNT(DISTINCT loan_id)::int AS n
      FROM ${t}
      WHERE EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='${t}' AND column_name='loan_id')
    `).catch(() => [{ n: 'N/A' }]);
    const hasPartId = await sql`
      SELECT COUNT(*)::int AS n FROM information_schema.columns
      WHERE table_schema='public' AND table_name=${t} AND column_name IN ('participant_id','borrower_id','contact_id')
    `;
    console.log(`  ${t.padEnd(22)} ${String(r[0].n).padStart(5)} rows · ${String(cols[0].n).padStart(3)} cols · ${String(distinctLoans[0]?.n || '-').padStart(4)} distinct loan_ids · per-person: ${hasPartId[0].n > 0 ? 'YES' : 'no'}`);
  } catch (e) {
    console.log(`  ${t.padEnd(22)} ERR: ${e.message}`);
  }
}

// ─── 3. Junction table showdown ───────────────────────────────────
log('3. `loan_borrowers` vs `loan_participants` — junction analysis');
const lbRows = (await sql`SELECT COUNT(*)::int AS n FROM loan_borrowers`)[0].n;
const lpRows = (await sql`SELECT COUNT(*)::int AS n FROM loan_participants`)[0].n;
const lbCols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='loan_borrowers' ORDER BY ordinal_position`;
const lpCols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='loan_participants' ORDER BY ordinal_position`;
console.log(`  loan_borrowers:     ${lbRows} rows, ${lbCols.length} columns`);
for (const c of lbCols) console.log(`    - ${c.column_name.padEnd(24)} ${c.data_type}`);
console.log(`  loan_participants:  ${lpRows} rows, ${lpCols.length} columns`);
for (const c of lpCols) console.log(`    - ${c.column_name.padEnd(24)} ${c.data_type}`);

// Row overlap — how many loans have rows in both?
const overlap = await sql`
  SELECT COUNT(*)::int AS n FROM (
    SELECT DISTINCT loan_id FROM loan_borrowers
    INTERSECT
    SELECT DISTINCT loan_id FROM loan_participants
  ) AS _
`;
const lbOnly = await sql`
  SELECT COUNT(*)::int AS n FROM (
    SELECT DISTINCT loan_id FROM loan_borrowers
    EXCEPT
    SELECT DISTINCT loan_id FROM loan_participants
  ) AS _
`;
const lpOnly = await sql`
  SELECT COUNT(*)::int AS n FROM (
    SELECT DISTINCT loan_id FROM loan_participants
    EXCEPT
    SELECT DISTINCT loan_id FROM loan_borrowers
  ) AS _
`;
console.log(`  Loans in both tables:        ${overlap[0].n}`);
console.log(`  Loans in loan_borrowers only: ${lbOnly[0].n}`);
console.log(`  Loans in loan_participants only: ${lpOnly[0].n}`);

// ─── 4. loans.status distribution ─────────────────────────────────
log('4. loans.status distribution (lifecycle harmonization baseline)');
const statuses = await sql`SELECT status, COUNT(*)::int AS n FROM loans GROUP BY status ORDER BY n DESC`;
for (const r of statuses) console.log(`  ${r.status.padEnd(18)} ${r.n}`);

// ─── 5. Cross-loan table references (loan_notes, loan_service_providers, etc.) ─
log('5. Other tables with FK to loans');
const loanRefs = await sql`
  SELECT tc.table_name, kcu.column_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
    AND ccu.table_name = 'loans' AND ccu.column_name = 'id'
  ORDER BY tc.table_name
`;
console.log(`  ${loanRefs.length} FKs reference loans(id):`);
for (const r of loanRefs) {
  const cnt = (await sql.query(`SELECT COUNT(*)::int AS n FROM ${r.table_name}`))[0].n;
  console.log(`    ${r.table_name.padEnd(26)} via ${r.column_name.padEnd(18)} (${cnt} rows)`);
}

// ─── 6. 1003-BUILD-SPEC reality check ─────────────────────────────
log('6. Application LITE readiness — do the satellite columns match 1003?');
// Just check column names on a couple key satellites
for (const t of ['loan_employments', 'loan_assets', 'loan_liabilities', 'loan_declarations', 'loan_reos']) {
  try {
    const cols = await sql.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='${t}' ORDER BY ordinal_position`);
    const names = cols.map(c => c.column_name).join(', ');
    console.log(`  ${t}: ${names}`);
  } catch (e) { /* pass */ }
}

console.log('\n✓ Data gathering complete');
