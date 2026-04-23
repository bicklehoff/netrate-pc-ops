// API: New Deal from Contact — Clone a loan for a returning borrower
// POST /api/portal/mlo/contacts/:contactId/new-deal
//
// Creates a new Loan pre-filled from a source loan, linked to the same Contact.
// MLO picks which prior loan to use as template.

import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireMloSession, unauthorizedResponse } from '@/lib/require-mlo-session';

// Fields to copy from the source loan (deal-specific financial data)
const COPY_FIELDS = [
  'monthly_base_income', 'other_monthly_income', 'other_income_source',
  'employment_status', 'employer_name', 'position_title', 'years_in_position',
  'present_housing_expense', 'marital_status', 'num_dependents', 'dependent_ages',
  'declarations', 'credit_score',
  'current_address', 'address_years', 'address_months', 'mailing_address',
  'occupancy', 'lien_status',
];


export async function POST(request, { params }) {
  try {
    const { session, orgId, mloId } = await requireMloSession();
    if (!session) return unauthorizedResponse();

    const { id: contactId } = await params;
    const body = await request.json();
    const { sourceLoanId } = body;

    // Load contact (post-migration: contact IS the borrower)
    const contactRows = await sql`
      SELECT id, role, first_name, last_name, email, phone
      FROM contacts WHERE id = ${contactId} AND organization_id = ${orgId} LIMIT 1
    `;
    const contact = contactRows[0];

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    if (contact.role !== 'borrower') {
      // Promote to borrower so this contact can own a loan
      await sql`UPDATE contacts SET role = 'borrower', marketing_stage = 'in_process', updated_at = NOW() WHERE id = ${contact.id}`;
    }

    // Load source loan if provided
    let sourceData = {};
    let sourceBorrowerData = {};

    if (sourceLoanId) {
      const sourceLoanRows = await sql`SELECT * FROM loans WHERE id = ${sourceLoanId} AND organization_id = ${orgId} LIMIT 1`;
      const sourceLoan = sourceLoanRows[0];

      if (!sourceLoan) {
        return NextResponse.json({ error: 'Source loan not found' }, { status: 404 });
      }

      // Copy fields from source loan
      for (const field of COPY_FIELDS) {
        if (sourceLoan[field] != null) {
          sourceData[field] = sourceLoan[field];
        }
      }

      // Get source satellite data keyed on (sourceLoanId, contactId)
      const [srcHH, srcEmp, srcInc, srcDecl, srcLP] = await Promise.all([
        sql`SELECT * FROM loan_housing_history WHERE loan_id = ${sourceLoanId} AND contact_id = ${contactId} AND housing_type = 'current' LIMIT 1`,
        sql`SELECT * FROM loan_employments WHERE loan_id = ${sourceLoanId} AND contact_id = ${contactId} AND is_primary = true LIMIT 1`,
        sql`SELECT * FROM loan_incomes WHERE loan_id = ${sourceLoanId} AND contact_id = ${contactId} LIMIT 1`,
        sql`SELECT * FROM loan_declarations WHERE loan_id = ${sourceLoanId} AND contact_id = ${contactId} LIMIT 1`,
        sql`SELECT marital_status FROM loan_participants WHERE loan_id = ${sourceLoanId} AND contact_id = ${contactId} LIMIT 1`,
      ]);
      sourceBorrowerData = { srcHH: srcHH[0], srcEmp: srcEmp[0], srcInc: srcInc[0], srcDecl: srcDecl[0], srcLP: srcLP[0] };
    }

    const skipForNew = ['property_address', 'loan_amount', 'loan_type', 'loan_term', 'interest_rate', 'purpose', 'lender_name', 'loan_number', 'lender_loan_number'];

    // Insert base loan, then UPDATE with source data
    let newLoan;
    const baseInsert = await sql`
      INSERT INTO loans (organization_id, contact_id, mlo_id, status, ball_in_court, application_step, num_borrowers, created_at, updated_at)
      VALUES (${orgId}, ${contact.id}, ${mloId}, 'draft', 'mlo', 1, 1, NOW(), NOW())
      RETURNING *
    `;
    newLoan = baseInsert[0];

    // Apply source data via parameterized UPDATE if we have any
    if (Object.keys(sourceData).length > 0) {
      const setClauses = [];
      const vals = [];
      for (const [col, val] of Object.entries(sourceData)) {
        if (!skipForNew.includes(col)) {
          vals.push(typeof val === 'object' && val !== null ? JSON.stringify(val) : val);
          const isJson = typeof val === 'object' && val !== null;
          setClauses.push(`${col} = $${vals.length}${isJson ? '::jsonb' : ''}`);
        }
      }
      if (setClauses.length > 0) {
        vals.push(newLoan.id);
        const q = `UPDATE loans SET ${setClauses.join(', ')} WHERE id = $${vals.length} RETURNING *`;
        const updated = await sql(q, vals);
        newLoan = updated[0];
      }
    }

    // Create LoanParticipant (with optional marital_status from source)
    const newDealMaritalStatus = sourceBorrowerData?.srcLP?.marital_status || null;
    await sql`
      INSERT INTO loan_participants (loan_id, contact_id, role, ordinal, marital_status, organization_id, created_at, updated_at)
      VALUES (${newLoan.id}, ${contact.id}, 'primary_borrower', 0, ${newDealMaritalStatus}, ${orgId}, NOW(), NOW())
      ON CONFLICT DO NOTHING
    `;

    // Copy satellite data from source loan if available
    if (sourceBorrowerData?.srcHH) {
      const h = sourceBorrowerData.srcHH;
      await sql`INSERT INTO loan_housing_history (loan_id, contact_id, housing_type, address, residency_type, years, months, monthly_rent, ordinal) VALUES (${newLoan.id}, ${contact.id}, 'current', ${h.address}, ${h.residency_type}, ${h.years}, ${h.months}, ${h.monthly_rent}, 0)`;
    }
    if (sourceBorrowerData?.srcEmp) {
      const e = sourceBorrowerData.srcEmp;
      await sql`INSERT INTO loan_employments (id, loan_id, contact_id, is_primary, employer_name, position, years_on_job, months_on_job, self_employed, created_at, updated_at) VALUES (gen_random_uuid(), ${newLoan.id}, ${contact.id}, true, ${e.employer_name}, ${e.position}, ${e.years_on_job}, ${e.months_on_job}, ${e.self_employed ?? false}, NOW(), NOW())`;
    }
    if (sourceBorrowerData?.srcInc) {
      const inc = sourceBorrowerData.srcInc;
      await sql`INSERT INTO loan_incomes (id, loan_id, contact_id, base_monthly, overtime_monthly, bonus_monthly, commission_monthly, dividends_monthly, interest_monthly, rental_income_monthly, other_monthly, other_income_source, created_at, updated_at) VALUES (gen_random_uuid(), ${newLoan.id}, ${contact.id}, ${inc.base_monthly}, ${inc.overtime_monthly}, ${inc.bonus_monthly}, ${inc.commission_monthly}, ${inc.dividends_monthly}, ${inc.interest_monthly}, ${inc.rental_income_monthly}, ${inc.other_monthly}, ${inc.other_income_source}, NOW(), NOW())`;
    }
    if (sourceBorrowerData?.srcDecl) {
      const dc = sourceBorrowerData.srcDecl;
      await sql`INSERT INTO loan_declarations (id, loan_id, contact_id, outstanding_judgments, bankruptcy, bankruptcy_type, foreclosure, party_to_lawsuit, loan_default, alimony_obligation, delinquent_federal_debt, co_signer_on_other_loan, intent_to_occupy, ownership_interest_last_three_years, property_type_of_ownership, created_at, updated_at) VALUES (gen_random_uuid(), ${newLoan.id}, ${contact.id}, ${dc.outstanding_judgments}, ${dc.bankruptcy}, ${dc.bankruptcy_type}, ${dc.foreclosure}, ${dc.party_to_lawsuit}, ${dc.loan_default}, ${dc.alimony_obligation}, ${dc.delinquent_federal_debt}, ${dc.co_signer_on_other_loan}, ${dc.intent_to_occupy}, ${dc.ownership_interest_last_three_years}, ${dc.property_type_of_ownership}, NOW(), NOW())`;
    }

    // Audit trail
    await sql`
      INSERT INTO loan_events (loan_id, event_type, actor_type, actor_id, new_value, details, created_at)
      VALUES (
        ${newLoan.id}, 'loan_cloned_from_contact', 'mlo', ${mloId},
        'New deal created from contact',
        ${JSON.stringify({
          contactId: contact.id,
          sourceLoanId: sourceLoanId || null,
          copiedFields: Object.keys(sourceData),
        })}::jsonb,
        NOW()
      )
    `;

    return NextResponse.json({
      success: true,
      loanId: newLoan.id,
      contactId: contact.id,
      sourceLoanId: sourceLoanId || null,
    }, { status: 201 });
  } catch (error) {
    console.error('New deal from contact error:', error);
    return NextResponse.json({ error: 'Failed to create new deal' }, { status: 500 });
  }
}
