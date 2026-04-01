// Resend Email Client — all outbound email for NetRate
// Used by: magic link, borrower notifications, order-outs, doc requests
//
// From: NetRate Mortgage <notifications@netratemortgage.com>
// Reply-To: david@netratemortgage.com

import { Resend } from 'resend';

let resend = null;

function getResend() {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

const FROM_ADDRESS = 'NetRate Mortgage <notifications@netratemortgage.com>';
const REPLY_TO = 'david@netratemortgage.com';

/**
 * Send an email via Resend.
 * Gracefully skips if RESEND_API_KEY is not set (dev mode).
 *
 * @param {object} params
 * @param {string|string[]} params.to — recipient(s)
 * @param {string} params.subject
 * @param {string} params.html — HTML body
 * @param {string} [params.text] — plain text fallback
 * @param {string} [params.replyTo] — override reply-to (default: david@netratemortgage.com)
 * @param {string} [params.from] — override from address (default: notifications@netratemortgage.com)
 * @param {string[]} [params.cc] — CC recipients
 * @param {Array<{filename: string, content: Buffer}>} [params.attachments] — file attachments
 * @returns {Promise<{id: string, skipped?: boolean}>}
 */
export async function sendEmail({ to, subject, html, text, replyTo = REPLY_TO, from = FROM_ADDRESS, cc, attachments }) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[EMAIL SKIP] No RESEND_API_KEY. Would send to ${to}: ${subject}`);
    return { id: 'dev-skip', skipped: true };
  }

  const payload = {
    from,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    reply_to: replyTo,
  };

  if (text) payload.text = text;
  if (cc) payload.cc = Array.isArray(cc) ? cc : [cc];
  if (attachments?.length) payload.attachments = attachments;

  const { data, error } = await getResend().emails.send(payload);

  if (error) {
    console.error('[RESEND ERROR]', error);
    throw new Error(`Email send failed: ${error.message}`);
  }

  return data;
}

export { getResend };
