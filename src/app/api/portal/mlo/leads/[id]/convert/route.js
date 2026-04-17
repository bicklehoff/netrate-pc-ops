// POST /api/portal/mlo/leads/:id/convert
// Creates: Contact (find-or-create) + Loan (draft) + loan_participant
// Updates: Lead status → 'converted', Lead.contact_id set
// Transfers: scenarios linked to this lead get contact_id backfilled
// Auth: MLO session required

import sql from '@/lib/db';
import { normalizePhone } from '@/lib/normalize-phone';
import { requireMloSession, unauthorizedResponse } from '@/lib/require-mlo-session';

export async function POST(req, { params }) {
  try {
    const { session, orgId, mloId } = await requireMloSession();
    if (!session) return unauthorizedResponse();

    const { id } = await params;
    const leadRows = await sql`SELECT * FROM leads WHERE id = ${id} AND organization_id = ${orgId} LIMIT 1`;
    const lead = leadRows[0];

    if (!lead) {
      return Response.json({ error: 'Lead not found' }, { status: 404 });
    }
    if (lead.status === 'converted') {
      return Response.json({ error: 'Lead already converted' }, { status: 409 });
    }
    if (!lead.email) {
      return Response.json({ error: 'Lead must have an email to convert' }, { status: 400 });
    }

    const emailLower = lead.email.toLowerCase().trim();
    const assignedMloId = lead.mlo_id || mloId;

    const nameParts = (lead.name || '').trim().split(/\s+/);
    const firstName = nameParts[0] || 'Unknown';
    const lastName = nameParts.slice(1).join(' ') || 'Unknown';

    const result = await sql.begin(async (tx) => {
      // ─── 1. Find or create Contact ────────────────────────────
      let contactRows = await tx`
        SELECT * FROM contacts
        WHERE lower(email) = ${emailLower} AND organization_id = ${orgId}
        ORDER BY created_at ASC LIMIT 1
      `;
      let contact = contactRows[0];

      if (!contact) {
        // contacts.id has no DB default — must generate explicitly.
        const created = await tx`
          INSERT INTO contacts (
            id, organization_id, first_name, last_name, email, phone,
            source, role, marketing_stage, assigned_mlo_id,
            created_at, updated_at
          ) VALUES (
            gen_random_uuid(), ${orgId}, ${firstName}, ${lastName}, ${emailLower},
            ${normalizePhone(lead.phone) || lead.phone || null},
            ${lead.source || 'lead'}, 'borrower', 'in_process', ${assignedMloId},
            NOW(), NOW()
          )
          RETURNING *
        `;
        contact = created[0];
      } else {
        await tx`
          UPDATE contacts SET
            role = 'borrower',
            marketing_stage = 'in_process',
            assigned_mlo_id = COALESCE(assigned_mlo_id, ${assignedMloId}),
            updated_at = NOW()
          WHERE id = ${contact.id} AND organization_id = ${orgId}
        `;
      }

      // ─── 2. Create Loan (draft) ───────────────────────────────
      const propertyAddress = lead.property_state
        ? JSON.stringify({ state: lead.property_state, county: lead.property_county || null })
        : null;

      // loans.id has no DB default — must generate explicitly.
      const loanRows = await tx`
        INSERT INTO loans (
          id, organization_id, contact_id, mlo_id, status, ball_in_court,
          purpose, occupancy, property_type,
          loan_amount, purchase_price, down_payment, estimated_value, current_balance,
          credit_score, employment_status, property_address,
          lead_source, referral_source, application_channel,
          num_borrowers, application_step, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), ${orgId}, ${contact.id}, ${assignedMloId}, 'draft', 'mlo',
          ${lead.loan_purpose || null}, ${lead.occupancy || null}, ${lead.property_type || null},
          ${lead.loan_amount || null}, ${lead.purchase_price || lead.property_value || null},
          ${lead.down_payment || null}, ${lead.property_value || null}, ${lead.current_balance || null},
          ${lead.credit_score || null}, ${lead.employment_type || null},
          ${propertyAddress}::jsonb,
          ${lead.source || null},
          ${lead.source === 'contact' ? 'past_client' : (lead.source || null)},
          'lead_conversion',
          1, 1, NOW(), NOW()
        )
        RETURNING *
      `;
      const loan = loanRows[0];

      // ─── 3. Create loan_participant ───────────────────────────
      await tx`
        INSERT INTO loan_participants (
          loan_id, contact_id, role, ordinal, organization_id, created_at, updated_at
        ) VALUES (
          ${loan.id}, ${contact.id}, 'primary_borrower', 0, ${orgId}, NOW(), NOW()
        )
      `;

      // ─── 4. Transfer scenarios from lead to contact ───────────
      const transferred = await tx`
        UPDATE scenarios
        SET contact_id = ${contact.id}, updated_at = NOW()
        WHERE lead_id = ${id}
          AND organization_id = ${orgId}
          AND contact_id IS NULL
        RETURNING id
      `;

      // ─── 5. Create LoanEvent ──────────────────────────────────
      // loan_events.id has no DB default — must generate explicitly.
      await tx`
        INSERT INTO loan_events (
          id, loan_id, event_type, actor_type, actor_id, old_value, new_value, details, created_at
        ) VALUES (
          gen_random_uuid(), ${loan.id}, 'status_change', 'mlo', ${mloId}, NULL, 'draft',
          ${JSON.stringify({
            source: 'lead_conversion',
            leadId: lead.id,
            leadSource: lead.source,
            scenariosTransferred: transferred.length,
          })}::jsonb,
          NOW()
        )
      `;

      // ─── 6. Update Lead → converted ──────────────────────────
      await tx`
        UPDATE leads
        SET status = 'converted', contact_id = ${contact.id}, updated_at = NOW()
        WHERE id = ${id} AND organization_id = ${orgId}
      `;

      return { loanId: loan.id, contactId: contact.id, scenariosTransferred: transferred.length };
    });

    return Response.json({ success: true, ...result }, { status: 201 });
  } catch (error) {
    console.error('[leads/convert] error:', error?.message);
    return Response.json({ error: 'Failed to convert lead' }, { status: 500 });
  }
}
