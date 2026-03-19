import { NextResponse } from 'next/server';
import { getAvailableSlots } from '@/lib/zoho-bookings';

// GET /api/bookings/slots?date=20-Mar-2026
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');

  if (!date) {
    return NextResponse.json({ error: 'date parameter required (dd-MMM-yyyy)' }, { status: 400 });
  }

  // Quick env check
  const hasToken = !!process.env.ZOHO_BOOKINGS_REFRESH_TOKEN;
  const hasClientId = !!process.env.ZOHO_CLIENT_ID;
  const hasClientSecret = !!process.env.ZOHO_CLIENT_SECRET;

  if (!hasToken || !hasClientId || !hasClientSecret) {
    console.error('Bookings env check:', { hasToken, hasClientId, hasClientSecret });
    return NextResponse.json({
      error: `Missing env vars: ${!hasToken ? 'ZOHO_BOOKINGS_REFRESH_TOKEN ' : ''}${!hasClientId ? 'ZOHO_CLIENT_ID ' : ''}${!hasClientSecret ? 'ZOHO_CLIENT_SECRET' : ''}`.trim()
    }, { status: 500 });
  }

  try {
    const result = await getAvailableSlots(date);
    return NextResponse.json(result);
  } catch (err) {
    console.error('Bookings slots error:', err.message, err.stack);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
