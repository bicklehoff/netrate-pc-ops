// API: MLO Lead Detail
// GET /api/portal/mlo/leads/:id — single lead
// PATCH /api/portal/mlo/leads/:id — update status or notes

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

const VALID_STATUSES = ['new', 'contacted', 'qualified', 'quoted', 'converted', 'closed'];

export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.userType !== 'mlo') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        quotes: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    return NextResponse.json({ lead });
  } catch (error) {
    console.error('Lead detail error:', error);
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

    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Whitelist updatable fields
    const allowed = [
      'status', 'loanPurpose', 'loanAmount', 'propertyValue', 'propertyState',
      'propertyCounty', 'propertyType', 'occupancy', 'creditScore', 'creditScoreRange',
      'employmentType', 'firstTimebuyer', 'annualIncome', 'monthlyDebts',
      'purchasePrice', 'downPayment', 'preApprovalAmount', 'preApprovalExpires',
      'currentRate', 'currentBalance', 'currentLender', 'notes',
    ];

    const data = {};
    for (const key of allowed) {
      if (body[key] !== undefined) {
        // Validate status
        if (key === 'status' && !VALID_STATUSES.includes(body[key])) {
          return NextResponse.json(
            { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
            { status: 400 }
          );
        }
        data[key] = body[key];
      }
    }

    // Handle notes append (special case)
    if (body.appendNote) {
      const timestamp = new Date().toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
      });
      const noteEntry = `\n--- ${timestamp} (${session.user.name}) ---\n${body.appendNote}`;
      data.notes = (lead.notes || '') + noteEntry;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const updated = await prisma.lead.update({
      where: { id },
      data,
      include: {
        quotes: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    return NextResponse.json({ lead: updated });
  } catch (error) {
    console.error('Lead update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
