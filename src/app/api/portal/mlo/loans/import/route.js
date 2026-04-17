// API: MISMO XML Import
// POST /api/portal/mlo/loans/import — Preview: parse XML, return extracted data (no DB writes)
// PUT  /api/portal/mlo/loans/import — Commit: parse XML, create borrower + loan + loanBorrower records
//
// Accepts: multipart FormData with an XML file
// Auth: MLO or Admin required (NextAuth session)

import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { encrypt, ssnLastFour } from '@/lib/encryption';
import { parseMismoXml } from '@/lib/mismo-parser';
import { createLoanFolder } from '@/lib/zoho-workdrive';
import { requireMloSession, unauthorizedResponse } from '@/lib/require-mlo-session';

// ─── POST: Preview (parse only, no DB writes) ──────────────

export async function POST(request) {
  try {
    const { session } = await requireMloSession();
    if (!session) return unauthorizedResponse();

    const xmlString = await extractXmlFromRequest(request);
    const result = parseMismoXml(xmlString);

    // Strip SSN from preview (show only last 4)
    const previewBorrowers = result.borrowers.map((b) => ({
      ...b,
      ssn: b.ssn ? `***-**-${b.ssn.slice(-4)}` : null,
    }));

    return NextResponse.json({
      success: true,
      preview: true,
      loan: result.loan,
      borrowers: previewBorrowers,
      property: result.property,
      assets: result.assets,
      liabilities: result.liabilities,
      reos: result.reos,
      transaction: result.transaction,
      stats: result.stats,
    });
  } catch (error) {
    console.error('MISMO preview error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to parse XML file' },
      { status: 400 }
    );
  }
}

// ─── PUT: Commit (create records) ───────────────────────────

