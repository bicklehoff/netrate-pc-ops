// API: Convert Lead to Loan
// POST /api/portal/mlo/leads/:id/convert
// Creates: Contact (if needed) + Borrower (if needed) + Loan (draft) + LoanBorrower
// Updates: Lead status → 'converted', Contact status → 'applicant'
// Auth: MLO session required

import sql from '@/lib/db';
import { encrypt } from '@/lib/encryption';
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

    // Split name into first/last
    const nameParts = (lead.name || '').trim().split(/\s+/);
    const firstName = nameParts[0] || 'Unknown';
    const lastName = nameParts.slice(1).join(' ') || 'Unknown';

    // Wrap all 6 steps in a transaction — partial failure leaves orphaned records
    const result = await sql.begin(async (tx) => {
      // ─── 1. Find or create Contact (post-migration: contact carries borrower fields) ─
      let contactRows = await tx`SELECT * FROM contacts WHERE email = ${emailLower} AND organization_id = ${orgId} LIMIT 1`;
      let contact = contactRows[0];

      if (!contact) {
        const placeholderSsn = encrypt('000000000');
        const placeholderDob = encrypt('1900-01-01');
        const created = await tx`
          INSERT INTO contacts (organization_id, first_name, last_name, email, phone, source, status, contact_type, assigned_mlo_id, tags,
            ssn_encrypted, dob_encrypted, ssn_last_four, role, marketing_stage, created_at, updated_at)
          VALUES (${orgId}, ${firstName}, ${lastName}, ${emailLower}, ${normalizePhone(lead.phone) || lead.phone || null}, 'lead', 'applicant', 'borrower', ${assignedMloId}, '{}',
            ${placeholderSsn}, ${placeholderDob}, '0000', 'borrower', 'in_process', NOW(), NOW())
          RETURNING *
        `;
        contact = created[0];
      } else {
        // Promote contact to borrower role + ensure PII placeholders if missing
        const placeholderSsn = encrypt('000000000');
        const placeholderDob = encrypt('1900-01-01');
        if (!contact.assigned_mlo_id) {
          await tx`
            UPDATE contacts SET status = 'applicant', last_contacted_at = NOW(), assigned_mlo_id = ${assignedMloId},
              role = 'borrower', marketing_stage = 'in_process',
              ssn_encrypted = COALESCE(ssn_encrypted, ${placeholderSsn}),
              dob_encrypted = COALESCE(dob_encrypted, ${placeholderDob}),
              ssn_last_four = COALESCE(ssn_last_four, '0000'),
              updated_at = NOW()
            WHERE id = ${contact.id} AND organization_id = ${orgId}
          `;
        } else {
          await tx`
            UPDATE contacts SET status = 'applicant', last_contacted_at = NOW(),
              role = 'borrower', marketing_stage = 'in_process',
              ssn_encrypted = COALESCE(ssn_encrypted, ${placeholderSsn}),
              dob_encrypted = COALESCE(dob_encrypted, ${placeholderDob}),
              ssn_last_four = COALESCE(ssn_last_four, '0000'),
              updated_at = NOW()
            WHERE id = ${contact.id} AND organization_id = ${orgId}
          `;
        }
      }

      // ─── 2. Create Loan (draft) ───────────────────────────────
      const propertyAddress = lead.property_state
        ? JSON.stringify({ state: lead.property_state, county: lead.property_county || null })
        : null;

      const loanRows = await tx`
        INSERT INTO loans (
          organization_id, contact_id, mlo_id, status, ball_in_court, purpose, occupancy, property_type,
          loan_amount, purchase_price, down_payment, estimated_value, current_balance,
          credit_score, employment_status, property_address, lead_source, referral_source,
          num_borrowers, application_step, created_at, updated_at
        ) VALUES (
          ${orgId}, ${contact.id}, ${assignedMloId}, 'draft', 'mlo',
          ${lead.loan_purpose || null}, ${lead.occupancy || null}, ${lead.property_type || null},
          ${lead.loan_amount || null}, ${lead.purchase_price || lead.property_value || null},
          ${lead.down_payment || null}, ${lead.property_value || null}, ${lead.current_balance || null},
          ${lead.credit_score || null}, ${lead.employment_type || null},
          ${propertyAddress}::jsonb,
          ${lead.source || null},
          ${lead.source === 'contact' ? 'past_client' : (lead.source || null)},
          1, 1, NOW(), NOW()
        )
        RETURNING *
      `;
      const loan = loanRows[0];

      // ─── 3. Create LoanBorrower ───────────────────────────────
      await tx`
        INSERT INTO loan_borrowers (loan_id, contact_id, borrower_type, ordinal, created_at, updated_at)
        VALUES (${loan.id}, ${contact.id}, 'primary', 0, NOW(), NOW())
      `;

      // ─── 4. Create LoanEvent ──────────────────────────────────
      await tx`
        INSERT INTO loan_events (loan_id, event_type, actor_type, actor_id, old_value, new_value, details, created_at)
        VALUES (
          ${loan.id}, 'status_change', 'mlo', ${mloId}, NULL, 'draft',
          ${JSON.stringify({ source: 'lead_conversion', leadId: lead.id, leadSource: lead.source })}::jsonb,
          NOW()
        )
      `;

      // ─── 5. Update Lead → converted ──────────────────────────
      await tx`
        UPDATE leads SET status = 'converted', contact_id = ${contact.id}, updated_at = NOW()
        WHERE id = ${id} AND organization_id = ${orgId}
      `;

      return { loanId: loan.id, contactId: contact.id };
    });

    return Response.json({ success: true, ...result }, { status: 201 });
  } catch (error) {
    console.error('Lead conversion error:', error?.message);
    return Response.json({ error: 'Failed to convert lead' }, { status: 500 });
  }
}
