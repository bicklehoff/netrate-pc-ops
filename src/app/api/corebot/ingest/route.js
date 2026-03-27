// Corebot Ingest — Zoho Flow → Core
// Receives loan data from Zoho Flow (LDox origin), upserts into Core DB.
// Auth: X-Corebot-Key header matched against COREBOT_API_KEY env var.
//
// Flow: LDox → Zoho Flow (proxy) → POST /api/corebot/ingest → Core DB
//
// Merge logic: Match by ldoxLoanId first, then loanNumber, then create new.
// Borrowers matched by email, created if new (with PII encryption).

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { encrypt } from '@/lib/encryption';

// ─── Status Mapping: LDox → Core ────────────────────────────
// Core statuses were modeled after LDox lifecycle.

const STATUS_MAP = {
  'Prospect':              'prospect',
  'Web Application':       'prospect',
  'Prequalification':      'prospect',
  'Application':           'applied',
  'Processing':            'processing',
  'Submitted':             'submitted_uw',
  'UW Submitted':          'submitted_uw',
  'UW Suspended':          'suspended',
  'Conditional Approval':  'cond_approved',
  'Cond. Approved':        'cond_approved',
  'UW Approved':           'cond_approved',
  'Suspended':             'suspended',
  'Clear to Close':        'ctc',
  'Clear To Close':        'ctc',
  'Closing Docs Sent':     'docs_out',
  'Docs Out':              'docs_out',
  'Closing Scheduled':     'ctc',
  'Closed':                'ctc',
  'Wire Requested':        'ctc',
  'Funded':                'funded',
  'Final Disposition':     'settled',
  'Servicing':             'settled',
  'Denied':                'denied',
  'Withdrawn':             'withdrawn',
  'Closed Incomplete':     'withdrawn',
};

// Ball-in-court derived from status
const BALL_IN_COURT = {
  prospect: 'borrower',
  applied: 'mlo',
  processing: 'mlo',
  submitted_uw: 'lender',
  cond_approved: 'mlo',
  suspended: 'mlo',
  ctc: 'mlo',
  docs_out: 'lender',
  funded: 'mlo',
  settled: 'none',
  denied: 'none',
  withdrawn: 'none',
};

// ─── Helpers ─────────────────────────────────────────────────

function normalizeStatus(ldoxStatus) {
  if (!ldoxStatus) return 'prospect';
  return STATUS_MAP[ldoxStatus] || 'prospect';
}

