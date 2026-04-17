#!/usr/bin/env node
/**
 * UAD Layer 1b3 — Pre-flight verification (read-only)
 *
 * Confirms the database is in the expected post-1b2a state before running
 * migration 008 (drop borrowers, rename loans.borrower_id -> contact_id).
 *
 * Checks:
 *   A. loans.borrower_id coverage — every non-null loans.borrower_id must
 *      chain to exactly one contact via contacts.borrower_id.
 *   B. Borrower coverage — every borrower must have a matching contact.
 *   C. loan_participants coverage — loan_borrowers + loan_contacts data
 *      fully represented in loan_participants.
 *   D. mlos view is the compat view (not a base table) — confirms 1b2a ran.
 *   E. No other tables FK to borrowers outside what we plan to drop.
 *   F. scenarios.contact_id population rate (informational — not a blocker).
 *
 * Exits non-zero if any GO/NO-GO check fails.
 *
 * Run: node scripts/layer-1b3-preflight.mjs
 */

import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const dbUrl = process.env.PC_DATABASE_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('PC_DATABASE_URL / DATABASE_URL not set.');
  process.exit(1);
}

const sql = neon(dbUrl);
const section = (t) => console.log('\n\n=== ' + t + ' ===');

let blockers = 0;
let warnings = 0;

function check(label, pass, detail) {
  const mark = pass ? '✅' : '❌';
  console.log(`  ${mark} ${label}${detail ? `  —  ${detail}` : ''}`);
  if (!pass) blockers++;
}

function warn(label, detail) {
  console.log(`  ⚠️  ${label}${detail ? `  —  ${detail}` : ''}`);
  warnings++;
}

