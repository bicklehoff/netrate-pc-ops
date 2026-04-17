// POST /api/portal/mlo/leads/:id/convert
// Creates: Contact (find-or-create) + Loan (draft) + loan_participant
// Updates: Lead status → 'converted', Lead.contact_id set
// Transfers: scenarios linked to this lead get contact_id backfilled
// Auth: MLO session required
//
// Implemented as a single monolithic CTE statement. The Neon HTTP driver
// (@neondatabase/serverless) is stateless and cannot span a multi-statement
// transaction. Postgres wraps any single statement in an implicit
// transaction, so collapsing the whole flow into one statement gives us
// atomicity without needing Pool + ws.

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

    const propertyAddress = lead.property_state
      ? JSON.stringify({ state: lead.property_state, county: lead.property_county || null })
      : null;

    const referralSource = lead.source === 'contact' ? 'past_client' : (lead.source || null);
    const leadEventDetails = JSON.stringify({
      source: 'lead_conversion',
      leadId: lead.id,
      leadSource: lead.source,
    });

    // Single atomic statement. CTEs run in one implicit transaction;
    // if any step fails, Postgres rolls the whole thing back.
    const rows = await sql`
      WITH existing_contact AS (
        SELECT id FROM contacts
        WHERE lower(email) = ${emailLower} AND organization_id = ${orgId}
        ORDER BY created_at ASC LIMIT 1
      ),
      updated_contact AS (
        UPDATE contacts SET
          role = 'borrower',
          marketing_stage = 'in_process',
          assigned_mlo_id = COALESCE(assigned_mlo_id, ${assignedMloId}),
          updated_at = NOW()
        WHERE id IN (SELECT id FROM existing_contact)
        RETURNING id
      ),
      inserted_contact AS (
        INSERT INTO contacts (
          id, organization_id, first_name, last_name, email, phone,
          source, role, marketing_stage, assigned_mlo_id,
          created_at, updated_at
        )
        SELECT
          gen_random_uuid(), ${orgId}, ${firstName}, ${lastName}, ${emailLower},
          ${normalizePhone(lead.phone) || lead.phone || null},
          ${lead.source || 'lead'}, 'borrower', 'in_process', ${assignedMloId},
          NOW(), NOW()
        WHERE NOT EXISTS (SELECT 1 FROM existing_contact)
        RETURNING id
      ),
      contact AS (
        SELECT id FROM updated_contact
        UNION ALL
        SELECT id FROM inserted_contact
      ),
      new_loan AS (
        INSERT INTO loans (
          id, organization_id, contact_id, mlo_id, status, ball_in_court,
          purpose, occupancy, property_type,
          loan_amount, purchase_price, down_payment, estimated_value, current_balance,
          credit_score, employment_status, property_address,
          lead_source, referral_source, application_channel,
          num_borrowers, application_step, created_at, updated_at
        )
        SELECT
          gen_random_uuid(), ${orgId}, c.id, ${assignedMloId}, 'draft', 'mlo',
          ${lead.loan_purpose || null}, ${lead.occupancy || null}, ${lead.property_type || null},
          ${lead.loan_amount || null}, ${lead.purchase_price || lead.property_value || null},
          ${lead.down_payment || null}, ${lead.property_value || null}, ${lead.current_balance || null},
          ${lead.credit_score || null}, ${lead.employment_type || null},
          ${propertyAddress}::jsonb,
          ${lead.source || null}, ${referralSource}, 'lead_conversion',
          1, 1, NOW(), NOW()
        FROM contact c
        RETURNING id, contact_id
      ),
      new_participant AS (
        INSERT INTO loan_participants (
          loan_id, contact_id, role, ordinal, organization_id, created_at, updated_at
        )
        SELECT nl.id, nl.contact_id, 'primary_borrower', 0, ${orgId}, NOW(), NOW()
        FROM new_loan nl
        RETURNING id
      ),
      transferred AS (
        UPDATE scenarios SET
          contact_id = (SELECT id FROM contact),
          updated_at = NOW()
        WHERE lead_id = ${id}
          AND organization_id = ${orgId}
          AND contact_id IS NULL
        RETURNING id
      ),
      transferred_count AS (
        SELECT COUNT(*)::int AS c FROM transferred
      ),
      new_event AS (
        INSERT INTO loan_events (
          id, loan_id, event_type, actor_type, actor_id, old_value, new_value, details, created_at
        )
        SELECT
          gen_random_uuid(), nl.id, 'status_change', 'mlo', ${mloId}, NULL, 'draft',
          (${leadEventDetails}::jsonb) || jsonb_build_object('scenariosTransferred', tc.c),
          NOW()
        FROM new_loan nl, transferred_count tc
        RETURNING id
      ),
      lead_update AS (
        UPDATE leads SET
          status = 'converted',
          contact_id = (SELECT id FROM contact),
          updated_at = NOW()
        WHERE id = ${id} AND organization_id = ${orgId}
        RETURNING id
      )
      SELECT
        (SELECT id FROM contact) AS contact_id,
        (SELECT id FROM new_loan) AS loan_id,
        (SELECT c FROM transferred_count) AS scenarios_transferred,
        (SELECT id FROM new_participant) AS participant_id,
        (SELECT id FROM new_event) AS event_id,
        (SELECT id FROM lead_update) AS lead_id
    `;

    const row = rows[0];
    if (!row?.loan_id || !row?.contact_id) {
      console.error('[leads/convert] CTE returned partial result:', row);
      return Response.json({ error: 'Failed to convert lead' }, { status: 500 });
    }

    return Response.json(
      {
        success: true,
        loanId: row.loan_id,
        contactId: row.contact_id,
        scenariosTransferred: row.scenarios_transferred || 0,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[leads/convert] error:', error?.message, error?.stack);
    return Response.json({ error: 'Failed to convert lead' }, { status: 500 });
  }
}
