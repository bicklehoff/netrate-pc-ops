/**
 * Lead Confirmation — sent to borrower immediately after /api/lead form submit.
 * Tone: David's voice, warm but brief. No urgency, no CTA pressure.
 *
 * Design tokens (locked April 2026, tailwind.config.js):
 *   brand  #2E6BA8 — primary interactive accent (header, links)
 *   go     #059669 — forward-motion CTA (button)
 *   accent #FFC220 — highlight accent only (not used for primary CTAs)
 *   ink    #1A1F2E — primary text / dark fill
 */

const BRAND = '#2E6BA8';
const GO = '#059669';
const INK = '#1A1F2E';
const INK_MID = '#4A5C6E';
const INK_SUBTLE = '#7A8E9E';
const SURFACE_PAGE = '#FAFAF7';
const SURFACE_ALT = '#F5F4F1';

const RATES_URL = process.env.NEXTAUTH_URL
  ? `${process.env.NEXTAUTH_URL}/rates`
  : 'https://www.netratemortgage.com/rates';

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * @param {object} params
 * @param {string} [params.firstName]
 * @returns {{ subject: string, html: string, text: string }}
 */
export function leadConfirmationTemplate({ firstName } = {}) {
  const name = escapeHtml(firstName || 'there');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>NetRate Mortgage</title>
</head>
<body style="margin:0;padding:0;background-color:${SURFACE_PAGE};font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${INK};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${SURFACE_PAGE};">
<tr><td align="center" style="padding:24px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 6px rgba(26,31,46,0.07),0 2px 12px rgba(26,31,46,0.05);">
<tr><td style="padding:24px 32px;background-color:${BRAND};">
  <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Net</span><span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Rate</span><span style="font-size:16px;font-weight:500;color:rgba(255,255,255,0.9);margin-left:6px;">Mortgage</span>
</td></tr>
<tr><td style="padding:32px;">
  <h2 style="margin:0 0 16px;font-size:20px;font-weight:600;color:${INK};">Got your message</h2>
  <p style="margin:0 0 16px;font-size:15px;color:${INK_MID};line-height:1.6;">
    Hi ${name}, thanks for reaching out. I got your message and will follow up within one business day.
  </p>
  <p style="margin:0 0 16px;font-size:15px;color:${INK_MID};line-height:1.6;">
    In the meantime, you can browse today's rates — no login required.
  </p>
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
  <tr><td align="center" style="background-color:${GO};border-radius:6px;">
    <a href="${RATES_URL}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:6px;">
      View Today's Rates
    </a>
  </td></tr>
  </table>
  <p style="margin:0;font-size:14px;color:${INK_MID};line-height:1.6;">
    — David Burson, NMLS #641790
  </p>
</td></tr>
<tr><td style="padding:20px 32px;background-color:${SURFACE_ALT};border-top:1px solid #e9e7e0;">
  <p style="margin:0;font-size:12px;color:${INK_MID};line-height:1.5;">
    NetRate Mortgage LLC | NMLS #1111861<br>
    357 S McCaslin Blvd #200, Louisville, CO 80027<br>
    <a href="tel:3034445251" style="color:${BRAND};text-decoration:none;">303-444-5251</a> |
    <a href="mailto:david@netratemortgage.com" style="color:${BRAND};text-decoration:none;">david@netratemortgage.com</a>
  </p>
  <p style="margin:8px 0 0;font-size:11px;color:${INK_SUBTLE};">
    Equal Housing Lender. This email was sent because you submitted a contact form at netratemortgage.com.
  </p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = `Hi ${firstName || 'there'},

Thanks for reaching out. I got your message and will follow up within one business day.

In the meantime, you can browse today's rates at: ${RATES_URL}

— David Burson, NMLS #641790

NetRate Mortgage LLC | NMLS #1111861
357 S McCaslin Blvd #200, Louisville, CO 80027
303-444-5251 | david@netratemortgage.com
Equal Housing Lender`;

  return {
    subject: 'We received your inquiry — NetRate Mortgage',
    html,
    text,
  };
}
