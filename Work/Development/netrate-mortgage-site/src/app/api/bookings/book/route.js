import { NextResponse } from 'next/server';
import { bookAppointment } from '@/lib/zoho-bookings';

// POST /api/bookings/book
// Body: { date, time, name, email, phone, notes? }
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { date, time, name, email, phone, notes } = body;

  if (!date || !time || !name || !email || !phone) {
    return NextResponse.json(
      { error: 'Required fields: date, time, name, email, phone' },
      { status: 400 }
    );
  }

  // Basic email validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
  }

  // Basic phone validation (at least 10 digits)
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) {
    return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 });
  }

  try {
    const result = await bookAppointment({ date, time, name, email, phone, notes });
    return NextResponse.json({ success: true, booking: result });
  } catch (err) {
    console.error('Bookings book error:', err.message);
    return NextResponse.json({ error: 'Failed to book appointment' }, { status: 500 });
  }
}
