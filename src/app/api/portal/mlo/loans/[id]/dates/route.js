// API: Loan Dates (Processing Checklist)
// GET /api/portal/mlo/loans/:id/dates — Get LoanDates record
// PATCH /api/portal/mlo/loans/:id/dates — Update individual date fields
//
// Used by ProcessingSection for click-to-edit date fields.

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// All date fields that can be updated
const DATE_FIELDS = [
  'applicationDate', 'lockedDate', 'lockExpiration', 'lockTerm',
  'creditPulledDate', 'creditExpiration',
  'appraisalOrdered', 'appraisalScheduled', 'appraisalReceived',
  'appraisalDue', 'appraisalDeadline', 'appraisalExpiry',
  'titleOrdered', 'titleReceived', 'titleExpiry',
  'hoiOrdered', 'hoiReceived', 'hoiBound',
  'floodCertOrdered', 'floodCertReceived',
  'estimatedClosing', 'closingDate', 'estimatedFunding', 'fundingDate',
  'firstPaymentDate',
  'submittedToUwDate', 'condApprovedDate', 'ctcDate', 'docsOutDate',
];

// Boolean fields
const BOOLEAN_FIELDS = ['appraisalWaiver'];

// Integer fields
const INT_FIELDS = ['lockTerm'];

export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.userType !== 'mlo') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Verify loan access
    const loan = await prisma.loan.findUnique({
      where: { id },
      select: { id: true, mloId: true },
    });
    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }
    const isAdmin = session.user.role === 'admin';
    if (!isAdmin && loan.mloId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const dates = await prisma.loanDates.findUnique({
      where: { loanId: id },
    });

    return NextResponse.json({ dates: dates || {} });
  } catch (error) {
    console.error('Loan dates GET error:', error);
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

    // Verify loan access
    const loan = await prisma.loan.findUnique({
      where: { id },
      select: { id: true, mloId: true },
    });
    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }
    const isAdmin = session.user.role === 'admin';
    if (!isAdmin && loan.mloId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Build update data
    const updateData = {};
    const changedFields = [];

    for (const field of DATE_FIELDS) {
      if (body[field] !== undefined) {
        updateData[field] = body[field] ? new Date(body[field]) : null;
        changedFields.push(field);
      }
    }

    for (const field of BOOLEAN_FIELDS) {
      if (body[field] !== undefined) {
        updateData[field] = Boolean(body[field]);
        changedFields.push(field);
      }
    }

    for (const field of INT_FIELDS) {
      if (body[field] !== undefined) {
        updateData[field] = body[field] ? parseInt(body[field], 10) : null;
        changedFields.push(field);
      }
    }

    if (changedFields.length === 0) {
      return NextResponse.json({ error: 'No valid date fields provided' }, { status: 400 });
    }

    // Upsert — create LoanDates record if it doesn't exist yet
    const dates = await prisma.loanDates.upsert({
      where: { loanId: id },
      create: {
        loanId: id,
        ...updateData,
      },
      update: updateData,
    });

    // Audit event
    await prisma.loanEvent.create({
      data: {
        loanId: id,
        eventType: 'field_updated',
        actorType: 'mlo',
        actorId: session.user.id,
        newValue: JSON.stringify(updateData),
        details: { fields: changedFields, source: 'processing_checklist' },
      },
    });

    return NextResponse.json({ dates });
  } catch (error) {
    console.error('Loan dates PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
