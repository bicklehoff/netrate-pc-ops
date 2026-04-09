// API: Create Lead from Contact
// POST /api/portal/mlo/contacts/:id/create-lead
// Creates a Lead record linked to an existing Contact
// Auth: MLO session required

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import sql from '@/lib/db';

export async function POST(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.userType === 'mlo') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    // Find the contact
    const contactRows = await sql`SELECT * FROM contacts WHERE id = ${id} LIMIT 1`;
    const contact = contactRows[0];

    if (!contact) {
      return Response.json({ error: 'Contact not found' }, { status: 404 });
    }

    // Check if there's already an active lead for this contact
    const existingLead = await sql`
      SELECT id FROM leads
      WHERE contact_id = ${contact.id} AND status IN ('new', 'contacted', 'qualified')
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
        name, email, phone, source, source_detail, status,
        loan_purpose, property_state, loan_amount, credit_score_range,
        notes, contact_id, created_at, updated_at
      ) VALUES (
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