function parseDate(val) {
  if (!val || val === '') return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function normalizePhone(phone) {
  if (!phone) return null;
  return phone.replace(/\D/g, '').replace(/^1/, '').replace(/^(\d{3})(\d{3})(\d{4})$/, '($1) $2-$3');
}

function normalizeAddress(addr) {
  if (!addr) return null;
  return {
    street: addr.street || '',
    city: addr.city || '',
    state: addr.state || '',
    zipCode: String(addr.zipCode || ''),
  };
}

// ─── Auth ────────────────────────────────────────────────────

function authenticate(request) {
  const key = request.headers.get('x-corebot-key') || request.headers.get('X-Corebot-Key');
  const expected = process.env.COREBOT_API_KEY;
  if (!expected) {
    console.error('COREBOT_API_KEY not configured');
    return false;
  }
  return key === expected;
}

// ─── Process Single Loan ─────────────────────────────────────

async function processLoan(loanData) {
  const ldoxLoanId = loanData.loanId || null;
  const loanNumber = loanData.loanNumber ? String(loanData.loanNumber) : null;
  const borrowerData = loanData.borrower;
  const coreStatus = normalizeStatus(loanData.loanStatus?.name);
  const ballInCourt = BALL_IN_COURT[coreStatus] || 'mlo';

  // ── 1. Match or create borrower ──────────────────────────
  let borrower = null;
  if (borrowerData?.contacts?.email) {
    borrower = await prisma.borrower.findUnique({
      where: { email: borrowerData.contacts.email.toLowerCase() },
    });
  }

  if (!borrower && borrowerData) {
    const email = borrowerData.contacts?.email?.toLowerCase();
    if (!email) {
      throw new Error(`Loan ${loanNumber}: Borrower has no email — cannot create`);
    }

    // Encrypt PII
    const ssnRaw = borrowerData.ssn ? String(borrowerData.ssn) : null;
    const dobRaw = borrowerData.birthDate || null;

    // Pad SSN to 9 digits (LDox sends as integer, leading zeros stripped)
    const ssnPadded = ssnRaw ? ssnRaw.padStart(9, '0') : null;

    borrower = await prisma.borrower.create({
      data: {
        email,
        firstName: borrowerData.firstName || 'Unknown',
        lastName: borrowerData.lastName || 'Unknown',
        phone: normalizePhone(borrowerData.contacts?.mobilePhone || borrowerData.contacts?.homePhone),
        ssnEncrypted: ssnPadded ? encrypt(ssnPadded) : encrypt('000000000'),
        dobEncrypted: dobRaw ? encrypt(dobRaw) : encrypt('1900-01-01'),
        ssnLastFour: ssnPadded ? ssnPadded.slice(-4) : '0000',
      },
    });
  }

  if (!borrower) {
    throw new Error(`Loan ${loanNumber}: Could not match or create borrower`);
  }

  // ── 2. Match MLO by ldoxOfficerId, then NMLS fallback ───
  let mloId = null;
  if (loanData.loanOfficer) {
    const loValue = String(loanData.loanOfficer);
    // Try ldoxOfficerId first (integer)
    const mloByLdox = await prisma.mlo.findUnique({
      where: { ldoxOfficerId: parseInt(loValue, 10) },
    }).catch(() => null);
    if (mloByLdox) {
      mloId = mloByLdox.id;
    } else {
      // Fallback: match by NMLS (loanOfficer field often contains NMLS)
      const mloByNmls = await prisma.mlo.findFirst({
        where: { nmls: loValue },
      });
      if (mloByNmls) mloId = mloByNmls.id;
    }
  }
  // Also check explicit loanOfficerNmls field
  if (!mloId && loanData.loanOfficerNmls) {
    const mlo = await prisma.mlo.findFirst({
      where: { nmls: String(loanData.loanOfficerNmls) },
    });
    if (mlo) mloId = mlo.id;
  }

  // ── 3. Build loan data object ────────────────────────────
  const loanFields = {
    borrowerId: borrower.id,
    mloId,
    status: coreStatus,
    ballInCourt,
    ldoxLoanId,
    loanNumber,
    loanAmount: loanData.loanAmount ? parseFloat(loanData.loanAmount) : null,
    interestRate: loanData.noteRate ? parseFloat(loanData.noteRate) : null,
    loanTerm: loanData.term ? parseInt(loanData.term, 10) : null,
    purpose: loanData.purpose?.name?.toLowerCase() || null,
    occupancy: loanData.occupancy?.name?.toLowerCase() || null,
    loanType: loanData.loanType?.name?.toLowerCase() || null,
    lenderName: loanData.lender || null,
    purchasePrice: loanData.purchasePrice ? parseFloat(loanData.purchasePrice) : null,
    estimatedValue: loanData.appraisalValue ? parseFloat(loanData.appraisalValue) : null,
    numUnits: loanData.units ? parseInt(loanData.units, 10) : null,
    propertyType: loanData.propertyType?.name || null,
    propertyAddress: normalizeAddress(loanData.subjectPropertyAddress),
    currentAddress: normalizeAddress(borrowerData?.currentAddress),
    creditScore: loanData.creditScore ? parseInt(loanData.creditScore, 10) : null,
  };

  // ── 4. Upsert loan ──────────────────────────────────────
  let loan;
  let isNew = false;

  // Try match by ldoxLoanId first
  if (ldoxLoanId) {
    loan = await prisma.loan.findUnique({ where: { ldoxLoanId } });
  }

  // Fallback: match by loanNumber + borrower
  if (!loan && loanNumber) {
    loan = await prisma.loan.findFirst({
      where: { loanNumber, borrowerId: borrower.id },
    });
  }

  if (loan) {
    // Update existing
    const oldStatus = loan.status;
    loan = await prisma.loan.update({
      where: { id: loan.id },
      data: loanFields,
    });

    // Log status change if it changed
    if (oldStatus !== coreStatus) {
      await prisma.loanEvent.create({
        data: {
          loanId: loan.id,
          eventType: 'status_change',
          actorType: 'system',
          oldValue: oldStatus,
          newValue: coreStatus,
          details: { source: 'corebot', ldoxStatus: loanData.loanStatus?.name },
        },
      });
    }
  } else {
    // Create new
    isNew = true;
    loan = await prisma.loan.create({
      data: {
        ...loanFields,
        applicationStep: coreStatus === 'prospect' ? 1 : 6,
        submittedAt: coreStatus !== 'prospect' ? new Date() : null,
      },
    });
  }

  // Log import event
  await prisma.loanEvent.create({
    data: {
      loanId: loan.id,
      eventType: 'field_updated',
      actorType: 'system',
      details: {
        source: 'corebot',
        action: isNew ? 'created' : 'updated',
        ldoxLoanId,
        loanNumber,
      },
    },
  });

  // ── 5. Upsert dates ─────────────────────────────────────
  if (loanData.dates) {
    const d = loanData.dates;
    const dateFields = {
      applicationDate: parseDate(d.applicationTaken),
      lockedDate: parseDate(d.rateLocked),
      lockExpiration: parseDate(d.lockExpiration),
      estimatedClosing: parseDate(d.estimatedClosing),
      closingDate: parseDate(d.closed),
      fundingDate: parseDate(d.funded),
      firstPaymentDate: parseDate(d.firstPaymentDate),
      estimatedFunding: parseDate(d.fundingEstimate),
      appraisalOrdered: parseDate(d.brokersRequestForAppraisal),
    };

    // Only upsert if at least one date is non-null
    const hasAnyDate = Object.values(dateFields).some((v) => v !== null);
    if (hasAnyDate) {
      await prisma.loanDates.upsert({
        where: { loanId: loan.id },
        create: { loanId: loan.id, ...dateFields },
        update: dateFields,
      });
    }
  }

  // ── 6. Create LoanBorrower junction if new ───────────────
  if (isNew) {
    await prisma.loanBorrower.create({
      data: {
        loanId: loan.id,
        borrowerId: borrower.id,
        borrowerType: 'primary',
        ordinal: 0,
        currentAddress: normalizeAddress(borrowerData?.currentAddress),
      },
    }).catch(() => {
      // Ignore if junction already exists (unique constraint)
    });
  }

  // ── 7. Handle co-borrower if present ─────────────────────
  if (loanData.coBorrower) {
    const cb = loanData.coBorrower;
    const cbEmail = cb.contacts?.email?.toLowerCase();
    if (cbEmail) {
      let coBorrower = await prisma.borrower.findUnique({ where: { email: cbEmail } });
      if (!coBorrower) {
        const cbSsn = cb.ssn ? String(cb.ssn).padStart(9, '0') : null;
        coBorrower = await prisma.borrower.create({
          data: {
            email: cbEmail,
            firstName: cb.firstName || 'Unknown',
            lastName: cb.lastName || 'Unknown',
            phone: normalizePhone(cb.contacts?.mobilePhone || cb.contacts?.homePhone),
            ssnEncrypted: cbSsn ? encrypt(cbSsn) : encrypt('000000000'),
            dobEncrypted: cb.birthDate ? encrypt(cb.birthDate) : encrypt('1900-01-01'),
            ssnLastFour: cbSsn ? cbSsn.slice(-4) : '0000',
          },
        });
      }

      await prisma.loanBorrower.upsert({
        where: { loanId_borrowerId: { loanId: loan.id, borrowerId: coBorrower.id } },
        create: {
          loanId: loan.id,
          borrowerId: coBorrower.id,
          borrowerType: 'co_borrower',
          ordinal: 1,
          currentAddress: normalizeAddress(cb.currentAddress),
        },
        update: {
          currentAddress: normalizeAddress(cb.currentAddress),
        },
      });

      // Update co-borrower count
      await prisma.loan.update({
        where: { id: loan.id },
        data: { numBorrowers: 2 },
      });
    }
  }

  return { loanId: loan.id, loanNumber, isNew, status: coreStatus };
}

// ─── POST Handler ────────────────────────────────────────────

export async function POST(request) {
  // Auth check
  if (!authenticate(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();

    // Extract loans from Zoho Flow payload structure
    const loans = body?.webhookTrigger?.payload?.loans || body?.loans || [];

    if (!Array.isArray(loans) || loans.length === 0) {
      return NextResponse.json(
        { error: 'No loans in payload', success: false },
        { status: 400 }
      );
    }

    const results = { processed: 0, created: 0, updated: 0, errors: [] };

    for (const loanData of loans) {
      try {
        const result = await processLoan(loanData);
        results.processed++;
        if (result.isNew) results.created++;
        else results.updated++;
      } catch (err) {
        console.error('Corebot ingest error for loan:', loanData.loanNumber, err.message);
        results.errors.push({
          loanNumber: loanData.loanNumber,
          error: err.message,
        });
      }
    }

    console.log(`Corebot ingest: ${results.processed} processed, ${results.created} created, ${results.updated} updated, ${results.errors.length} errors`);

    return NextResponse.json({ success: true, ...results });
  } catch (err) {
    console.error('Corebot ingest fatal error:', err);
    return NextResponse.json(
      { error: 'Internal server error', success: false },
      { status: 500 }
    );
  }
}
