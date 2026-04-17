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

// Fields to copy from source LoanBorrower (primary)
const COPY_BORROWER_FIELDS = [
  'marital_status', 'current_address', 'address_years', 'address_months',
  'mailing_address', 'employment_status', 'employer_name', 'position_title',
  'years_in_position', 'monthly_base_income', 'other_monthly_income', 'other_income_source',
  'dob_encrypted', 'housing_type', 'monthly_rent', 'cell_phone',
  'declarations',
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

      // Get primary LoanBorrower
      const lbRows = await sql`
        SELECT * FROM loan_borrowers
        WHERE loan_id = ${sourceLoanId} AND borrower_type = 'primary'
        LIMIT 1
      `;
      if (lbRows[0]) {
        for (const field of COPY_BORROWER_FIELDS) {
          if (lbRows[0][field] != null) {
            sourceBorrowerData[field] = lbRows[0][field];
          }
        }
      }
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

    // Create primary LoanBorrower
    await sql`
      INSERT INTO loan_borrowers (loan_id, contact_id, borrower_type, ordinal, created_at, updated_at)
      VALUES (${newLoan.id}, ${contact.id}, 'primary', 0, NOW(), NOW())
    `;

    // Apply source borrower data via parameterized UPDATE if we have any
    if (Object.keys(sourceBorrowerData).length > 0) {
      const setClauses = [];
      const vals = [];
      for (const [col, val] of Object.entries(sourceBorrowerData)) {
        vals.push(typeof val === 'object' && val !== null ? JSON.stringify(val) : val);
        const isJson = typeof val === 'object' && val !== null;
        setClauses.push(`${col} = $${vals.length}${isJson ? '::jsonb' : ''}`);
      }
      if (setClauses.length > 0) {
        setClauses.push('updated_at = NOW()');
        vals.push(newLoan.id);
        const q = `UPDATE loan_borrowers SET ${setClauses.join(', ')} WHERE loan_id = $${vals.length} AND borrower_type = 'primary'`;
        await sql(q, vals);
      }
    }

    // Create LoanParticipant bridge record (post-migration: replaces loan_contacts)
    await sql`
      INSERT INTO loan_participants (loan_id, contact_id, role, ordinal, organization_id, created_at, updated_at)
      VALUES (${newLoan.id}, ${contact.id}, 'primary_borrower', 0, ${orgId}, NOW(), NOW())
      ON CONFLICT DO NOTHING
    `;

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
