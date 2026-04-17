/**
 * createInboundLead — shared lead-intake creation logic.
 *
 * Used by:
 *   - `POST /api/leads/inbound` (server-to-server webhook, API-key auth)
 *   - Future public form endpoint (ICanBuy landing page + Google Ads pages)
 *
 * Creates (best-effort, in order):
 *   1. Lead row (attribution + raw payload audit)
 *   2. Contact (find-or-create by email via findOrCreateContactByEmail)
 *   3. Lead → Contact link (paid leads skip the UAD conversion gate)
 *   4. Loan (status=draft = "Prospect" in MLO pipeline)
 *   5. loan_participant (role=primary_borrower)
 *   6. David notification email via Resend (non-blocking)
 *
 * Callers are responsible for:
 *   - Authentication (API-key for webhooks, honeypot+IP-limit for public forms)
 *   - Rate limiting
 *   - Payload field-name normalization (camelCase vs snake_case variants)
 *
 * Returns `{ success, contactId, leadId, dealId, isNew, emailStatus }`.
 */

import sql from '@/lib/db';
import { findOrCreateContactByEmail } from '@/lib/contacts/find-or-create';
import { notifyOnLeadCreated } from '@/lib/leads/notify';

const DEFAULT_ORG_ID = '00000000-0000-4000-8000-000000000001';

/**
 * @param {object} params
 * @param {string} params.email - Required. Lowercased, validated by caller.
 * @param {string} [params.firstName]
 * @param {string} [params.lastName]
 * @param {string} [params.phone] - Normalized by caller if applicable.
 * @param {string} [params.state] - 2-letter state, already uppercased.
 * @param {string} [params.loanPurpose]
 * @param {string} [params.loanType]
 * @param {number} [params.loanAmount]
 * @param {number} [params.creditScore]
 * @param {number} [params.propertyValue]
 * @param {object|string} [params.propertyAddress]
 * @param {string} [params.propertyType]
 * @param {string} [params.source='inbound'] - Attribution source.
 * @param {string} [params.sourceDetail]
 * @param {string} [params.applicationChannel='inbound_webhook'] - 'inbound_webhook' | 'landing_form' | 'icanbuy_form' etc.
 * @param {string} [params.utmSource]
 * @param {string} [params.utmMedium]
 * @param {string} [params.utmCampaign]
 * @param {string} [params.message] - Optional freetext from form.
 * @param {object} [params.rawPayload] - Full original payload for audit (stored in leads.scenario_data).
 * @param {boolean} [params.notifyDavid=true] - Send David email.
 * @returns {Promise<{ success: boolean, contactId: string, leadId: string, dealId: string, isNew: boolean, emailStatus: string }>}
 */
