// API: MLO Leads List
// GET /api/portal/mlo/leads
// Returns all leads with contact/MLO data, ordered by most recent first.
// Query params: ?status=, ?mloId=, ?q=

import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireMloSession, unauthorizedResponse } from '@/lib/require-mlo-session';

export async function GET(request) {
  try {
    const { session, orgId } = await requireMloSession();

    if (!session) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');
    const filterMloId = searchParams.get('mloId');
    const q = searchParams.get('q');

    const effectiveStatus = (statusFilter && statusFilter !== 'all') ? statusFilter : null;
    const pattern = q ? `%${q}%` : null;

    const leads = await sql`
      SELECT l.*,
        json_build_object('id', c.id, 'first_name', c.first_name, 'last_name', c.last_name, 'status', c.status) AS contact
      FROM leads l
      LEFT JOIN contacts c ON c.id = l.contact_id
      WHERE l.organization_id = ${orgId}
        AND (${effectiveStatus}::text IS NULL OR l.status = ${effectiveStatus})
        AND (${filterMloId}::uuid IS NULL OR l.mlo_id = ${filterMloId})
        AND (${pattern}::text IS NULL OR l.name ILIKE ${pattern} OR l.email ILIKE ${pattern} OR l.phone LIKE ${pattern})
      ORDER BY l.created_at DESC
    `;

    // Null out contact if no contact_id
    const result = leads.map(lead => ({
      ...lead,
      contact: lead.contact?.id ? lead.contact : null,
    }));

    return NextResponse.json({ leads: result });
  } catch (error) {
    console.error('Leads list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
