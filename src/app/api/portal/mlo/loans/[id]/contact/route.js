// API: Get contact linked to a loan's borrower
// GET /api/portal/mlo/loans/:id/contact

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.userType !== 'mlo') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const loan = await prisma.loan.findUnique({
      where: { id },
      select: { borrowerId: true },
    });

    if (!loan?.borrowerId) {
      return NextResponse.json({ contactId: null });
    }

    const contact = await prisma.contact.findFirst({
      where: { borrowerId: loan.borrowerId },
      select: { id: true },
    });

    return NextResponse.json({ contactId: contact?.id || null });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
