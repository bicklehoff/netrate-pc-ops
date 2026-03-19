import { NextResponse } from 'next/server';
import { getAvailableSlots } from '@/lib/zoho-bookings';

// GET /api/bookings/slots?date=20-Mar-2026
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');

  if (!date) {
    return NextResponse.json({ error: 'date parameter required (dd-MMM-yyyy)' }, { status: 400 });
  }

  try {
    const result = await getAvailableSlots(date);
    return NextResponse.json(result);
  } catch (err) {
    console.error('Bookings slots error:', err.message);
    return NextResponse.json({ error: 'Failed to fetch available times' }, { status: 500 });
  }
}
