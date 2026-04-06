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

// ─── BRP Access Link ───────────────────────────────────────

export function brpAccessTemplate({ firstName, accessLink }) {
  const name = firstName || 'there';
  const html = emailLayout(`
  <h2 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#111827;">Access Your Rates</h2>
  <p style="margin:0 0 8px;font-size:15px;color:#374151;line-height:1.6;">
    Hi ${name}, click the button below to view your saved rate scenario and current pricing.
  </p>
  ${ctaButton('View My Rates', accessLink)}
  <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.5;">
    If you didn't request this, you can safely ignore this email.
  </p>
  <p style="margin:12px 0 0;font-size:12px;color:#9ca3af;word-break:break-all;">
    Or copy this link: ${accessLink}
  </p>
`, `View your saved rates at NetRate Mortgage`);

  const text = `Hi ${name},\n\nView your saved rates:\n${accessLink}\n\nNetRate Mortgage LLC | NMLS #1111861`;

  return {
    subject: 'Your NetRate Mortgage Rates',
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

/**
 * Quote email — sent when MLO shares a rate quote with a borrower.
 * @param {object} params
 * @param {string} params.firstName — borrower's first name
 * @param {string} params.quoteLink — portal link to view the quote
 * @param {Array} params.scenarios — rate scenarios [{rate, program, monthlyPI}]
 * @param {string} params.loanAmount — formatted loan amount
 * @param {string} params.purpose — purchase/refinance/cashout
 */
export function quoteTemplate({ firstName, quoteLink, scenarios, loanAmount, purpose }) {
  const name = firstName || 'there';
  const primaryRate = scenarios?.[0];
  const rateDisplay = primaryRate ? `${primaryRate.rate.toFixed(3)}%` : '';
  const piDisplay = primaryRate?.monthlyPI ? `$${Number(primaryRate.monthlyPI).toLocaleString()}` : '';

  const rateRows = (scenarios || []).map(s =>
    `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-weight:bold;">${s.rate.toFixed(3)}%</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;">${s.program || ''}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-family:monospace;text-align:right;">$${Number(s.monthlyPI || 0).toLocaleString()}/mo</td>
    </tr>`
  ).join('');

  const html = emailLayout(`
  <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">Your Rate Quote Is Ready</h2>
  <p style="margin:0 0 20px;font-size:14px;color:#6b7280;line-height:1.5;">
    Hi ${name}, I've put together a personalized rate quote for your ${purpose} loan${loanAmount ? ` (${loanAmount})` : ''}.
  </p>

  ${rateRows ? `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
    <tr style="background-color:#111827;">
      <th style="padding:8px 12px;text-align:left;color:#ffffff;font-size:12px;">Rate</th>
      <th style="padding:8px 12px;text-align:left;color:#ffffff;font-size:12px;">Program</th>
      <th style="padding:8px 12px;text-align:right;color:#ffffff;font-size:12px;">Monthly P&I</th>
    </tr>
    ${rateRows}
  </table>
  ` : ''}

  ${ctaButton('View Full Quote Details', quoteLink)}

  <p style="margin:16px 0 0;font-size:13px;color:#6b7280;line-height:1.5;">
    The full quote includes closing cost breakdown, fee details, and a downloadable PDF.
    This quote is based on current wholesale pricing and is subject to change.
  </p>
  <p style="margin:12px 0 0;font-size:13px;color:#6b7280;">
    Questions? Reply to this email or call me at 303-444-5251.
  </p>
`, `Your rate quote: ${rateDisplay} — ${piDisplay}/mo`);

  const text = `Hi ${name},\n\nYour rate quote is ready for your ${purpose} loan${loanAmount ? ` (${loanAmount})` : ''}.\n\n${
    (scenarios || []).map(s => `${s.rate.toFixed(3)}% — ${s.program} — $${Number(s.monthlyPI || 0).toLocaleString()}/mo`).join('\n')
  }\n\nView your full quote: ${quoteLink}\n\nQuestions? Reply to this email or call 303-444-5251.\n\nDavid Burson\nNetRate Mortgage LLC | NMLS #641790`;

  return {
    subject: `Your Rate Quote${rateDisplay ? `: ${rateDisplay}` : ''} — NetRate Mortgage`,
    html,
    text,
  };
}

// ─── Rate Alert Welcome ────────────────────────────────────

const FREQ_LABELS = {
  daily: 'every weekday',
  '3x_week': 'three times a week',
  '2x_week': 'twice a week',
  weekly: 'once a week',
};

/**
 * Welcome email sent immediately when a borrower saves a scenario for rate alerts.
 * @param {object} params
 * @param {string} params.firstName
 * @param {object} params.scenarioSummary — { purpose, loanAmount, fico, ltv, state }
 * @param {Array}  params.initialRates — [{rate, monthlyPI}] top 3
 * @param {string} params.frequency — alert frequency key
 * @param {string[]} params.days — alert day abbreviations
 * @param {string} params.unsubscribeLink
 */
export function rateAlertWelcomeTemplate({ firstName, scenarioSummary, initialRates, frequency, days, unsubscribeLink, myRatesLink }) {
  const name = firstName || 'there';
  const s = scenarioSummary || {};
  const purposeLabel = { purchase: 'Purchase', refi: 'Refinance', cashout: 'Cash-Out Refi' }[s.purpose] || s.purpose || '';
  const summaryLine = [
    purposeLabel,
    s.loanAmount ? '$' + Number(s.loanAmount).toLocaleString('en-US', { maximumFractionDigits: 0 }) : null,
    s.fico ? `${s.fico} FICO` : null,
    s.state || null,
  ].filter(Boolean).join(' · ');

  const dayNames = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday' };
  const dayList = (days || []).map(d => dayNames[d] || d).join(', ');
  const freqText = FREQ_LABELS[frequency] || 'periodically';

  const rateRows = (initialRates || []).map(r =>
    `<tr>
      <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-weight:bold;">${Number(r.rate).toFixed(3)}%</td>
      <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;font-family:monospace;text-align:right;">$${Number(r.monthlyPI || 0).toLocaleString()}/mo</td>
    </tr>`
  ).join('');

  const rateTable = rateRows ? `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
    <tr style="background-color:#111827;">
      <th style="padding:6px 12px;text-align:left;color:#ffffff;font-size:12px;">Rate</th>
      <th style="padding:6px 12px;text-align:right;color:#ffffff;font-size:12px;">Monthly P&I</th>
    </tr>
    ${rateRows}
  </table>` : '';

  const html = emailLayout(`
  <h2 style="margin:0 0 8px;font-size:20px;font-weight:600;color:#111827;">Your Scenario Is Saved</h2>
  <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
    Hi ${name}, thanks for using our rate tool. Your scenario has been saved and you're now signed up for rate alerts.
  </p>

  <div style="background-color:#f0fdfa;border-radius:8px;padding:16px;margin:0 0 16px;">
    <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#0e7490;text-transform:uppercase;">Your Scenario</p>
    <p style="margin:0;font-size:14px;color:#374151;">${summaryLine}</p>
  </div>

  ${rateTable}

  <h3 style="margin:20px 0 8px;font-size:16px;font-weight:600;color:#111827;">How It Works</h3>
  <ul style="margin:0 0 16px;padding-left:20px;">
    <li style="margin:4px 0;font-size:14px;color:#374151;line-height:1.5;">We re-price your scenario ${freqText} (${dayList})</li>
    <li style="margin:4px 0;font-size:14px;color:#374151;line-height:1.5;">Your loan officer reviews the latest rates before each update</li>
    <li style="margin:4px 0;font-size:14px;color:#374151;line-height:1.5;">You receive an email with your updated rates and any changes</li>
  </ul>

  ${myRatesLink ? ctaButton('View My Rates', myRatesLink) : ''}

  <h3 style="margin:20px 0 8px;font-size:16px;font-weight:600;color:#111827;">Who We Are</h3>
  <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6;">
    NetRate Mortgage is a licensed mortgage broker — we shop wholesale rates from multiple lenders on your behalf to find the best deal. Unlike big banks that offer one rate, we compare pricing across our lender network so you can see the real numbers before you commit to anything.
  </p>

  <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.5;">
    Have questions? Reply to this email or call us at 303-444-5251. No pressure, no pitch — just real rates.
  </p>
  <p style="margin:16px 0 0;font-size:11px;color:#9ca3af;">
    <a href="${unsubscribeLink}" style="color:#9ca3af;text-decoration:underline;">Unsubscribe from rate alerts</a>
  </p>
`, `Your scenario is saved — here's what happens next`);

  const ratesText = (initialRates || []).map(r =>
    `${Number(r.rate).toFixed(3)}% — $${Number(r.monthlyPI || 0).toLocaleString()}/mo`
  ).join('\n');

  const text = `Hi ${name},\n\nYour scenario is saved and you're signed up for rate alerts.\n\nScenario: ${summaryLine}\n\n${ratesText ? `Today's rates:\n${ratesText}\n\n` : ''}How it works:\n- We re-price your scenario ${freqText} (${dayList})\n- Your loan officer reviews before each update\n- You receive an email with updated rates\n${myRatesLink ? `\nView My Rates: ${myRatesLink}\n` : ''}\nWho we are:\nNetRate Mortgage is a licensed mortgage broker — we shop wholesale rates from multiple lenders on your behalf.\n\nQuestions? Reply to this email or call 303-444-5251.\n\nUnsubscribe: ${unsubscribeLink}\n\nNetRate Mortgage LLC | NMLS #1111861`;

  return {
    subject: 'Your Scenario Is Saved — NetRate Mortgage Rate Alerts',
    html,
    text,
  };
}

// ─── Scenario Rate Alert ───────────────────────────────────

const PURPOSE_LABELS = { purchase: 'Purchase', refi: 'Refinance', cashout: 'Cash-Out Refi' };

function fmtDollar(n) {
  return '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

/**
 * Rate alert email — sent after MLO approves a queued alert.
 * @param {object} params
 * @param {string} params.firstName
 * @param {object} params.scenarioSummary — { purpose, loanAmount, fico, ltv, state }
 * @param {Array} params.currentRates — [{rate, monthlyPI, lenderName, rebateDollars, discountDollars}]
 * @param {Array} [params.previousRates] — same shape, for comparison
 * @param {string} params.viewLink — link to view live scenario
 * @param {string} params.unsubscribeLink
 * @param {string} [params.mloNotes] — optional note from the loan officer
 */
export function scenarioAlertTemplate({ firstName, scenarioSummary, currentRates, previousRates, viewLink, unsubscribeLink, mloNotes }) {
  const name = firstName || 'there';
  const s = scenarioSummary || {};
  const summaryLine = [
    PURPOSE_LABELS[s.purpose] || s.purpose,
    s.loanAmount ? fmtDollar(s.loanAmount) : null,
    s.fico ? `${s.fico} FICO` : null,
    s.ltv ? `${Math.round(s.ltv)}% LTV` : null,
    s.state || null,
  ].filter(Boolean).join(' | ');

  // Build previous rate lookup for comparison
  const prevMap = {};
  if (previousRates?.length) {
    previousRates.forEach((r, i) => { prevMap[i] = r; });
  }

  const rateRows = (currentRates || []).map((r, i) => {
    const prev = prevMap[i];
    let changeCell = '<td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#9ca3af;text-align:center;">—</td>';
    if (prev) {
      const diff = r.rate - prev.rate;
      if (Math.abs(diff) >= 0.001) {
        const color = diff < 0 ? '#059669' : '#dc2626';
        const arrow = diff < 0 ? '▼' : '▲';
        changeCell = `<td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:12px;font-weight:600;color:${color};text-align:center;">${arrow} ${Math.abs(diff).toFixed(3)}%</td>`;
      } else {
        changeCell = '<td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#9ca3af;text-align:center;">No change</td>';
      }
    }

    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-weight:bold;">${r.rate.toFixed(3)}%</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-family:monospace;text-align:right;">${fmtDollar(r.monthlyPI)}/mo</td>
      ${changeCell}
    </tr>`;
  }).join('');

  const mloNotesHtml = mloNotes
    ? `<div style="margin:20px 0;padding:16px;background-color:#f0fdfa;border-left:4px solid ${BRAND_COLOR};border-radius:4px;">
        <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#0e7490;">Note from your loan officer:</p>
        <p style="margin:0;font-size:14px;color:#374151;line-height:1.5;">${mloNotes}</p>
      </div>`
    : '';

  const html = emailLayout(`
  <h2 style="margin:0 0 8px;font-size:20px;font-weight:600;color:#111827;">Your Rate Update</h2>
  <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">
    Hi ${name}, here's your latest rate update for your saved scenario.
  </p>
  <p style="margin:0 0 20px;font-size:13px;color:#9ca3af;">${summaryLine}</p>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
    <tr style="background-color:#111827;">
      <th style="padding:8px 12px;text-align:left;color:#ffffff;font-size:12px;">Rate</th>
      <th style="padding:8px 12px;text-align:right;color:#ffffff;font-size:12px;">Monthly P&I</th>
      <th style="padding:8px 12px;text-align:center;color:#ffffff;font-size:12px;">Change</th>
    </tr>
    ${rateRows}
  </table>

  ${mloNotesHtml}

  ${ctaButton('View Live Rates', viewLink)}

  <p style="margin:16px 0 0;font-size:13px;color:#6b7280;line-height:1.5;">
    Rates are based on current wholesale pricing and are subject to change.
    Questions? Reply to this email or call us at 303-444-5251.
  </p>
  <p style="margin:16px 0 0;font-size:11px;color:#9ca3af;">
    <a href="${unsubscribeLink}" style="color:#9ca3af;text-decoration:underline;">Unsubscribe from these alerts</a>
  </p>
`, `Rate update: ${currentRates?.[0] ? currentRates[0].rate.toFixed(3) + '%' : 'new rates available'}`);

  const ratesText = (currentRates || []).map(r =>
    `${r.rate.toFixed(3)}% — ${fmtDollar(r.monthlyPI)}/mo`
  ).join('\n');

  const text = `Hi ${name},\n\nYour rate update for: ${summaryLine}\n\n${ratesText}\n\nView live rates: ${viewLink}\n\n${mloNotes ? `Note from your loan officer: ${mloNotes}\n\n` : ''}Unsubscribe: ${unsubscribeLink}\n\nNetRate Mortgage LLC | NMLS #1111861`;

  return {
    subject: `Rate Update: ${currentRates?.[0] ? currentRates[0].rate.toFixed(3) + '%' : 'New rates'} — NetRate Mortgage`,
    html,
    text,
  };
}
