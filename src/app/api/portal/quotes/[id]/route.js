/**
 * Borrower Quote View API
 *
 * GET /api/portal/quotes/:id?token=...
 *
 * Public-ish endpoint — authenticated via magic token (from email link).
 * Tracks viewedAt on first access. Returns quote data for the borrower view.
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Validate magic token
    const borrower = await prisma.borrower.findFirst({
      where: {
        magicToken: token,
        magicExpires: { gte: new Date() },
      },
      select: { id: true, email: true },
    });

    if (!borrower) {
      return NextResponse.json({ error: 'Link expired or invalid. Contact your loan officer for a new quote link.' }, { status: 401 });
    }

    // Load quote
    const quote = await prisma.borrowerQuote.findUnique({
      where: { id },
    });

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    // Verify the borrower email matches the quote
    if (quote.borrowerEmail?.toLowerCase() !== borrower.email?.toLowerCase()) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Check expiration
    if (quote.expiresAt && new Date(quote.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'This quote has expired. Contact your loan officer for updated pricing.' }, { status: 410 });
    }

    // Track first view
    if (!quote.viewedAt) {
      await prisma.borrowerQuote.update({
        where: { id },
        data: { viewedAt: new Date(), status: 'viewed' },
      });
    }

    // Return sanitized quote (no internal IDs)
    return NextResponse.json({
      quote: {
        id: quote.id,
        borrowerName: quote.borrowerName,
        purpose: quote.purpose,
        propertyValue: quote.propertyValue,
        loanAmount: quote.loanAmount,
        ltv: quote.ltv,
        fico: quote.fico,
        state: quote.state,
        county: quote.county,
        loanType: quote.loanType,
        term: quote.term,
        scenarios: quote.scenarios,
        feeBreakdown: quote.feeBreakdown,
        monthlyPayment: quote.monthlyPayment,
        pdfUrl: quote.pdfUrl,
        status: quote.status,
        expiresAt: quote.expiresAt,
        createdAt: quote.createdAt,
      },
    });
  } catch (err) {
    console.error('Borrower quote view error:', err);
    return NextResponse.json({ error: 'Failed to load quote' }, { status: 500 });
  }
}
