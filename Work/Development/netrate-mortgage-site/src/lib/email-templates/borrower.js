// Borrower Email Templates — NetRate branded, mobile-responsive
// Used by: magic link auth, status change notifications, doc requests
//
// All templates return { subject, html, text } for use with sendEmail().
// Portal URL: NEXTAUTH_URL or https://www.netratemortgage.com

const PORTAL_URL = process.env.NEXTAUTH_URL || 'https://www.netratemortgage.com';
const BRAND_COLOR = '#0891b2';

// ─── Shared Layout ──────────────────────────────────────────

function emailLayout(content, preheader = '') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>NetRate Mortgage</title>
<!--[if mso]><style>body{font-family:Arial,sans-serif!important}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;">${preheader}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;">
<tr><td align="center" style="padding:24px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
<!-- Header -->
<tr><td style="padding:24px 32px;background-color:${BRAND_COLOR};">
  <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Net</span><span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Rate</span><span style="font-size:16px;font-weight:400;color:rgba(255,255,255,0.85);margin-left:6px;">Mortgage</span>
</td></tr>
<!-- Body -->
<tr><td style="padding:32px;">
${content}
</td></tr>
<!-- Footer -->
<tr><td style="padding:20px 32px;background-color:#f9fafb;border-top:1px solid #e5e7eb;">
  <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.5;">
    NetRate Mortgage LLC | NMLS #1111861<br>
    357 S McCaslin Blvd #200, Louisville, CO 80027<br>
    <a href="tel:3034445251" style="color:${BRAND_COLOR};text-decoration:none;">303-444-5251</a> |
    <a href="mailto:david@netratemortgage.com" style="color:${BRAND_COLOR};text-decoration:none;">david@netratemortgage.com</a>
  </p>
  <p style="margin:8px 0 0;font-size:11px;color:#9ca3af;">
    Equal Housing Lender. This email was sent by NetRate Mortgage LLC.
  </p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function ctaButton(text, url) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
<tr><td align="center" style="background-color:${BRAND_COLOR};border-radius:8px;">
  <a href="${url}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
    ${text}
  </a>
</td></tr>
</table>`;
}

// ─── Magic Link ─────────────────────────────────────────────

export function magicLinkTemplate({ firstName, magicLink }) {
  const name = firstName || 'there';
  const html = emailLayout(`
  <h2 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#111827;">Sign in to MyNetRate</h2>
  <p style="margin:0 0 8px;font-size:15px;color:#374151;line-height:1.6;">
    Hi ${name}, click the button below to access your loan portal.
  </p>
  ${ctaButton('Sign In to My Portal', magicLink)}
  <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.5;">
    This link expires in 15 minutes. If you didn't request this, you can safely ignore this email.
  </p>
  <p style="margin:12px 0 0;font-size:12px;color:#9ca3af;word-break:break-all;">
    Or copy this link: ${magicLink}
  </p>
`, `Sign in to your NetRate Mortgage portal`);

  const text = `Hi ${name},\n\nSign in to your MyNetRate portal:\n${magicLink}\n\nThis link expires in 15 minutes.\n\nNetRate Mortgage LLC | NMLS #1111861`;

  return {
    subject: 'Sign in to MyNetRate',
    html,
    text,
  };
}

// ─── Status Change ──────────────────────────────────────────

const STATUS_MESSAGES = {
  applied: {
    heading: 'Application Received',
    body: 'We\'ve received your mortgage application and our team is reviewing it. We\'ll be in touch shortly with next steps.',
    cta: 'View Your Application',
  },
  processing: {
    heading: 'Your Loan Is Being Processed',
    body: 'Great news — your loan is now in processing. We\'re gathering everything we need to submit to underwriting.',
    cta: 'View Your Loan Status',
  },
  submitted_uw: {
    heading: 'Submitted to Underwriting',
    body: 'Your loan has been submitted to underwriting for review. This typically takes 2-5 business days. We\'ll update you as soon as we hear back.',
    cta: 'View Your Loan Status',
  },
  cond_approved: {
    heading: 'Conditionally Approved',
    body: 'Your loan has been conditionally approved. There may be a few items to address before we get the final clear to close. Check your portal for details.',
    cta: 'View Conditions',
  },
  ctc: {
    heading: 'Clear to Close!',
    body: 'Congratulations! Your loan is clear to close. We\'re preparing your closing documents and will coordinate the closing date with you shortly.',
    cta: 'View Closing Details',
  },
  docs_out: {
    heading: 'Closing Documents Sent',
    body: 'Your closing documents have been sent out. Please review them carefully and reach out if you have any questions before signing.',
    cta: 'View Your Portal',
  },
  funded: {
    heading: 'Your Loan Has Funded!',
    body: 'Congratulations! Your loan has officially funded. Thank you for choosing NetRate Mortgage. It has been a pleasure working with you.',
    cta: null,
  },
  denied: {
    heading: 'Application Update',
    body: 'We need to discuss your application. Please reach out to your loan officer at your earliest convenience so we can go over your options.',
    cta: 'Contact Your Loan Officer',
  },
  suspended: {
    heading: 'We Need to Talk',
    body: 'There\'s an item we need to discuss regarding your application. Please reach out to your loan officer so we can get things back on track.',
    cta: 'Contact Your Loan Officer',
  },
};

