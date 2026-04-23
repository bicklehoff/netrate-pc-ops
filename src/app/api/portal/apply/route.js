// API: Submit Loan Application
// POST /api/portal/apply
//
// Receives all form data, creates contact + loan + co-borrower records.
// Encrypts SSN and DOB before storage.
// Creates initial loan_event for the submission.
// Supports up to 3 co-borrowers (4 total borrowers per loan).
//
// Post-UAD Layer-1b3: borrower identity lives on `contacts`. Per-borrower
// app-module data (employment, income, declarations, address) still flows
// through `loan_borrowers` (keyed on contact_id after migration 008).
// `loan_contacts` is replaced by `loan_participants`.

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

// ─── Create or find a Contact record (with borrower PII) ───
async function upsertContact({ firstName, lastName, email, phone, ssn, dob, role = 'borrower' }) {
  const emailLower = (sanitize(email) || email || '').toLowerCase().trim();
  const ssnDigits = String(ssn).replace(/\D/g, '');
  if (ssnDigits.length !== 9) throw new Error('SSN must contain exactly 9 digits');

  const ssnEncrypted = encrypt(ssnDigits);
  const dobEncrypted = encrypt(String(dob));
  const lastFour = ssnLastFour(ssnDigits);

  const existing = await sql`SELECT * FROM contacts WHERE lower(email) = ${emailLower} LIMIT 1`;

  if (existing[0]) {
    const updated = await sql`
      UPDATE contacts SET
        first_name = ${sanitize(firstName)}, last_name = ${sanitize(lastName)},
        phone = ${normalizePhone(phone) || (phone ? sanitize(phone) : null)},
        dob_encrypted = ${dobEncrypted}, ssn_encrypted = ${ssnEncrypted},
        ssn_last_four = ${lastFour}, updated_at = NOW()
      WHERE id = ${existing[0].id}
      RETURNING *
    `;
    return updated[0];
  } else {
    const created = await sql`
      INSERT INTO contacts (email, first_name, last_name, phone, dob_encrypted, ssn_encrypted, ssn_last_four, role, marketing_stage, source, created_at, updated_at)
      VALUES (${emailLower}, ${sanitize(firstName)}, ${sanitize(lastName)},
        ${normalizePhone(phone) || (phone ? sanitize(phone) : null)},
        ${dobEncrypted}, ${ssnEncrypted}, ${lastFour}, ${role}, 'in_process', 'application', NOW(), NOW())
      RETURNING *
    `;
    return created[0];
  }
}