export async function PUT(request) {
  try {
    const { session, orgId, mloId } = await requireMloSession();
    if (!session) return unauthorizedResponse();

    const formData = await request.formData();
    const file = formData.get('file');
    const statusOverride = formData.get('status') || 'processing';
    const assignMloId = formData.get('mloId') || null;

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No XML file provided' }, { status: 400 });
    }

    const xmlString = await file.text();
    const result = parseMismoXml(xmlString);

    if (!result.primaryBorrower) {
      return NextResponse.json({ error: 'No borrower found in XML' }, { status: 400 });
    }

    const primary = result.primaryBorrower;

    if (!primary.firstName || !primary.lastName) {
      return NextResponse.json({ error: 'Borrower name is required' }, { status: 400 });
    }

    if (!process.env.PII_ENCRYPTION_KEY) {
      console.error('FATAL: PII_ENCRYPTION_KEY not set');
      return NextResponse.json({ error: 'Server configuration error. Contact support.' }, { status: 500 });
    }

    // ─── Create/Update Primary Borrower ───────────────────
    const borrower = await upsertBorrowerFromImport(primary, orgId);

    // ─── Create Loan Record ───────────────────────────────
    const loanData = result.loan;
    const propAddress = result.property?.address || null;

    const loanRows = await sql`
      INSERT INTO loans (id, organization_id, contact_id, mlo_id, status, ball_in_court, purpose, occupancy,
        loan_type, lender_name, loan_number, loan_amount, interest_rate, loan_term,
        property_address, property_type, num_units, purchase_price, estimated_value,
        current_address, address_years, address_months, marital_status,
        employment_status, employer_name, position_title, years_in_position,
        monthly_base_income, other_monthly_income, other_income_source,
        present_housing_expense, declarations, num_borrowers, application_step, submitted_at,
        created_at, updated_at)
      VALUES (gen_random_uuid(), ${orgId}, ${borrower.id}, ${assignMloId || mloId}, ${statusOverride}, 'mlo',
        ${loanData.purpose}, ${loanData.occupancy},
        ${loanData.loanType}, ${loanData.lenderName}, ${loanData.loanNumber},
        ${loanData.loanAmount}, ${loanData.interestRate}, ${loanData.loanTerm},
        ${propAddress ? JSON.stringify(propAddress) : null}, ${loanData.propertyType}, ${loanData.numUnits},
        ${loanData.purchasePrice}, ${loanData.estimatedValue},
        ${primary.currentAddress ? JSON.stringify(primary.currentAddress) : null},
        ${primary.addressYears}, ${primary.addressMonths}, ${primary.maritalStatus},
        ${primary.employmentStatus}, ${primary.employerName}, ${primary.positionTitle},
        ${primary.yearsInPosition}, ${primary.monthlyBaseIncome}, ${primary.otherMonthlyIncome},
        ${primary.otherIncomeSource}, ${loanData.presentHousingExpense},
        ${primary.declarations ? JSON.stringify(primary.declarations) : null},
        ${result.borrowers.length}, 6, NOW(), NOW(), NOW())
      RETURNING *
    `;
    const loan = loanRows[0];

    // ─── Create LoanBorrower for Primary ──────────────────
    const primaryLBRows = await sql`
      INSERT INTO loan_borrowers (id, loan_id, contact_id, borrower_type, ordinal,
        marital_status, citizenship, housing_type, monthly_rent,
        current_address, address_years, address_months,
        previous_address, previous_address_years, previous_address_months,
        cell_phone, suffix, employment_status, employer_name, position_title,
        years_in_position, monthly_base_income, other_monthly_income, other_income_source,
        declarations, created_at, updated_at)
      VALUES (gen_random_uuid(), ${loan.id}, ${borrower.id}, 'primary', 0,
        ${primary.maritalStatus}, ${primary.citizenship}, ${primary.housingType}, ${primary.monthlyRent},
        ${primary.currentAddress ? JSON.stringify(primary.currentAddress) : null},
        ${primary.addressYears}, ${primary.addressMonths},
        ${primary.previousAddress ? JSON.stringify(primary.previousAddress) : null},
        ${primary.previousAddressYears}, ${primary.previousAddressMonths},
        ${primary.cellPhone}, ${primary.suffix}, ${primary.employmentStatus},
        ${primary.employerName}, ${primary.positionTitle}, ${primary.yearsInPosition},
        ${primary.monthlyBaseIncome}, ${primary.otherMonthlyIncome}, ${primary.otherIncomeSource},
        ${primary.declarations ? JSON.stringify(primary.declarations) : null}, NOW(), NOW())
      RETURNING *
    `;
    const primaryLB = primaryLBRows[0];

    // Create 1003 sub-models for primary borrower
    await create1003BorrowerModels(primaryLB.id, primary);

    // ─── Create Co-Borrower Records ───────────────────────
    for (const cb of result.coBorrowers) {
      if (!cb.firstName || !cb.lastName) continue;

      const cbBorrower = await upsertBorrowerFromImport(cb, orgId);

      const cbLBRows = await sql`
        INSERT INTO loan_borrowers (id, loan_id, contact_id, borrower_type, ordinal,
          marital_status, citizenship, housing_type, monthly_rent,
          current_address, address_years, address_months,
          previous_address, previous_address_years, previous_address_months,
          cell_phone, suffix, employment_status, employer_name, position_title,
          years_in_position, monthly_base_income, other_monthly_income, other_income_source,
          declarations, created_at, updated_at)
        VALUES (gen_random_uuid(), ${loan.id}, ${cbBorrower.id}, 'co_borrower', ${cb.ordinal},
          ${cb.maritalStatus}, ${cb.citizenship}, ${cb.housingType}, ${cb.monthlyRent},
          ${cb.currentAddress ? JSON.stringify(cb.currentAddress) : null},
          ${cb.addressYears}, ${cb.addressMonths},
          ${cb.previousAddress ? JSON.stringify(cb.previousAddress) : null},
          ${cb.previousAddressYears}, ${cb.previousAddressMonths},
          ${cb.cellPhone}, ${cb.suffix}, ${cb.employmentStatus},
          ${cb.employerName}, ${cb.positionTitle}, ${cb.yearsInPosition},
          ${cb.monthlyBaseIncome}, ${cb.otherMonthlyIncome}, ${cb.otherIncomeSource},
          ${cb.declarations ? JSON.stringify(cb.declarations) : null}, NOW(), NOW())
        RETURNING *
      `;

      await create1003BorrowerModels(cbLBRows[0].id, cb);
    }

    // ─── Create Loan-Level 1003 Models ────────────────────
    await create1003LoanModels(loan.id, result);

    // ─── Tag contacts with import source (borrower upsert above already created contact) ─
    await tagContactSource(borrower.id, 'xml_import', orgId);

    for (const cb of result.coBorrowers) {
      if (!cb.firstName || !cb.lastName) continue;
      const cbContactRows = await sql`
        SELECT * FROM contacts WHERE first_name = ${cb.firstName} AND last_name = ${cb.lastName} AND organization_id = ${orgId}
        ORDER BY created_at DESC LIMIT 1
      `;
      if (cbContactRows[0]) {
        await tagContactSource(cbContactRows[0].id, 'xml_import', orgId);
      }
    }

    // ─── Audit Trail ──────────────────────────────────────
    await sql`
      INSERT INTO loan_events (id, loan_id, event_type, actor_type, actor_id, old_value, new_value, details, created_at)
      VALUES (gen_random_uuid(), ${loan.id}, 'status_change', 'mlo', ${mloId}, NULL, ${statusOverride},
              ${JSON.stringify({ source: 'mismo_xml_import', numBorrowers: result.borrowers.length, loanNumber: loanData.loanNumber, lenderName: loanData.lenderName })},
              NOW())
    `;

    // ─── WorkDrive Folder (non-blocking) ──────────────────
    try {
      const folder = await createLoanFolder({
        borrowerFirstName: primary.firstName,
        borrowerLastName: primary.lastName,
        purpose: loanData.purpose || 'purchase',
      });

      await sql`
        UPDATE loans SET work_drive_folder_id = ${folder.rootFolderId}, work_drive_subfolders = ${JSON.stringify(folder.subfolders)}, updated_at = NOW()
        WHERE id = ${loan.id}
      `;

      console.log(`WorkDrive folder created for imported loan ${loan.id}: ${folder.rootFolderId}`);
    } catch (wdError) {
      console.error('WorkDrive folder creation failed for import (non-fatal):', wdError?.message);
    }

    return NextResponse.json({
      success: true,
      loan_id: loan.id,
      contact_id: borrower.id,
      borrower_name: `${primary.firstName} ${primary.lastName}`,
      loan_number: loanData.loanNumber,
      status: statusOverride,
    });
  } catch (error) {
    console.error('MISMO import error:', error?.message, error?.stack);
    return NextResponse.json(
      { error: error?.message || 'Import failed. Please check the XML file format.' },
      { status: 500 }
    );
  }
}

