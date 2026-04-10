// API: Loan Task Detail
// PATCH /api/portal/mlo/loans/:id/tasks/:taskId — Update a task

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import sql from '@/lib/db';

export async function PATCH(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.userType !== 'mlo') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { taskId } = await params;
    const body = await request.json();

    const data = {};
    if ('completedAt' in body) data.completed_at = body.completedAt;
    if ('title' in body) data.title = body.title;
    if ('priority' in body) data.priority = body.priority;
    if ('status' in body) data.status = body.status;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const cols = Object.keys(data);
    const vals = Object.values(data);
    const setFragments = cols.map((c, i) => `"${c}" = $${i + 1}`);
    const q = `UPDATE loan_tasks SET ${setFragments.join(', ')}, updated_at = NOW() WHERE id = $${cols.length + 1} RETURNING *`;
    const taskRows = await sql(q, [...vals, taskId]);

    return NextResponse.json({ task: taskRows[0] });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
