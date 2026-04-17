import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { normalizePhone } from '@/lib/normalize-phone';
import { notifyOnLeadCreated } from '@/lib/leads/notify';

// Simple in-memory rate limiter (resets on cold start, but still catches bursts)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 5; // 5 submissions per IP per hour

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { windowStart: now, count: 1 });
    return false;
  }
  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) return true;
  return false;
}

// Basic email format validation
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request) {
  try {
    // Rate limiting by IP
    const forwarded = request.headers.get('x-forwarded-for') || '';
    // Use rightmost IP (set by Vercel proxy, not spoofable)
    const ip = forwarded.split(',').pop()?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown';

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many submissions. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { name, email, phone, message, leadSource, source, sourceDetail,
            utmSource, utmMedium, utmCampaign, smsConsent } = body;

    // Honeypot field — if filled, it's a bot (hidden field in the form)
    if (body.website_url) {
      // Silently accept but don't store — bots think it worked
      return NextResponse.json({ success: true, id: 'ok' });
    }

    if (!name || !email) {
      return NextResponse.json(
        { error: 'Name and email are required' },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Please provide a valid email address' },
        { status: 400 }
      );
    }

    // Duplicate check — same email within last 5 minutes = likely double-submit
    const recentDupes = await sql`
      SELECT id FROM leads
      WHERE email = ${email}
        AND created_at > NOW() - INTERVAL '5 minutes'
      LIMIT 1
    `;
    if (recentDupes.length > 0) {
      // Return success to avoid confusing the user, but don't create duplicate
      return NextResponse.json({ success: true, id: recentDupes[0].id });
    }

    // Append SMS consent status to message (no schema migration needed)
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
    // Total email send is ~1s (parallel), acceptable for form submission UX.
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
      // Never fail the form submit because of email issues — log and move on.
      console.error('[lead] notify failed (non-fatal):', err.message);
    }

    return NextResponse.json({ success: true, id: rows[0].id });
  } catch (err) {
    console.error('Lead API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
