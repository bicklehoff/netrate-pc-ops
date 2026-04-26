// GET /api/book/slots?date=dd-MMM-yyyy
//
// Returns available appointment slots for a date, filtered to :00/:30 boundaries.
// Used by /book widget for time selection.
//
// Validation:
//   - date param required, format dd-MMM-yyyy (e.g. "27-Apr-2026")
//   - rate-limited: 30/min per IP (slot fetches happen on every date click)
//
// Returns: { slots: string[], timeZone: string } | { error: string }

import { NextResponse } from 'next/server';
import { getAvailableSlots, ZohoBookingsError } from '@/lib/zoho/bookings';
import { rateLimit } from '@/lib/api/rate-limit';

const DATE_RE = /^[0-3]\d-[A-Z][a-z]{2}-\d{4}$/;

export async function GET(request) {
  const limited = await rateLimit(request, { scope: 'book-slots', limit: 30, window: '1 m' });
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');

  if (!date || !DATE_RE.test(date)) {
    return NextResponse.json(
      { error: 'Invalid date format — expected dd-MMM-yyyy (e.g. 27-Apr-2026)' },
      { status: 400 }
    );
  }

  try {
    const result = await getAvailableSlots(date);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ZohoBookingsError) {
      console.error(`[book/slots] Zoho error (${err.code}): ${err.message}`, err.details);
      // Don't leak Zoho details to client — generic message
      return NextResponse.json(
        { error: 'Could not load available times. Please try again or call directly.' },
        { status: 502 }
      );
    }
    console.error('[book/slots] unexpected error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
