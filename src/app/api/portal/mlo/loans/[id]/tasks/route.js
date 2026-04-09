// API: Loan Tasks
// GET /api/portal/mlo/loans/:id/tasks — List tasks for a loan
// POST /api/portal/mlo/loans/:id/tasks — Create a task

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import sql from '@/lib/db';

export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.userType !== 'mlo') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const tasks = await sql`
      SELECT * FROM loan_tasks WHERE loan_id = ${id} ORDER BY created_at ASC
    `;

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

    const taskRows = await sql`
      INSERT INTO loan_tasks (id, loan_id, title, priority, completed_at, created_by_id, created_at, updated_at)
      VALUES (gen_random_uuid(), ${id}, ${body.title}, ${body.priority || 'normal'}, ${body.completedAt || null}, ${session.user.id}, NOW(), NOW())
      RETURNING *
    `;

    return NextResponse.json({ task: taskRows[0] }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
