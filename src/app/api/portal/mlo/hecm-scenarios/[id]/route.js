// API: HECM Scenario — Single CRUD
// GET    /api/portal/mlo/hecm-scenarios/[id]
// PUT    /api/portal/mlo/hecm-scenarios/[id]
// DELETE /api/portal/mlo/hecm-scenarios/[id]

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

async function getAuthedMloId() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.userType !== 'mlo') return null;
  return session.user.id;
}

export async function GET(request, { params }) {
  try {
    const mloId = await getAuthedMloId();
    if (!mloId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const scenario = await prisma.hecmScenario.findFirst({
      where: { id, mloId },
    });

    if (!scenario) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ scenario });
  } catch (err) {
    console.error('HECM scenario GET error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const mloId = await getAuthedMloId();
    if (!mloId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const { inputState, results } = body;

    // Verify ownership
    const existing = await prisma.hecmScenario.findFirst({
      where: { id, mloId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const scenario = await prisma.hecmScenario.update({
      where: { id },
      data: {
        borrowerName: inputState?.borrowerName || existing.borrowerName,
        referenceNumber: inputState?.referenceNumber ?? existing.referenceNumber,
        homeValue: inputState?.homeValue ?? existing.homeValue,
        inputState: inputState || existing.inputState,
        results: results ?? existing.results,
      },
    });

    return NextResponse.json({ scenario });
  } catch (err) {
    console.error('HECM scenario PUT error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const mloId = await getAuthedMloId();
    if (!mloId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    // Verify ownership
    const existing = await prisma.hecmScenario.findFirst({
      where: { id, mloId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await prisma.hecmScenario.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('HECM scenario DELETE error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
