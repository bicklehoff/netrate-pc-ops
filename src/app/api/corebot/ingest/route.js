// Corebot Ingest — Zoho Flow → Core
// Receives loan data from Zoho Flow (LDox origin), upserts into Core DB.
// Auth: X-Corebot-Key header matched against COREBOT_API_KEY env var.
//
// Flow: LDox → Zoho Flow (proxy) → POST /api/corebot/ingest → Core DB
//
// Merge logic: Match by ldoxLoanId first, then loanNumber, then create new.
// Borrowers matched by email, created if new (with PII encryption).

import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { encrypt } from '@/lib/encryption';
import { enrichPropertyAddress } from '@/lib/geocode';

// ─── Status Mapping: LDox → Core ────────────────────────────
// Core statuses were modeled after LDox lifecycle.

const STATUS_MAP = {
  'Prospect':              'prospect',
  'Web Application':       'prospect',
  'Prequalification':      'prospect',
  'Application':           'applied',
  'Processing':            'processing',
  'Submitted':             'submitted_uw',
  'UW Submitted':          'submitted_uw',
  'UW Suspended':          'suspended',
  'Conditional Approval':  'cond_approved',
  'Cond. Approved':        'cond_approved',
  'UW Approved':           'cond_approved',
  'Suspended':             'suspended',
  'Clear to Close':        'ctc',
  'Clear To Close':        'ctc',
  'Closing Docs Sent':     'docs_out',
  'Docs Out':              'docs_out',
  'Closing Scheduled':     'ctc',
  'Closed':                'ctc',
  'Wire Requested':        'ctc',
  'Funded':                'funded',
  'Final Disposition':     'settled',
  'Servicing':             'settled',
  'Denied':                'denied',
  'Withdrawn':             'withdrawn',
  'Closed Incomplete':     'withdrawn',
};

// Ball-in-court derived from status
const BALL_IN_COURT = {
  prospect: 'borrower',
  applied: 'mlo',
  processing: 'mlo',
  submitted_uw: 'lender',
  cond_approved: 'mlo',
  suspended: 'mlo',
  ctc: 'mlo',
  docs_out: 'lender',
  funded: 'mlo',
  settled: 'none',
  denied: 'none',
  withdrawn: 'none',
};

// ─── Helpers ─────────────────────────────────────────────────

function normalizeStatus(ldoxStatus) {
  if (!ldoxStatus) return 'prospect';
  return STATUS_MAP[ldoxStatus] || 'prospect';
}

