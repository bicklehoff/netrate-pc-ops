// API: Contact Loan History — all loans linked to a contact
// GET /api/portal/mlo/contacts/:contactId/loans

import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireMloSession, unauthorizedResponse } from '@/lib/require-mlo-session';

export async function GET(request, { params }) {
  try {
    const { session, orgId } = await requireMloSession();
    if (!session) return unauthorizedResponse();

    const { id: contactId } = await params;

    const contactRows = await sql`
      SELECT id, first_name, last_name, borrower_id FROM contacts WHERE id = ${contactId} AND organization_id = ${orgId} LIMIT 1
    `;
    const contact = contactRows[0];

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    // Find loans via contact_id (direct) OR via borrower_id (legacy)
    let loans;
    if (contact.borrower_id) {
      loans = await sql`
        SELECT l.id, l.status, l.loan_amount, l.loan_type, l.purpose, l.property_address,
          l.lender_name, l.interest_rate, l.loan_term, l.closing_date, l.funding_date,
          l.created_at, l.updated_at, l.is_application, l.application_date,
          m.first_name AS mlo_first_name, m.last_name AS mlo_last_name, m.nmls AS mlo_nmls
        FROM loans l
        LEFT JOIN mlos m ON m.id = l.mlo_id
        WHERE (l.contact_id = ${contactId} OR l.borrower_id = ${contact.borrower_id}) AND l.organization_id = ${orgId}
        ORDER BY l.created_at DESC
      `;
    } else {
      loans = await sql`
        SELECT l.id, l.status, l.loan_amount, l.loan_type, l.purpose, l.property_address,
          l.lender_name, l.interest_rate, l.loan_term, l.closing_date, l.funding_date,
          l.created_at, l.updated_at, l.is_application, l.application_date,
          m.first_name AS mlo_first_name, m.last_name AS mlo_last_name, m.nmls AS mlo_nmls
        FROM loans l
        LEFT JOIN mlos m ON m.id = l.mlo_id
        WHERE l.contact_id = ${contactId} AND l.organization_id = ${orgId}
        ORDER BY l.created_at DESC
      `;
    }

    // Convert Decimals for JSON
    const formatted = loans.map((loan) => ({
      ...loan,
      loan_amount: loan.loan_amount ? Number(loan.loan_amount) : null,
      interest_rate: loan.interest_rate ? Number(loan.interest_rate) : null,
      mlo: loan.mlo_first_name ? { first_name: loan.mlo_first_name, last_name: loan.mlo_last_name, nmls: loan.mlo_nmls } : null,
      canUseAsTemplate: ['funded', 'settled', 'archived', 'denied'].includes(loan.status),
    }));

    return NextResponse.json({
      contact: { id: contact.id, first_name: contact.first_name, last_name: contact.last_name },
      loans: formatted,
      totalLoans: formatted.length,
    });
  } catch (error) {
    console.error('Contact loans error:', error);
    return NextResponse.json({ error: 'Failed to fetch contact loans' }, { status: 500 });
  }
}
