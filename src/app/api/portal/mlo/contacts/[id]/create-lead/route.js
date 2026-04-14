// API: Create Lead from Contact
// POST /api/portal/mlo/contacts/:id/create-lead
// Creates a Lead record linked to an existing Contact
// Auth: MLO session required

import sql from '@/lib/db';
import { requireMloSession, unauthorizedResponse } from '@/lib/require-mlo-session';

export async function POST(req, { params }) {
  try {
    const { session, orgId } = await requireMloSession();
    if (!session) return unauthorizedResponse();

    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    // Find the contact
    const contactRows = await sql`SELECT * FROM contacts WHERE id = ${id} AND organization_id = ${orgId} LIMIT 1`;
    const contact = contactRows[0];

    if (!contact) {
      return Response.json({ error: 'Contact not found' }, { status: 404 });
    }

    // Check if there's already an active lead for this contact
    const existingLead = await sql`
      SELECT id FROM leads
      WHERE contact_id = ${contact.id} AND organization_id = ${orgId} AND status IN ('new', 'contacted', 'qualified')
      LIMIT 1
    `;

    if (existingLead[0]) {
      return Response.json({
        error: 'This contact already has an active lead',
        leadId: existingLead[0].id,
      }, { status: 409 });
    }

    // Create the lead
    const leadRows = await sql`
      INSERT INTO leads (
        organization_id, name, email, phone, source, source_detail, status,
        loan_purpose, property_state, loan_amount, credit_score_range,
        notes, contact_id, created_at, updated_at
      ) VALUES (
        ${orgId},
        ${`${contact.first_name} ${contact.last_name}`},
        ${contact.email}, ${contact.phone}, 'contact',
        ${`Created from contact by ${session.user.name || session.user.email}`},
        'new',
        ${body.loanPurpose || null}, ${body.propertyState || null},
        ${body.loanAmount ? parseFloat(body.loanAmount) : null},
        ${body.creditScoreRange || null},
        ${body.notes || null}, ${contact.id},
        NOW(), NOW()
      )
      RETURNING *
    `;

    return Response.json({ success: true, lead: leadRows[0] }, { status: 201 });
  } catch (error) {
    console.error('Create lead from contact error:', error?.message);
    return Response.json({ error: 'Failed to create lead' }, { status: 500 });
  }
}
