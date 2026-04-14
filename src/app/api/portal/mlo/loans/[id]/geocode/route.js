// POST /api/portal/mlo/loans/[id]/geocode
// Validate and enrich the loan's property address via Google Geocoding

import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { enrichPropertyAddress } from '@/lib/geocode';
import { requireMloSession } from '@/lib/require-mlo-session';

export async function POST(request, { params }) {
  try {
    const { session, orgId } = await requireMloSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const loanRows = await sql`SELECT * FROM loans WHERE id = ${id} AND organization_id = ${orgId} LIMIT 1`;
    const loan = loanRows[0];

    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

    const currentAddr = loan.property_address || {};

    // Accept Google address
    if (body.accept && body.address) {
      const newAddr = {
        street: body.address.street || currentAddr.street,
        city: body.address.city || currentAddr.city,
        state: body.address.state || currentAddr.state,
        zip: body.address.zip || currentAddr.zip,
        county: body.address.county || '',
        lat: body.address.lat || null,
        lng: body.address.lng || null,
        placeId: body.address.placeId || null,
        formatted: body.address.formatted || '',
        googleValidated: true,
        validatedAt: new Date().toISOString(),
      };

      await sql`UPDATE loans SET property_address = ${JSON.stringify(newAddr)}, updated_at = NOW() WHERE id = ${id}`;

      await sql`
        INSERT INTO loan_events (id, loan_id, event_type, details, created_at)
        VALUES (gen_random_uuid(), ${id}, 'field_updated', ${JSON.stringify({ source: 'geocode', formatted: newAddr.formatted })}, NOW())
      `.catch(() => {});

      return NextResponse.json({ saved: true, address: newAddr });
    }

    // Geocode and return comparison
    const result = await enrichPropertyAddress(currentAddr);

    if (!result.enriched) {
      return NextResponse.json({
        validated: false,
        error: result.error || 'Could not validate address',
        keySource: result.keySource || 'unknown',
        current: currentAddr,
      });
    }

    return NextResponse.json({
      validated: true,
      current: currentAddr,
      google: result.googleAddress,
      enriched: result.address,
    });
  } catch (err) {
    console.error('Geocode route error:', err);
    return NextResponse.json({ validated: false, error: err.message || 'Server error' }, { status: 500 });
  }
}
