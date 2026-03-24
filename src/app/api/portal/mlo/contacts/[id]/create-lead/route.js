// API: Create Lead from Contact
// POST /api/portal/mlo/contacts/:id/create-lead
// Creates a Lead record linked to an existing Contact
// Auth: MLO session required

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function POST(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.userType === 'mlo') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    // Find the contact
    const contact = await prisma.contact.findUnique({
      where: { id },
    });

    if (!contact) {
      return Response.json({ error: 'Contact not found' }, { status: 404 });
    }

    // Check if there's already an active lead for this contact
    const existingLead = await prisma.lead.findFirst({
      where: {
        contactId: contact.id,
        status: { in: ['new', 'contacted', 'qualified'] },
      },
    });

    if (existingLead) {
      return Response.json({
        error: 'This contact already has an active lead',
        leadId: existingLead.id,
      }, { status: 409 });
    }

    // Create the lead
    const lead = await prisma.lead.create({
      data: {
        name: `${contact.firstName} ${contact.lastName}`,
        email: contact.email,
        phone: contact.phone,
        source: 'contact',
        sourceDetail: `Created from contact by ${session.user.name || session.user.email}`,
        status: 'new',
        loanPurpose: body.loanPurpose || null,
        propertyState: body.propertyState || null,
        loanAmount: body.loanAmount ? parseFloat(body.loanAmount) : null,
        creditScoreRange: body.creditScoreRange || null,
        notes: body.notes || null,
        contactId: contact.id,
      },
    });

    return Response.json({ success: true, lead }, { status: 201 });
  } catch (error) {
    console.error('Create lead from contact error:', error?.message);
    return Response.json({ error: 'Failed to create lead' }, { status: 500 });
  }
}
