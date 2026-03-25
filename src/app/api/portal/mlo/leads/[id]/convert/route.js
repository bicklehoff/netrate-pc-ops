// API: Convert Lead to Loan
// POST /api/portal/mlo/leads/:id/convert
// Creates: Contact (if needed) + Borrower (if needed) + Loan (draft) + LoanBorrower
// Updates: Lead status → 'converted', Contact status → 'applicant'
// Auth: MLO session required

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { encrypt } from '@/lib/encryption';

export async function POST(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.userType !== 'mlo') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const lead = await prisma.lead.findUnique({ where: { id } });

    if (!lead) {
      return Response.json({ error: 'Lead not found' }, { status: 404 });
    }

    if (lead.status === 'converted') {
      return Response.json({ error: 'Lead already converted' }, { status: 409 });
    }

    if (!lead.email) {
      return Response.json({ error: 'Lead must have an email to convert' }, { status: 400 });
    }

    const emailLower = lead.email.toLowerCase().trim();
    const mloId = lead.mloId || session.user.id;

    // Split name into first/last
    const nameParts = (lead.name || '').trim().split(/\s+/);
    const firstName = nameParts[0] || 'Unknown';
    const lastName = nameParts.slice(1).join(' ') || 'Unknown';

    // ─── 1. Find or create Contact ────────────────────────────
    let contact = await prisma.contact.findFirst({
      where: { email: emailLower },
    });

    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          firstName,
          lastName,
          email: emailLower,
          phone: lead.phone || null,
          source: 'lead',
          status: 'applicant',
          contactType: 'borrower',
          assignedMloId: mloId,
          tags: [],
        },
      });
    } else {
      // Update existing contact status
      await prisma.contact.update({
        where: { id: contact.id },
        data: {
          status: 'applicant',
          lastContactedAt: new Date(),
          ...(contact.assignedMloId ? {} : { assignedMloId: mloId }),
        },
      });
    }

    // ─── 2. Find or create Borrower ───────────────────────────
    let borrower = await prisma.borrower.findUnique({
      where: { email: emailLower },
    });

    if (!borrower) {
      // Create minimal borrower — no SSN/DOB yet (will be collected during processing)
      // Use placeholder encrypted values
      const placeholderSsn = encrypt('000000000');
      const placeholderDob = encrypt('1900-01-01');

      borrower = await prisma.borrower.create({
        data: {
          email: emailLower,
          firstName,
          lastName,
          phone: lead.phone || null,
          ssnEncrypted: placeholderSsn,
          dobEncrypted: placeholderDob,
          ssnLastFour: '0000',
        },
      });
    }

    // Link contact to borrower if not already linked
    if (!contact.borrowerId) {
      await prisma.contact.update({
        where: { id: contact.id },
        data: { borrowerId: borrower.id },
      });
    }

    // ─── 3. Create Loan (draft) ───────────────────────────────
    const loan = await prisma.loan.create({
      data: {
        borrowerId: borrower.id,
        mloId,
        status: 'draft',
        ballInCourt: 'mlo',
        purpose: lead.loanPurpose || null,
        occupancy: lead.occupancy || null,
        propertyType: lead.propertyType || null,
        loanAmount: lead.loanAmount || null,
        purchasePrice: lead.purchasePrice || lead.propertyValue || null,
        downPayment: lead.downPayment || null,
        estimatedValue: lead.propertyValue || null,
        currentBalance: lead.currentBalance || null,
        creditScore: lead.creditScore || null,
        employmentStatus: lead.employmentType || null,
        propertyAddress: lead.propertyState ? { state: lead.propertyState, county: lead.propertyCounty || null } : null,
        leadSource: lead.source || null,
        referralSource: lead.source === 'contact' ? 'past_client' : (lead.source || null),
        numBorrowers: 1,
        applicationStep: 1,
      },
    });

    // ─── 4. Create LoanBorrower ───────────────────────────────
    await prisma.loanBorrower.create({
      data: {
        loanId: loan.id,
        borrowerId: borrower.id,
        borrowerType: 'primary',
        ordinal: 0,
      },
    });

    // ─── 5. Create LoanEvent ──────────────────────────────────
    await prisma.loanEvent.create({
      data: {
        loanId: loan.id,
        eventType: 'status_change',
        actorType: 'mlo',
        actorId: session.user.id,
        oldValue: null,
        newValue: 'draft',
        details: {
          source: 'lead_conversion',
          leadId: lead.id,
          leadSource: lead.source,
        },
      },
    });

    // ─── 6. Update Lead → converted ──────────────────────────
    await prisma.lead.update({
      where: { id },
      data: {
        status: 'converted',
        contactId: contact.id,
      },
    });

    return Response.json({
      success: true,
      loanId: loan.id,
      contactId: contact.id,
      borrowerId: borrower.id,
    }, { status: 201 });
  } catch (error) {
    console.error('Lead conversion error:', error?.message);
    return Response.json({ error: 'Failed to convert lead' }, { status: 500 });
  }
}
