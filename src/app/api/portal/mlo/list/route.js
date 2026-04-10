// API: MLO List
// GET /api/portal/mlo/list — Returns all MLOs (id, name) for assignment dropdowns.
// Auth: MLO or Admin required.

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import sql from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.userType !== 'mlo') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const mlos = await sql`
      SELECT id, first_name, last_name, email, role
      FROM mlos
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
