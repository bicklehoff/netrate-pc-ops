// API: MLO Loan Detail
// GET /api/portal/mlo/loans/:id — Full loan detail with all related data
// PATCH /api/portal/mlo/loans/:id — Update loan status, fields, or add notes
//
// Core UI Redesign: Expanded GET includes dates, conditions, loanBorrowers, tasks.
// Expanded PATCH accepts all editable fields + MCR-aware status→date auto-capture.

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getBallInCourt, EMAIL_TRIGGERS } from '@/lib/loan-states';
import { sendEmail } from '@/lib/resend';
import { statusChangeTemplate } from '@/lib/email-templates/borrower';
import { updateContactFromLoanStatus } from '@/lib/contact-status';

// Status → LoanDates field mapping for MCR-aware auto-date capture
const STATUS_DATE_MAP = {
  applied: 'applicationDate',
  submitted_uw: 'submittedToUwDate',
  cond_approved: 'condApprovedDate',
  ctc: 'ctcDate',
  docs_out: 'docsOutDate',
  funded: 'fundingDate',
};

// All loan fields that can be updated via inline edit
const EDITABLE_FIELDS = [
  // Loan terms
  'loanType', 'loanAmount', 'interestRate', 'loanTerm', 'lienStatus', 'numBorrowers',
  // Property
  'propertyAddress', 'propertyType', 'numUnits', 'purchasePrice', 'downPayment', 'estimatedValue', 'currentBalance',
  // Purpose
  'purpose', 'occupancy', 'refiPurpose', 'cashOutAmount',
  // Lender
  'lenderName', 'loanNumber',
  // Employment/Income
  'employmentStatus', 'employerName', 'positionTitle', 'yearsInPosition',
  'monthlyBaseIncome', 'otherMonthlyIncome', 'otherIncomeSource',
  'presentHousingExpense', 'maritalStatus', 'numDependents', 'dependentAges',
  'creditScore',
  // MCR
  'actionTaken', 'actionTakenDate', 'applicationMethod',
  // CRM
  'referralSource', 'leadSource', 'applicationChannel',
  // Pre-qual letter
  'prequalLetterData',
  // Universal approval fields
  'appraisedValue', 'loanProgram', 'underwriterName', 'accountExec', 'brokerProcessor',
];

// Fields that need Decimal conversion
const DECIMAL_FIELDS = [
  'loanAmount', 'interestRate', 'purchasePrice', 'downPayment',
  'estimatedValue', 'currentBalance', 'cashOutAmount',
  'monthlyBaseIncome', 'otherMonthlyIncome', 'presentHousingExpense',
  'appraisedValue',
];

// Fields that need Integer conversion
const INT_FIELDS = ['loanTerm', 'numUnits', 'yearsInPosition', 'numBorrowers', 'creditScore', 'numDependents'];

