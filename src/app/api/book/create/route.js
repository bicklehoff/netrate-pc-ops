// POST /api/book/create
//
// Books an appointment via Zoho Bookings, writes a contact + lead via the
// shared CoreCRM intake (createInboundLead), and sends a borrower confirmation
// email via Resend. David is notified through createInboundLead's built-in
// notify hook.
//
// Acceptance criteria source: Claw relay relay_mod5wravdehcpl2l (Phase 1 brief).
//
// Body (JSON):
//   { date: "dd-MMM-yyyy", time: "h:mm AM/PM", name, email, phone, notes? }
//
// Returns:
//   { booking: { bookingId, when }, contactId, leadId, isNew, emailStatus }
//
// Idempotency: not enforced — duplicate clicks may create duplicate Zoho
// appointments. Acceptable for low-traffic launch; revisit if real users
// hit the double-submit edge case (see deferred follow-ups in
// Work/Dev/ZOHO-OAUTH-SUBSTRATE-DESIGN.md updates).

import { NextResponse } from 'next/server';
import { bookAppointment, ZohoBookingsError } from '@/lib/zoho/bookings';
import { createInboundLead } from '@/lib/leads/create-inbound';
import { sendEmail } from '@/lib/resend';
import { normalizePhone } from '@/lib/normalize-phone';
import { rateLimit } from '@/lib/api/rate-limit';

const DATE_RE = /^[0-3]\d-[A-Z][a-z]{2}-\d{4}$/;
const TIME_RE = /^\d{1,2}:\d{2}\s*(AM|PM)$/i;

function isValidEmail(s) {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function splitName(full) {
  const parts = (full || '').trim().split(/\s+/);
  return {
    firstName: parts[0] || null,
    lastName: parts.length > 1 ? parts.slice(1).join(' ') : null,
  };
}

export async function POST(request) {
  const limited = await rateLimit(request, { scope: 'book-create', limit: 5, window: '10 m' });
  if (limited) return limited;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { date, time, name, email, phone, notes } = body || {};

  // ── Validation ─────────────────────────────────────────────
  if (!date || !DATE_RE.test(date)) {
    return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
  }
  if (!time || !TIME_RE.test(time)) {
    return NextResponse.json({ error: 'Invalid time format' }, { status: 400 });
  }
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
  }
  if (!phone || typeof phone !== 'string') {
    return NextResponse.json({ error: 'Phone is required' }, { status: 400 });
  }

  const normalizedPhone = normalizePhone(phone) || phone;
  const trimmedName = name.trim();
  const lowerEmail = email.trim().toLowerCase();

  // ── 1. Create Zoho appointment (this can fail loudest — do first) ──
  let booking;
  try {
    booking = await bookAppointment({
      date,
      time,
      name: trimmedName,
      email: lowerEmail,
      phone: normalizedPhone,
      notes: notes || undefined,
    });
  } catch (err) {
    if (err instanceof ZohoBookingsError) {
      console.error(`[book/create] Zoho error (${err.code}): ${err.message}`, err.details);
      // Slot-taken race surfaces as Zoho 200 with status!='success' → ZohoBookingsError code 'api'
      const userMsg =
        err.code === 'api'
          ? 'That time was just taken. Please pick another slot.'
          : 'Could not complete booking. Please try again or call directly.';
      return NextResponse.json({ error: userMsg }, { status: err.code === 'api' ? 409 : 502 });
    }
    console.error('[book/create] unexpected booking error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  // ── 2. CoreCRM write (Zoho already succeeded — best-effort write) ──
  const { firstName, lastName } = splitName(trimmedName);
  let crmResult = null;
  try {
    crmResult = await createInboundLead({
      email: lowerEmail,
      firstName,
      lastName,
      phone: normalizedPhone,
      source: 'booking-widget',
      sourceDetail: `appointment_${date}_${time.replace(/\s+/g, '')}`,
      applicationChannel: 'booking_widget',
      message: notes || null,
      rawPayload: { date, time, name: trimmedName, email: lowerEmail, phone, notes, bookingId: booking.bookingId },
    });
  } catch (err) {
    // Don't fail the user-visible request just because CRM write hiccupped —
    // appointment is already in Zoho. Log loudly so we can backfill.
    console.error('[book/create] CoreCRM write failed (Zoho appointment was created):', err, {
      bookingId: booking.bookingId,
      email: lowerEmail,
    });
  }

  // ── 3. Borrower confirmation email (Zoho's auto-confirm is disabled per Phase 0) ──
  try {
    await sendEmail({
      to: lowerEmail,
      subject: `Booking confirmed: rate consultation ${date} at ${time}`,
      html: borrowerConfirmHtml({ date, time, name: trimmedName }),
      text: borrowerConfirmText({ date, time, name: trimmedName }),
    });
  } catch (err) {
    // Confirmation email failure is non-fatal; booking is real either way.
    console.error('[book/create] borrower confirmation email failed:', err?.message);
  }

  return NextResponse.json({
    success: true,
    booking: {
      bookingId: booking.bookingId,
      when: `${date} ${time}`,
    },
    contactId: crmResult?.contactId || null,
    leadId: crmResult?.leadId || null,
    isNew: crmResult?.isNew ?? null,
    emailStatus: crmResult?.emailStatus || null,
  });
}

// ─── Email templates ──────────────────────────────────────────

function borrowerConfirmHtml({ date, time, name }) {
  return `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1A1F2E;max-width:560px;margin:0 auto;padding:24px;">
  <h1 style="font-size:24px;color:#2E6BA8;margin-bottom:8px;">You're booked, ${escapeHtml(name)}.</h1>
  <p style="font-size:16px;line-height:1.5;">Your free rate consultation is confirmed for <strong>${escapeHtml(date)} at ${escapeHtml(time)}</strong> Mountain Time.</p>
  <div style="background:#f8f9fa;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:24px 0;">
    <p style="margin:0 0 4px;font-size:14px;color:#6b7280;">Consultation with</p>
    <p style="margin:0;font-weight:600;">David Burson</p>
    <p style="margin:0;font-size:14px;color:#374151;">NetRate Mortgage · NMLS #641790</p>
    <p style="margin:8px 0 0;font-size:14px;">📞 <a href="tel:303-444-5251" style="color:#2E6BA8;">303-444-5251</a></p>
    <p style="margin:0;font-size:14px;">✉️ <a href="mailto:david@netratemortgage.com" style="color:#2E6BA8;">david@netratemortgage.com</a></p>
  </div>
  <p style="font-size:14px;color:#6b7280;">Need to reschedule or cancel? Reply to this email or call directly. We'll reach out before the appointment.</p>
  <p style="font-size:12px;color:#9ca3af;margin-top:32px;">NetRate Mortgage · 357 S McCaslin Blvd #200 · Louisville, CO 80027</p>
</body></html>`;
}

function borrowerConfirmText({ date, time, name }) {
  return `You're booked, ${name}.

Your free rate consultation is confirmed for ${date} at ${time} Mountain Time.

Consultation with David Burson
NetRate Mortgage · NMLS #641790
303-444-5251
david@netratemortgage.com

Need to reschedule or cancel? Reply to this email or call directly. We'll reach out before the appointment.

NetRate Mortgage · 357 S McCaslin Blvd #200 · Louisville, CO 80027`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
