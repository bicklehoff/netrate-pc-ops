/**
 * Inbound Lead Alert — David notification template.
 *
 * Sent to david@netratemortgage.com when a paid lead (ICanBuy, MCR, QED,
 * referral, etc.) flows in via POST /api/leads/inbound. Goal: David knows
 * to call the lead within minutes of Zoho Flow relaying it.
 *
 * Subject is scannable from a phone notification: name, state, loan type,
 * amount, FICO, phone. Body has the full payload + a link straight to the
 * MLO contact page.
 */

function formatMoney(n) {
  if (n == null || Number.isNaN(Number(n))) return null;
  return `$${Math.round(Number(n)).toLocaleString()}`;
}

function formatAddress(addr) {
  if (!addr) return null;
  if (typeof addr === 'string') return addr;
  if (typeof addr !== 'object') return null;
  const parts = [addr.street, addr.city, addr.state, addr.zip].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
}

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
 * Build a subject line + HTML + text body for the inbound-lead alert.
 *
 * @param {object} params
 * @param {string} params.contactId - UUID of the contact (for deep link).
 * @param {string} [params.firstName]
 * @param {string} [params.lastName]
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
 * @param {string} [params.siteUrl] - Override for site base URL (default from env).
 * @returns {{ subject: string, html: string, text: string }}
 */
export function inboundLeadAlertTemplate({
  contactId,
  firstName,
  lastName,
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
  siteUrl,
}) {
  const baseUrl = siteUrl || process.env.NEXTAUTH_URL || 'https://www.netratemortgage.com';
  const contactLink = `${baseUrl}/portal/mlo/contacts/${contactId}`;

  const name = [firstName, lastName].filter(Boolean).join(' ') || email || 'Unknown';
  const amount = formatMoney(loanAmount);
  const address = formatAddress(propertyAddress);

  const subjectParts = [name];
  if (state) subjectParts.push(state);
  if (loanType) subjectParts.push(loanType);
  if (amount) subjectParts.push(amount);
  if (creditScore) subjectParts.push(`FICO ${creditScore}`);
  if (phone) subjectParts.push(phone);
  const subject = `New Lead: ${subjectParts.join(' — ')}`;

  // ─── Text body ─────────────────────────────────────────────────
  const textLines = [
    `NEW INBOUND LEAD`,
    ``,
    `Name:          ${name}`,
    `Email:         ${email}`,
    phone ? `Phone:         ${phone}` : null,
    state ? `State:         ${state}` : null,
    loanPurpose ? `Purpose:       ${loanPurpose}` : null,
    loanType ? `Product:       ${loanType}` : null,
    amount ? `Amount:        ${amount}` : null,
    creditScore ? `FICO:          ${creditScore}` : null,
    address ? `Property:      ${address}` : null,
    source ? `Source:        ${source}${sourceDetail ? ` / ${sourceDetail}` : ''}` : null,
    ``,
    `Open in CoreCRM: ${contactLink}`,
  ].filter(Boolean);
  const text = textLines.join('\n');

  // ─── HTML body ─────────────────────────────────────────────────
  const row = (label, value) => value
    ? `<tr><td style="padding:6px 12px 6px 0;color:#6b7280;font-size:13px;vertical-align:top;white-space:nowrap;">${escapeHtml(label)}</td><td style="padding:6px 0;color:#111827;font-size:14px;">${value}</td></tr>`
    : '';

  const phoneHtml = phone
    ? `<a href="tel:${escapeHtml(phone)}" style="color:#0891b2;text-decoration:none;font-weight:600;">${escapeHtml(phone)}</a>`
    : null;
  const emailHtml = `<a href="mailto:${escapeHtml(email)}" style="color:#0891b2;text-decoration:none;">${escapeHtml(email)}</a>`;
  const sourceHtml = source
    ? `${escapeHtml(source)}${sourceDetail ? ` <span style="color:#9ca3af;">/ ${escapeHtml(sourceDetail)}</span>` : ''}`
    : null;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
    <tr>
      <td style="padding:20px 24px;background:#0891b2;color:#ffffff;">
        <div style="font-size:12px;letter-spacing:0.1em;text-transform:uppercase;opacity:0.9;">New Inbound Lead</div>
        <div style="font-size:22px;font-weight:700;margin-top:4px;">${escapeHtml(name)}</div>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 24px;">
        <table cellpadding="0" cellspacing="0" style="width:100%;">
          ${row('Email', emailHtml)}
          ${row('Phone', phoneHtml)}
          ${row('State', state ? escapeHtml(state) : null)}
          ${row('Purpose', loanPurpose ? escapeHtml(loanPurpose) : null)}
          ${row('Product', loanType ? escapeHtml(loanType) : null)}
          ${row('Amount', amount ? escapeHtml(amount) : null)}
          ${row('FICO', creditScore != null ? escapeHtml(String(creditScore)) : null)}
          ${row('Property', address ? escapeHtml(address) : null)}
          ${row('Source', sourceHtml)}
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:0 24px 24px;">
        <a href="${escapeHtml(contactLink)}" style="display:inline-block;padding:12px 20px;background:#0891b2;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">Open in CoreCRM →</a>
      </td>
    </tr>
    <tr>
      <td style="padding:12px 24px 20px;border-top:1px solid #f3f4f6;color:#9ca3af;font-size:12px;">
        Delivered by NetRate Mortgage · Reply to this email to message yourself a reminder.
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}
