// Order-Out Email Templates — Title, Appraisal, HOI, Flood Cert
// Sent to third-party vendors when MLO orders services.
// All templates return { subject, html, text } for use with sendEmail().

const BRAND_COLOR = '#0891b2';

// ─── Shared Layout ──────────────────────────────────────────

function orderLayout(content) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>NetRate Mortgage — Order</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;">
<tr><td align="center" style="padding:24px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
<!-- Header -->
<tr><td style="padding:20px 32px;background-color:${BRAND_COLOR};">
  <span style="font-size:20px;font-weight:700;color:#ffffff;">Net</span><span style="font-size:20px;font-weight:700;color:#ffffff;">Rate</span><span style="font-size:14px;font-weight:400;color:rgba(255,255,255,0.85);margin-left:6px;">Mortgage</span>
  <span style="float:right;font-size:13px;color:rgba(255,255,255,0.8);line-height:28px;">Service Order</span>
</td></tr>
<!-- Body -->
<tr><td style="padding:28px 32px;">
${content}
</td></tr>
<!-- Footer -->
<tr><td style="padding:16px 32px;background-color:#f9fafb;border-top:1px solid #e5e7eb;">
  <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.5;">
    NetRate Mortgage LLC | NMLS #1111861<br>
    357 S McCaslin Blvd #200, Louisville, CO 80027<br>
    <a href="tel:3034445251" style="color:${BRAND_COLOR};text-decoration:none;">303-444-5251</a> |
    <a href="mailto:david@netratemortgage.com" style="color:${BRAND_COLOR};text-decoration:none;">david@netratemortgage.com</a>
  </p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function detailRow(label, value) {
  if (!value) return '';
  return `<tr>
  <td style="padding:6px 12px;font-size:13px;color:#6b7280;white-space:nowrap;vertical-align:top;">${label}</td>
  <td style="padding:6px 12px;font-size:13px;color:#111827;font-weight:500;">${value}</td>
</tr>`;
}

function loanDetailsTable(loan) {
  const borrowerName = [loan.borrowerFirstName, loan.borrowerLastName].filter(Boolean).join(' ');
  const coBorrowerName = [loan.coBorrowerFirstName, loan.coBorrowerLastName].filter(Boolean).join(' ');

  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:16px 0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
  <tr><td colspan="2" style="padding:8px 12px;background-color:#f9fafb;font-size:12px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:0.5px;">Loan Details</td></tr>
  ${detailRow('Borrower', borrowerName)}
  ${coBorrowerName ? detailRow('Co-Borrower', coBorrowerName) : ''}
  ${detailRow('Property', loan.propertyAddress)}
  ${detailRow('Loan Type', loan.loanType)}
  ${detailRow('Purpose', loan.purpose)}
  ${detailRow('Lender', loan.lenderName)}
  ${detailRow('Loan #', loan.loanNumber)}
  ${detailRow('Loan Amount', loan.loanAmount ? `$${Number(loan.loanAmount).toLocaleString()}` : null)}
</table>`;
}

function formatLoanText(loan) {
  const borrowerName = [loan.borrowerFirstName, loan.borrowerLastName].filter(Boolean).join(' ');
  const coBorrowerName = [loan.coBorrowerFirstName, loan.coBorrowerLastName].filter(Boolean).join(' ');
  const lines = [];
  if (borrowerName) lines.push(`Borrower: ${borrowerName}`);
  if (coBorrowerName) lines.push(`Co-Borrower: ${coBorrowerName}`);
  if (loan.propertyAddress) lines.push(`Property: ${loan.propertyAddress}`);
  if (loan.loanType) lines.push(`Loan Type: ${loan.loanType}`);
  if (loan.purpose) lines.push(`Purpose: ${loan.purpose}`);
  if (loan.lenderName) lines.push(`Lender: ${loan.lenderName}`);
  if (loan.loanNumber) lines.push(`Loan #: ${loan.loanNumber}`);
  if (loan.loanAmount) lines.push(`Loan Amount: $${Number(loan.loanAmount).toLocaleString()}`);
  return lines.join('\n');
}

