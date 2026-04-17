// API: Contact Detail
// GET  /api/portal/mlo/contacts/:id — Full contact with relations
// PATCH /api/portal/mlo/contacts/:id — Update contact fields
// Auth: MLO session required

import sql from '@/lib/db';
import { requireMloSession, unauthorizedResponse } from '@/lib/require-mlo-session';

export async function GET(req, { params }) {
  try {
    const { session, orgId } = await requireMloSession();
    if (!session) return unauthorizedResponse();

    const { id } = await params;

    // Main contact with assigned MLO
    const contactRows = await sql`
      SELECT c.*,
        json_build_object('id', m.id, 'first_name', m.first_name, 'last_name', m.last_name, 'email', m.email) AS assigned_mlo
      FROM contacts c
      LEFT JOIN staff m ON m.id = c.assigned_mlo_id
      WHERE c.id = ${id} AND c.organization_id = ${orgId}
      LIMIT 1
    `;
    const contact = contactRows[0];

    if (!contact) {
      return Response.json({ error: 'Contact not found' }, { status: 404 });
    }

    // Fetch related data in parallel
    const [borrowerData, leads, contactNotes, callLogs, smsMessages] = await Promise.all([
      // Borrower role + loans (post-migration: contact IS borrower)
      contact.role === 'borrower'
        ? sql`
            SELECT c.id, c.email, c.first_name, c.last_name, c.phone, c.phone_verified,
              COALESCE(json_agg(
                json_build_object(
                  'id', l.id, 'status', l.status, 'purpose', l.purpose,
                  'loan_amount', l.loan_amount, 'interest_rate', l.interest_rate,
                  'loan_term', l.loan_term, 'lender_name', l.lender_name,
                  'loan_number', l.loan_number, 'property_address', l.property_address,
                  'property_type', l.property_type, 'created_at', l.created_at,
                  'submitted_at', l.submitted_at
                ) ORDER BY l.created_at DESC
              ) FILTER (WHERE l.id IS NOT NULL), '[]') AS loans
            FROM contacts c
            LEFT JOIN loans l ON l.contact_id = c.id
            WHERE c.id = ${contact.id} AND c.organization_id = ${orgId}
            GROUP BY c.id
          `
        : [],
      // Leads
      sql`
        SELECT id, name, status, source, source_detail, loan_purpose, loan_amount,
          property_state, credit_score, created_at
        FROM leads WHERE contact_id = ${id} AND organization_id = ${orgId}
        ORDER BY created_at DESC LIMIT 10
      `,
      // Contact notes
      sql`SELECT * FROM contact_notes WHERE contact_id = ${id} ORDER BY created_at DESC LIMIT 20`,
      // Call logs with latest note
      sql`
        SELECT cl.id, cl.direction, cl.from_number, cl.to_number, cl.status, cl.duration, cl.started_at,
          (SELECT json_build_object('content', cn.content, 'disposition', cn.disposition, 'created_at', cn.created_at)
           FROM call_notes cn WHERE cn.call_log_id = cl.id ORDER BY cn.created_at DESC LIMIT 1) AS latest_note
        FROM call_logs cl
        WHERE cl.contact_id = ${id} AND cl.organization_id = ${orgId}
        ORDER BY cl.started_at DESC LIMIT 20
      `,
      // SMS messages
      sql`
        SELECT id, direction, body, status, sent_at
        FROM sms_messages WHERE contact_id = ${id} AND organization_id = ${orgId}
        ORDER BY sent_at DESC LIMIT 20
      `,
    ]);

    const borrower = borrowerData[0] || null;

    // Format call logs to match expected shape
    const formattedCallLogs = callLogs.map(cl => ({
      ...cl,
      notes: cl.latest_note ? [cl.latest_note] : [],
    }));

    return Response.json({
      contact: {
        ...contact,
        assigned_mlo: contact.assigned_mlo?.id ? contact.assigned_mlo : null,
        borrower,
        leads,
        contactNotes: contactNotes,
        callLogs: formattedCallLogs,
        smsMessages,
      },
    });
  } catch (error) {
    console.error('Contact detail error:', error?.message);
    return Response.json({ error: 'Failed to load contact' }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  try {
    const { session, orgId } = await requireMloSession();
    if (!session) return unauthorizedResponse();

    const { id } = await params;
    const body = await req.json();

    // Allowlist of updatable fields: camelCase body key → snake_case DB column
    const fieldMap = {
      firstName: 'first_name',
      lastName: 'last_name',
      email: 'email',
      phone: 'phone',
      company: 'company',
      notes: 'notes',
      tags: 'tags',
      status: 'status',
      contactType: 'contact_type',
      assignedMloId: 'assigned_mlo_id',
      newsletterOptIn: 'newsletter_opt_in',
      strikeRateOptIn: 'strike_rate_opt_in',
      emailOptOut: 'email_opt_out',
      smsOptOut: 'sms_opt_out',
      lastContactedAt: 'last_contacted_at',
      nextFollowUp: 'next_follow_up',
      leadScore: 'lead_score',
      propertyAddress: 'property_address',
      currentLoanAmount: 'current_loan_amount',
      currentRate: 'current_rate',
      currentLoanTerm: 'current_loan_term',
      homeValue: 'home_value',
      fundedDate: 'funded_date',
      anniversaryDate: 'anniversary_date',
      coBorrowerName: 'co_borrower_name',
      coBorrowerEmail: 'co_borrower_email',
      coBorrowerPhone: 'co_borrower_phone',
      dateOfBirth: 'date_of_birth',
      mailingAddress: 'mailing_address',
      city: 'city',
      state: 'state',
      zipCode: 'zip_code',
    };

    const setClauses = [];
    const values = [];

    for (const [bodyKey, dbCol] of Object.entries(fieldMap)) {
      if (body[bodyKey] !== undefined) {
        let val = body[bodyKey];
        if (bodyKey === 'email' && val) {
          val = val.toLowerCase().trim();
        }
        values.push(val);
        setClauses.push(`${dbCol} = $${values.length}`);
      }
    }

    if (body.email) {
      const emailVal = body.email.toLowerCase().trim();
      const existing = await sql`SELECT id FROM contacts WHERE email = ${emailVal} AND id != ${id} AND organization_id = ${orgId} LIMIT 1`;
      if (existing[0]) {
        return Response.json({ error: 'A contact with this email already exists' }, { status: 409 });
      }
    }

    if (setClauses.length === 0) {
      return Response.json({ error: 'Nothing to update' }, { status: 400 });
    }

    setClauses.push('updated_at = NOW()');
    values.push(id);

    values.push(orgId);
    const query = `UPDATE contacts SET ${setClauses.join(', ')} WHERE id = $${values.length - 1} AND organization_id = $${values.length} RETURNING *`;
    const contactRows = await sql(query, values);

    return Response.json({ success: true, contact: contactRows[0] });
  } catch (error) {
    console.error('Contact update error:', error?.message);
    return Response.json({ error: 'Failed to update contact' }, { status: 500 });
  }
}
