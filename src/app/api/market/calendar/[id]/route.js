// DELETE /api/market/calendar/:id — Remove a calendar event by ID
// Auth: x-api-key: CLAW_API_KEY

import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';

export async function DELETE(request, { params }) {
  try {
    const apiKey = request.headers.get('x-api-key')
      || request.headers.get('authorization')?.replace('Bearer ', '');

    if (!apiKey || apiKey !== process.env.CLAW_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    await prisma.economicCalendarEvent.delete({ where: { id } });

    revalidatePath('/rate-watch');

    return NextResponse.json({ ok: true, deleted: id });
  } catch (error) {
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    console.error('Calendar DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