export async function createInboundLead({
  email,
  firstName = null,
  lastName = null,
  phone = null,
  state = null,
  loanPurpose = null,
  loanType = null,
  loanAmount = null,
  creditScore = null,
  propertyValue = null,
  propertyAddress = null,
  propertyType = null,
  source = 'inbound',
  sourceDetail = null,
  applicationChannel = 'inbound_webhook',
  utmSource = null,
  utmMedium = null,
  utmCampaign = null,
  message = null,
  rawPayload = null,
  notifyDavid = true,
} = {}) {
  if (!email) {
    throw new Error('createInboundLead: email is required');
  }

  const fullName = [firstName, lastName].filter(Boolean).join(' ') || email;

  // ── 1. Create Lead ────────────────────────────────────────────
  const leadRows = await sql`
    INSERT INTO leads (
      name, first_name, last_name, email, phone,
      source, source_detail, status,
      loan_purpose, loan_amount, property_state, property_value, property_type,
      credit_score, scenario_data,
      utm_source, utm_medium, utm_campaign,
      notes, created_at, updated_at
    ) VALUES (
      ${fullName}, ${firstName}, ${lastName}, ${email}, ${phone},
      ${source}, ${sourceDetail}, 'new',
      ${loanPurpose}, ${loanAmount}, ${state}, ${propertyValue}, ${propertyType},
      ${creditScore}, ${rawPayload ? JSON.stringify(rawPayload) : null}::jsonb,
      ${utmSource}, ${utmMedium}, ${utmCampaign},
      ${message}, NOW(), NOW()
    )
    RETURNING id, organization_id
  `;
  const leadId = leadRows[0].id;
  const orgId = leadRows[0].organization_id || DEFAULT_ORG_ID;

  // ── 2. Find or create Contact ─────────────────────────────────
  // Paid/inbound leads go straight to `in_process` — they are pre-qualified
  // pipeline items. Organic leads (`/api/lead` contact form) stay as
  // leads-only until MLO conversion per UAD AD-1/AD-2.
  const { contact, created: isNew } = await findOrCreateContactByEmail({
    email,
    phone,
    firstName,
    lastName,
    organizationId: orgId,
    role: 'borrower',
    marketingStage: 'in_process',
    source,
  });

  // Backfill state on the contact if we learned it here.
  if (isNew && state) {
    try {
      await sql`UPDATE contacts SET state = ${state}, updated_at = NOW() WHERE id = ${contact.id}`;
    } catch (err) {
      console.warn('[createInboundLead] state backfill failed (non-fatal):', err.message);
    }
  }

  // ── 3. Link Lead → Contact ────────────────────────────────────
  await sql`UPDATE leads SET contact_id = ${contact.id}, updated_at = NOW() WHERE id = ${leadId}`;

  // ── 4. Create Loan (Deal) ─────────────────────────────────────
  // status='draft' maps to "Prospect" per src/lib/loan-states.js.
  const propertyAddressJson = propertyAddress
    ? (typeof propertyAddress === 'string'
        ? JSON.stringify({ address: propertyAddress })
        : JSON.stringify(propertyAddress))
    : null;

  // loans.id has no DB default — must generate explicitly.
  const loanRows = await sql`
    INSERT INTO loans (
      id, contact_id, status, ball_in_court,
      purpose, loan_type, loan_amount, credit_score,
      property_address, property_type, estimated_value,
      lead_source, referral_source, application_channel,
      created_at, updated_at
    ) VALUES (
      gen_random_uuid(), ${contact.id}, 'draft', 'borrower',
      ${loanPurpose}, ${loanType}, ${loanAmount}, ${creditScore},
      ${propertyAddressJson}::jsonb, ${propertyType}, ${propertyValue},
      ${source}, ${sourceDetail}, ${applicationChannel},
      NOW(), NOW()
    )
    RETURNING id
  `;
  const loanId = loanRows[0].id;

  // ── 5. Insert loan_participant ────────────────────────────────
  await sql`
    INSERT INTO loan_participants (
      loan_id, contact_id, role, ordinal, organization_id, created_at, updated_at
    ) VALUES (
      ${loanId}, ${contact.id}, 'primary_borrower', 0, ${orgId}, NOW(), NOW()
    )
  `;

  // ── 6. Notifications (non-blocking) ──────────────────────────
  // Inbound/paid leads: send both borrower confirmation + David alert.
  // skipBorrower=false because inbound leads always have a valid email (caller-validated).
  const { borrowerEmailStatus, davidEmailStatus } = notifyDavid
    ? await notifyOnLeadCreated({
        leadId,
        contactId: contact.id,
        firstName,
        email,
        phone,
        state,
        loanPurpose,
        loanType,
        loanAmount,
        creditScore,
        propertyAddress,
        source,
        sourceDetail,
      })
    : { borrowerEmailStatus: 'skipped_disabled', davidEmailStatus: 'skipped_disabled' };

  return {
    success: true,
    contactId: contact.id,
    leadId,
    dealId: loanId,
    isNew,
    emailStatus: davidEmailStatus,
    borrowerEmailStatus,
  };
}
