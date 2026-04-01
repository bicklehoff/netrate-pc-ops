// API: Contact Loan History — all loans linked to a contact
// GET /api/portal/mlo/contacts/:contactId/loans

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.userType !== 'mlo') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: contactId } = await params;

    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { id: true, firstName: true, lastName: true, borrowerId: true },
    });

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    // Find loans via contactId (direct) OR via borrowerId (legacy)
    const loans = await prisma.loan.findMany({
      where: {
        OR: [
          { contactId: contactId },
          ...(contact.borrowerId ? [{ borrowerId: contact.borrowerId }] : []),
        ],
      },
      select: {
        id: true,
        status: true,
        loanAmount: true,
        loanType: true,
        purpose: true,
        propertyAddress: true,
        lenderName: true,
        interestRate: true,
        loanTerm: true,
        closingDate: true,
        fundingDate: true,
        createdAt: true,
        updatedAt: true,
        isApplication: true,
        applicationDate: true,
        mlo: {
          select: { firstName: true, lastName: true, nmls: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Convert Decimals for JSON
    const formatted = loans.map((loan) => ({
      ...loan,
      loanAmount: loan.loanAmount ? Number(loan.loanAmount) : null,
      interestRate: loan.interestRate ? Number(loan.interestRate) : null,
      canUseAsTemplate: ['funded', 'settled', 'archived', 'denied'].includes(loan.status),
    }));

    return NextResponse.json({
      contact: { id: contact.id, firstName: contact.firstName, lastName: contact.lastName },
      loans: formatted,
      totalLoans: formatted.length,
    });
  } catch (error) {
    console.error('Contact loans error:', error);
    return NextResponse.json({ error: 'Failed to fetch contact loans' }, { status: 500 });
  }
}