export function statusChangeTemplate({ firstName, status, propertyAddress }) {
  const name = firstName || 'there';
  const msg = STATUS_MESSAGES[status];
  if (!msg) return null;

  const portalLink = `${PORTAL_URL}/portal/dashboard`;
  const addressLine = propertyAddress ? `<p style="margin:0 0 16px;font-size:14px;color:#6b7280;">Property: ${propertyAddress}</p>` : '';

  const html = emailLayout(`
  <h2 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#111827;">${msg.heading}</h2>
  ${addressLine}
  <p style="margin:0 0 8px;font-size:15px;color:#374151;line-height:1.6;">
    Hi ${name}, ${msg.body}
  </p>
  ${msg.cta ? ctaButton(msg.cta, portalLink) : ''}
  <p style="margin:16px 0 0;font-size:13px;color:#6b7280;">
    Questions? Reply to this email or call us at 303-444-5251.
  </p>
`, msg.heading);

  const text = `Hi ${name},\n\n${msg.heading}\n\n${msg.body}\n\n${msg.cta ? `Visit your portal: ${portalLink}\n\n` : ''}Questions? Reply to this email or call 303-444-5251.\n\nNetRate Mortgage LLC | NMLS #1111861`;

  return {
    subject: msg.heading,
    html,
    text,
  };
}

// ─── Document Request ───────────────────────────────────────

export function docRequestTemplate({ firstName, documents }) {
  const name = firstName || 'there';
  const portalLink = `${PORTAL_URL}/portal/dashboard`;

  const docList = documents.map((d) => `<li style="margin:4px 0;font-size:15px;color:#374151;">${d.label}${d.notes ? ` <span style="color:#6b7280;">— ${d.notes}</span>` : ''}</li>`).join('\n');
  const docListText = documents.map((d) => `- ${d.label}${d.notes ? ` (${d.notes})` : ''}`).join('\n');

  const html = emailLayout(`
  <h2 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#111827;">Documents Needed</h2>
  <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
    Hi ${name}, we need the following document${documents.length > 1 ? 's' : ''} to keep your loan moving forward:
  </p>
  <ul style="margin:0 0 8px;padding-left:20px;">
    ${docList}
  </ul>
  ${ctaButton('Upload Documents', portalLink)}
  <p style="margin:0;font-size:13px;color:#6b7280;">
    You can upload directly through your MyNetRate portal. Questions? Just reply to this email.
  </p>
`, `We need documents for your loan`);

  const text = `Hi ${name},\n\nWe need the following document${documents.length > 1 ? 's' : ''} for your loan:\n\n${docListText}\n\nUpload at: ${portalLink}\n\nQuestions? Reply to this email or call 303-444-5251.\n\nNetRate Mortgage LLC | NMLS #1111861`;

  return {
    subject: `Action needed: document${documents.length > 1 ? 's' : ''} requested`,
    html,
    text,
  };
}

// ─── Welcome ────────────────────────────────────────────────

export function welcomeTemplate({ firstName, portalUrl }) {
  const name = firstName || 'there';
  const link = portalUrl || `${PORTAL_URL}/portal/dashboard`;

  const html = emailLayout(`
  <h2 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#111827;">Welcome to MyNetRate</h2>
  <p style="margin:0 0 8px;font-size:15px;color:#374151;line-height:1.6;">
    Hi ${name}, your MyNetRate portal is ready. Here you can:
  </p>
  <ul style="margin:0 0 16px;padding-left:20px;">
    <li style="margin:4px 0;font-size:15px;color:#374151;">Track your loan status in real time</li>
    <li style="margin:4px 0;font-size:15px;color:#374151;">Upload documents securely</li>
    <li style="margin:4px 0;font-size:15px;color:#374151;">See what's needed and what's been received</li>
  </ul>
  ${ctaButton('Go to My Portal', link)}
  <p style="margin:0;font-size:13px;color:#6b7280;">
    To sign in, just use your email address — we'll send you a secure link each time.
  </p>
`, `Your MyNetRate portal is ready`);

  const text = `Hi ${name},\n\nWelcome to MyNetRate! Your portal is ready.\n\nTrack your loan status, upload documents, and see what's needed.\n\nVisit: ${link}\n\nNetRate Mortgage LLC | NMLS #1111861`;

  return {
    subject: 'Welcome to MyNetRate — your loan portal is ready',
    html,
    text,
  };
}
