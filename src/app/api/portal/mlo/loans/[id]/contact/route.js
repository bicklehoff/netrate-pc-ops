// API: Get contact linked to a loan's borrower
// GET /api/portal/mlo/loans/:id/contact

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

    const loanRows = await sql`SELECT borrower_id FROM loans WHERE id = ${id} LIMIT 1`;
    const loan = loanRows[0];

    if (!loan?.borrower_id) {
      return NextResponse.json({ contact_id: null });
    }

    const contactRows = await sql`
      SELECT id FROM contacts WHERE borrower_id = ${loan.borrower_id} LIMIT 1
    `;

    return NextResponse.json({ contact_id: contactRows[0]?.id || null });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
