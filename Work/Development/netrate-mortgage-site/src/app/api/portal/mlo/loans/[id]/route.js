// API: MLO Loan Detail
// GET /api/portal/mlo/loans/:id — Full loan detail with borrower info, docs, events
// PATCH /api/portal/mlo/loans/:id — Update loan status or fields

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getBallInCourt } from '@/lib/loan-states';

export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.userType !== 'mlo') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const isAdmin = session.user.role === 'admin';

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
      },
    });

    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

    // Non-admins can only see their own loans
    if (!isAdmin && loan.mloId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

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

    // Handle status change (free jumps — rules enforced later)
    if (body.status && body.status !== loan.status) {
      const pendingDocs = await prisma.document.count({
        where: { loanId: id, status: 'requested' },
      });

      const updated = await prisma.loan.update({
        where: { id },
        data: {
          status: body.status,
          ballInCourt: getBallInCourt(body.status, pendingDocs > 0),
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

      return NextResponse.json({ loan: updated });
    }

    // Handle note addition
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

    // Handle MLO assignment
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

    // Handle inline field updates (lenderName, loanNumber)
    const inlineFields = ['lenderName', 'loanNumber'];
    const fieldUpdate = inlineFields.find((f) => body[f] !== undefined);
    if (fieldUpdate) {
      const data = {};
      const details = {};
      for (const field of inlineFields) {
        if (body[field] !== undefined) {
          data[field] = body[field] || null;
          details[field] = { old: loan[field], new: body[field] || null };
        }
      }

      const updated = await prisma.loan.update({ where: { id }, data });

      await prisma.loanEvent.create({
        data: {
          loanId: id,
          eventType: 'field_updated',
          actorType: 'mlo',
          actorId: session.user.id,
          newValue: JSON.stringify(data),
          details: { fields: details, source: 'inline_edit' },
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