// ─── Title Order ────────────────────────────────────────────

export function titleOrderTemplate({ recipientName, loan, notes, mloName }) {
  const greeting = recipientName ? `Hi ${recipientName},` : 'Hello,';
  const signer = mloName || 'David Burson';

  const html = orderLayout(`
  <h2 style="margin:0 0 12px;font-size:18px;font-weight:600;color:#111827;">Title Order Request</h2>
  <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6;">
    ${greeting} please open a title order for the following loan:
  </p>
  ${loanDetailsTable(loan)}
  ${notes ? `<div style="margin:16px 0;padding:12px 16px;background-color:#fffbeb;border:1px solid #fde68a;border-radius:8px;">
    <p style="margin:0;font-size:12px;font-weight:600;color:#92400e;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Notes</p>
    <p style="margin:0;font-size:13px;color:#78350f;">${notes}</p>
  </div>` : ''}
  <p style="margin:16px 0 0;font-size:14px;color:#374151;">
    Please send the commitment to <a href="mailto:david@netratemortgage.com" style="color:${BRAND_COLOR};">david@netratemortgage.com</a> when ready.
  </p>
  <p style="margin:16px 0 0;font-size:14px;color:#374151;">Thank you,<br><strong>${signer}</strong><br>NetRate Mortgage LLC | NMLS #1111861</p>
`);

  const text = `Title Order Request\n\n${greeting} Please open a title order for the following loan:\n\n${formatLoanText(loan)}\n\n${notes ? `Notes: ${notes}\n\n` : ''}Please send the commitment to david@netratemortgage.com when ready.\n\nThank you,\n${signer}\nNetRate Mortgage LLC | NMLS #1111861\n303-444-5251`;

  return {
    subject: `Title Order — ${loan.borrowerLastName || 'New Loan'}${loan.propertyAddress ? ` — ${loan.propertyAddress}` : ''}`,
    html,
    text,
  };
}

// ─── Appraisal Order ────────────────────────────────────────

export function appraisalOrderTemplate({ recipientName, loan, notes, mloName }) {
  const greeting = recipientName ? `Hi ${recipientName},` : 'Hello,';
  const signer = mloName || 'David Burson';

  const html = orderLayout(`
  <h2 style="margin:0 0 12px;font-size:18px;font-weight:600;color:#111827;">Appraisal Order Request</h2>
  <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6;">
    ${greeting} please order an appraisal for the following property:
  </p>
  ${loanDetailsTable(loan)}
  ${notes ? `<div style="margin:16px 0;padding:12px 16px;background-color:#fffbeb;border:1px solid #fde68a;border-radius:8px;">
    <p style="margin:0;font-size:12px;font-weight:600;color:#92400e;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Notes</p>
    <p style="margin:0;font-size:13px;color:#78350f;">${notes}</p>
  </div>` : ''}
  <p style="margin:16px 0 0;font-size:14px;color:#374151;">
    Please coordinate access with the borrower and send the completed report to <a href="mailto:david@netratemortgage.com" style="color:${BRAND_COLOR};">david@netratemortgage.com</a>.
  </p>
  <p style="margin:16px 0 0;font-size:14px;color:#374151;">Thank you,<br><strong>${signer}</strong><br>NetRate Mortgage LLC | NMLS #1111861</p>
`);

  const text = `Appraisal Order Request\n\n${greeting} Please order an appraisal for the following property:\n\n${formatLoanText(loan)}\n\n${notes ? `Notes: ${notes}\n\n` : ''}Please coordinate access with the borrower and send the completed report to david@netratemortgage.com.\n\nThank you,\n${signer}\nNetRate Mortgage LLC | NMLS #1111861\n303-444-5251`;

  return {
    subject: `Appraisal Order — ${loan.propertyAddress || loan.borrowerLastName || 'New Loan'}`,
    html,
    text,
  };
}

// ─── HOI Order ──────────────────────────────────────────────