export async function POST(request) {
  try {
    // ─── Rate Limiting ─────────────────────────────────────────
    const headersList = await headers();
    const ip = headersList.get('x-forwarded-for')?.split(',').pop()?.trim()
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

    // ─── Create Primary Contact (borrower role) ───────────────
    const borrower = await upsertContact({
      firstName: body.firstName, lastName: body.lastName, email: body.email,
      phone: body.phone, ssn: body.ssn, dob: body.dob, role: 'borrower',
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
        contact_id, status, ball_in_court, purpose, occupancy, num_borrowers,
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

    // ─── Create/Update LoanParticipant + Satellites for Primary ─────
    const lpOrgId = loan.organization_id || '00000000-0000-4000-8000-000000000001';
    const lbData = {
      marital_status: body.maritalStatus || null,
      current_address: safeJson(body.currentAddress) ? JSON.stringify(body.currentAddress) : null,
      address_years: safeInt(body.addressYears),
      address_months: safeInt(body.addressMonths),
      employer_name: body.employerName || null,
      position_title: body.positionTitle || null,
      years_in_position: safeInt(body.yearsInPosition),
      self_employed: body.employmentStatus === 'self_employed',
      monthly_base_income: safeDecimal(body.monthlyBaseIncome),
      other_monthly_income: safeDecimal(body.otherMonthlyIncome),
      other_income_source: body.otherIncomeSource || null,
    };
    const existingLP = await sql`SELECT id FROM loan_participants WHERE loan_id = ${loan.id} AND contact_id = ${borrower.id} LIMIT 1`;
    if (existingLP[0]) {
      await sql`UPDATE loan_participants SET marital_status = ${lbData.marital_status}, updated_at = NOW() WHERE loan_id = ${loan.id} AND contact_id = ${borrower.id}`;
    } else {
      await sql`INSERT INTO loan_participants (loan_id, contact_id, role, ordinal, marital_status, organization_id, created_at, updated_at) VALUES (${loan.id}, ${borrower.id}, 'primary_borrower', 0, ${lbData.marital_status}, ${lpOrgId}, NOW(), NOW()) ON CONFLICT DO NOTHING`;
    }
    const existHHPrimary = await sql`SELECT id FROM loan_housing_history WHERE loan_id = ${loan.id} AND contact_id = ${borrower.id} AND housing_type = 'current' LIMIT 1`;
    if (existHHPrimary[0]) {
      await sql`UPDATE loan_housing_history SET address = ${lbData.current_address}::jsonb, years = ${lbData.address_years}, months = ${lbData.address_months}, updated_at = NOW() WHERE id = ${existHHPrimary[0].id}`;
    } else if (lbData.current_address || lbData.address_years != null || lbData.address_months != null) {
      await sql`INSERT INTO loan_housing_history (loan_id, contact_id, housing_type, address, years, months, ordinal) VALUES (${loan.id}, ${borrower.id}, 'current', ${lbData.current_address}::jsonb, ${lbData.address_years}, ${lbData.address_months}, 0)`;
    }
    if (lbData.monthly_base_income != null || lbData.other_monthly_income != null) {
      const existInc = await sql`SELECT id FROM loan_incomes WHERE loan_id = ${loan.id} AND contact_id = ${borrower.id} LIMIT 1`;
      if (existInc[0]) {
        await sql`UPDATE loan_incomes SET base_monthly = ${lbData.monthly_base_income}, other_monthly = ${lbData.other_monthly_income}, other_income_source = ${lbData.other_income_source}, updated_at = NOW() WHERE id = ${existInc[0].id}`;
      } else {
        await sql`INSERT INTO loan_incomes (id, loan_id, contact_id, base_monthly, other_monthly, other_income_source, created_at, updated_at) VALUES (gen_random_uuid(), ${loan.id}, ${borrower.id}, ${lbData.monthly_base_income}, ${lbData.other_monthly_income}, ${lbData.other_income_source}, NOW(), NOW())`;
      }
    }
    if (lbData.employer_name) {
      const existEmp = await sql`SELECT id FROM loan_employments WHERE loan_id = ${loan.id} AND contact_id = ${borrower.id} AND is_primary = true LIMIT 1`;
      if (existEmp[0]) {
        await sql`UPDATE loan_employments SET employer_name = ${lbData.employer_name}, position = ${lbData.position_title}, years_on_job = ${lbData.years_in_position}, self_employed = ${lbData.self_employed}, updated_at = NOW() WHERE id = ${existEmp[0].id}`;
      } else {
        await sql`INSERT INTO loan_employments (id, loan_id, contact_id, is_primary, employer_name, position, years_on_job, self_employed, created_at, updated_at) VALUES (gen_random_uuid(), ${loan.id}, ${borrower.id}, true, ${lbData.employer_name}, ${lbData.position_title}, ${lbData.years_in_position}, ${lbData.self_employed}, NOW(), NOW())`;
      }
    }
    {
      const d = declarations;
      const existDecl = await sql`SELECT id FROM loan_declarations WHERE loan_id = ${loan.id} AND contact_id = ${borrower.id} LIMIT 1`;
      if (existDecl[0]) {
        await sql`UPDATE loan_declarations SET intent_to_occupy = ${d.primaryResidence ?? null}, ownership_interest_last_three_years = ${d.priorOwnership3Years ?? null}, property_type_of_ownership = ${d.priorPropertyType || null}, prior_property_title_held = ${d.priorPropertyTitleHeld || null}, family_relationship_seller = ${d.familyRelationshipSeller ?? null}, undisclosed_borrowing = ${d.undisclosedBorrowing ?? null}, applying_for_other_mortgage = ${d.applyingForOtherMortgage ?? null}, applying_for_new_credit = ${d.applyingForNewCredit ?? null}, priority_lien = ${d.priorityLien ?? null}, co_signer_on_other_loan = ${d.coSignerOnDebt ?? null}, outstanding_judgments = ${d.outstandingJudgments ?? null}, delinquent_federal_debt = ${d.delinquentFederalDebt ?? null}, party_to_lawsuit = ${d.lawsuitParty ?? null}, deed_in_lieu = ${d.deedInLieu ?? null}, pre_foreclosure_sale = ${d.preForeclosureSale ?? null}, foreclosure = ${d.foreclosure ?? null}, bankruptcy = ${d.bankruptcy ?? null}, bankruptcy_type = ${d.bankruptcyChapter || null}, authorize_credit_pull = ${d.authorizeCreditPull ?? null}, authorize_verification = ${d.authorizeVerification ?? null}, updated_at = NOW() WHERE id = ${existDecl[0].id}`;
      } else {
        await sql`INSERT INTO loan_declarations (id, loan_id, contact_id, intent_to_occupy, ownership_interest_last_three_years, property_type_of_ownership, prior_property_title_held, family_relationship_seller, undisclosed_borrowing, applying_for_other_mortgage, applying_for_new_credit, priority_lien, co_signer_on_other_loan, outstanding_judgments, delinquent_federal_debt, party_to_lawsuit, deed_in_lieu, pre_foreclosure_sale, foreclosure, bankruptcy, bankruptcy_type, authorize_credit_pull, authorize_verification, created_at, updated_at) VALUES (gen_random_uuid(), ${loan.id}, ${borrower.id}, ${d.primaryResidence ?? null}, ${d.priorOwnership3Years ?? null}, ${d.priorPropertyType || null}, ${d.priorPropertyTitleHeld || null}, ${d.familyRelationshipSeller ?? null}, ${d.undisclosedBorrowing ?? null}, ${d.applyingForOtherMortgage ?? null}, ${d.applyingForNewCredit ?? null}, ${d.priorityLien ?? null}, ${d.coSignerOnDebt ?? null}, ${d.outstandingJudgments ?? null}, ${d.delinquentFederalDebt ?? null}, ${d.lawsuitParty ?? null}, ${d.deedInLieu ?? null}, ${d.preForeclosureSale ?? null}, ${d.foreclosure ?? null}, ${d.bankruptcy ?? null}, ${d.bankruptcyChapter || null}, ${d.authorizeCreditPull ?? null}, ${d.authorizeVerification ?? null}, NOW(), NOW())`;
      }
    }

    // ─── Create Co-Borrower Records ──────────────────────────
    for (let i = 0; i < coBorrowers.length; i++) {
      const cb = coBorrowers[i];
      if (!cb.firstName || !cb.lastName || !cb.email || !cb.ssn || !cb.dob) continue;

      const cbBorrower = await upsertContact({
        firstName: cb.firstName, lastName: cb.lastName, email: cb.email,
        phone: cb.phone, ssn: cb.ssn, dob: cb.dob, role: 'co_borrower',
      });

      const cbLbData = {
        marital_status: cb.maritalStatus || null,
        current_address: safeJson(cb.currentAddress) ? JSON.stringify(cb.currentAddress) : null,
        address_years: safeInt(cb.addressYears),
        address_months: safeInt(cb.addressMonths),
        employer_name: cb.employerName || null,
        position_title: cb.positionTitle || null,
        years_in_position: safeInt(cb.yearsInPosition),
        self_employed: cb.employmentStatus === 'self_employed',
        monthly_base_income: safeDecimal(cb.monthlyBaseIncome),
        other_monthly_income: safeDecimal(cb.otherMonthlyIncome),
        other_income_source: cb.otherIncomeSource || null,
      };

      const existCBLP = await sql`SELECT id FROM loan_participants WHERE loan_id = ${loan.id} AND contact_id = ${cbBorrower.id} LIMIT 1`;
      if (existCBLP[0]) {
        await sql`UPDATE loan_participants SET role = 'co_borrower', ordinal = ${i + 1}, marital_status = ${cbLbData.marital_status}, updated_at = NOW() WHERE loan_id = ${loan.id} AND contact_id = ${cbBorrower.id}`;
      } else {
        await sql`INSERT INTO loan_participants (loan_id, contact_id, role, ordinal, marital_status, organization_id, created_at, updated_at) VALUES (${loan.id}, ${cbBorrower.id}, 'co_borrower', ${i + 1}, ${cbLbData.marital_status}, ${lpOrgId}, NOW(), NOW()) ON CONFLICT DO NOTHING`;
      }
      const existHHCb = await sql`SELECT id FROM loan_housing_history WHERE loan_id = ${loan.id} AND contact_id = ${cbBorrower.id} AND housing_type = 'current' LIMIT 1`;
      if (existHHCb[0]) {
        await sql`UPDATE loan_housing_history SET address = ${cbLbData.current_address}::jsonb, years = ${cbLbData.address_years}, months = ${cbLbData.address_months}, updated_at = NOW() WHERE id = ${existHHCb[0].id}`;
      } else if (cbLbData.current_address || cbLbData.address_years != null || cbLbData.address_months != null) {
        await sql`INSERT INTO loan_housing_history (loan_id, contact_id, housing_type, address, years, months, ordinal) VALUES (${loan.id}, ${cbBorrower.id}, 'current', ${cbLbData.current_address}::jsonb, ${cbLbData.address_years}, ${cbLbData.address_months}, ${i + 1})`;
      }
      if (cbLbData.monthly_base_income != null || cbLbData.other_monthly_income != null) {
        const existCBInc = await sql`SELECT id FROM loan_incomes WHERE loan_id = ${loan.id} AND contact_id = ${cbBorrower.id} LIMIT 1`;
        if (existCBInc[0]) {
          await sql`UPDATE loan_incomes SET base_monthly = ${cbLbData.monthly_base_income}, other_monthly = ${cbLbData.other_monthly_income}, other_income_source = ${cbLbData.other_income_source}, updated_at = NOW() WHERE id = ${existCBInc[0].id}`;
        } else {
          await sql`INSERT INTO loan_incomes (id, loan_id, contact_id, base_monthly, other_monthly, other_income_source, created_at, updated_at) VALUES (gen_random_uuid(), ${loan.id}, ${cbBorrower.id}, ${cbLbData.monthly_base_income}, ${cbLbData.other_monthly_income}, ${cbLbData.other_income_source}, NOW(), NOW())`;
        }
      }
      if (cbLbData.employer_name) {
        const existCBEmp = await sql`SELECT id FROM loan_employments WHERE loan_id = ${loan.id} AND contact_id = ${cbBorrower.id} AND is_primary = true LIMIT 1`;
        if (existCBEmp[0]) {
          await sql`UPDATE loan_employments SET employer_name = ${cbLbData.employer_name}, position = ${cbLbData.position_title}, years_on_job = ${cbLbData.years_in_position}, self_employed = ${cbLbData.self_employed}, updated_at = NOW() WHERE id = ${existCBEmp[0].id}`;
        } else {
          await sql`INSERT INTO loan_employments (id, loan_id, contact_id, is_primary, employer_name, position, years_on_job, self_employed, created_at, updated_at) VALUES (gen_random_uuid(), ${loan.id}, ${cbBorrower.id}, true, ${cbLbData.employer_name}, ${cbLbData.position_title}, ${cbLbData.years_in_position}, ${cbLbData.self_employed}, NOW(), NOW())`;
        }
      }
      if (cb.declarations) {
        const cd = cb.declarations;
        const existCBDecl = await sql`SELECT id FROM loan_declarations WHERE loan_id = ${loan.id} AND contact_id = ${cbBorrower.id} LIMIT 1`;
        if (existCBDecl[0]) {
          await sql`UPDATE loan_declarations SET intent_to_occupy = ${cd.primaryResidence ?? null}, outstanding_judgments = ${cd.outstandingJudgments ?? null}, foreclosure = ${cd.foreclosure ?? null}, bankruptcy = ${cd.bankruptcy ?? null}, bankruptcy_type = ${cd.bankruptcyChapter || null}, party_to_lawsuit = ${cd.lawsuitParty ?? null}, delinquent_federal_debt = ${cd.delinquentFederalDebt ?? null}, co_signer_on_other_loan = ${cd.coSignerOnDebt ?? null}, updated_at = NOW() WHERE id = ${existCBDecl[0].id}`;
        } else {
          await sql`INSERT INTO loan_declarations (id, loan_id, contact_id, intent_to_occupy, outstanding_judgments, foreclosure, bankruptcy, bankruptcy_type, party_to_lawsuit, delinquent_federal_debt, co_signer_on_other_loan, created_at, updated_at) VALUES (gen_random_uuid(), ${loan.id}, ${cbBorrower.id}, ${cd.primaryResidence ?? null}, ${cd.outstandingJudgments ?? null}, ${cd.foreclosure ?? null}, ${cd.bankruptcy ?? null}, ${cd.bankruptcyChapter || null}, ${cd.lawsuitParty ?? null}, ${cd.delinquentFederalDebt ?? null}, ${cd.coSignerOnDebt ?? null}, NOW(), NOW())`;
        }
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

    // ─── Application Gate ──────────────────────────────────────
    try {
      const gatePassed = checkApplicationGate(loan, borrower);
      if (gatePassed) {
        await sql`UPDATE loans SET is_application = true, application_date = NOW(), updated_at = NOW() WHERE id = ${loan.id}`;
      }
    } catch (gateErr) {
      console.error('Application gate check failed (non-fatal):', gateErr?.message);
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

    return NextResponse.json({ success: true, loanId: loan.id, contactId: borrower.id });
  } catch (error) {
    console.error('Application submission error:', error?.message, error?.stack);
    const msg = error?.message || '';
    if (msg.includes('SSN') || msg.includes('date of birth') || msg.includes('Invalid') || msg.includes('must be')) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: 'Something went wrong. Please try again or contact support.' }, { status: 500 });
  }
}
