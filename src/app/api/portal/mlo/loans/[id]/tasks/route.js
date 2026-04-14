// API: Loan Tasks
// GET /api/portal/mlo/loans/:id/tasks — List tasks for a loan
// POST /api/portal/mlo/loans/:id/tasks — Create a task

import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireMloSession, unauthorizedResponse } from '@/lib/require-mlo-session';

export async function GET(request, { params }) {
  try {
    const { session, orgId } = await requireMloSession();
    if (!session) return unauthorizedResponse();

    const { id } = await params;

    // Verify loan belongs to this org
    const loanRows = await sql`SELECT id FROM loans WHERE id = ${id} AND organization_id = ${orgId} LIMIT 1`;
    if (loanRows.length === 0) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

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
    const { session, orgId, mloId } = await requireMloSession();
    if (!session) return unauthorizedResponse();

    const { id } = await params;

    // Verify loan belongs to this org
    const loanRows = await sql`SELECT id FROM loans WHERE id = ${id} AND organization_id = ${orgId} LIMIT 1`;
    if (loanRows.length === 0) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

    const body = await request.json();

    const taskRows = await sql`
      INSERT INTO loan_tasks (id, loan_id, title, priority, completed_at, created_by_id, created_at, updated_at)
      VALUES (gen_random_uuid(), ${id}, ${body.title}, ${body.priority || 'normal'}, ${body.completedAt || null}, ${mloId}, NOW(), NOW())
      RETURNING *
    `;

    return NextResponse.json({ task: taskRows[0] }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
