// POST /api/portal/mlo/loans/[id]/geocode
// Validate and enrich the loan's property address via Google Geocoding

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { enrichPropertyAddress } from '@/lib/geocode';

export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const loan = await prisma.loan.findUnique({
      where: { id },
      select: { id: true, propertyAddress: true, propertyState: true, propertyCounty: true },
    });

    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

    const currentAddr = loan.propertyAddress || {};

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

      await prisma.loan.update({
        where: { id },
        data: {
          propertyAddress: newAddr,
          propertyState: newAddr.state || loan.propertyState,
          propertyCounty: newAddr.county || loan.propertyCounty,
        },
      });

      await prisma.loanEvent.create({
        data: {
          loanId: id,
          eventType: 'field_updated',
          details: { source: 'geocode', formatted: newAddr.formatted },
        },
      }).catch(() => {});

      return NextResponse.json({ saved: true, address: newAddr });
    }

    // Geocode and return comparison
    const result = await enrichPropertyAddress(currentAddr);

    if (!result.enriched) {
      return NextResponse.json({
        validated: false,
        error: result.error || 'Could not validate address',
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
