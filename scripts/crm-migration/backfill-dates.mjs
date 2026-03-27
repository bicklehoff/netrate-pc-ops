// Backfill LoanDates for imported loans
import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';

const sql = neon(process.env.PC_DATABASE_URL);

function parseDate(dateStr) {
  if (!dateStr || !dateStr.trim()) return null;
  dateStr = dateStr.trim();
  const mdyMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdyMatch) {
    const d = new Date(`${mdyMatch[3]}-${mdyMatch[1].padStart(2, '0')}-${mdyMatch[2].padStart(2, '0')}`);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  const ymdMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymdMatch) {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

const content = readFileSync('Work/Dev/crm-migration/zoho-backup/Data/Loans_001.csv', 'utf-8');
const rows = parse(content, { columns: true, skip_empty_lines: true, relax_column_count: true });
console.log(`Loaded ${rows.length} CSV rows`);

// Get loans missing dates
const loansInDb = await sql`SELECT l.id, l.loan_number FROM loans l
  WHERE l.loan_number IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM loan_dates ld WHERE ld.loan_id = l.id)`;
const loanIdByNum = new Map();
for (const l of loansInDb) loanIdByNum.set(l.loan_number, l.id);
console.log(`Loans missing dates: ${loansInDb.length}`);

// Also use "Closing Date" (Zoho's expected close = estimated_closing)
let created = 0, skipped = 0, errors = 0;
for (const row of rows) {
  const loanNum = (row['Loan Number'] || '').trim();
  if (!loanNum || !loanIdByNum.has(loanNum)) { skipped++; continue; }

  const loanId = loanIdByNum.get(loanNum);
  const appDate = parseDate(row['Application Date']);
  const fundDate = parseDate(row['Funded Date']);
  const closeDate = parseDate(row['Closed Date']); // actual close
  const estClose = parseDate(row['Closing Date']); // Zoho "Closing Date" = expected close
  const firstPmt = parseDate(row['First Payment Date']);
  const lockDate = parseDate(row['Rate Lock Date']);
  const lockExp = parseDate(row['Rate Lock Expiration']);

  if (!appDate && !fundDate && !closeDate && !firstPmt && !lockDate && !lockExp && !estClose) {
    skipped++;
    continue;
  }

  try {
    await sql`INSERT INTO loan_dates (
      id, loan_id, application_date, funding_date, closing_date,
      estimated_closing, first_payment_date, locked_date, lock_expiration,
      created_at, updated_at
    ) VALUES (
      gen_random_uuid(), ${loanId},
      ${appDate}, ${fundDate}, ${closeDate},
      ${estClose}, ${firstPmt}, ${lockDate}, ${lockExp},
      now(), now()
    )`;
    created++;
  } catch (e) {
    errors++;
    if (errors <= 3) console.error(`Error (${loanNum}): ${e.message}`);
  }
}
console.log(`LoanDates created: ${created}, skipped: ${skipped}, errors: ${errors}`);