export function hoiOrderTemplate({ recipientName, loan, notes, mloName }) {
  const greeting = recipientName ? `Hi ${recipientName},` : 'Hello,';
  const signer = mloName || 'David Burson';

  const html = orderLayout(`
  <h2 style="margin:0 0 12px;font-size:18px;font-weight:600;color:#111827;">Homeowners Insurance Request</h2>
  <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6;">
    ${greeting} please provide an insurance quote and binder for the following property:
  </p>
  ${loanDetailsTable(loan)}
  ${notes ? `<div style="margin:16px 0;padding:12px 16px;background-color:#fffbeb;border:1px solid #fde68a;border-radius:8px;">
    <p style="margin:0;font-size:12px;font-weight:600;color:#92400e;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Notes</p>
    <p style="margin:0;font-size:13px;color:#78350f;">${notes}</p>
  </div>` : ''}
  <p style="margin:16px 0 4px;font-size:14px;color:#374151;font-weight:500;">Mortgagee clause:</p>
  <p style="margin:0 0 16px;font-size:13px;color:#374151;line-height:1.5;padding:8px 12px;background:#f9fafb;border-radius:6px;font-family:monospace;">
    ${loan.lenderName || '[Lender Name]'}<br>
    ISAOA/ATIMA
  </p>
  <p style="margin:0 0 0;font-size:14px;color:#374151;">
    Please send the binder and declaration page to <a href="mailto:david@netratemortgage.com" style="color:${BRAND_COLOR};">david@netratemortgage.com</a>.
  </p>
  <p style="margin:16px 0 0;font-size:14px;color:#374151;">Thank you,<br><strong>${signer}</strong><br>NetRate Mortgage LLC | NMLS #1111861</p>
`);

  const text = `Homeowners Insurance Request\n\n${greeting} Please provide an insurance quote and binder for the following property:\n\n${formatLoanText(loan)}\n\nMortgagee clause:\n${loan.lenderName || '[Lender Name]'}\nISAOA/ATIMA\n\n${notes ? `Notes: ${notes}\n\n` : ''}Please send the binder and declaration page to david@netratemortgage.com.\n\nThank you,\n${signer}\nNetRate Mortgage LLC | NMLS #1111861\n303-444-5251`;

  return {
    subject: `HOI Request — ${loan.borrowerLastName || 'New Loan'}${loan.propertyAddress ? ` — ${loan.propertyAddress}` : ''}`,
    html,
    text,
  };
}

// ─── Flood Cert Order ───────────────────────────────────────

export function floodCertOrderTemplate({ recipientName, loan, notes, mloName }) {
  const greeting = recipientName ? `Hi ${recipientName},` : 'Hello,';
  const signer = mloName || 'David Burson';

  const html = orderLayout(`
  <h2 style="margin:0 0 12px;font-size:18px;font-weight:600;color:#111827;">Flood Certification Request</h2>
  <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6;">
    ${greeting} please provide a flood zone determination for the following property:
  </p>
  ${loanDetailsTable(loan)}
  ${notes ? `<div style="margin:16px 0;padding:12px 16px;background-color:#fffbeb;border:1px solid #fde68a;border-radius:8px;">
    <p style="margin:0;font-size:12px;font-weight:600;color:#92400e;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Notes</p>
    <p style="margin:0;font-size:13px;color:#78350f;">${notes}</p>
  </div>` : ''}
  <p style="margin:16px 0 0;font-size:14px;color:#374151;">
    Please send the certification to <a href="mailto:david@netratemortgage.com" style="color:${BRAND_COLOR};">david@netratemortgage.com</a>.
  </p>
  <p style="margin:16px 0 0;font-size:14px;color:#374151;">Thank you,<br><strong>${signer}</strong><br>NetRate Mortgage LLC | NMLS #1111861</p>
`);

  const text = `Flood Certification Request\n\n${greeting} Please provide a flood zone determination for the following property:\n\n${formatLoanText(loan)}\n\n${notes ? `Notes: ${notes}\n\n` : ''}Please send the certification to david@netratemortgage.com.\n\nThank you,\n${signer}\nNetRate Mortgage LLC | NMLS #1111861\n303-444-5251`;

  return {
    subject: `Flood Cert Order — ${loan.propertyAddress || loan.borrowerLastName || 'New Loan'}`,
    html,
    text,
  };
}
