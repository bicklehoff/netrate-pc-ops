// API: Submit Loan Application
// POST /api/portal/apply
//
// Receives all form data, creates borrower + loan + co-borrower records.
// Encrypts SSN and DOB before storage.
// Creates initial loan_event for the submission.
// Supports up to 3 co-borrowers (4 total borrowers per loan).

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import sql from '@/lib/db';
import { encrypt, ssnLastFour } from '@/lib/encryption';
import { createLoanFolder } from '@/lib/zoho-workdrive';
import { checkApplicationGate } from '@/lib/application-gate';
import { sendEmail } from '@/lib/resend';
import { statusChangeTemplate } from '@/lib/email-templates/borrower';
import { getInitialDocList } from '@/lib/constants/initial-doc-list';
import { normalizePhone } from '@/lib/normalize-phone';

// ─── Rate Limiting (in-memory, per IP) ──────────────────────
const rateLimitMap = new Map();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (rateLimitMap.size > 100) {
    for (const [key, val] of rateLimitMap) {
      if (now - val.windowStart > RATE_LIMIT_WINDOW_MS) rateLimitMap.delete(key);
    }
  }
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }
  if (entry.count >= RATE_LIMIT_MAX) return { allowed: false, remaining: 0 };
  entry.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count };
}

// ─── Input Validation Helpers ───────────────────────────────
function validateEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }

function validateSSN(ssn) {
  const digits = String(ssn).replace(/\D/g, '');
  if (digits.length !== 9) return 'SSN must contain exactly 9 digits';
  if (digits.startsWith('000')) return 'Invalid SSN';
  if (digits.substring(3, 5) === '00') return 'Invalid SSN';
  if (digits.substring(5) === '0000') return 'Invalid SSN';
  if (digits === '999999999') return 'Invalid SSN';
  if (['123456789', '111111111', '222222222', '333333333', '444444444',
       '555555555', '666666666', '777777777', '888888888'].includes(digits)) return 'Invalid SSN';
  return null;
}

function validateDOB(dob) {
  const date = new Date(dob);
  if (isNaN(date.getTime())) return 'Invalid date of birth';
  const age = (new Date() - date) / (365.25 * 24 * 60 * 60 * 1000);
  if (age < 18) return 'Applicant must be at least 18 years old';
  if (age > 100) return 'Invalid date of birth';
  return null;
}

function validatePhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length !== 10 && digits.length !== 11) return 'Phone must be 10 digits';
  return null;
}

function sanitize(str) {
  if (typeof str !== 'string') return str;
  return str.trim().replace(/[<>]/g, '');
}

function safeInt(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = parseInt(val, 10);
  return Number.isNaN(n) ? null : n;
}

function safeDecimal(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = parseFloat(val);
  return Number.isNaN(n) ? null : n;
}

function safeJson(val) {
  if (!val || typeof val !== 'object') return null;
  return val;
}

// ─── Create or find a Borrower record ──────────────────────
async function upsertBorrower({ firstName, lastName, email, phone, ssn, dob }) {
  const emailLower = (sanitize(email) || email || '').toLowerCase().trim();
  const ssnDigits = String(ssn).replace(/\D/g, '');
  if (ssnDigits.length !== 9) throw new Error('SSN must contain exactly 9 digits');

  const ssnEncrypted = encrypt(ssnDigits);
  const dobEncrypted = encrypt(String(dob));
  const lastFour = ssnLastFour(ssnDigits);

  const existing = await sql`SELECT * FROM borrowers WHERE email = ${emailLower} LIMIT 1`;

  if (existing[0]) {
    const updated = await sql`
      UPDATE borrowers SET
        first_name = ${sanitize(firstName)}, last_name = ${sanitize(lastName)},
        phone = ${normalizePhone(phone) || (phone ? sanitize(phone) : null)},
        dob_encrypted = ${dobEncrypted}, ssn_encrypted = ${ssnEncrypted},
        ssn_last_four = ${lastFour}, updated_at = NOW()
      WHERE email = ${emailLower}
      RETURNING *
    `;
    return updated[0];
  } else {
    const created = await sql`
      INSERT INTO borrowers (email, first_name, last_name, phone, dob_encrypted, ssn_encrypted, ssn_last_four, created_at, updated_at)
      VALUES (${emailLower}, ${sanitize(firstName)}, ${sanitize(lastName)},
        ${normalizePhone(phone) || (phone ? sanitize(phone) : null)},
        ${dobEncrypted}, ${ssnEncrypted}, ${lastFour}, NOW(), NOW())
      RETURNING *
    `;
    return created[0];
  }
}

