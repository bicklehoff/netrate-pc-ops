// CRM Loan Import: Zoho Loans CSV → Loan records in DB
// Run: node --env-file=.env scripts/crm-migration/import-loans.mjs [--commit]
//
// Creates actual Loan records from Zoho Loans CSV data.
// Matches borrowers by email, resolves MLOs by NMLS.
// Deduplicates by loan number — skips if loan already exists.

import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { createCipheriv, randomBytes } from 'crypto';

// Simple AES-256-GCM encrypt for placeholder PII fields
function encryptPii(plaintext) {
  const key = Buffer.from(process.env.PII_ENCRYPTION_KEY, 'hex');
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${encrypted.toString('base64')}:${tag.toString('base64')}`;
}

const COMMIT = process.argv.includes('--commit');
const sql = neon(process.env.PC_DATABASE_URL || process.env.DATABASE_URL);

// ─── MLO Mapping ────────────────────────────────────────────────────

const NMLS_MAP = {
  '180707': 'Jamie Cunningham',
  '641790': 'David Burson',
  '649445': 'David Burson', // Jerry Cusick → David
};

const MLO_NAME_MAP = {
  'jamie cunningham': '180707',
  'david burson': '641790',
  'david s burson': '641790',
  'jerry cusick': '641790',
  'gerald cusick': '641790',
  'michael cusick': '641790',
  'mike cusick': '641790',
  'pearl francisco': '641790',
  'jay norvell': '641790',
  'jay norwood': '641790',
};

const DEFAULT_NMLS = '641790'; // David

function resolveNmls(loName, nmls) {
  if (nmls && NMLS_MAP[nmls]) return nmls;
  if (loName) {
    const key = loName.toLowerCase().trim();
    if (MLO_NAME_MAP[key]) return MLO_NAME_MAP[key];
  }
  return DEFAULT_NMLS;
}

// ─── Stage → Status Mapping ─────────────────────────────────────────

const STAGE_STATUS = {
  'final disposition': 'funded',
  'funded': 'funded',
  'payment sent': 'funded',
  'paid': 'funded',
  'clear to close': 'clear_to_close',
  'processing': 'processing',
  'application': 'application',
  'web application': 'application',
  'prospect': 'draft',
  'back to lead': 'draft',
  'withdrawn': 'withdrawn',
  'closed incomplete': 'withdrawn',
};

// ─── Property Type Mapping ──────────────────────────────────────────

function mapPropertyType(subPropType) {
  if (!subPropType) return null;
  const lower = subPropType.toLowerCase();
  if (lower.includes('condo')) return 'condo';
  if (lower.includes('townhouse') || lower.includes('town')) return 'townhouse';
  if (lower.includes('multi') || lower.includes('2-4') || lower.includes('duplex') || lower.includes('triplex')) return 'multi_unit';
  if (lower.includes('manufactured') || lower.includes('mobile')) return 'manufactured';
  if (lower.includes('pud')) return 'pud';
  return 'single_family';
}

// ─── Loan Type Mapping ──────────────────────────────────────────────

function mapLoanType(mortgageType, amortType) {
  const mt = (mortgageType || '').toLowerCase();
  if (mt.includes('fha')) return 'fha';
  if (mt.includes('va')) return 'va';
  if (mt.includes('usda')) return 'usda';
  // Check amortization type for ARM vs fixed
  const at = (amortType || '').toLowerCase();
  if (at.includes('arm') || at.includes('adjustable')) return 'conventional'; // still conventional, just ARM
  return 'conventional';
}

// ─── Purpose Mapping ────────────────────────────────────────────────

function mapPurpose(loanPurpose) {
  if (!loanPurpose) return null;
  const lower = loanPurpose.toLowerCase();
  if (lower.includes('purchase')) return 'purchase';
  if (lower.includes('cash') || lower.includes('cashout')) return 'cash_out';
  if (lower.includes('refi') || lower.includes('refinance')) return 'refinance';
  if (lower.includes('heloc')) return 'heloc';
  if (lower.includes('reverse') || lower.includes('hecm')) return 'hecm';
  return 'refinance'; // default for non-purchase
}

// ─── Occupancy Mapping ──────────────────────────────────────────────

function mapOccupancy(occ) {
  if (!occ) return null;
  const lower = occ.toLowerCase();
  if (lower.includes('primary') || lower.includes('owner')) return 'primary';
  if (lower.includes('second') || lower.includes('vacation')) return 'secondary';
  if (lower.includes('invest') || lower.includes('rental')) return 'investment';
  return 'primary';
}

// ─── Normalizers ────────────────────────────────────────────────────

function normalizeEmail(email) {
  if (!email) return null;
  const cleaned = email.trim().toLowerCase();
  if (!cleaned) return null;
  if (/^(test|noemail|none|na|no|fake|x+|unknown|info|admin)@/i.test(cleaned)) return null;
  if (cleaned.includes('example.com') || cleaned.includes('placeholder')) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) return null;
  return cleaned;
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  // Try MM/DD/YYYY
  const mdyMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdyMatch) {
    const d = new Date(`${mdyMatch[3]}-${mdyMatch[1].padStart(2, '0')}-${mdyMatch[2].padStart(2, '0')}`);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  // Try YYYY-MM-DD (with optional time)
  const ymdMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymdMatch) {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

function parseMoney(val) {
  if (!val) return null;
  const num = parseFloat(String(val).replace(/[$,]/g, ''));
  return isNaN(num) || num === 0 ? null : num;
}

function titleCase(str) {
  if (!str) return null;
  return str.trim().replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.substr(1).toLowerCase());
}

function normalizePhone(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (/^(\d)\1+$/.test(digits)) return null;
  return digits.length >= 10 ? `+1${digits.slice(-10)}` : null;
}

// ─── Test record detection ──────────────────────────────────────────

const TEST_EMAILS = new Set([
  'david@cmglending.com', 'david@locusprocessing.com', 'bursony@gmail.com',
  'maryfreddie@gmail.com', 'freddie@gmail.com',
  'amy.a@fanniemae.com', 'andy.a@fanniemae.com',
]);

function isTestRecord(email, name) {
  if (email && TEST_EMAILS.has(email)) return true;
  const nameLower = (name || '').toLowerCase();
  if (/test|freddie|fannie/.test(nameLower)) return true;
  return false;
}

// ─── Main ───────────────────────────────────────────────────────────

async function run() {
  console.log(`\n=== Zoho Loan Import ${COMMIT ? '(COMMIT)' : '(DRY RUN)'} ===\n`);

  // Load CSV
  const csvPath = 'Work/Dev/crm-migration/zoho-backup/Data/Loans_001.csv';
  const content = readFileSync(csvPath, 'utf-8');
  const rows = parse(content, { columns: true, skip_empty_lines: true, relax_column_count: true });
  console.log(`Loaded ${rows.length} loan rows from CSV`);

  // Get MLO IDs from DB
  const mlos = await sql`SELECT id, nmls, first_name, last_name FROM mlos`;
  const mloIdByNmls = new Map();
  for (const m of mlos) { if (m.nmls) mloIdByNmls.set(m.nmls, m.id); }
  console.log(`MLOs in DB: ${mlos.map(m => `${m.first_name} ${m.last_name} (${m.nmls})`).join(', ')}`);

  // Get existing borrowers by email for matching
  const borrowers = await sql`SELECT id, email, first_name, last_name FROM borrowers WHERE email IS NOT NULL`;
  const borrowerByEmail = new Map();
  for (const b of borrowers) { borrowerByEmail.set(b.email.toLowerCase().trim(), b); }
  console.log(`Existing borrowers: ${borrowers.length}`);

  // Get existing loan numbers for dedup
  const existingLoans = await sql`SELECT loan_number FROM loans WHERE loan_number IS NOT NULL`;
  const existingLoanNums = new Set(existingLoans.map(l => l.loan_number));
  console.log(`Existing loans (for dedup): ${existingLoanNums.size}`);

  // Process loans
  const stats = {
    imported: 0, skippedDup: 0, skippedTest: 0, skippedNoEmail: 0,
    borrowerCreated: 0, borrowerMatched: 0, borrowerNoMatch: 0,
    datesCreated: 0, coBorrowerCreated: 0, errors: 0,
    byMlo: {}, byStatus: {}, byPurpose: {},
  };
  const loans = [];

  for (const row of rows) {
    const email = normalizeEmail(row['Email']);
    const loanNum = (row['Loan Number'] || '').trim();
    const name = (row['Loan Name'] || `${row['First Name'] || ''} ${row['Last Name'] || ''}`).trim();

    // Skip test records
    if (isTestRecord(email, name)) { stats.skippedTest++; continue; }

    // Skip no email (can't match to borrower)
    if (!email) { stats.skippedNoEmail++; continue; }

    // Skip duplicates (already in DB by loan number)
    if (loanNum && existingLoanNums.has(loanNum)) { stats.skippedDup++; continue; }

    // Resolve MLO
    const nmls = resolveNmls(row['Loan Officer'], row['LO NMLS']);
    const mloId = mloIdByNmls.get(nmls) || null;
    const mloName = NMLS_MAP[nmls] || 'David Burson';

    // Map status from stage
    const stage = (row['Stage'] || '').toLowerCase();
    const status = STAGE_STATUS[stage] || 'draft';

    // Map fields
    const purpose = mapPurpose(row['Loan Purpose']);
    const loanType = mapLoanType(row['Mortgage Type'], row['Amortization Type']);
    const propertyType = mapPropertyType(row['Sub Prop Type']);
    const occupancy = mapOccupancy(row['Occupancy']);

    // Property address
    const propertyAddress = (row['Subject Street'] || row['Full Address']) ? {
      street: row['Subject Street'] || null,
      city: row['Subject City'] || null,
      state: row['Subject State'] || null,
      zip: row['Subject ZIP'] || null,
      county: row['Subject County'] || null,
    } : null;

    // Dates
    const dates = {
      applicationDate: parseDate(row['Application Date']),
      fundingDate: parseDate(row['Funded Date']),
      closingDate: parseDate(row['Closed Date']),
      firstPaymentDate: parseDate(row['First Payment Date']),
      rateLockDate: parseDate(row['Rate Lock Date']),
      rateLockExpiration: parseDate(row['Rate Lock Expiration']),
    };

    // Co-borrower
    const hasCoB = row['B2 First Name'] || row['B2 Last Name'] || row['B2 Email'];

    const loan = {
      email,
      loanNumber: loanNum || null,
      loanAmount: parseMoney(row['Loan Amount']),
      interestRate: parseFloat(row['Interest Rate']) || null,
      purchasePrice: parseMoney(row['Purchase Price']),
      downPayment: parseMoney(row['Down Payment']),
      estimatedValue: parseMoney(row['Appraised Value']),
      lenderName: row['Lender'] || null,
      purpose,
      occupancy,
      propertyType,
      loanType,
      loanTerm: parseInt(row['Amortization Term']) || null,
      numUnits: parseInt(row['Number of Units']) || null,
      creditScore: parseInt(row['Loan Fico']) || null,
      numBorrowers: parseInt(row['Borrower Count']) || 1,
      ldoxLoanId: row['LendingDox ID'] || null,
      leadSource: row['Lead Source'] || null,
      refiPurpose: row['Refinance Purpose Type'] || null,
      cashOutAmount: parseMoney(row['Refinance CashOut Amount']),
      employmentStatus: row['Employment Status'] || null,
      monthlyBaseIncome: parseMoney(row['B1 Monthly Income']),
      propertyAddress,
      status,
      mloId,
      mloName,
      nmls,
      dates,
      // Co-borrower info
      coB: hasCoB ? {
        firstName: titleCase(row['B2 First Name']),
        lastName: titleCase(row['B2 Last Name']),
        email: normalizeEmail(row['B2 Email']),
        phone: normalizePhone(row['B2 Phone'] || row['B2 Cell']),
        dob: parseDate(row['B2 DOB']),
      } : null,
      // For borrower matching
      firstName: titleCase(row['First Name']),
      lastName: titleCase(row['Last Name']),
      phone: normalizePhone(row['Phone'] || row['B1 Cell']),
      dob: parseDate(row['B1 DOB']),
      // Zoho metadata
      zohoRecordId: row['Record Id'],
      createdAt: parseDate(row['Loan Created At'] || row['Created Time']),
    };

    // Track stats
    stats.byMlo[mloName] = (stats.byMlo[mloName] || 0) + 1;
    stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
    stats.byPurpose[purpose || 'unknown'] = (stats.byPurpose[purpose || 'unknown'] || 0) + 1;

    // Track dedup
    if (loanNum) existingLoanNums.add(loanNum);

    loans.push(loan);
  }

  // ─── Report ─────────────────────────────────────────────────────
  console.log(`\n${'='.repeat(50)}`);
  console.log(`  LOAN IMPORT REPORT`);
  console.log(`${'='.repeat(50)}`);
  console.log(`\nTotal to import: ${loans.length}`);
  console.log(`Skipped: ${stats.skippedDup} duplicates, ${stats.skippedTest} test, ${stats.skippedNoEmail} no email`);
  console.log(`\nBy MLO:`);
  for (const [name, cnt] of Object.entries(stats.byMlo).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${name}: ${cnt}`);
  }
  console.log(`\nBy Status:`);
  for (const [s, cnt] of Object.entries(stats.byStatus).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${s}: ${cnt}`);
  }
  console.log(`\nBy Purpose:`);
  for (const [p, cnt] of Object.entries(stats.byPurpose).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${p}: ${cnt}`);
  }

  if (!COMMIT) {
    console.log(`\n*** DRY RUN — no changes made. Pass --commit to execute. ***\n`);
    return;
  }

  // ─── COMMIT: Create Loan Records ─────────────────────────────────
  console.log('\n=== Creating loan records ===');

  for (const loan of loans) {
    try {
      // 1. Find or create borrower
      let borrowerId;
      const existingBorrower = borrowerByEmail.get(loan.email);

      if (existingBorrower) {
        borrowerId = existingBorrower.id;
        stats.borrowerMatched++;
      } else {
        // Create new borrower — DOB/SSN are NOT NULL encrypted columns
        const placeholderDob = encryptPii('N/A');
        const placeholderSsn = encryptPii('N/A');
        const result = await sql`INSERT INTO borrowers (
          id, first_name, last_name, email, phone,
          dob_encrypted, ssn_encrypted, ssn_last_four,
          created_at, updated_at
        ) VALUES (
          gen_random_uuid(),
          ${loan.firstName || 'Unknown'}, ${loan.lastName || 'Unknown'},
          ${loan.email}, ${loan.phone},
          ${placeholderDob}, ${placeholderSsn}, '0000',
          ${loan.createdAt || new Date().toISOString()}, now()
        ) RETURNING id`;
        borrowerId = result[0].id;
        // Add to map for future dedup within this import
        borrowerByEmail.set(loan.email, { id: borrowerId, email: loan.email });
        stats.borrowerCreated++;
      }

      // 2. Create loan
      const loanResult = await sql`INSERT INTO loans (
        id, borrower_id, mlo_id, status, purpose, occupancy, property_type,
        property_address, num_units, purchase_price, down_payment, estimated_value,
        loan_type, lender_name, loan_number, loan_amount, interest_rate, loan_term,
        credit_score, num_borrowers, ldox_loan_id, lead_source,
        refi_purpose, cash_out_amount, employment_status, monthly_base_income,
        created_at, updated_at
      ) VALUES (
        gen_random_uuid(), ${borrowerId}, ${loan.mloId},
        ${loan.status}, ${loan.purpose}, ${loan.occupancy}, ${loan.propertyType},
        ${loan.propertyAddress ? JSON.stringify(loan.propertyAddress) : null},
        ${loan.numUnits}, ${loan.purchasePrice}, ${loan.downPayment}, ${loan.estimatedValue},
        ${loan.loanType}, ${loan.lenderName}, ${loan.loanNumber},
        ${loan.loanAmount}, ${loan.interestRate}, ${loan.loanTerm},
        ${loan.creditScore}, ${loan.numBorrowers}, ${loan.ldoxLoanId}, ${loan.leadSource},
        ${loan.refiPurpose}, ${loan.cashOutAmount},
        ${loan.employmentStatus}, ${loan.monthlyBaseIncome},
        ${loan.createdAt || new Date().toISOString()}, now()
      ) RETURNING id`;
      const loanId = loanResult[0].id;

      // 3. Create LoanDates if any dates exist
      const d = loan.dates;
      const hasDates = Object.values(d).some(v => v !== null);
      if (hasDates) {
        await sql`INSERT INTO loan_dates (
          id, loan_id, application_date, funding_date, closing_date,
          first_payment_date, locked_date, lock_expiration
        ) VALUES (
          gen_random_uuid(), ${loanId},
          ${d.applicationDate}, ${d.fundingDate}, ${d.closingDate},
          ${d.firstPaymentDate}, ${d.rateLockDate}, ${d.rateLockExpiration}
        )`;
        stats.datesCreated++;
      }

      // 4. Create co-borrower LoanBorrower junction if B2 exists
      if (loan.coB) {
        // Find or create co-borrower
        let coBorrowerId;
        if (loan.coB.email) {
          const existingCoB = borrowerByEmail.get(loan.coB.email);
          if (existingCoB) {
            coBorrowerId = existingCoB.id;
          } else {
            const cobDob = encryptPii('N/A');
            const cobSsn = encryptPii('N/A');
            const cobResult = await sql`INSERT INTO borrowers (
              id, first_name, last_name, email, phone,
              dob_encrypted, ssn_encrypted, ssn_last_four,
              created_at, updated_at
            ) VALUES (
              gen_random_uuid(),
              ${loan.coB.firstName || 'Unknown'}, ${loan.coB.lastName || 'Unknown'},
              ${loan.coB.email}, ${loan.coB.phone},
              ${cobDob}, ${cobSsn}, '0000',
              ${loan.createdAt || new Date().toISOString()}, now()
            ) RETURNING id`;
            coBorrowerId = cobResult[0].id;
            borrowerByEmail.set(loan.coB.email, { id: coBorrowerId, email: loan.coB.email });
          }
        } else if (loan.coB.firstName) {
          // No email — create borrower without email
          const cobDob2 = encryptPii('N/A');
          const cobSsn2 = encryptPii('N/A');
          const cobResult = await sql`INSERT INTO borrowers (
            id, first_name, last_name, phone,
            dob_encrypted, ssn_encrypted, ssn_last_four,
            created_at, updated_at
          ) VALUES (
            gen_random_uuid(),
            ${loan.coB.firstName || 'Unknown'}, ${loan.coB.lastName || 'Unknown'},
            ${loan.coB.phone},
            ${cobDob2}, ${cobSsn2}, '0000',
            ${loan.createdAt || new Date().toISOString()}, now()
          ) RETURNING id`;
          coBorrowerId = cobResult[0].id;
        }

        if (coBorrowerId) {
          try {
            await sql`INSERT INTO loan_borrowers (
              id, loan_id, borrower_id, borrower_type, ordinal
            ) VALUES (
              gen_random_uuid(), ${loanId}, ${coBorrowerId}, 'coborrower', 2
            )`;
            stats.coBorrowerCreated++;
          } catch (e) {
            // Duplicate — skip
          }
        }
      }

      stats.imported++;
      if (stats.imported % 100 === 0) {
        console.log(`  ... ${stats.imported} loans imported`);
      }
    } catch (e) {
      stats.errors++;
      if (stats.errors <= 10) {
        console.error(`  Error (${loan.email}, ${loan.loanNumber}): ${e.message}`);
      }
    }
  }

  // ─── Verification ───────────────────────────────────────────────
  console.log(`\n${'='.repeat(50)}`);
  console.log(`  IMPORT RESULTS`);
  console.log(`${'='.repeat(50)}`);
  console.log(`Loans imported: ${stats.imported}`);
  console.log(`Borrowers matched: ${stats.borrowerMatched}`);
  console.log(`Borrowers created: ${stats.borrowerCreated}`);
  console.log(`LoanDates created: ${stats.datesCreated}`);
  console.log(`Co-borrowers linked: ${stats.coBorrowerCreated}`);
  console.log(`Errors: ${stats.errors}`);

  // Verify totals
  const totalLoans = await sql`SELECT COUNT(*) as c FROM loans`;
  const loansByMlo = await sql`SELECT m.first_name || ' ' || m.last_name as name, COUNT(l.id) as c
    FROM loans l LEFT JOIN mlos m ON l.mlo_id = m.id
    GROUP BY m.first_name, m.last_name ORDER BY c DESC`;
  const loansByStatus = await sql`SELECT status, COUNT(*) as c FROM loans GROUP BY status ORDER BY c DESC`;

  console.log(`\nTotal loans in DB: ${totalLoans[0].c}`);
  console.log('\nLoans by MLO:');
  for (const r of loansByMlo) console.log(`  ${r.name || 'UNASSIGNED'}: ${r.c}`);
  console.log('\nLoans by Status:');
  for (const r of loansByStatus) console.log(`  ${r.status}: ${r.c}`);

  console.log('\nLoan import complete!');
}

run().catch((e) => { console.error(e); process.exit(1); });