function parseDate(val) {
  if (!val || val === '') return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function normalizePhone(phone) {
  if (!phone) return null;
  return phone.replace(/\D/g, '').replace(/^1/, '').replace(/^(\d{3})(\d{3})(\d{4})$/, '($1) $2-$3');
}

function normalizeAddress(addr) {
  if (!addr) return null;
  return {
    street: addr.street || '',
    city: addr.city || '',
    state: addr.state || '',
    zipCode: String(addr.zipCode || ''),
  };
}

// ─── Auth ────────────────────────────────────────────────────

function authenticate(request) {
  const key = request.headers.get('x-corebot-key') || request.headers.get('X-Corebot-Key');
  const expected = process.env.COREBOT_API_KEY;
  if (!expected) {
    console.error('COREBOT_API_KEY not configured');
    return false;
  }
  return key === expected;
}

// ─── Process Single Loan ─────────────────────────────────────

async function processLoan(loanData) {
  const ldoxLoanId = loanData.loanId || null;
  const loanNumber = loanData.loanNumber ? String(loanData.loanNumber) : null;
  const borrowerData = loanData.borrower;
  const coreStatus = normalizeStatus(loanData.loanStatus?.name);
  const ballInCourt = BALL_IN_COURT[coreStatus] || 'mlo';

  // ── 1. Match or create borrower ──────────────────────────
  let borrower = null;
  if (borrowerData?.contacts?.email) {
    const borrowerRows = await sql`
      SELECT * FROM "Borrower"
      WHERE email = ${borrowerData.contacts.email.toLowerCase()}
      LIMIT 1
    `;
    borrower = borrowerRows[0] || null;
  }

  if (!borrower && borrowerData) {
    const email = borrowerData.contacts?.email?.toLowerCase();
    if (!email) {
      throw new Error(`Loan ${loanNumber}: Borrower has no email — cannot create`);
    }

    // Encrypt PII
    const ssnRaw = borrowerData.ssn ? String(borrowerData.ssn) : null;
    const dobRaw = borrowerData.birthDate || null;

    // Pad SSN to 9 digits (LDox sends as integer, leading zeros stripped)
    const ssnPadded = ssnRaw ? ssnRaw.padStart(9, '0') : null;

    const rows = await sql`
      INSERT INTO "Borrower" (email, first_name, last_name, phone, ssn_encrypted, dob_encrypted, ssn_last_four)
      VALUES (
        ${email},
        ${borrowerData.firstName || 'Unknown'},
        ${borrowerData.lastName || 'Unknown'},
        ${normalizePhone(borrowerData.contacts?.mobilePhone || borrowerData.contacts?.homePhone)},
        ${ssnPadded ? encrypt(ssnPadded) : encrypt('000000000')},
        ${dobRaw ? encrypt(dobRaw) : encrypt('1900-01-01')},
        ${ssnPadded ? ssnPadded.slice(-4) : '0000'}
      )
      RETURNING *
    `;
    borrower = rows[0];
  }

  if (!borrower) {
    throw new Error(`Loan ${loanNumber}: Could not match or create borrower`);
  }

  // ── 2. Match MLO by ldoxOfficerId, then NMLS fallback ───
  let mloId = null;
  if (loanData.loanOfficer) {
    const loValue = String(loanData.loanOfficer);
    // Try ldoxOfficerId first (integer)
    const loInt = parseInt(loValue, 10);
    if (!isNaN(loInt)) {
      const mloByLdox = await sql`
        SELECT id FROM "Mlo" WHERE ldox_officer_id = ${loInt} LIMIT 1
      `;
      if (mloByLdox[0]) mloId = mloByLdox[0].id;
    }
    if (!mloId) {
      // Fallback: match by NMLS
      const mloByNmls = await sql`
        SELECT id FROM "Mlo" WHERE nmls = ${loValue} LIMIT 1
      `;
      if (mloByNmls[0]) mloId = mloByNmls[0].id;
    }
  }
  // Also check explicit loanOfficerNmls field
  if (!mloId && loanData.loanOfficerNmls) {
    const mloRows = await sql`
      SELECT id FROM "Mlo" WHERE nmls = ${String(loanData.loanOfficerNmls)} LIMIT 1
    `;
    if (mloRows[0]) mloId = mloRows[0].id;
  }

  // ── 3. Build loan field values ────────────────────────────
  const loanAmount = loanData.loanAmount ? parseFloat(loanData.loanAmount) : null;
  const interestRate = loanData.noteRate ? parseFloat(loanData.noteRate) : null;
  const loanTerm = loanData.term ? parseInt(loanData.term, 10) : null;
  const purpose = loanData.purpose?.name?.toLowerCase() || null;
  const occupancy = loanData.occupancy?.name?.toLowerCase() || null;
  const loanType = loanData.loanType?.name?.toLowerCase() || null;
  const lenderName = loanData.lender || null;
  const purchasePrice = loanData.purchasePrice ? parseFloat(loanData.purchasePrice) : null;
  const estimatedValue = loanData.appraisalValue ? parseFloat(loanData.appraisalValue) : null;
  const numUnits = loanData.units ? parseInt(loanData.units, 10) : null;
  const propertyType = loanData.propertyType?.name || null;
  const propertyAddress = normalizeAddress(loanData.subjectPropertyAddress);
  const currentAddress = normalizeAddress(borrowerData?.currentAddress);
  const creditScore = loanData.creditScore ? parseInt(loanData.creditScore, 10) : null;

  // ── 4. Upsert loan ──────────────────────────────────────
  let loan;
  let isNew = false;

  // Try match by ldoxLoanId first
  if (ldoxLoanId) {
    const rows = await sql`
      SELECT * FROM "Loan" WHERE ldox_loan_id = ${ldoxLoanId} LIMIT 1
    `;
    loan = rows[0] || null;
  }

  // Fallback: match by loanNumber + borrower
  if (!loan && loanNumber) {
    const rows = await sql`
      SELECT * FROM "Loan"
      WHERE loan_number = ${loanNumber} AND borrower_id = ${borrower.id}
      LIMIT 1
    `;
    loan = rows[0] || null;
  }

  if (loan) {
    // Update existing
    const oldStatus = loan.status;
    const updatedRows = await sql`
      UPDATE "Loan" SET
        borrower_id = ${borrower.id},
        mlo_id = ${mloId},
        status = ${coreStatus},
        ball_in_court = ${ballInCourt},
        ldox_loan_id = ${ldoxLoanId},
        loan_number = ${loanNumber},
        loan_amount = ${loanAmount},
        interest_rate = ${interestRate},
        loan_term = ${loanTerm},
        purpose = ${purpose},
        occupancy = ${occupancy},
        loan_type = ${loanType},
        lender_name = ${lenderName},
        purchase_price = ${purchasePrice},
        estimated_value = ${estimatedValue},
        num_units = ${numUnits},
        property_type = ${propertyType},
        property_address = ${propertyAddress ? JSON.stringify(propertyAddress) : null}::jsonb,
        current_address = ${currentAddress ? JSON.stringify(currentAddress) : null}::jsonb,
        credit_score = ${creditScore},
        updated_at = NOW()
      WHERE id = ${loan.id}
      RETURNING *
    `;
    loan = updatedRows[0];

    // Log status change if it changed
    if (oldStatus !== coreStatus) {
      await sql`
        INSERT INTO "LoanEvent" (loan_id, event_type, actor_type, old_value, new_value, details)
        VALUES (
          ${loan.id},
          'status_change',
          'system',
          ${oldStatus},
          ${coreStatus},
          ${JSON.stringify({ source: 'corebot', ldoxStatus: loanData.loanStatus?.name })}::jsonb
        )
      `;
    }
  } else {
    // Create new
    isNew = true;
    const applicationStep = coreStatus === 'prospect' ? 1 : 6;
    const submittedAt = coreStatus !== 'prospect' ? new Date() : null;
    const rows = await sql`
      INSERT INTO "Loan" (
        borrower_id, mlo_id, status, ball_in_court, ldox_loan_id, loan_number,
        loan_amount, interest_rate, loan_term, purpose, occupancy, loan_type,
        lender_name, purchase_price, estimated_value, num_units, property_type,
        property_address, current_address, credit_score, application_step, submitted_at
      ) VALUES (
        ${borrower.id}, ${mloId}, ${coreStatus}, ${ballInCourt}, ${ldoxLoanId}, ${loanNumber},
        ${loanAmount}, ${interestRate}, ${loanTerm}, ${purpose}, ${occupancy}, ${loanType},
        ${lenderName}, ${purchasePrice}, ${estimatedValue}, ${numUnits}, ${propertyType},
        ${propertyAddress ? JSON.stringify(propertyAddress) : null}::jsonb,
        ${currentAddress ? JSON.stringify(currentAddress) : null}::jsonb,
        ${creditScore}, ${applicationStep}, ${submittedAt}
      )
      RETURNING *
    `;
    loan = rows[0];
  }

  // Log import event
  await sql`
    INSERT INTO "LoanEvent" (loan_id, event_type, actor_type, details)
    VALUES (
      ${loan.id},
      'field_updated',
      'system',
      ${JSON.stringify({
        source: 'corebot',
        action: isNew ? 'created' : 'updated',
        ldoxLoanId,
        loanNumber,
      })}::jsonb
    )
  `;

  // ── 5. Upsert dates ─────────────────────────────────────
  if (loanData.dates) {
    const d = loanData.dates;
    const applicationDate = parseDate(d.applicationTaken);
    const lockedDate = parseDate(d.rateLocked);
    const lockExpiration = parseDate(d.lockExpiration);
    const estimatedClosing = parseDate(d.estimatedClosing);
    const closingDate = parseDate(d.closed);
    const fundingDate = parseDate(d.funded);
    const firstPaymentDate = parseDate(d.firstPaymentDate);
    const estimatedFunding = parseDate(d.fundingEstimate);
    const appraisalOrdered = parseDate(d.brokersRequestForAppraisal);

    // Only upsert if at least one date is non-null
    const hasAnyDate = [applicationDate, lockedDate, lockExpiration, estimatedClosing, closingDate, fundingDate, firstPaymentDate, estimatedFunding, appraisalOrdered].some((v) => v !== null);
    if (hasAnyDate) {
      await sql`
        INSERT INTO "LoanDates" (
          loan_id, application_date, locked_date, lock_expiration, estimated_closing,
          closing_date, funding_date, first_payment_date, estimated_funding, appraisal_ordered
        ) VALUES (
          ${loan.id}, ${applicationDate}, ${lockedDate}, ${lockExpiration}, ${estimatedClosing},
          ${closingDate}, ${fundingDate}, ${firstPaymentDate}, ${estimatedFunding}, ${appraisalOrdered}
        )
        ON CONFLICT (loan_id) DO UPDATE SET
          application_date = COALESCE(EXCLUDED.application_date, "LoanDates".application_date),
          locked_date = COALESCE(EXCLUDED.locked_date, "LoanDates".locked_date),
          lock_expiration = COALESCE(EXCLUDED.lock_expiration, "LoanDates".lock_expiration),
          estimated_closing = COALESCE(EXCLUDED.estimated_closing, "LoanDates".estimated_closing),
          closing_date = COALESCE(EXCLUDED.closing_date, "LoanDates".closing_date),
          funding_date = COALESCE(EXCLUDED.funding_date, "LoanDates".funding_date),
          first_payment_date = COALESCE(EXCLUDED.first_payment_date, "LoanDates".first_payment_date),
          estimated_funding = COALESCE(EXCLUDED.estimated_funding, "LoanDates".estimated_funding),
          appraisal_ordered = COALESCE(EXCLUDED.appraisal_ordered, "LoanDates".appraisal_ordered),
          updated_at = NOW()
      `;
    }
  }

  // ── 6. Create LoanBorrower junction if new ───────────────
  if (isNew) {
    try {
      await sql`
        INSERT INTO "LoanBorrower" (loan_id, borrower_id, borrower_type, ordinal, current_address)
        VALUES (
          ${loan.id},
          ${borrower.id},
          'primary',
          0,
          ${currentAddress ? JSON.stringify(currentAddress) : null}::jsonb
        )
        ON CONFLICT DO NOTHING
      `;
    } catch {
      // Ignore if junction already exists
    }
  }

  // ── 7. Handle co-borrower if present ─────────────────────
  if (loanData.coBorrower) {
    const cb = loanData.coBorrower;
    const cbEmail = cb.contacts?.email?.toLowerCase();
    if (cbEmail) {
      let cbRows = await sql`
        SELECT * FROM "Borrower" WHERE email = ${cbEmail} LIMIT 1
      `;
      let coBorrower = cbRows[0] || null;

      if (!coBorrower) {
        const cbSsn = cb.ssn ? String(cb.ssn).padStart(9, '0') : null;
        const newCbRows = await sql`
          INSERT INTO "Borrower" (email, first_name, last_name, phone, ssn_encrypted, dob_encrypted, ssn_last_four)
          VALUES (
            ${cbEmail},
            ${cb.firstName || 'Unknown'},
            ${cb.lastName || 'Unknown'},
            ${normalizePhone(cb.contacts?.mobilePhone || cb.contacts?.homePhone)},
            ${cbSsn ? encrypt(cbSsn) : encrypt('000000000')},
            ${cb.birthDate ? encrypt(cb.birthDate) : encrypt('1900-01-01')},
            ${cbSsn ? cbSsn.slice(-4) : '0000'}
          )
          RETURNING *
        `;
        coBorrower = newCbRows[0];
      }

      const cbAddress = normalizeAddress(cb.currentAddress);
      await sql`
        INSERT INTO "LoanBorrower" (loan_id, borrower_id, borrower_type, ordinal, current_address)
        VALUES (
          ${loan.id},
          ${coBorrower.id},
          'co_borrower',
          1,
          ${cbAddress ? JSON.stringify(cbAddress) : null}::jsonb
        )
        ON CONFLICT (loan_id, borrower_id) DO UPDATE SET
          current_address = ${cbAddress ? JSON.stringify(cbAddress) : null}::jsonb,
          updated_at = NOW()
      `;

      // Update co-borrower count
      await sql`
        UPDATE "Loan" SET num_borrowers = 2, updated_at = NOW()
        WHERE id = ${loan.id}
      `;
    }
  }

  // ── 8. Geocode property address (non-blocking) ───────────
  // Enriches with zip, county, lat/lng if missing
  if (propertyAddress?.street) {
    enrichPropertyAddress(propertyAddress).then(async (result) => {
      if (result.enriched) {
        try {
          await sql`
            UPDATE "Loan" SET
              property_address = ${JSON.stringify(result.address)}::jsonb,
              updated_at = NOW()
            WHERE id = ${loan.id}
          `;
        } catch { /* ignore */ }
      }
    }).catch(() => {});
  }

  return { loanId: loan.id, loanNumber, isNew, status: coreStatus };
}

// ─── POST Handler ────────────────────────────────────────────

export async function POST(request) {
  // Auth check
  if (!authenticate(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();

    // Extract loans from Zoho Flow payload structure
    const loans = body?.webhookTrigger?.payload?.loans || body?.loans || [];

    if (!Array.isArray(loans) || loans.length === 0) {
      return NextResponse.json(
        { error: 'No loans in payload', success: false },
        { status: 400 }
      );
    }

    const results = { processed: 0, created: 0, updated: 0, errors: [] };

    for (const loanData of loans) {
      try {
        const result = await processLoan(loanData);
        results.processed++;
        if (result.isNew) results.created++;
        else results.updated++;
      } catch (err) {
        console.error('Corebot ingest error for loan:', loanData.loanNumber, err.message);
        results.errors.push({
          loanNumber: loanData.loanNumber,
          error: err.message,
        });
      }
    }

    console.log(`Corebot ingest: ${results.processed} processed, ${results.created} created, ${results.updated} updated, ${results.errors.length} errors`);

    return NextResponse.json({ success: true, ...results });
  } catch (err) {
    console.error('Corebot ingest fatal error:', err);
    return NextResponse.json(
      { error: 'Internal server error', success: false },
      { status: 500 }
    );
  }
}
