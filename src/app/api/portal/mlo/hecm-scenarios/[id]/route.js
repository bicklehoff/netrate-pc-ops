// API: HECM Scenario — Single CRUD
// GET    /api/portal/mlo/hecm-scenarios/[id]
// PUT    /api/portal/mlo/hecm-scenarios/[id]
// DELETE /api/portal/mlo/hecm-scenarios/[id]

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import sql from '@/lib/db';

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
    const rows = await sql`
      SELECT * FROM hecm_scenarios WHERE id = ${id} AND mlo_id = ${mloId} LIMIT 1
    `;

    if (!rows[0]) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ scenario: rows[0] });
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
    const existing = await sql`
      SELECT * FROM hecm_scenarios WHERE id = ${id} AND mlo_id = ${mloId} LIMIT 1
    `;
    if (!existing[0]) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const rows = await sql`
      UPDATE hecm_scenarios SET
        borrower_name = ${inputState?.borrowerName || existing[0].borrower_name},
        reference_number = ${inputState?.referenceNumber ?? existing[0].reference_number},
        home_value = ${inputState?.homeValue ?? existing[0].home_value},
        input_state = ${inputState ? JSON.stringify(inputState) : JSON.stringify(existing[0].input_state)}::jsonb,
        results = ${results !== undefined ? (results ? JSON.stringify(results) : null) : (existing[0].results ? JSON.stringify(existing[0].results) : null)}::jsonb,
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    return NextResponse.json({ scenario: rows[0] });
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
    const existing = await sql`
      SELECT id FROM hecm_scenarios WHERE id = ${id} AND mlo_id = ${mloId} LIMIT 1
    `;
    if (!existing[0]) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await sql`DELETE FROM hecm_scenarios WHERE id = ${id}`;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('HECM scenario DELETE error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
