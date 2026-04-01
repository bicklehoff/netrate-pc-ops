// POST /api/portal/mlo/loans/[id]/geocode
// Validate and enrich the loan's property address via Google Geocoding
// Returns both the current address and Google's suggested address for comparison
// Body: { accept?: boolean } — if true, saves Google address to loan

import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/lib/prisma';
import { enrichPropertyAddress } from '@/lib/geocode';

export async function POST(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  // Fetch loan
  const loan = await prisma.loan.findUnique({
    where: { id },
    select: { id: true, propertyAddress: true, propertyState: true, propertyCounty: true },
  });

  if (!loan) {
    return Response.json({ error: 'Loan not found' }, { status: 404 });
  }

  const currentAddr = loan.propertyAddress || {};

  // If accept=true, we already have a googleAddress in the body — save it
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

    // Audit event
    await prisma.loanEvent.create({
      data: {
        loanId: id,
        eventType: 'field_updated',
        description: `Address validated via Google Geocoding: ${newAddr.formatted}`,
        metadata: { source: 'geocode', fields: ['propertyAddress', 'propertyState', 'propertyCounty'] },
      },
    });

    return Response.json({ saved: true, address: newAddr });
  }

  // Otherwise, just geocode and return both for comparison
  const result = await enrichPropertyAddress(currentAddr);

  if (!result.enriched) {
    return Response.json({
      validated: false,
      error: result.error || 'Could not validate address',
      current: currentAddr,
    });
  }

  return Response.json({
    validated: true,
    current: currentAddr,
    google: result.googleAddress,
    enriched: result.address,
  });
}
