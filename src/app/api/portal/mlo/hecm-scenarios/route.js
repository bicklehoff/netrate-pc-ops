// API: HECM Scenarios — List & Create
// GET  /api/portal/mlo/hecm-scenarios — returns all scenarios for the MLO
// POST /api/portal/mlo/hecm-scenarios — creates a new scenario

import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireMloSession, unauthorizedResponse } from '@/lib/require-mlo-session';

export async function GET() {
  try {
    const { session, orgId, mloId } = await requireMloSession();
    if (!session) return unauthorizedResponse();

    const scenarios = await sql`
      SELECT id, borrower_name, reference_number, home_value, created_at, updated_at
      FROM hecm_scenarios
      WHERE mlo_id = ${mloId}
        AND organization_id = ${orgId}
      ORDER BY updated_at DESC
    `;

    return NextResponse.json({ scenarios });
  } catch (err) {
    console.error('HECM scenarios GET error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { session, orgId, mloId } = await requireMloSession();
    if (!session) return unauthorizedResponse();

    const body = await request.json();
    const { inputState, results } = body;

    if (!inputState) {
      return NextResponse.json({ error: 'inputState is required' }, { status: 400 });
    }

    const rows = await sql`
      INSERT INTO hecm_scenarios (organization_id, mlo_id, borrower_name, reference_number, home_value, input_state, results, created_at, updated_at)
      VALUES (
        ${orgId}, ${mloId}, ${inputState.borrowerName || 'Untitled'},
        ${inputState.referenceNumber || null}, ${inputState.homeValue || null},
        ${JSON.stringify(inputState)}::jsonb, ${results ? JSON.stringify(results) : null}::jsonb,
        NOW(), NOW()
      )
      RETURNING *
    `;

    return NextResponse.json({ scenario: rows[0] }, { status: 201 });
  } catch (err) {
    console.error('HECM scenarios POST error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
