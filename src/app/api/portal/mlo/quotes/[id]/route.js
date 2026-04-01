/**
 * MLO Quote API — Single Quote CRUD
 *
 * GET   /api/portal/mlo/quotes/:id — get full quote with all data
 * PATCH /api/portal/mlo/quotes/:id — update quote fields (scenario, fees, selected rates)
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.userType !== 'mlo') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const quote = await prisma.borrowerQuote.findUnique({
      where: { id },
    });

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }
    if (quote.mloId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    return NextResponse.json({ quote });
  } catch (err) {
    console.error('Quote GET error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
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

    // Verify ownership
    const existing = await prisma.borrowerQuote.findUnique({
      where: { id },
      select: { mloId: true, status: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }
    if (existing.mloId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Build update data from allowed fields
    const data = {};
    const allowedScalar = [
      'borrowerName', 'borrowerEmail', 'borrowerPhone',
      'purpose', 'propertyType', 'occupancy', 'loanType',
      'state', 'county', 'currentLender',
    ];
    for (const field of allowedScalar) {
      if (body[field] !== undefined) data[field] = body[field];
    }

    const allowedDecimal = [
      'propertyValue', 'loanAmount', 'ltv', 'currentRate',
      'currentBalance', 'currentPayment', 'annualTaxes',
      'annualInsurance', 'pmiRate', 'monthlyPmi',
      'cashToClose', 'monthlyPayment', 'monthlySavings',
    ];
    for (const field of allowedDecimal) {
      if (body[field] !== undefined) data[field] = Number(body[field]);
    }

    const allowedInt = ['fico', 'term', 'paybackMonths'];
    for (const field of allowedInt) {
      if (body[field] !== undefined) data[field] = Number(body[field]);
    }

    if (body.closingDate !== undefined) {
      data.closingDate = body.closingDate ? new Date(body.closingDate) : null;
    }
    if (body.firstPaymentDate !== undefined) {
      data.firstPaymentDate = body.firstPaymentDate ? new Date(body.firstPaymentDate) : null;
    }

    // JSON fields
    if (body.scenarios !== undefined) data.scenarios = body.scenarios;
    if (body.feeBreakdown !== undefined) data.feeBreakdown = body.feeBreakdown;

    // Contact/loan links
    if (body.contactId !== undefined) data.contactId = body.contactId;
    if (body.leadId !== undefined) data.leadId = body.leadId;
    if (body.loanId !== undefined) data.loanId = body.loanId;

    const quote = await prisma.borrowerQuote.update({
      where: { id },
      data,
    });

    return NextResponse.json({ quote });
  } catch (err) {
    console.error('Quote PATCH error:', err);
    return NextResponse.json({ error: 'Internal error', detail: err.message }, { status: 500 });
  }
}