async function main() {
  section('0. Baseline row counts');
  const counts = await sql`
    SELECT 'borrowers'          AS tbl, count(*)::int AS rows FROM borrowers
    UNION ALL SELECT 'contacts',          count(*)::int FROM contacts
    UNION ALL SELECT 'staff',             count(*)::int FROM staff
    UNION ALL SELECT 'loans',             count(*)::int FROM loans
    UNION ALL SELECT 'loan_borrowers',    count(*)::int FROM loan_borrowers
    UNION ALL SELECT 'loan_contacts',     count(*)::int FROM loan_contacts
    UNION ALL SELECT 'loan_participants', count(*)::int FROM loan_participants
    UNION ALL SELECT 'scenarios',         count(*)::int FROM scenarios
    ORDER BY tbl
  `;
  console.table(counts);

  section('A. loans.borrower_id -> contact chain (GO/NO-GO)');
  const loanOrphans = await sql`
    SELECT count(*)::int AS n
    FROM loans l
    LEFT JOIN contacts c ON c.borrower_id = l.borrower_id
    WHERE l.borrower_id IS NOT NULL AND c.id IS NULL
  `;
  check(
    `Every loans.borrower_id chains to a contact via contacts.borrower_id`,
    loanOrphans[0].n === 0,
    `${loanOrphans[0].n} orphans (expected 0)`
  );

  const loanIdSummary = await sql`
    SELECT
      count(*)::int AS total_loans,
      count(borrower_id)::int AS with_borrower_id,
      count(*) FILTER (WHERE borrower_id IS NULL)::int AS null_borrower_id
    FROM loans
  `;
  console.log(`   loans: ${loanIdSummary[0].total_loans} total, ${loanIdSummary[0].with_borrower_id} with borrower_id, ${loanIdSummary[0].null_borrower_id} null`);

  section('B. Borrower coverage (GO/NO-GO)');
  const borrowerOrphans = await sql`
    SELECT count(*)::int AS n
    FROM borrowers b
    LEFT JOIN contacts c ON c.borrower_id = b.id
    WHERE c.id IS NULL
  `;
  check(
    `Every borrower has a matching contact`,
    borrowerOrphans[0].n === 0,
    `${borrowerOrphans[0].n} orphan borrowers (expected 0)`
  );

  const borrowerContactPairs = await sql`
    SELECT
      (SELECT count(*)::int FROM borrowers) AS borrower_rows,
      (SELECT count(*)::int FROM contacts WHERE borrower_id IS NOT NULL) AS contacts_with_borrower_id
  `;
  console.log(`   borrowers=${borrowerContactPairs[0].borrower_rows}, contacts with borrower_id=${borrowerContactPairs[0].contacts_with_borrower_id}`);

  // Any duplicate borrower_id mappings on contacts (unexpected)?
  const dupBorrowerRefs = await sql`
    SELECT borrower_id, count(*)::int AS n
    FROM contacts
    WHERE borrower_id IS NOT NULL
    GROUP BY borrower_id
    HAVING count(*) > 1
  `;
  check(
    `contacts.borrower_id is unique per borrower`,
    dupBorrowerRefs.length === 0,
    `${dupBorrowerRefs.length} borrowers with multiple contact rows (expected 0)`
  );

  section('C. loan_participants coverage');
  const lcCoverage = await sql`
    SELECT count(*)::int AS missing
    FROM loan_contacts lc
    WHERE lc.contact_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM loan_participants lp
        WHERE lp.loan_id = lc.loan_id AND lp.contact_id = lc.contact_id
      )
  `;
  check(
    `All loan_contacts rows represented in loan_participants`,
    lcCoverage[0].missing === 0,
    `${lcCoverage[0].missing} missing`
  );

  const lbCoverage = await sql`
    SELECT count(*)::int AS missing
    FROM loan_borrowers lb
    JOIN contacts c ON c.borrower_id = lb.borrower_id
    WHERE NOT EXISTS (
      SELECT 1 FROM loan_participants lp
      WHERE lp.loan_id = lb.loan_id AND lp.contact_id = c.id
    )
  `;
  check(
    `All loan_borrowers rows represented in loan_participants`,
    lbCoverage[0].missing === 0,
    `${lbCoverage[0].missing} missing`
  );

  const lpRoleDist = await sql`
    SELECT role, count(*)::int AS n
    FROM loan_participants
    GROUP BY role
    ORDER BY n DESC
  `;
  console.log('   loan_participants role distribution:');
  console.table(lpRoleDist);

  section('D. mlos compat view state');
  const mlosType = await sql`
    SELECT table_type
    FROM information_schema.tables
    WHERE table_name = 'mlos'
  `;
  const mlosIsView = mlosType.length === 1 && mlosType[0].table_type === 'VIEW';
  check(
    `mlos is a VIEW (compat shim from 1b2a)`,
    mlosIsView,
    mlosType.length === 0 ? 'mlos not present' : `is ${mlosType[0].table_type}`
  );

  const staffType = await sql`
    SELECT table_type
    FROM information_schema.tables
    WHERE table_name = 'staff'
  `;
  check(
    `staff is a BASE TABLE`,
    staffType.length === 1 && staffType[0].table_type === 'BASE TABLE',
    staffType.length === 0 ? 'staff not present' : `is ${staffType[0].table_type}`
  );

  section('E. Foreign keys pointing at borrowers (informational)');
  const borrowerFks = await sql`
    SELECT
      tc.table_name AS referencing_table,
      kcu.column_name AS referencing_column,
      ccu.table_name AS referenced_table,
      ccu.column_name AS referenced_column,
      tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'borrowers'
    ORDER BY tc.table_name, kcu.column_name
  `;
  console.log(`   Found ${borrowerFks.length} FK(s) referencing borrowers:`);
  if (borrowerFks.length) console.table(borrowerFks);

  // We expect these specific FKs — anything else is a surprise
  const expectedFks = new Set([
    'loans:borrower_id',
    'loan_borrowers:borrower_id',
    'contacts:borrower_id',
  ]);
  const unexpectedFks = borrowerFks.filter(f => !expectedFks.has(`${f.referencing_table}:${f.referencing_column}`));
  if (unexpectedFks.length) {
    warn(`Unexpected FKs to borrowers — migration 008 DROP TABLE CASCADE will drop them`, JSON.stringify(unexpectedFks));
  } else {
    console.log(`   ✅ All FKs to borrowers are expected (loans, loan_borrowers, contacts)`);
  }

  section('F. scenarios.contact_id population (informational)');
  const scenariosFill = await sql`
    SELECT
      count(*)::int AS total,
      count(contact_id)::int AS with_contact_id,
      count(lead_id)::int AS with_lead_id,
      count(borrower_email)::int AS with_borrower_email_string
    FROM scenarios
  `;
  console.table(scenariosFill);
  const unfillable = await sql`
    SELECT count(*)::int AS n
    FROM scenarios
    WHERE contact_id IS NULL AND (borrower_email IS NULL OR borrower_email = '') AND lead_id IS NULL
  `;
  console.log(`   scenarios with no link path: ${unfillable[0].n} (these will stay NULL — acceptable)`);

  section('G. Summary');
  console.log(`   blockers: ${blockers}`);
  console.log(`   warnings: ${warnings}`);

  if (blockers > 0) {
    console.log('\n❌ NOT SAFE TO MIGRATE — resolve blockers first.');
    process.exit(2);
  }
  console.log('\n✅ GO — database is in the expected state for migration 008.');
}

main().catch((e) => { console.error(e); process.exit(1); });
