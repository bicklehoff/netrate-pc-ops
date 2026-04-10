// API: Convert Lead to Loan
// POST /api/portal/mlo/leads/:id/convert
// Creates: Contact (if needed) + Borrower (if needed) + Loan (draft) + LoanBorrower
// Updates: Lead status → 'converted', Contact status → 'applicant'
// Auth: MLO session required

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import sql from '@/lib/db';
import { encrypt } from '@/lib/encryption';
import { normalizePhone } from '@/lib/normalize-phone';

export async function POST(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.userType !== 'mlo') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const leadRows = await sql`SELECT * FROM leads WHERE id = ${id} LIMIT 1`;
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
    const mloId = lead.mlo_id || session.user.id;

    // Split name into first/last
    const nameParts = (lead.name || '').trim().split(/\s+/);
    const firstName = nameParts[0] || 'Unknown';
    const lastName = nameParts.slice(1).join(' ') || 'Unknown';

    // ─── 1. Find or create Contact ────────────────────────────
    let contactRows = await sql`SELECT * FROM contacts WHERE email = ${emailLower} LIMIT 1`;
    let contact = contactRows[0];

    if (!contact) {
      const created = await sql`
        INSERT INTO contacts (first_name, last_name, email, phone, source, status, contact_type, assigned_mlo_id, tags, created_at, updated_at)
        VALUES (${firstName}, ${lastName}, ${emailLower}, ${normalizePhone(lead.phone) || lead.phone || null}, 'lead', 'applicant', 'borrower', ${mloId}, '{}', NOW(), NOW())
        RETURNING *
      `;
      contact = created[0];
    } else {
      // Update existing contact status
      if (!contact.assigned_mlo_id) {
        await sql`
          UPDATE contacts SET status = 'applicant', last_contacted_at = NOW(), assigned_mlo_id = ${mloId}, updated_at = NOW()
          WHERE id = ${contact.id}
        `;
      } else {
        await sql`
          UPDATE contacts SET status = 'applicant', last_contacted_at = NOW(), updated_at = NOW()
          WHERE id = ${contact.id}
        `;
      }
    }

    // ─── 2. Find or create Borrower ───────────────────────────
    let borrowerRows = await sql`SELECT * FROM borrowers WHERE email = ${emailLower} LIMIT 1`;
    let borrower = borrowerRows[0];

    if (!borrower) {
      const placeholderSsn = encrypt('000000000');
      const placeholderDob = encrypt('1900-01-01');

      const created = await sql`
        INSERT INTO borrowers (email, first_name, last_name, phone, ssn_encrypted, dob_encrypted, ssn_last_four, created_at, updated_at)
        VALUES (${emailLower}, ${firstName}, ${lastName}, ${normalizePhone(lead.phone) || lead.phone || null}, ${placeholderSsn}, ${placeholderDob}, '0000', NOW(), NOW())
        RETURNING *
      `;
      borrower = created[0];
    }

    // Link contact to borrower if not already linked
    if (!contact.borrower_id) {
      await sql`UPDATE contacts SET borrower_id = ${borrower.id}, updated_at = NOW() WHERE id = ${contact.id}`;
    }

    // ─── 3. Create Loan (draft) ───────────────────────────────
    const propertyAddress = lead.property_state
      ? JSON.stringify({ state: lead.property_state, county: lead.property_county || null })
      : null;

    const loanRows = await sql`
      INSERT INTO loans (
        borrower_id, mlo_id, status, ball_in_court, purpose, occupancy, property_type,
        loan_amount, purchase_price, down_payment, estimated_value, current_balance,
        credit_score, employment_status, property_address, lead_source, referral_source,
        num_borrowers, application_step, created_at, updated_at
      ) VALUES (
        ${borrower.id}, ${mloId}, 'draft', 'mlo',
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

    // ─── 4. Create LoanBorrower ───────────────────────────────
    await sql`
      INSERT INTO loan_borrowers (loan_id, borrower_id, borrower_type, ordinal, created_at, updated_at)
      VALUES (${loan.id}, ${borrower.id}, 'primary', 0, NOW(), NOW())
    `;

    // ─── 5. Create LoanEvent ──────────────────────────────────
    await sql`
      INSERT INTO loan_events (loan_id, event_type, actor_type, actor_id, old_value, new_value, details, created_at)
      VALUES (
        ${loan.id}, 'status_change', 'mlo', ${session.user.id}, NULL, 'draft',
        ${JSON.stringify({ source: 'lead_conversion', leadId: lead.id, leadSource: lead.source })}::jsonb,
        NOW()
      )
    `;

    // ─── 6. Update Lead → converted ──────────────────────────
    await sql`
      UPDATE leads SET status = 'converted', contact_id = ${contact.id}, updated_at = NOW()
      WHERE id = ${id}
    `;

    return Response.json({
      success: true,
      loanId: loan.id,
      contactId: contact.id,
      borrowerId: borrower.id,
    }, { status: 201 });
  } catch (error) {
    console.error('Lead conversion error:', error?.message);
    return Response.json({ error: 'Failed to convert lead' }, { status: 500 });
  }
}
