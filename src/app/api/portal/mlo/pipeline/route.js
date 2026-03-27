// API: MLO Pipeline
// GET  /api/portal/mlo/pipeline — List all loans with inline-editable fields
// PATCH /api/portal/mlo/pipeline — Bulk update loans (status, mloId)
//
// Returns all loans for the authenticated MLO (or all loans if admin).
// Includes borrower name, status, ball-in-court, pending doc count, and
// editable fields (loanNumber, lenderName, mloId).

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getBallInCourt } from '@/lib/loan-states';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.userType !== 'mlo') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const loans = await prisma.loan.findMany({
      where: {},  // All MLOs see full pipeline — LO filter handles scoping
      include: {
        borrower: {
          select: { firstName: true, lastName: true, email: true, phone: true, ssnLastFour: true },
        },
        documents: {
          select: { id: true, status: true },
        },
        mlo: {
          select: { id: true, firstName: true, lastName: true },
        },
        dates: true,
        loanBorrowers: {
          include: { borrower: { select: { firstName: true, lastName: true, email: true, phone: true } } },
          orderBy: { ordinal: 'asc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Convert Decimal fields to numbers
    const num = (v) => v ? Number(v) : null;

    // Transform for the pipeline table
    const pipeline = loans.map((loan) => ({
      id: loan.id,
      // Borrower
      borrowerName: `${loan.borrower.firstName} ${loan.borrower.lastName}`,
      borrowerEmail: loan.borrower.email,
      borrowerPhone: loan.borrower.phone,
      ssnLastFour: loan.borrower.ssnLastFour,
      // Co-borrowers
      coBorrowers: loan.loanBorrowers
        .filter(lb => lb.borrowerType !== 'primary')
        .map(lb => ({
          name: `${lb.borrower.firstName} ${lb.borrower.lastName}`,
          email: lb.borrower.email,
          phone: lb.borrower.phone,
          type: lb.borrowerType,
        })),
      numBorrowers: loan.numBorrowers,
      // Status
      status: loan.status,
      ballInCourt: loan.ballInCourt,
      // Loan details
      purpose: loan.purpose,
      loanType: loan.loanType,
      loanNumber: loan.loanNumber,
      lenderName: loan.lenderName,
      loanAmount: num(loan.loanAmount),
      interestRate: num(loan.interestRate),
      loanTerm: loan.loanTerm,
      creditScore: loan.creditScore,
      lienStatus: loan.lienStatus,
      // Property
      propertyAddress: loan.propertyAddress,
      propertyStreet: loan.propertyAddress?.street || null,
      propertyCity: loan.propertyAddress?.city || null,
      propertyState: loan.propertyAddress?.state || null,
      propertyZip: loan.propertyAddress?.zip || null,
      propertyCounty: loan.propertyAddress?.county || null,
      propertyType: loan.propertyType,
      numUnits: loan.numUnits,
      occupancy: loan.occupancy,
      // Financials
      purchasePrice: num(loan.purchasePrice),
      downPayment: num(loan.downPayment),
      estimatedValue: num(loan.estimatedValue),
      currentBalance: num(loan.currentBalance),
      refiPurpose: loan.refiPurpose,
      cashOutAmount: num(loan.cashOutAmount),
      // Income / Employment
      employmentStatus: loan.employmentStatus,
      employerName: loan.employerName,
      positionTitle: loan.positionTitle,
      yearsInPosition: loan.yearsInPosition,
      monthlyBaseIncome: num(loan.monthlyBaseIncome),
      otherMonthlyIncome: num(loan.otherMonthlyIncome),
      otherIncomeSource: loan.otherIncomeSource,
      presentHousingExpense: num(loan.presentHousingExpense),
      // MLO
      mloId: loan.mloId,
      mloName: loan.mlo ? `${loan.mlo.firstName} ${loan.mlo.lastName}` : null,
      // Documents
      pendingDocs: loan.documents.filter((d) => d.status === 'requested').length,
      totalDocs: loan.documents.length,
      // Source / CRM
      leadSource: loan.leadSource,
      referralSource: loan.referralSource,
      applicationMethod: loan.applicationMethod,
      applicationChannel: loan.applicationChannel,
      ldoxLoanId: loan.ldoxLoanId,
      // MCR / HMDA
      actionTaken: loan.actionTaken,
      actionTakenDate: loan.actionTakenDate,
      // Dates (all)
      dates: loan.dates ? {
        applicationDate: loan.dates.applicationDate,
        lockedDate: loan.dates.lockedDate,
        lockExpiration: loan.dates.lockExpiration,
        lockTerm: loan.dates.lockTerm,
        creditPulledDate: loan.dates.creditPulledDate,
        creditExpiration: loan.dates.creditExpiration,
        appraisalOrdered: loan.dates.appraisalOrdered,
        appraisalScheduled: loan.dates.appraisalScheduled,
        appraisalReceived: loan.dates.appraisalReceived,
        appraisalDue: loan.dates.appraisalDue,
        appraisalWaiver: loan.dates.appraisalWaiver,
        titleOrdered: loan.dates.titleOrdered,
        titleReceived: loan.dates.titleReceived,
        hoiOrdered: loan.dates.hoiOrdered,
        hoiReceived: loan.dates.hoiReceived,
        hoiBound: loan.dates.hoiBound,
        floodCertOrdered: loan.dates.floodCertOrdered,
        floodCertReceived: loan.dates.floodCertReceived,
        estimatedClosing: loan.dates.estimatedClosing,
        closingDate: loan.dates.closingDate,
        fundingDate: loan.dates.fundingDate,
        firstPaymentDate: loan.dates.firstPaymentDate,
        submittedToUwDate: loan.dates.submittedToUwDate,
        condApprovedDate: loan.dates.condApprovedDate,
        ctcDate: loan.dates.ctcDate,
        docsOutDate: loan.dates.docsOutDate,
      } : null,
      // Convenience date fields for table columns
      lockExpiration: loan.dates?.lockExpiration || null,
      estimatedClosing: loan.dates?.estimatedClosing || null,
      closingDate: loan.dates?.closingDate || null,
      // Timestamps
      submittedAt: loan.submittedAt,
      updatedAt: loan.updatedAt,
      createdAt: loan.createdAt,
    }));

    return NextResponse.json({ loans: pipeline });
  } catch (error) {
    console.error('Pipeline error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── Bulk Update ─────────────────────────────────────────────
// Body: { loanIds: string[], updates: { status?, mloId? } }
// Creates audit events for each loan updated.

export async function PATCH(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.userType !== 'mlo') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { loanIds, updates } = body;

    if (!loanIds || !Array.isArray(loanIds) || loanIds.length === 0) {
      return NextResponse.json({ error: 'loanIds array is required' }, { status: 400 });
    }
    if (!updates || typeof updates !== 'object') {
      return NextResponse.json({ error: 'updates object is required' }, { status: 400 });
    }

    // Only allow specific fields for bulk update
    const allowedFields = ['status', 'mloId'];
    const updateKeys = Object.keys(updates).filter((k) => allowedFields.includes(k));
    if (updateKeys.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const isAdmin = session.user.role === 'admin';

    // Verify access to all loans
    const loans = await prisma.loan.findMany({
      where: { id: { in: loanIds } },
    });

    if (loans.length !== loanIds.length) {
      return NextResponse.json({ error: 'One or more loans not found' }, { status: 404 });
    }

    if (!isAdmin) {
      const unauthorized = loans.find((l) => l.mloId !== session.user.id);
      if (unauthorized) {
        return NextResponse.json({ error: 'Unauthorized access to one or more loans' }, { status: 403 });
      }
    }

    // Update each loan individually (for audit trail with old/new values)
    let updatedCount = 0;
    for (const loan of loans) {
      const data = {};
      const events = [];

      if (updates.status && updates.status !== loan.status) {
        const pendingDocs = await prisma.document.count({
          where: { loanId: loan.id, status: 'requested' },
        });
        data.status = updates.status;
        data.ballInCourt = getBallInCourt(updates.status, pendingDocs > 0) || 'none';
        events.push({
          loanId: loan.id,
          eventType: 'status_change',
          actorType: 'mlo',
          actorId: session.user.id,
          oldValue: loan.status,
          newValue: updates.status,
          details: { source: 'bulk_update' },
        });
      }

      if (updates.mloId !== undefined && updates.mloId !== loan.mloId) {
        data.mloId = updates.mloId || null;
        events.push({
          loanId: loan.id,
          eventType: 'field_updated',
          actorType: 'mlo',
          actorId: session.user.id,
          oldValue: loan.mloId,
          newValue: updates.mloId || null,
          details: { field: 'mloId', source: 'bulk_update' },
        });
      }

      if (Object.keys(data).length > 0) {
        await prisma.loan.update({ where: { id: loan.id }, data });
        for (const event of events) {
          await prisma.loanEvent.create({ data: event });
        }
        updatedCount++;
      }
    }

    return NextResponse.json({ success: true, updatedCount });
  } catch (error) {
    console.error('Bulk update error:', error);
    return NextResponse.json({ error: 'Bulk update failed' }, { status: 500 });
  }
}

// ─── Bulk Delete ─────────────────────────────────────────────
// Body: { loanIds: string[] }
// Admin only. Deletes loans and associated records.

export async function DELETE(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.userType !== 'mlo') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required for delete' }, { status: 403 });
    }

    const body = await request.json();
    const { loanIds } = body;

    if (!loanIds || !Array.isArray(loanIds) || loanIds.length === 0) {
      return NextResponse.json({ error: 'loanIds array is required' }, { status: 400 });
    }

    // Delete associated records first (non-cascade), then loans (cascade handles the rest)
    await prisma.condition.deleteMany({ where: { loanId: { in: loanIds } } }).catch(() => {});
    await prisma.loanEvent.deleteMany({ where: { loanId: { in: loanIds } } }).catch(() => {});
    await prisma.document.deleteMany({ where: { loanId: { in: loanIds } } }).catch(() => {});

    const result = await prisma.loan.deleteMany({ where: { id: { in: loanIds } } });

    return NextResponse.json({ success: true, deletedCount: result.count });
  } catch (error) {
    console.error('Bulk delete error:', error);
    return NextResponse.json({ error: 'Bulk delete failed' }, { status: 500 });
  }
}
