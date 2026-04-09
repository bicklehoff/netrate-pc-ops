import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { normalizePhone } from '@/lib/normalize-phone';

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, email, phone, message, leadSource, source, sourceDetail,
            utmSource, utmMedium, utmCampaign, smsConsent } = body;

    if (!name || !email) {
      return NextResponse.json(
        { error: 'Name and email are required' },
        { status: 400 }
      );
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

    return NextResponse.json({ success: true, id: rows[0].id });
  } catch (err) {
    console.error('Lead API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
