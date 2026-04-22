import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { normalizePhone } from '@/lib/normalize-phone';
import { notifyOnLeadCreated } from '@/lib/leads/notify';
import { apiError } from '@/lib/api/safe-error';
import { rateLimit } from '@/lib/api/rate-limit';

// Minimum time between form render and submission. Legit users take 10s+ to
// fill out a contact form; most bots POST within a few hundred ms of fetching
// the page. 2s is a generous floor that never trips on humans.
const MIN_FORM_DELAY_MS = 2000;

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request) {
  const limited = await rateLimit(request, { scope: 'lead', limit: 5, window: '1 h' });
  if (limited) return limited;

  try {
    const body = await request.json();
    const {
      name, email, phone, message, leadSource, source, sourceDetail,
      utmSource, utmMedium, utmCampaign, smsConsent,
      website_url, formLoadedAt,
    } = body;

    // Anti-spam signals. All three silently "succeed" so the bot thinks it
    // worked and doesn't retry with a different shape — we never store,
    // never email, just pretend.
    //
    // 1. Honeypot: hidden field only bots fill
    // 2. Time-trap: form submitted implausibly fast (bot didn't let page render)
    // 3. JS-less: form submitted without the JS-set timestamp at all (non-JS bot)
    if (website_url) {
      return NextResponse.json({ success: true, id: 'ok' });
    }
    if (typeof formLoadedAt !== 'number') {
      return NextResponse.json({ success: true, id: 'ok' });
    }
    if (Date.now() - formLoadedAt < MIN_FORM_DELAY_MS) {
      return NextResponse.json({ success: true, id: 'ok' });
    }

    if (!name || !email) {
      return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
    }
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Please provide a valid email address' }, { status: 400 });
    }

    // Same-email dedupe in a 5-minute window catches accidental double-submits.
    const recentDupes = await sql`
      SELECT id FROM leads
      WHERE email = ${email}
        AND created_at > NOW() - INTERVAL '5 minutes'
      LIMIT 1
    `;
    if (recentDupes.length > 0) {
      return NextResponse.json({ success: true, id: recentDupes[0].id });
    }

    const fullMessage = smsConsent !== undefined
      ? [message, `[SMS Consent: ${smsConsent ? 'YES' : 'NO'}]`].filter(Boolean).join('\n')
      : message;

    const rows = await sql`
      INSERT INTO leads (name, email, phone, message, source, source_detail, utm_source, utm_medium, utm_campaign)
      VALUES (${name}, ${email}, ${normalizePhone(phone) || phone || null}, ${fullMessage || null}, ${source || leadSource || 'website'}, ${sourceDetail || null}, ${utmSource || null}, ${utmMedium || null}, ${utmCampaign || null})
      RETURNING id
    `;

    const firstName = (name || '').trim().split(/\s+/)[0] || null;
    // Must await — Vercel serverless terminates post-response, killing any background promises.
    try {
      await notifyOnLeadCreated({
        leadId: rows[0].id,
        contactId: null,
        firstName,
        email,
        phone: normalizePhone(phone) || phone || null,
        source: source || leadSource || 'website',
        sourceDetail: sourceDetail || null,
      });
    } catch (err) {
      console.error('[lead] notify failed (non-fatal):', err.message);
    }

    return NextResponse.json({ success: true, id: rows[0].id });
  } catch (err) {
    return apiError(err, 'Internal server error', 500, { scope: 'lead' });
  }
}
