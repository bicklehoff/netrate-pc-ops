/**
 * notifyOnLeadCreated — dispatch borrower confirmation + David alert on new lead.
 *
 * Used by:
 *   - createInboundLead (replaces inline David email block)
 *   - POST /api/lead (contact form — fire-and-forget)
 *
 * Both sends are try/catch non-fatal. Caller never blocks on email.
 */

import { sendEmail } from '@/lib/resend';
import { inboundLeadAlertTemplate } from '@/lib/email-templates/inbound-lead-alert';
import { leadConfirmationTemplate } from '@/lib/email-templates/lead-confirmation';

const DAVID_EMAIL = 'david@netratemortgage.com';

/**
 * @param {object} params
 * @param {string} params.leadId
 * @param {string} [params.contactId]
 * @param {string} [params.firstName]
 * @param {string} params.email
 * @param {string} [params.phone]
 * @param {string} [params.state]
 * @param {string} [params.loanPurpose]
 * @param {string} [params.loanType]
 * @param {number} [params.loanAmount]
 * @param {number} [params.creditScore]
 * @param {object|string} [params.propertyAddress]
 * @param {string} [params.source]
 * @param {string} [params.sourceDetail]
 * @param {boolean} [params.skipBorrower=false] - Skip borrower confirmation (e.g. no valid email).
 * @returns {Promise<{ borrowerEmailStatus: string, davidEmailStatus: string }>}
 */
export async function notifyOnLeadCreated({
  leadId,
  contactId = null,
  firstName = null,
  email,
  phone = null,
  state = null,
  loanPurpose = null,
  loanType = null,
  loanAmount = null,
  creditScore = null,
  propertyAddress = null,
  source = null,
  sourceDetail = null,
  skipBorrower = false,
}) {
  let borrowerEmailStatus = skipBorrower ? 'skipped_disabled' : 'not_attempted';
  let davidEmailStatus = 'not_attempted';

  // ── 1. Borrower confirmation ──────────────────────────────────
  if (!skipBorrower && email) {
    try {
      const tmpl = leadConfirmationTemplate({ firstName });
      const result = await sendEmail({ to: email, subject: tmpl.subject, html: tmpl.html, text: tmpl.text });
      borrowerEmailStatus = result?.skipped ? 'skipped_no_api_key' : 'sent';
    } catch (err) {
      borrowerEmailStatus = 'failed';
      console.error('[notifyOnLeadCreated] borrower email failed (non-fatal):', err.message);
    }
  }

  // ── 2. David alert ────────────────────────────────────────────
  try {
    const tmpl = inboundLeadAlertTemplate({
      contactId,
      leadId,
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
    });
    const result = await sendEmail({ to: DAVID_EMAIL, subject: tmpl.subject, html: tmpl.html, text: tmpl.text });
    davidEmailStatus = result?.skipped ? 'skipped_no_api_key' : 'sent';
  } catch (err) {
    davidEmailStatus = 'failed';
    console.error('[notifyOnLeadCreated] David alert failed (non-fatal):', err.message);
  }

  return { borrowerEmailStatus, davidEmailStatus };
}
