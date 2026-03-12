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
import prisma from '@/lib/prisma';
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
    dateField: 'titleOrdered',
    label: 'Title',
  },
  appraisal: {
    template: appraisalOrderTemplate,
    dateField: 'appraisalOrdered',
    label: 'Appraisal',
  },
  hoi: {
    template: hoiOrderTemplate,
    dateField: 'hoiOrdered',
    label: 'HOI',
  },
  flood: {
    template: floodCertOrderTemplate,
    dateField: 'floodCertOrdered',
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
    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      include: {
        borrower: { select: { firstName: true, lastName: true } },
        loanBorrowers: {
          include: { borrower: { select: { firstName: true, lastName: true } } },
        },
      },
    });

    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

    const isAdmin = session.user.role === 'admin';
    if (!isAdmin && loan.mloId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Build loan context for template
    const loanContext = {
      borrowerFirstName: loan.borrower?.firstName,
      borrowerLastName: loan.borrower?.lastName,
      propertyAddress: loan.propertyStreet || null,
      loanType: loan.loanType || null,
      purpose: loan.purpose || null,
      lenderName: loan.lenderName || null,
      loanNumber: loan.loanNumber || null,
      loanAmount: loan.loanAmount || null,
    };

    // Add co-borrower if exists
    if (loan.loanBorrowers?.length > 1) {
      const coBorrower = loan.loanBorrowers.find((lb) => lb.borrowerType === 'co_borrower');
      if (coBorrower?.borrower) {
        loanContext.coBorrowerFirstName = coBorrower.borrower.firstName;
        loanContext.coBorrowerLastName = coBorrower.borrower.lastName;
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
    await prisma.loanDates.upsert({
      where: { loanId },
      update: { [config.dateField]: now },
      create: { loanId, [config.dateField]: now },
    });

    // Create audit event
    await prisma.loanEvent.create({
      data: {
        loanId,
        eventType: 'order_out',
        actorType: 'mlo',
        actorId: session.user.id,
        details: {
          orderType,
          recipientEmail,
          recipientName: recipientName || null,
          dateField: config.dateField,
          emailId: emailResult?.id || null,
        },
      },
    });

    // Create loan note
    await prisma.loanNote.create({
      data: {
        loanId,
        authorId: session.user.id,
        content: `${config.label} ordered — sent to ${recipientName || recipientEmail}${notes ? `. Notes: ${notes}` : ''}`,
      },
    });

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
