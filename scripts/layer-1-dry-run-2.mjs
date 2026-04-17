#!/usr/bin/env node
/**
 * UAD Layer 1 — follow-up queries after option (a) confirmed
 * - Exact collision count (no LIMIT)
 * - Current loans.status distribution to confirm 'settled' usage
 * - Current loans.ball_in_court values
 * - Whether any contacts have portal_auth-like data (sanity check)
 */
import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const dbUrl = process.env.PC_DATABASE_URL || process.env.DATABASE_URL;
const sql = neon(dbUrl);
const section = (t) => console.log('\n\n=== ' + t + ' ===');

async function main() {
  section('A. Exact email collision count (same email on borrower AND contact, no FK link)');
  const collisions = await sql`
    SELECT count(*)::int AS collisions
    FROM borrowers b
    JOIN contacts c ON lower(c.email) = lower(b.email)
    WHERE c.borrower_id IS NULL OR c.borrower_id != b.id
  `;
  console.table(collisions);

  section('B. Of those collisions — are they 1:1 or do some emails have multiple matches?');
  const collisionFanout = await sql`
    WITH collision_pairs AS (
      SELECT b.id AS borrower_id, c.id AS contact_id, lower(b.email) AS email
      FROM borrowers b
      JOIN contacts c ON lower(c.email) = lower(b.email)
      WHERE c.borrower_id IS NULL OR c.borrower_id != b.id
    )
    SELECT
      count(*)::int AS total_pairs,
      count(DISTINCT email)::int AS distinct_emails,
      count(DISTINCT borrower_id)::int AS distinct_borrowers,
      count(DISTINCT contact_id)::int AS distinct_contacts
    FROM collision_pairs
  `;
  console.table(collisionFanout);

  section('C. loans.status distribution');
  const statusDist = await sql`
    SELECT status, count(*)::int AS n
    FROM loans
    GROUP BY status
    ORDER BY n DESC
  `;
  console.table(statusDist);

  section('D. loans.ball_in_court distribution');
  const ballDist = await sql`
    SELECT ball_in_court, count(*)::int AS n
    FROM loans
    GROUP BY ball_in_court
    ORDER BY n DESC
  `;
  console.table(ballDist);

  section('E. loans.purpose distribution');
  const purposeDist = await sql`
    SELECT purpose, count(*)::int AS n
    FROM loans
    GROUP BY purpose
    ORDER BY n DESC NULLS LAST
  `;
  console.table(purposeDist);

  section('F. Are there any portal-session borrowers today? (password_hash NOT NULL)');
  const portalBorrowers = await sql`
    SELECT count(*)::int AS with_password
    FROM borrowers
    WHERE password_hash IS NOT NULL AND password_hash != ''
  `;
  console.table(portalBorrowers);

  section('G. Documents — loan_id FK integrity (post-rename needs deal_id)');
  const docFkCount = await sql`SELECT count(*)::int AS total FROM documents WHERE loan_id IS NOT NULL`;
  console.table(docFkCount);

  section('H. Conditions, LoanNotes, LoanTasks, LoanDates, LoanEvents — sub-table row counts (FKs need rewrite)');
  const subTableCounts = await sql`
    SELECT 'conditions' AS tbl, count(*)::int AS n FROM conditions
    UNION ALL SELECT 'loan_notes', count(*)::int FROM loan_notes
    UNION ALL SELECT 'loan_tasks', count(*)::int FROM loan_tasks
    UNION ALL SELECT 'loan_dates', count(*)::int FROM loan_dates
    UNION ALL SELECT 'loan_events', count(*)::int FROM loan_events
  `;
  console.table(subTableCounts);

  section('I. Application-module sub-tables — row counts (all hang off loan_borrowers today)');
  const appModules = await sql`
    SELECT 'loan_employments' AS tbl, count(*)::int AS n FROM loan_employments
    UNION ALL SELECT 'loan_incomes', count(*)::int FROM loan_incomes
    UNION ALL SELECT 'loan_assets', count(*)::int FROM loan_assets
    UNION ALL SELECT 'loan_liabilities', count(*)::int FROM loan_liabilities
    UNION ALL SELECT 'loan_declarations', count(*)::int FROM loan_declarations
    UNION ALL SELECT 'loan_reo', count(*)::int FROM loan_reo
    UNION ALL SELECT 'loan_transactions', count(*)::int FROM loan_transactions
    UNION ALL SELECT 'loan_conv', count(*)::int FROM loan_conv
    UNION ALL SELECT 'loan_fha', count(*)::int FROM loan_fha
    UNION ALL SELECT 'loan_va', count(*)::int FROM loan_va
    UNION ALL SELECT 'loan_dscr', count(*)::int FROM loan_dscr
    UNION ALL SELECT 'loan_hecm', count(*)::int FROM loan_hecm
    ORDER BY n DESC
  `;
  console.table(appModules);

  console.log('\nDone.');
}

main().catch(e => { console.error(e); process.exit(1); });