// ─── Helpers ──────────────────────────────────────────────

async function extractXmlFromRequest(request) {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || typeof file === 'string') {
      throw new Error('No XML file provided');
    }
    return await file.text();
  }

  return await request.text();
}

async function upsertBorrowerFromImport({ firstName, lastName, email, phone, ssn, dob }, orgId) {
  const borrowerEmail = email
    ? email.toLowerCase().trim()
    : `${(firstName || 'unknown').toLowerCase()}.${(lastName || 'unknown').toLowerCase()}.import.${Date.now()}@placeholder.netrate.local`;

  let ssnEncrypted;
  let lastFour;
  if (ssn && ssn.replace(/\D/g, '').length === 9) {
    const ssnDigits = ssn.replace(/\D/g, '');
    ssnEncrypted = encrypt(ssnDigits);
    lastFour = ssnLastFour(ssnDigits);
  } else {
    ssnEncrypted = encrypt('000000000');
    lastFour = '0000';
  }

  const dobEncrypted = dob ? encrypt(String(dob)) : encrypt('1900-01-01');

  // Check if contact exists by email
  const existingRows = await sql`SELECT * FROM contacts WHERE email = ${borrowerEmail} AND organization_id = ${orgId} LIMIT 1`;

  if (existingRows.length > 0) {
    const existing = existingRows[0];
    const updatedRows = await sql`
      UPDATE contacts SET first_name = ${firstName || existing.first_name}, last_name = ${lastName || existing.last_name},
        phone = ${phone || existing.phone}, dob_encrypted = ${dobEncrypted}, ssn_encrypted = ${ssnEncrypted}, ssn_last_four = ${lastFour},
        role = 'borrower', marketing_stage = 'in_process', updated_at = NOW()
      WHERE email = ${borrowerEmail} AND organization_id = ${orgId} RETURNING *
    `;
    return updatedRows[0];
  } else {
    const newRows = await sql`
      INSERT INTO contacts (id, organization_id, email, first_name, last_name, phone, dob_encrypted, ssn_encrypted, ssn_last_four, role, marketing_stage, created_at, updated_at)
      VALUES (gen_random_uuid(), ${orgId}, ${borrowerEmail}, ${firstName || 'Unknown'}, ${lastName || 'Unknown'}, ${phone || null}, ${dobEncrypted}, ${ssnEncrypted}, ${lastFour}, 'borrower', 'in_process', NOW(), NOW())
      RETURNING *
    `;
    return newRows[0];
  }
}

