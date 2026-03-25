// API: Contact Detail
// GET  /api/portal/mlo/contacts/:id — Full contact with relations
// PATCH /api/portal/mlo/contacts/:id — Update contact fields
// Auth: MLO session required

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.userType === 'mlo') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const contact = await prisma.contact.findUnique({
      where: { id },
      include: {
        assignedMlo: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        borrower: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            phoneVerified: true,
            loans: {
              select: {
                id: true,
                status: true,
                purpose: true,
                loanAmount: true,
                interestRate: true,
                loanTerm: true,
                lenderName: true,
                loanNumber: true,
                propertyAddress: true,
                propertyType: true,
                createdAt: true,
                submittedAt: true,
              },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        leads: {
          select: {
            id: true,
            name: true,
            status: true,
            source: true,
            sourceDetail: true,
            loanPurpose: true,
            loanAmount: true,
            propertyState: true,
            creditScore: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        contactNotes: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        callLogs: {
          select: {
            id: true,
            direction: true,
            fromNumber: true,
            toNumber: true,
            status: true,
            duration: true,
            startedAt: true,
            notes: {
              select: { content: true, disposition: true, createdAt: true },
              take: 1,
              orderBy: { createdAt: 'desc' },
            },
          },
          orderBy: { startedAt: 'desc' },
          take: 20,
        },
        smsMessages: {
          select: {
            id: true,
            direction: true,
            body: true,
            status: true,
            sentAt: true,
          },
          orderBy: { sentAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!contact) {
      return Response.json({ error: 'Contact not found' }, { status: 404 });
    }

    return Response.json({ contact });
  } catch (error) {
    console.error('Contact detail error:', error?.message);
    return Response.json({ error: 'Failed to load contact' }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.userType === 'mlo') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    // Allowlist of updatable fields
    const allowedFields = [
      'firstName', 'lastName', 'email', 'phone', 'company', 'notes', 'tags',
      'status', 'contactType', 'assignedMloId',
      'newsletterOptIn', 'strikeRateOptIn', 'emailOptOut', 'smsOptOut',
      'lastContactedAt', 'nextFollowUp', 'leadScore',
      'propertyAddress', 'currentLoanAmount', 'currentRate', 'currentLoanTerm',
      'homeValue', 'fundedDate', 'anniversaryDate',
      'coBorrowerName', 'coBorrowerEmail', 'coBorrowerPhone',
      'dateOfBirth', 'mailingAddress', 'city', 'state', 'zipCode',
    ];

    const data = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        data[field] = body[field];
      }
    }

    if (data.email) {
      data.email = data.email.toLowerCase().trim();
      // Check for duplicate email (excluding self)
      const existing = await prisma.contact.findFirst({
        where: { email: data.email, NOT: { id } },
      });
      if (existing) {
        return Response.json({ error: 'A contact with this email already exists' }, { status: 409 });
      }
    }

    const contact = await prisma.contact.update({
      where: { id },
      data,
    });

    return Response.json({ success: true, contact });
  } catch (error) {
    console.error('Contact update error:', error?.message);
    return Response.json({ error: 'Failed to update contact' }, { status: 500 });
  }
}