export async function POST(request) {
  try {
    // ─── Rate Limiting ─────────────────────────────────────────
    const headersList = await headers();
    const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim()
      || headersList.get('x-real-ip') || 'unknown';
    const rateCheck = checkRateLimit(ip);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: 'Too many submissions. Please try again later.' }, { status: 429 });
    }

    const body = await request.json();

    // ─── Validation ────────────────────────────────────
    if (!body.firstName || !body.lastName || !body.email || !body.ssn || !body.dob || !body.purpose) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (!validateEmail(body.email)) return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    const ssnError = validateSSN(body.ssn);
    if (ssnError) return NextResponse.json({ error: ssnError }, { status: 400 });
    const dobError = validateDOB(body.dob);
    if (dobError) return NextResponse.json({ error: dobError }, { status: 400 });
    const phoneError = validatePhone(body.phone);
    if (phoneError) return NextResponse.json({ error: phoneError }, { status: 400 });
    if (!['purchase', 'refinance'].includes(body.purpose)) return NextResponse.json({ error: 'Invalid loan purpose' }, { status: 400 });
    if (!process.env.PII_ENCRYPTION_KEY) {
      console.error('FATAL: PII_ENCRYPTION_KEY environment variable is not set');
      return NextResponse.json({ error: 'Server configuration error. Please contact support.' }, { status: 500 });
    }

    // ─── Create Primary Borrower ──────────────────────────────
    const borrower = await upsertBorrower({
      firstName: body.firstName, lastName: body.lastName, email: body.email,
      phone: body.phone, ssn: body.ssn, dob: body.dob,
    });

    // ─── Build Declarations Object ──────────────────
    const declarations = {
      primaryResidence: body.primaryResidence ?? true,
      priorOwnership3Years: body.priorOwnership3Years ?? false,
      priorPropertyType: body.priorPropertyType || null,
      priorPropertyTitleHeld: body.priorPropertyTitleHeld || null,
      familyRelationshipSeller: body.familyRelationshipSeller ?? false,
      undisclosedBorrowing: body.undisclosedBorrowing ?? false,
      undisclosedBorrowingAmount: safeDecimal(body.undisclosedBorrowingAmount),
      applyingForOtherMortgage: body.applyingForOtherMortgage ?? false,
      applyingForNewCredit: body.applyingForNewCredit ?? false,
      priorityLien: body.priorityLien ?? false,
      coSignerOnDebt: body.coSignerOnDebt ?? false,
      outstandingJudgments: body.outstandingJudgments ?? false,
      delinquentFederalDebt: body.delinquentFederalDebt ?? false,
      lawsuitParty: body.lawsuitParty ?? false,
      deedInLieu: body.deedInLieu ?? false,
      preForeclosureSale: body.preForeclosureSale ?? false,
      foreclosure: body.foreclosure ?? false,
      bankruptcy: body.bankruptcy ?? false,
      bankruptcyChapter: body.bankruptcyChapter || null,
      citizenshipStatus: body.citizenshipStatus || null,
      hmdaEthnicity: body.hmdaEthnicity || null,
      hmdaRace: body.hmdaRace?.length > 0 ? body.hmdaRace : null,
      hmdaSex: body.hmdaSex || null,
      authorizeVerification: body.authorizeVerification ?? false,
      authorizeCreditPull: body.authorizeCreditPull ?? false,
    };

    const coBorrowers = body.coBorrowers || [];
    const numBorrowers = 1 + coBorrowers.length;

    // ─── Create Loan Record ──────────────────────────────────
    const loanRows = await sql`
      INSERT INTO loans (
        borrower_id, status, ball_in_court, purpose, occupancy, num_borrowers,
        property_address, property_type, num_units, purchase_price, down_payment,
        estimated_value, current_balance, refi_purpose, cash_out_amount,
        current_address, address_years, address_months, mailing_address, marital_status,
        num_dependents, employment_status, employer_name, position_title, years_in_position,
        monthly_base_income, other_monthly_income, other_income_source,
        declarations, application_step, submitted_at, created_at, updated_at
      ) VALUES (
        ${borrower.id}, 'applied', 'mlo', ${body.purpose}, ${body.occupancy || null}, ${numBorrowers},
        ${safeJson(body.propertyAddress) ? JSON.stringify(body.propertyAddress) : null}::jsonb,
        ${body.propertyType || null}, ${safeInt(body.numUnits)},
        ${safeDecimal(body.purchasePrice)}, ${safeDecimal(body.downPayment)},
        ${safeDecimal(body.estimatedValue)}, ${safeDecimal(body.currentBalance)},
        ${body.refiPurpose || null}, ${safeDecimal(body.cashOutAmount)},
        ${safeJson(body.currentAddress) ? JSON.stringify(body.currentAddress) : null}::jsonb,
        ${safeInt(body.addressYears)}, ${safeInt(body.addressMonths)},
        ${body.mailingAddressSame ? null : (safeJson(body.mailingAddress) ? JSON.stringify(body.mailingAddress) : null)}::jsonb,
        ${body.maritalStatus || null}, ${safeInt(body.numDependents)},
        ${body.employmentStatus || null}, ${body.employerName || null},
        ${body.positionTitle || null}, ${safeInt(body.yearsInPosition)},
        ${safeDecimal(body.monthlyBaseIncome)}, ${safeDecimal(body.otherMonthlyIncome)},
        ${body.otherIncomeSource || null},
        ${JSON.stringify(declarations)}::jsonb, 6, NOW(), NOW(), NOW()
      )
      RETURNING *
    `;
    const loan = loanRows[0];

    // ─── Create/Update LoanBorrower for Primary ────────────────
    // Upsert: check if exists first
    const existingLB = await sql`
      SELECT id FROM loan_borrowers WHERE loan_id = ${loan.id} AND borrower_id = ${borrower.id} LIMIT 1
    `;
    const lbData = {
      marital_status: body.maritalStatus || null,
      current_address: safeJson(body.currentAddress) ? JSON.stringify(body.currentAddress) : null,
      address_years: safeInt(body.addressYears),
      address_months: safeInt(body.addressMonths),
      mailing_address: body.mailingAddressSame ? null : (safeJson(body.mailingAddress) ? JSON.stringify(body.mailingAddress) : null),
      employment_status: body.employmentStatus || null,
      employer_name: body.employerName || null,
      position_title: body.positionTitle || null,
      years_in_position: safeInt(body.yearsInPosition),
      monthly_base_income: safeDecimal(body.monthlyBaseIncome),
      other_monthly_income: safeDecimal(body.otherMonthlyIncome),
      other_income_source: body.otherIncomeSource || null,
    };

    if (existingLB[0]) {
      await sql`
        UPDATE loan_borrowers SET
          borrower_type = 'primary', ordinal = 0,
          marital_status = ${lbData.marital_status},
          current_address = ${lbData.current_address}::jsonb,
          address_years = ${lbData.address_years}, address_months = ${lbData.address_months},
          mailing_address = ${lbData.mailing_address}::jsonb,
          employment_status = ${lbData.employment_status}, employer_name = ${lbData.employer_name},
          position_title = ${lbData.position_title}, years_in_position = ${lbData.years_in_position},
          monthly_base_income = ${lbData.monthly_base_income}, other_monthly_income = ${lbData.other_monthly_income},
          other_income_source = ${lbData.other_income_source},
          declarations = ${JSON.stringify(declarations)}::jsonb, updated_at = NOW()
        WHERE loan_id = ${loan.id} AND borrower_id = ${borrower.id}
      `;
    } else {
      await sql`
        INSERT INTO loan_borrowers (
          loan_id, borrower_id, borrower_type, ordinal,
          marital_status, current_address, address_years, address_months,
          mailing_address, employment_status, employer_name, position_title,
          years_in_position, monthly_base_income, other_monthly_income, other_income_source,
          declarations, created_at, updated_at
        ) VALUES (
          ${loan.id}, ${borrower.id}, 'primary', 0,
          ${lbData.marital_status}, ${lbData.current_address}::jsonb,
          ${lbData.address_years}, ${lbData.address_months},
          ${lbData.mailing_address}::jsonb,
          ${lbData.employment_status}, ${lbData.employer_name}, ${lbData.position_title},
          ${lbData.years_in_position}, ${lbData.monthly_base_income}, ${lbData.other_monthly_income},
          ${lbData.other_income_source},
          ${JSON.stringify(declarations)}::jsonb, NOW(), NOW()
        )
      `;
    }

    // ─── Create Co-Borrower Records ──────────────────────────
    for (let i = 0; i < coBorrowers.length; i++) {
      const cb = coBorrowers[i];
      if (!cb.firstName || !cb.lastName || !cb.email || !cb.ssn || !cb.dob) continue;

      const cbBorrower = await upsertBorrower({
        firstName: cb.firstName, lastName: cb.lastName, email: cb.email,
        phone: cb.phone, ssn: cb.ssn, dob: cb.dob,
      });

      const existingCBLB = await sql`
        SELECT id FROM loan_borrowers WHERE loan_id = ${loan.id} AND borrower_id = ${cbBorrower.id} LIMIT 1
      `;

      const cbLbData = {
        marital_status: body.maritalStatus || null,
        current_address: safeJson(cb.currentAddress) ? JSON.stringify(cb.currentAddress) : null,
        address_years: safeInt(cb.addressYears),
        address_months: safeInt(cb.addressMonths),
        mailing_address: cb.mailingAddressSame ? null : (safeJson(cb.mailingAddress) ? JSON.stringify(cb.mailingAddress) : null),
        employment_status: cb.employmentStatus || null,
        employer_name: cb.employerName || null,
        position_title: cb.positionTitle || null,
        years_in_position: safeInt(cb.yearsInPosition),
        monthly_base_income: safeDecimal(cb.monthlyBaseIncome),
        other_monthly_income: safeDecimal(cb.otherMonthlyIncome),
        other_income_source: cb.otherIncomeSource || null,
        declarations: cb.declarations ? JSON.stringify(cb.declarations) : null,
      };

      if (existingCBLB[0]) {
        await sql`
          UPDATE loan_borrowers SET
            borrower_type = 'co_borrower', ordinal = ${i + 1},
            relationship = ${cb.relationship || null},
            marital_status = ${cbLbData.marital_status},
            current_address = ${cbLbData.current_address}::jsonb,
            address_years = ${cbLbData.address_years}, address_months = ${cbLbData.address_months},
            mailing_address = ${cbLbData.mailing_address}::jsonb,
            employment_status = ${cbLbData.employment_status}, employer_name = ${cbLbData.employer_name},
            position_title = ${cbLbData.position_title}, years_in_position = ${cbLbData.years_in_position},
            monthly_base_income = ${cbLbData.monthly_base_income}, other_monthly_income = ${cbLbData.other_monthly_income},
            other_income_source = ${cbLbData.other_income_source},
            declarations = ${cbLbData.declarations}::jsonb, updated_at = NOW()
          WHERE loan_id = ${loan.id} AND borrower_id = ${cbBorrower.id}
        `;
      } else {
        await sql`
          INSERT INTO loan_borrowers (
            loan_id, borrower_id, borrower_type, ordinal, relationship,
            marital_status, current_address, address_years, address_months,
            mailing_address, employment_status, employer_name, position_title,
            years_in_position, monthly_base_income, other_monthly_income, other_income_source,
            declarations, created_at, updated_at
          ) VALUES (
            ${loan.id}, ${cbBorrower.id}, 'co_borrower', ${i + 1}, ${cb.relationship || null},
            ${cbLbData.marital_status}, ${cbLbData.current_address}::jsonb,
            ${cbLbData.address_years}, ${cbLbData.address_months},
            ${cbLbData.mailing_address}::jsonb,
            ${cbLbData.employment_status}, ${cbLbData.employer_name}, ${cbLbData.position_title},
            ${cbLbData.years_in_position}, ${cbLbData.monthly_base_income}, ${cbLbData.other_monthly_income},
            ${cbLbData.other_income_source},
            ${cbLbData.declarations}::jsonb, NOW(), NOW()
          )
        `;
      }
    }

    // ─── Audit Trail ─────────────────────────────────────────
    await sql`
      INSERT INTO loan_events (loan_id, event_type, actor_type, actor_id, old_value, new_value, details, created_at)
      VALUES (${loan.id}, 'status_change', 'borrower', ${borrower.id}, 'rate_alert', 'applied',
        ${JSON.stringify({
          source: 'web_application', numBorrowers,
          coBorrowerNames: coBorrowers.map((cb) => `${cb.firstName} ${cb.lastName}`),
        })}::jsonb, NOW())
    `;

    // ─── Create Initial Document Requests ───────────────────
    try {
      const docList = getInitialDocList({
        purpose: body.purpose,
        employmentStatus: body.employmentStatus,
        coBorrowers: (body.coBorrowers || []).map((cb) => ({
          firstName: cb.firstName, employmentStatus: cb.employmentStatus,
        })),
      });
      if (docList.length > 0) {
        for (const item of docList) {
          await sql`
            INSERT INTO documents (loan_id, doc_type, label, status, notes, created_at)
            VALUES (${loan.id}, ${item.docType}, ${item.label}, 'requested', ${item.notes || null}, NOW())
          `;
        }
      }
    } catch (docListErr) {
      console.error('Initial doc list creation failed (non-fatal):', docListErr?.message);
    }

    // ─── Link Contact + Application Gate (non-blocking) ───
    try {
      let contactRows = await sql`SELECT * FROM contacts WHERE borrower_id = ${borrower.id} LIMIT 1`;
      let contact = contactRows[0];
      if (!contact) {
        const created = await sql`
          INSERT INTO contacts (first_name, last_name, email, phone, borrower_id, source, status, created_at, updated_at)
          VALUES (${sanitize(body.firstName)}, ${sanitize(body.lastName)}, ${body.email?.toLowerCase()},
            ${normalizePhone(body.phone) || body.phone || null}, ${borrower.id}, 'application', 'applicant', NOW(), NOW())
          RETURNING *
        `;
        contact = created[0];
      }

      await sql`UPDATE loans SET contact_id = ${contact.id}, updated_at = NOW() WHERE id = ${loan.id}`;

      await sql`
        INSERT INTO loan_contacts (loan_id, contact_id, role, is_primary, name, email, phone, created_at, updated_at)
        VALUES (${loan.id}, ${contact.id}, 'borrower', true,
          ${`${sanitize(body.firstName)} ${sanitize(body.lastName)}`},
          ${body.email?.toLowerCase()}, ${normalizePhone(body.phone) || body.phone || null},
          NOW(), NOW())
      `;

      const gatePassed = checkApplicationGate(loan, borrower);
      if (gatePassed) {
        await sql`UPDATE loans SET is_application = true, application_date = NOW(), updated_at = NOW() WHERE id = ${loan.id}`;
      }
    } catch (contactErr) {
      console.error('Contact linking failed (non-fatal):', contactErr?.message);
    }

    // ─── WorkDrive Folder Creation (non-blocking) ──────────
    try {
      const folder = await createLoanFolder({
        borrowerFirstName: sanitize(body.firstName),
        borrowerLastName: sanitize(body.lastName),
        purpose: body.purpose,
      });
      await sql`
        UPDATE loans SET work_drive_folder_id = ${folder.rootFolderId},
          work_drive_subfolders = ${JSON.stringify(folder.subfolders)}::jsonb, updated_at = NOW()
        WHERE id = ${loan.id}
      `;
      console.log(`WorkDrive folder created for loan ${loan.id}: ${folder.rootFolderId}`);
    } catch (wdError) {
      console.error('WorkDrive folder creation failed (non-fatal):', wdError?.message);
    }

    // ─── Send Confirmation Emails ────────────────────────────
    try {
      const propertyAddr = body.propertyAddress?.street
        ? `${body.propertyAddress.street}, ${body.propertyAddress.city}, ${body.propertyAddress.state}` : null;
      const primaryEmail = statusChangeTemplate({ firstName: body.firstName, status: 'applied', propertyAddress: propertyAddr });
      await sendEmail({ to: body.email, subject: primaryEmail.subject, html: primaryEmail.html, text: primaryEmail.text });
      for (const cb of (body.coBorrowers || [])) {
        if (cb.email) {
          const cbEmail = statusChangeTemplate({ firstName: cb.firstName, status: 'applied', propertyAddress: propertyAddr });
          await sendEmail({ to: cb.email, subject: cbEmail.subject, html: cbEmail.html, text: cbEmail.text });
        }
      }
    } catch (emailError) {
      console.error('Confirmation email failed (non-fatal):', emailError?.message);
    }

    return NextResponse.json({ success: true, loanId: loan.id, borrowerId: borrower.id });
  } catch (error) {
    console.error('Application submission error:', error?.message, error?.stack);
    const msg = error?.message || '';
    if (msg.includes('SSN') || msg.includes('date of birth') || msg.includes('Invalid') || msg.includes('must be')) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: 'Something went wrong. Please try again or contact support.' }, { status: 500 });
  }
}