async function tagContactSource(contactId, source, orgId) {
  try {
    await sql`
      UPDATE contacts SET source = COALESCE(source, ${source}), tags = COALESCE(tags, ${['borrower']}), updated_at = NOW()
      WHERE id = ${contactId} AND organization_id = ${orgId}
    `;
  } catch (error) {
    console.error('Contact source tag failed (non-fatal):', error?.message);
  }
}

async function create1003BorrowerModels(loanBorrowerId, borrowerData) {
  try {
    // Employments
    if (borrowerData.employments?.length > 0) {
      for (const emp of borrowerData.employments) {
        if (!emp) continue;
        await sql`
          INSERT INTO loan_employments (id, loan_borrower_id, is_primary, employer_name, employer_address, employer_phone, position, start_date, end_date, years_on_job, months_on_job, self_employed, created_at, updated_at)
          VALUES (gen_random_uuid(), ${loanBorrowerId}, ${emp.isPrimary ?? true}, ${emp.employerName || null},
                  ${emp.employerAddress ? JSON.stringify(emp.employerAddress) : null}, ${emp.employerPhone || null},
                  ${emp.position || null}, ${emp.startDate ? new Date(emp.startDate) : null}, ${emp.endDate ? new Date(emp.endDate) : null},
                  ${emp.yearsOnJob || null}, ${emp.monthsOnJob || null}, ${emp.selfEmployed ?? false}, NOW(), NOW())
        `;
      }
    }

    // Income
    const inc = borrowerData.detailedIncome;
    if (inc) {
      const hasAnyIncome = inc.baseMonthly || inc.overtimeMonthly || inc.bonusMonthly
        || inc.commissionMonthly || inc.dividendsMonthly || inc.interestMonthly
        || inc.rentalIncomeMonthly || inc.otherMonthly;
      if (hasAnyIncome) {
        await sql`
          INSERT INTO loan_incomes (id, loan_borrower_id, base_monthly, overtime_monthly, bonus_monthly, commission_monthly, dividends_monthly, interest_monthly, rental_income_monthly, other_monthly, other_income_source, created_at, updated_at)
          VALUES (gen_random_uuid(), ${loanBorrowerId}, ${inc.baseMonthly || null}, ${inc.overtimeMonthly || null},
                  ${inc.bonusMonthly || null}, ${inc.commissionMonthly || null}, ${inc.dividendsMonthly || null},
                  ${inc.interestMonthly || null}, ${inc.rentalIncomeMonthly || null}, ${inc.otherMonthly || null},
                  ${inc.otherIncomeSource || null}, NOW(), NOW())
        `;
      }
    }

    // Declarations
    const decl = borrowerData.structuredDeclaration;
    if (decl) {
      await sql`
        INSERT INTO loan_declarations (id, loan_borrower_id, outstanding_judgments, bankruptcy, bankruptcy_type, foreclosure, party_to_lawsuit, loan_default, alimony_obligation, delinquent_federal_debt, co_signer_on_other_loan, intent_to_occupy, ownership_interest_last_three_years, property_type_of_ownership, created_at, updated_at)
        VALUES (gen_random_uuid(), ${loanBorrowerId}, ${decl.outstandingJudgments ?? null}, ${decl.bankruptcy ?? null},
                ${decl.bankruptcyType || null}, ${decl.foreclosure ?? null}, ${decl.partyToLawsuit ?? null},
                ${decl.loanDefault ?? null}, ${decl.alimonyObligation ?? null}, ${decl.delinquentFederalDebt ?? null},
                ${decl.coSignerOnOtherLoan ?? null}, ${decl.intentToOccupy ?? null},
                ${decl.ownershipInterestLastThreeYears ?? null}, ${decl.propertyTypeOfOwnership || null}, NOW(), NOW())
      `;
    }
  } catch (error) {
    console.error('1003 borrower models creation failed (non-fatal):', error?.message);
  }
}

