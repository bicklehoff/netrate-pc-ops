// API: Loan Tasks
// GET /api/portal/mlo/loans/:id/tasks — List tasks for a loan
// POST /api/portal/mlo/loans/:id/tasks — Create a task

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
    const tasks = await prisma.loanTask.findMany({
      where: { loanId: id },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ tasks });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.userType !== 'mlo') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const task = await prisma.loanTask.create({
      data: {
        loanId: id,
        title: body.title,
        priority: body.priority || 'normal',
        completedAt: body.completedAt || null,
        createdById: session.user.id,
      },
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
