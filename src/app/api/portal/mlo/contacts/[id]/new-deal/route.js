// API: New Deal from Contact — Clone a loan for a returning borrower
// POST /api/portal/mlo/contacts/:contactId/new-deal
//
// Creates a new Loan pre-filled from a source loan, linked to the same Contact.
// MLO picks which prior loan to use as template.

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// Fields to copy from the source loan (deal-specific financial data)
const COPY_FIELDS = [
  'monthlyBaseIncome', 'otherMonthlyIncome', 'otherIncomeSource',
  'employmentStatus', 'employerName', 'positionTitle', 'yearsInPosition',
  'presentHousingExpense', 'maritalStatus', 'numDependents', 'dependentAges',
  'declarations', 'creditScore',
  'currentAddress', 'addressYears', 'addressMonths', 'mailingAddress',
  'occupancy', 'lienStatus',
];

// Fields to copy from source LoanBorrower (primary)
const COPY_BORROWER_FIELDS = [
  'maritalStatus', 'currentAddress', 'addressYears', 'addressMonths',
  'mailingAddress', 'employmentStatus', 'employerName', 'positionTitle',
  'yearsInPosition', 'monthlyBaseIncome', 'otherMonthlyIncome', 'otherIncomeSource',
  'dobEncrypted', 'housingType', 'monthlyRent', 'cellPhone',
  'declarations',
];

export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.userType !== 'mlo') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: contactId } = await params;
    const body = await request.json();
    const { sourceLoanId } = body;

    // Load contact
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { id: true, borrowerId: true, firstName: true, lastName: true, email: true, phone: true },
    });

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    if (!contact.borrowerId) {
      return NextResponse.json({ error: 'Contact has no linked borrower account' }, { status: 400 });
    }

    // Load source loan if provided
    let sourceData = {};
    let sourceBorrowerData = {};

    if (sourceLoanId) {
      const sourceLoan = await prisma.loan.findUnique({
        where: { id: sourceLoanId },
        include: {
          loanBorrowers: {
            where: { borrowerType: 'primary' },
            take: 1,
          },
        },
      });

      if (!sourceLoan) {
        return NextResponse.json({ error: 'Source loan not found' }, { status: 404 });
      }

      // Copy fields from source loan
      for (const field of COPY_FIELDS) {
        if (sourceLoan[field] != null) {
          sourceData[field] = sourceLoan[field];
        }
      }

      // Copy fields from source LoanBorrower
      if (sourceLoan.loanBorrowers[0]) {
        for (const field of COPY_BORROWER_FIELDS) {
          if (sourceLoan.loanBorrowers[0][field] != null) {
            sourceBorrowerData[field] = sourceLoan.loanBorrowers[0][field];
          }
        }
      }
    }

    // Create new loan
    const newLoan = await prisma.loan.create({
      data: {
        borrowerId: contact.borrowerId,
        contactId: contact.id,
        mloId: session.user.id,
        status: 'draft',
        ballInCourt: 'mlo',
        applicationStep: 1,
        numBorrowers: 1,
        ...sourceData,
        // These are always blank for a new deal
        propertyAddress: undefined,
        loanAmount: undefined,
        loanType: undefined,
        loanTerm: undefined,
        interestRate: undefined,
        purpose: undefined,
        lenderName: undefined,
        loanNumber: undefined,
        lenderLoanNumber: undefined,
      },
    });

    // Create primary LoanBorrower
    await prisma.loanBorrower.create({
      data: {
        loanId: newLoan.id,
        borrowerId: contact.borrowerId,
        borrowerType: 'primary',
        ordinal: 0,
        ...sourceBorrowerData,
      },
    });

    // Create LoanContact bridge record
    await prisma.loanContact.create({
      data: {
        loanId: newLoan.id,
        contactId: contact.id,
        role: 'borrower',
        isPrimary: true,
        name: `${contact.firstName} ${contact.lastName}`,
        email: contact.email,
        phone: contact.phone,
      },
    });

    // Audit trail
    await prisma.loanEvent.create({
      data: {
        loanId: newLoan.id,
        eventType: 'loan_cloned_from_contact',
        actorType: 'mlo',
        actorId: session.user.id,
        newValue: 'New deal created from contact',
        details: {
          contactId: contact.id,
          sourceLoanId: sourceLoanId || null,
          copiedFields: Object.keys(sourceData),
        },
      },
    });

    return NextResponse.json({
      success: true,
      loanId: newLoan.id,
      contactId: contact.id,
      sourceLoanId: sourceLoanId || null,
    }, { status: 201 });
  } catch (error) {
    console.error('New deal from contact error:', error);
    return NextResponse.json({ error: 'Failed to create new deal' }, { status: 500 });
  }
}
