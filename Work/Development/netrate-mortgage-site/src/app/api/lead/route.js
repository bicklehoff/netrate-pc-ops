import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

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

    const lead = await prisma.lead.create({
      data: {
        name,
        email,
        phone: phone || null,
        message: fullMessage || null,
        source: source || leadSource || 'website',
        sourceDetail: sourceDetail || null,
        utmSource: utmSource || null,
        utmMedium: utmMedium || null,
        utmCampaign: utmCampaign || null,
      },
    });

    return NextResponse.json({ success: true, id: lead.id });
  } catch (err) {
    console.error('Lead API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
