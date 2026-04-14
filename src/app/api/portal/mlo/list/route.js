// API: MLO List
// GET /api/portal/mlo/list — Returns all MLOs (id, name) for assignment dropdowns.
// Auth: MLO or Admin required.

import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireMloSession, unauthorizedResponse } from '@/lib/require-mlo-session';

export async function GET() {
  try {
    const { session, orgId } = await requireMloSession();
    if (!session) return unauthorizedResponse();

    const mlos = await sql`
      SELECT id, first_name, last_name, email, role
      FROM mlos
      WHERE organization_id = ${orgId}
      ORDER BY first_name ASC
    `;

    return NextResponse.json({
      mlos: mlos.map((m) => ({
        id: m.id,
        name: `${m.first_name} ${m.last_name}`,
        email: m.email,
        role: m.role,
      })),
    });
  } catch (error) {
    console.error('MLO list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
