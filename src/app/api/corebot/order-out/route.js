// CoreBot Order-Out — Send service order emails to vendors
// POST /api/corebot/order-out
// Body: { loanId, orderType, recipientEmail, recipientName?, notes?, cc? }
// Auth: MLO session
//
// Sends branded email to vendor, auto-updates LoanDates (ordered date),
// creates LoanEvent audit trail + LoanNote.

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import sql from '@/lib/db';
import { sendEmail } from '@/lib/resend';
import {
  titleOrderTemplate,
  appraisalOrderTemplate,
  hoiOrderTemplate,
  floodCertOrderTemplate,
} from '@/lib/email-templates/order-outs';

// Map orderType → template function + LoanDates field to auto-fill
const ORDER_CONFIG = {
  title: {
    template: titleOrderTemplate,
    dateField: 'title_ordered',
    label: 'Title',
  },
  appraisal: {
    template: appraisalOrderTemplate,
    dateField: 'appraisal_ordered',
    label: 'Appraisal',
  },
  hoi: {
    template: hoiOrderTemplate,
    dateField: 'hoi_ordered',
    label: 'HOI',
  },
  flood: {
    template: floodCertOrderTemplate,
    dateField: 'flood_cert_ordered',
    label: 'Flood Cert',
  },
};

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.userType !== 'mlo') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { loanId, orderType, recipientEmail, recipientName, notes, cc } = await request.json();

    if (!loanId || !orderType || !recipientEmail) {
      return NextResponse.json(
        { error: 'loanId, orderType, and recipientEmail are required' },
        { status: 400 }
      );
    }

    const config = ORDER_CONFIG[orderType];
    if (!config) {
      return NextResponse.json(
        { error: `Invalid orderType. Must be one of: ${Object.keys(ORDER_CONFIG).join(', ')}` },
        { status: 400 }
      );
    }

    // Load loan with borrower context
    const loanRows = await sql`
      SELECT l.*,
             b.first_name AS borrower_first_name,
             b.last_name AS borrower_last_name
      FROM loans l
      LEFT JOIN contacts b ON b.id = l.contact_id
      WHERE l.id = ${loanId}
      LIMIT 1
    `;
    const loan = loanRows[0];

    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

    const isAdmin = session.user.role === 'admin';
    if (!isAdmin && loan.mlo_id !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Fetch loan borrowers for co-borrower context
    const loanBorrowers = await sql`
      SELECT lb.borrower_type,
             b.first_name, b.last_name
      FROM loan_borrowers lb
      JOIN contacts b ON b.id = lb.contact_id
      WHERE lb.loan_id = ${loanId}
    `;

    // Build loan context for template
    const loanContext = {
      borrowerFirstName: loan.borrower_first_name,
      borrowerLastName: loan.borrower_last_name,
      propertyAddress: loan.property_street || null,
      loanType: loan.loan_type || null,
      purpose: loan.purpose || null,
      lenderName: loan.lender_name || null,
      loanNumber: loan.loan_number || null,
      loanAmount: loan.loan_amount ? Number(loan.loan_amount) : null,
    };

    // Add co-borrower if exists
    if (loanBorrowers.length > 1) {
      const coBorrower = loanBorrowers.find((lb) => lb.borrower_type === 'co_borrower');
      if (coBorrower) {
        loanContext.coBorrowerFirstName = coBorrower.first_name;
        loanContext.coBorrowerLastName = coBorrower.last_name;
      }
    }

    // MLO name for signature
    const mloName = [session.user.firstName, session.user.lastName].filter(Boolean).join(' ') || 'David Burson';

    // Generate email from template
    const template = config.template({
      recipientName: recipientName || null,
      loan: loanContext,
      notes: notes || null,
      mloName,
    });

    // Send email
    const emailResult = await sendEmail({
      to: recipientEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
      cc: cc || undefined,
    });

    // Auto-update LoanDates with ordered date
    const now = new Date();
    // dateField is from ORDER_CONFIG (safe, not user input) — use per-type queries
    if (config.dateField === 'title_ordered') {
      await sql`INSERT INTO loan_dates (loan_id, title_ordered) VALUES (${loanId}, ${now}) ON CONFLICT (loan_id) DO UPDATE SET title_ordered = ${now}, updated_at = NOW()`;
    } else if (config.dateField === 'appraisal_ordered') {
      await sql`INSERT INTO loan_dates (loan_id, appraisal_ordered) VALUES (${loanId}, ${now}) ON CONFLICT (loan_id) DO UPDATE SET appraisal_ordered = ${now}, updated_at = NOW()`;
    } else if (config.dateField === 'hoi_ordered') {
      await sql`INSERT INTO loan_dates (loan_id, hoi_ordered) VALUES (${loanId}, ${now}) ON CONFLICT (loan_id) DO UPDATE SET hoi_ordered = ${now}, updated_at = NOW()`;
    } else if (config.dateField === 'flood_cert_ordered') {
      await sql`INSERT INTO loan_dates (loan_id, flood_cert_ordered) VALUES (${loanId}, ${now}) ON CONFLICT (loan_id) DO UPDATE SET flood_cert_ordered = ${now}, updated_at = NOW()`;
    }

    // Create audit event
    await sql`
      INSERT INTO loan_events (loan_id, event_type, actor_type, actor_id, details)
      VALUES (
        ${loanId},
        'order_out',
        'mlo',
        ${session.user.id},
        ${JSON.stringify({
          orderType,
          recipientEmail,
          recipientName: recipientName || null,
          dateField: config.dateField,
          emailId: emailResult?.id || null,
        })}::jsonb
      )
    `;

    // Create loan note
    await sql`
      INSERT INTO loan_notes (loan_id, author_id, content)
      VALUES (
        ${loanId},
        ${session.user.id},
        ${`${config.label} ordered — sent to ${recipientName || recipientEmail}${notes ? `. Notes: ${notes}` : ''}`}
      )
    `;

    return NextResponse.json({
      success: true,
      orderedAt: now.toISOString(),
      emailId: emailResult?.id || null,
    });
  } catch (error) {
    console.error('Order-out error:', error);
    return NextResponse.json(
      { error: error.message || 'Order failed' },
      { status: 500 }
    );
  }
}
