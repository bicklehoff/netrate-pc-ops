#!/usr/bin/env node
/**
 * UAD Layer 1 — Dry-run queries
 *
 * Read-only. Queries production Neon for data we need to finalize the
 * Layer 1 migration script (borrowers+contacts merge, loan_borrowers →
 * deal_participants extension, LoanContact fold-in).
 *
 * Also answers BP-9 (LOAN_TYPES picklist divergence).
 */

import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const dbUrl = process.env.PC_DATABASE_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('PC_DATABASE_URL / DATABASE_URL not set. Ensure .env is loaded.');
  process.exit(1);
}

const sql = neon(dbUrl);

const section = (title) => console.log('\n\n=== ' + title + ' ===');

async function main() {
  section('1. Row counts — tables affected by Layer 1');
  const counts = await sql`
    SELECT 'borrowers'       AS tbl, count(*)::int AS rows FROM borrowers
    UNION ALL SELECT 'contacts',        count(*)::int FROM contacts
    UNION ALL SELECT 'mlos',            count(*)::int FROM mlos
    UNION ALL SELECT 'loans',           count(*)::int FROM loans
    UNION ALL SELECT 'loan_borrowers',  count(*)::int FROM loan_borrowers
    UNION ALL SELECT 'loan_contacts',   count(*)::int FROM loan_contacts
    UNION ALL SELECT 'leads',           count(*)::int FROM leads
    UNION ALL SELECT 'scenarios',       count(*)::int FROM scenarios
    UNION ALL SELECT 'call_logs',       count(*)::int FROM call_logs
    UNION ALL SELECT 'sms_messages',    count(*)::int FROM sms_messages
    UNION ALL SELECT 'documents',       count(*)::int FROM documents
    UNION ALL SELECT 'contact_notes',   count(*)::int FROM contact_notes
    ORDER BY tbl
  `;
  console.table(counts);

  section('2a. Borrowers without a linked Contact (orphan borrowers)');
  const orphanBorrowers = await sql`
    SELECT count(*)::int AS orphan_borrowers
    FROM borrowers b
    LEFT JOIN contacts c ON c.borrower_id = b.id
    WHERE c.id IS NULL
  `;
  console.table(orphanBorrowers);

  section('2b. Contacts with NULL borrower_id (CRM-only contacts)');
  const orphanContacts = await sql`
    SELECT count(*)::int AS crm_only_contacts
    FROM contacts
    WHERE borrower_id IS NULL
  `;
  console.table(orphanContacts);

  section('2c. Borrower+Contact linked pairs');
  const linkedPairs = await sql`
    SELECT count(*)::int AS linked_pairs
    FROM contacts c
    JOIN borrowers b ON b.id = c.borrower_id
  `;
  console.table(linkedPairs);

  section('2d. Email collisions — same email on both borrower AND contact with no FK link');
  const emailCollisions = await sql`
    SELECT b.email, b.id AS borrower_id, c.id AS contact_id
    FROM borrowers b
    JOIN contacts c ON lower(c.email) = lower(b.email)
    WHERE c.borrower_id IS NULL OR c.borrower_id != b.id
    LIMIT 50
  `;
  console.log('Collisions found:', emailCollisions.length);
  if (emailCollisions.length > 0 && emailCollisions.length <= 20) {
    console.table(emailCollisions);
  }

  section('2e. Duplicate emails WITHIN borrowers (should be 0 — email is UNIQUE)');
  const dupBorrowerEmails = await sql`
    SELECT email, count(*)::int AS n
    FROM borrowers
    GROUP BY email
    HAVING count(*) > 1
  `;
  console.log('Duplicates:', dupBorrowerEmails.length);
  if (dupBorrowerEmails.length > 0) console.table(dupBorrowerEmails);

  section('2f. Duplicate emails WITHIN contacts (per organization)');
  const dupContactEmails = await sql`
    SELECT lower(email) AS email, organization_id, count(*)::int AS n
    FROM contacts
    WHERE email IS NOT NULL AND email != ''
    GROUP BY lower(email), organization_id
    HAVING count(*) > 1
  `;
  console.log('Duplicates:', dupContactEmails.length);
  if (dupContactEmails.length > 0) console.table(dupContactEmails);

  section('3. LoanContact sample (to confirm "hardly any data" + see what roles exist)');
  const loanContactSample = await sql`
    SELECT id, loan_id, contact_id, role, created_at
    FROM loan_contacts
    ORDER BY created_at DESC NULLS LAST
    LIMIT 20
  `;
  console.table(loanContactSample);

  section('3b. LoanContact role distribution');
  const loanContactRoles = await sql`
    SELECT role, count(*)::int AS n
    FROM loan_contacts
    GROUP BY role
    ORDER BY n DESC
  `;
  console.table(loanContactRoles);

  section('4. BP-9 — LOAN_TYPES divergence between DB and UI');
  const loanTypesInScenarios = await sql`
    SELECT DISTINCT loan_type, count(*)::int AS n
    FROM scenarios
    WHERE loan_type IS NOT NULL
    GROUP BY loan_type
    ORDER BY n DESC
  `;
  console.log('loan_types in scenarios:');
  console.table(loanTypesInScenarios);

  const loanTypesInRateProducts = await sql`
    SELECT DISTINCT loan_type, count(*)::int AS n
    FROM rate_products
    WHERE loan_type IS NOT NULL
    GROUP BY loan_type
    ORDER BY n DESC
  `;
  console.log('loan_types in rate_products:');
  console.table(loanTypesInRateProducts);

  section('5. Mlo table — how many staff rows, are emails unique, what roles exist');
  const mloSummary = await sql`
    SELECT
      count(*)::int AS total,
      count(DISTINCT email)::int AS distinct_emails,
      count(DISTINCT role)::int AS distinct_roles
    FROM mlos
  `;
  console.table(mloSummary);
  const mloRoles = await sql`SELECT role, count(*)::int AS n FROM mlos GROUP BY role`;
  console.table(mloRoles);

  section('6. Loans with linked borrower — are all loans.borrower_id pointing to valid rows?');
  const loansOrphans = await sql`
    SELECT count(*)::int AS loans_with_bad_borrower_fk
    FROM loans l
    LEFT JOIN borrowers b ON b.id = l.borrower_id
    WHERE b.id IS NULL
  `;
  console.table(loansOrphans);

  section('7. Scenarios contact_id population rate');
  const scenariosContactId = await sql`
    SELECT
      count(*)::int AS total,
      count(contact_id)::int AS with_contact_id,
      count(borrower_email)::int AS with_borrower_email_string,
      count(lead_id)::int AS with_lead_id
    FROM scenarios
  `;
  console.table(scenariosContactId);

  console.log('\n\nDone. All read-only.');
}

main().catch((e) => { console.error(e); process.exit(1); });
