// API: HECM Scenarios — List & Create
// GET  /api/portal/mlo/hecm-scenarios — returns all scenarios for the MLO
// POST /api/portal/mlo/hecm-scenarios — creates a new scenario

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.userType !== 'mlo') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const scenarios = await prisma.hecmScenario.findMany({
      where: { mloId: session.user.id },
      select: {
        id: true,
        borrowerName: true,
        referenceNumber: true,
        homeValue: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({ scenarios });
  } catch (err) {
    console.error('HECM scenarios GET error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.userType !== 'mlo') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { inputState, results } = body;

    if (!inputState) {
      return NextResponse.json({ error: 'inputState is required' }, { status: 400 });
    }

    const scenario = await prisma.hecmScenario.create({
      data: {
        mloId: session.user.id,
        borrowerName: inputState.borrowerName || 'Untitled',
        referenceNumber: inputState.referenceNumber || null,
        homeValue: inputState.homeValue || null,
        inputState,
        results: results || null,
      },
    });

    return NextResponse.json({ scenario }, { status: 201 });
  } catch (err) {
    console.error('HECM scenarios POST error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