export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.userType !== 'mlo') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const loan = await prisma.loan.findUnique({
      where: { id },
      include: {
        borrower: {
          select: {
            id: true, firstName: true, lastName: true, email: true, phone: true,
            ssnLastFour: true, phoneVerified: true, createdAt: true,
          },
        },
        mlo: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        documents: {
          orderBy: { createdAt: 'desc' },
          include: {
            requestedBy: {
              select: { firstName: true, lastName: true },
            },
          },
        },
        events: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        // ─── New includes for Core UI ───
        dates: true,
        fha: true,
        hecm: true,
        va: true,
        dscr: true,
        conv: true,
        conditions: {
          orderBy: [{ stage: 'asc' }, { createdAt: 'asc' }],
        },
        loanBorrowers: {
          orderBy: { ordinal: 'asc' },
          include: {
            borrower: {
              select: { id: true, firstName: true, lastName: true, email: true, phone: true },
            },
          },
        },
        tasks: {
          orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
        },
      },
    });

    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

    // All MLOs can view all loans (LO filter handles scoping in pipeline)

    // Helper: convert all Decimal fields in an object to Number
    const serializeDecimals = (obj) => {
      if (!obj) return null;
      const result = { ...obj };
      for (const [key, val] of Object.entries(result)) {
        if (val && typeof val === 'object' && typeof val.toNumber === 'function') {
          result[key] = Number(val);
        }
      }
      return result;
    };

    // Convert Decimal fields to numbers
    const serialized = {
      ...loan,
      loanAmount: loan.loanAmount ? Number(loan.loanAmount) : null,
      interestRate: loan.interestRate ? Number(loan.interestRate) : null,
      purchasePrice: loan.purchasePrice ? Number(loan.purchasePrice) : null,
      downPayment: loan.downPayment ? Number(loan.downPayment) : null,
      estimatedValue: loan.estimatedValue ? Number(loan.estimatedValue) : null,
      currentBalance: loan.currentBalance ? Number(loan.currentBalance) : null,
      cashOutAmount: loan.cashOutAmount ? Number(loan.cashOutAmount) : null,
      monthlyBaseIncome: loan.monthlyBaseIncome ? Number(loan.monthlyBaseIncome) : null,
      otherMonthlyIncome: loan.otherMonthlyIncome ? Number(loan.otherMonthlyIncome) : null,
      presentHousingExpense: loan.presentHousingExpense ? Number(loan.presentHousingExpense) : null,
      appraisedValue: loan.appraisedValue ? Number(loan.appraisedValue) : null,
      // LoanBorrower decimal fields
      loanBorrowers: (loan.loanBorrowers || []).map((lb) => ({
        ...lb,
        monthlyBaseIncome: lb.monthlyBaseIncome ? Number(lb.monthlyBaseIncome) : null,
        otherMonthlyIncome: lb.otherMonthlyIncome ? Number(lb.otherMonthlyIncome) : null,
      })),
      // Satellite table decimal fields
      fha: serializeDecimals(loan.fha),
      hecm: serializeDecimals(loan.hecm),
      va: serializeDecimals(loan.va),
      dscr: serializeDecimals(loan.dscr),
      conv: serializeDecimals(loan.conv),
    };

    return NextResponse.json({ loan: serialized });
  } catch (error) {
    console.error('Loan detail error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.userType !== 'mlo') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const isAdmin = session.user.role === 'admin';

    const loan = await prisma.loan.findUnique({ where: { id } });
    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }
    if (!isAdmin && loan.mloId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // ─── Handle status change (with MCR-aware date auto-capture) ───
    if (body.status && body.status !== loan.status) {
      const pendingDocs = await prisma.document.count({
        where: { loanId: id, status: 'requested' },
      });

      const updated = await prisma.loan.update({
        where: { id },
        data: {
          status: body.status,
          ballInCourt: getBallInCourt(body.status, pendingDocs > 0) || 'none',
        },
      });

      // Create audit event
      await prisma.loanEvent.create({
        data: {
          loanId: id,
          eventType: 'status_change',
          actorType: 'mlo',
          actorId: session.user.id,
          oldValue: loan.status,
          newValue: body.status,
        },
      });

      // MCR-aware: auto-capture date on LoanDates when status changes
      const dateField = STATUS_DATE_MAP[body.status];
      if (dateField) {
        await prisma.loanDates.upsert({
          where: { loanId: id },
          create: {
            loanId: id,
            [dateField]: new Date(),
          },
          update: {
            // Only set if not already set (don't overwrite manual entries)
            ...(await (async () => {
              const existing = await prisma.loanDates.findUnique({ where: { loanId: id } });
              if (existing && existing[dateField]) return {};
              return { [dateField]: new Date() };
            })()),
          },
        });
      }

      // Send borrower notification email (non-blocking)
      const trigger = EMAIL_TRIGGERS[body.status];
      if (trigger?.sendToBorrower) {
        const borrower = await prisma.borrower.findUnique({ where: { id: loan.borrowerId } });
        if (borrower?.email) {
          const template = statusChangeTemplate({
            firstName: borrower.firstName,
            status: body.status,
            loanId: id,
            propertyAddress: loan.propertyStreet,
          });
          if (template) {
            sendEmail({ to: borrower.email, ...template }).catch((err) => {
              console.error(`Status email failed (${body.status}):`, err.message);
            });
          }
        }
      }

      // Update contact lifecycle status (non-blocking)
      updateContactFromLoanStatus(loan.id, body.status).catch(() => {});

      return NextResponse.json({ loan: updated });
    }

    // ─── Handle note addition ───
    if (body.note) {
      await prisma.loanEvent.create({
        data: {
          loanId: id,
          eventType: 'note_added',
          actorType: 'mlo',
          actorId: session.user.id,
          newValue: body.note,
        },
      });

      return NextResponse.json({ success: true });
    }

    // ─── Handle MLO assignment ───
    if (body.mloId !== undefined) {
      const updated = await prisma.loan.update({
        where: { id },
        data: { mloId: body.mloId },
      });

      await prisma.loanEvent.create({
        data: {
          loanId: id,
          eventType: 'field_updated',
          actorType: 'mlo',
          actorId: session.user.id,
          oldValue: loan.mloId,
          newValue: body.mloId,
          details: { field: 'mloId' },
        },
      });

      return NextResponse.json({ loan: updated });
    }

    // ─── Handle inline field updates (expanded for Core UI) ───
    const fieldUpdates = {};
    const fieldDetails = {};

    for (const field of EDITABLE_FIELDS) {
      if (body[field] !== undefined) {
        let value = body[field];

        // Type coerce
        if (value === '' || value === null) {
          value = null;
        } else if (DECIMAL_FIELDS.includes(field)) {
          value = parseFloat(value);
          if (isNaN(value)) value = null;
        } else if (INT_FIELDS.includes(field)) {
          value = parseInt(value, 10);
          if (isNaN(value)) value = null;
        } else if (field === 'actionTakenDate') {
          value = value ? new Date(value) : null;
        } else if (field === 'propertyAddress') {
          // Accept JSON object or comma-separated string
          if (typeof value === 'string') {
            const parts = value.split(',').map((s) => s.trim());
            value = {
              street: parts[0] || '',
              city: parts[1] || '',
              state: parts[2] || '',
              zip: parts[3] || '',
            };
          }
        }

        fieldUpdates[field] = value;
        fieldDetails[field] = { old: loan[field], new: value };
      }
    }

    if (Object.keys(fieldUpdates).length > 0) {
      const updated = await prisma.loan.update({
        where: { id },
        data: fieldUpdates,
      });

      await prisma.loanEvent.create({
        data: {
          loanId: id,
          eventType: 'field_updated',
          actorType: 'mlo',
          actorId: session.user.id,
          newValue: JSON.stringify(fieldUpdates),
          details: { fields: fieldDetails, source: 'core_inline_edit' },
        },
      });

      return NextResponse.json({ loan: updated });
    }

    return NextResponse.json({ error: 'No valid update provided' }, { status: 400 });
  } catch (error) {
    console.error('Loan update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