async function create1003LoanModels(loanId, result) {
  try {
    // Assets
    for (const asset of (result.assets || [])) {
      await sql`
        INSERT INTO loan_assets (id, loan_id, borrower_type, institution, account_type, account_number, balance, is_joint, created_at, updated_at)
        VALUES (gen_random_uuid(), ${loanId}, NULL, ${asset.institution || null}, ${asset.accountType || null},
                ${asset.accountNumber || null}, ${asset.balance || null}, false, NOW(), NOW())
      `;
    }

    // Liabilities
    for (const liab of (result.liabilities || [])) {
      await sql`
        INSERT INTO loan_liabilities (id, loan_id, creditor, account_number, liability_type, monthly_payment, unpaid_balance, months_remaining, paid_off_at_closing, created_at, updated_at)
        VALUES (gen_random_uuid(), ${loanId}, ${liab.creditor || null}, ${liab.accountNumber || null},
                ${liab.liabilityType || null}, ${liab.monthlyPayment || null}, ${liab.unpaidBalance || null},
                ${liab.monthsRemaining || null}, ${liab.paidOffAtClosing ?? false}, NOW(), NOW())
      `;
    }

    // REOs
    for (const reo of (result.reos || [])) {
      await sql`
        INSERT INTO loan_reos (id, loan_id, address, property_type, present_market_value, mortgage_balance, mortgage_payment, gross_rental_income, net_rental_income, insurance_taxes_maintenance, status, created_at, updated_at)
        VALUES (gen_random_uuid(), ${loanId}, ${reo.address ? JSON.stringify(reo.address) : null}, ${reo.propertyType || null},
                ${reo.presentMarketValue || null}, ${reo.mortgageBalance || null}, ${reo.mortgagePayment || null},
                ${reo.grossRentalIncome || null}, ${reo.netRentalIncome || null},
                ${reo.insuranceTaxesMaintenance || null}, ${reo.status || 'retained'}, NOW(), NOW())
      `;
    }

    // Transaction
    const tx = result.transaction;
    if (tx) {
      const hasTxData = tx.purchasePrice || tx.closingCostsEstimate || tx.discountPoints
        || tx.sellerConcessions || tx.cashFromBorrower;
      if (hasTxData) {
        await sql`
          INSERT INTO loan_transactions (id, loan_id, purchase_price, closing_costs_estimate, discount_points, seller_concessions, cash_from_borrower, created_at, updated_at)
          VALUES (gen_random_uuid(), ${loanId}, ${tx.purchasePrice || null}, ${tx.closingCostsEstimate || null},
                  ${tx.discountPoints || null}, ${tx.sellerConcessions || null}, ${tx.cashFromBorrower || null}, NOW(), NOW())
        `;
      }
    }

    // Update loan with amortization type
    if (result.loan.amortizationType) {
      await sql`UPDATE loans SET amortization_type = ${result.loan.amortizationType}, updated_at = NOW() WHERE id = ${loanId}`;
    }
  } catch (error) {
    console.error('1003 loan models creation failed (non-fatal):', error?.message);
  }
}
