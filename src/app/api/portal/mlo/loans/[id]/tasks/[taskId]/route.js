// API: Loan Task Detail
// PATCH /api/portal/mlo/loans/:id/tasks/:taskId — Update a task

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function PATCH(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.userType !== 'mlo') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { taskId } = await params;
    const body = await request.json();

    const data = {};
    if ('completedAt' in body) data.completedAt = body.completedAt;
    if ('title' in body) data.title = body.title;
    if ('priority' in body) data.priority = body.priority;
    if ('status' in body) data.status = body.status;

    const task = await prisma.loanTask.update({
      where: { id: taskId },
      data,
    });

    return NextResponse.json({ task });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
