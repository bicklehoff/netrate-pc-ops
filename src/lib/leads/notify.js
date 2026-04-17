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
  // Send both in parallel. Callers MUST await this function (not fire-and-forget) —
  // Vercel serverless terminates execution shortly after the response is returned,
  // which was silently killing the second sequential send.
  const borrowerPromise = skipBorrower || !email
    ? Promise.resolve({ skipped: true, reason: skipBorrower ? 'disabled' : 'no_email' })
    : (async () => {
        const tmpl = leadConfirmationTemplate({ firstName });
        return sendEmail({ to: email, subject: tmpl.subject, html: tmpl.html, text: tmpl.text });
      })();

  const davidPromise = (async () => {
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
    return sendEmail({ to: DAVID_EMAIL, subject: tmpl.subject, html: tmpl.html, text: tmpl.text });
  })();

  const [borrowerResult, davidResult] = await Promise.allSettled([borrowerPromise, davidPromise]);

  let borrowerEmailStatus;
  if (skipBorrower) {
    borrowerEmailStatus = 'skipped_disabled';
  } else if (!email) {
    borrowerEmailStatus = 'skipped_no_email';
  } else if (borrowerResult.status === 'rejected') {
    borrowerEmailStatus = 'failed';
    console.error('[notifyOnLeadCreated] borrower email failed:', borrowerResult.reason?.message);
  } else {
    borrowerEmailStatus = borrowerResult.value?.skipped ? 'skipped_no_api_key' : 'sent';
  }

  let davidEmailStatus;
  if (davidResult.status === 'rejected') {
    davidEmailStatus = 'failed';
    console.error('[notifyOnLeadCreated] David alert failed:', davidResult.reason?.message);
  } else {
    davidEmailStatus = davidResult.value?.skipped ? 'skipped_no_api_key' : 'sent';
  }

  return { borrowerEmailStatus, davidEmailStatus };
}
