// API: Payroll — CD Upload + Extraction + Approval + Send to Payroll
// PUT   /api/portal/mlo/loans/:id/payroll — Upload CD, trigger extraction via Claude
// PATCH /api/portal/mlo/loans/:id/payroll — Approve or dispute extracted CD data
// POST  /api/portal/mlo/loans/:id/payroll — Send approved CD + loan data to payroll
// GET   /api/portal/mlo/loans/:id/payroll — Get payroll/extraction status
//
// Flow: Upload CD → auto-extract via Claude → MLO reviews → MLO approves → Send to Payroll

// Claude extraction can take 15-20s — extend Vercel serverless timeout
export const maxDuration = 30;

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { uploadFile, createLoanFolder } from '@/lib/zoho-workdrive';
import { extractCdData } from '@/lib/cd-extractor';

async function verifyMloAccess(loanId, session) {
  if (!session || session.user.userType !== 'mlo') return null;
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: {
      borrower: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      mlo: {
        select: { id: true, firstName: true, lastName: true, email: true, nmls: true },
      },
    },
  });
  if (!loan) return null;
  const isAdmin = session.user.role === 'admin';
  if (!isAdmin && loan.mloId !== session.user.id) return null;
  return loan;
}

// ─── GET: Payroll + extraction status ───────────────────────
export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;
    const loan = await verifyMloAccess(id, session);
    if (!loan) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Dup-check: other loans for same borrower not settled/cancelled
    let relatedLoans = [];
    if (loan.borrowerId) {
      relatedLoans = await prisma.loan.findMany({
        where: {
          borrowerId: loan.borrowerId,
          id: { not: id },
          status: { notIn: ['settled', 'cancelled'] },
        },
        select: {
          id: true, status: true, loanNumber: true, lenderName: true,
          loanType: true, loanAmount: true, purpose: true, createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    const response = {
      loanId: loan.id,
      status: loan.status,
      cdWorkDriveFileId: loan.cdWorkDriveFileId,
      cdFileName: loan.cdFileName,
      cdExtractedData: loan.cdExtractedData,
      cdProcessedAt: loan.cdProcessedAt,
      cdApprovedAt: loan.cdApprovedAt,
      cdApprovedBy: loan.cdApprovedBy,
      payrollSentAt: loan.payrollSentAt,
      isFunded: loan.status === 'funded',
      hasCD: !!loan.cdWorkDriveFileId,
      isExtracted: loan.cdExtractedData?.status === 'success',
      isApproved: !!loan.cdApprovedAt,
      isSent: !!loan.payrollSentAt,
      relatedLoans,
      payrollDetails: null,
    };

    if (loan.payrollSentAt) {
      // Find the most recent payroll event with a successful tracker result
      const payrollEvents = await prisma.loanEvent.findMany({
        where: { loanId: id, eventType: 'payroll_sent' },
        orderBy: { createdAt: 'desc' },
        select: { details: true, createdAt: true },
        take: 5,
      });
      // Prefer the most recent successful one, fall back to latest
      const successfulEvent = payrollEvents.find(e => e.details?.trackerResult?.success);
      response.payrollDetails = successfulEvent?.details || payrollEvents[0]?.details || null;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Payroll status error:', error);
    return NextResponse.json({ error: 'Failed to get payroll status' }, { status: 500 });
  }
}

// ─── PUT: Upload CD + trigger extraction ────────────────────
export async function PUT(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;
    const loan = await verifyMloAccess(id, session);
    if (!loan) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (loan.status !== 'funded') {
      return NextResponse.json(
        { error: 'Loan must be in Funded status to upload a Closing Disclosure' },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Closing Disclosure must be a PDF file' }, { status: 400 });
    }

    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size exceeds 25 MB limit' }, { status: 400 });
    }

    // Upload to WorkDrive CLOSING subfolder — auto-create if missing
    let closingFolderId = loan.workDriveSubfolders?.CLOSING;

    if (!closingFolderId) {
      const loName = loan.mlo
        ? `${loan.mlo.firstName} ${loan.mlo.lastName}`
        : 'David Burson';

      const wdResult = await createLoanFolder({
        borrowerFirstName: loan.borrower?.firstName || 'Unknown',
        borrowerLastName: loan.borrower?.lastName || 'Unknown',
        purpose: loan.purpose || 'purchase',
        loName,
      });

      await prisma.loan.update({
        where: { id },
        data: {
          workDriveFolderId: wdResult.rootFolderId,
          workDriveSubfolders: wdResult.subfolders,
        },
      });

      closingFolderId = wdResult.subfolders.CLOSING;
    }

    const uploaded = await uploadFile(file, file.name, closingFolderId, true);

    // Store CD reference + clear any previous extraction/approval/payroll state
    await prisma.loan.update({
      where: { id },
      data: {
        cdWorkDriveFileId: uploaded.id,
        cdFileName: file.name,
        cdExtractedData: null,
        cdProcessedAt: null,
        cdApprovedAt: null,
        cdApprovedBy: null,
        payrollSentAt: null,
      },
    });

    // Audit: CD uploaded
    await prisma.loanEvent.create({
      data: {
        loanId: id,
        eventType: 'cd_uploaded',
        actorType: 'mlo',
        actorId: session.user.id,
        newValue: file.name,
        details: {
          workDriveFileId: uploaded.id,
          fileName: file.name,
          fileSize: file.size,
          folder: 'CLOSING',
          replacedPrevious: !!loan.cdWorkDriveFileId,
        },
      },
    });

    // Trigger CD extraction via Claude — pass file bytes directly to avoid WorkDrive round-trip
    const loanContext = {
      borrowerName: loan.borrower
        ? `${loan.borrower.firstName} ${loan.borrower.lastName}`
        : null,
      loanNumber: loan.loanNumber,
      propertyAddress: loan.propertyAddress,
    };

    const fileBuffer = await file.arrayBuffer();
    const extraction = await extractCdData({ fileBuffer, loanContext });

    await prisma.loan.update({
      where: { id },
      data: {
        cdExtractedData: extraction,
        cdProcessedAt: new Date(),
      },
    });

    // Audit: extraction result
    await prisma.loanEvent.create({
      data: {
        loanId: id,
        eventType: extraction.status === 'success' ? 'cd_extracted' : 'cd_extraction_failed',
        actorType: 'system',
        actorId: 'cd-extractor',
        newValue: extraction.status,
        details: extraction.status === 'success'
          ? { fields: Object.keys(extraction.data) }
          : { error: extraction.error },
      },
    });

    // Dup-check: find other loans for the same borrower that aren't settled
    let relatedLoans = [];
    if (loan.borrowerId) {
      const others = await prisma.loan.findMany({
        where: {
          borrowerId: loan.borrowerId,
          id: { not: id },
          status: { notIn: ['settled', 'cancelled'] },
        },
        select: {
          id: true,
          status: true,
          loanNumber: true,
          lenderName: true,
          loanType: true,
          loanAmount: true,
          purpose: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });
      relatedLoans = others;
    }

    return NextResponse.json({
      success: true,
      cdWorkDriveFileId: uploaded.id,
      cdFileName: file.name,
      cdExtractedData: extraction,
      cdProcessedAt: new Date().toISOString(),
      relatedLoans,
    });
  } catch (error) {
    console.error('CD upload error:', error);
    return NextResponse.json({ error: 'CD upload failed' }, { status: 500 });
  }
}

// ─── PATCH: Approve or dispute extracted CD data ────────────
export async function PATCH(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;
    const loan = await verifyMloAccess(id, session);
    if (!loan) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, notes, nicknameConfirmed, unmatchedPersons, reimbursementSelections } = body;

    if (action === 'approve') {
      if (!loan.cdExtractedData || loan.cdExtractedData.status !== 'success') {
        return NextResponse.json(
          { error: 'No successful CD extraction to approve' },
          { status: 400 }
        );
      }

      if (loan.cdApprovedAt) {
        return NextResponse.json(
          { error: 'CD data already approved' },
          { status: 400 }
        );
      }

      const now = new Date();
      const cd = loan.cdExtractedData.data;

      // Write CD data back to the loan record — CD is source of truth at closing
      const loanUpdate = {
        cdApprovedAt: now,
        cdApprovedBy: session.user.id,
      };

      // Update loan fields from CD extraction
      if (cd.loanAmount != null) loanUpdate.loanAmount = cd.loanAmount;
      if (cd.interestRate != null) loanUpdate.interestRate = cd.interestRate;
      if (cd.loanTerm != null) loanUpdate.loanTerm = cd.loanTerm;
      if (cd.loanType && cd.loanType !== 'other') loanUpdate.loanType = cd.loanType;
      if (cd.lenderName) loanUpdate.lenderName = cd.lenderName;
      if (cd.loanNumber) loanUpdate.lenderLoanNumber = cd.loanNumber;
      if (cd.monthlyPI != null) loanUpdate.monthlyPayment = cd.monthlyPI;
      if (cd.brokerCompensation != null) loanUpdate.brokerCompensation = cd.brokerCompensation;
      if (cd.totalClosingCosts != null) loanUpdate.totalClosingCosts = cd.totalClosingCosts;
      if (cd.cashToClose != null) loanUpdate.cashToClose = cd.cashToClose;
      if (cd.lenderCredits != null) loanUpdate.lenderCredits = cd.lenderCredits;
      if (cd.closingDate) loanUpdate.closingDate = new Date(cd.closingDate);
      if (cd.disbursementDate) loanUpdate.fundingDate = new Date(cd.disbursementDate);

      // Persist reimbursement selections into cdExtractedData
      if (reimbursementSelections) {
        const updatedExtraction = {
          ...loan.cdExtractedData,
          data: {
            ...cd,
            _reimbursementSelections: reimbursementSelections,
          },
        };
        loanUpdate.cdExtractedData = updatedExtraction;
      }

      await prisma.loan.update({ where: { id }, data: loanUpdate });

      // Handle nickname — if MLO confirmed, store legal name from CD on borrower
      let nicknameUpdate = null;
      if (nicknameConfirmed && loan.borrowerId && Array.isArray(cd.borrowerNames) && cd.borrowerNames.length > 0) {
        const primaryCd = cd.borrowerNames[0];
        nicknameUpdate = {
          legalFirstName: primaryCd.firstName,
          legalLastName: primaryCd.lastName,
          nickname: loan.borrower.firstName,
        };
        await prisma.borrower.update({
          where: { id: loan.borrowerId },
          data: nicknameUpdate,
        });
      }

      // Process unmatched persons from CD — create contacts and loan borrower links
      const personsCreated = [];
      if (unmatchedPersons && unmatchedPersons.length > 0) {
        for (const person of unmatchedPersons) {
          if (!person.role || !person.firstName || !person.lastName) continue;

          let contactId = null;

          // Create contact if requested
          if (person.saveAsContact) {
            const contact = await prisma.contact.create({
              data: {
                firstName: person.firstName,
                lastName: person.lastName,
                email: person.email || null,
                phone: person.phone || null,
                source: 'cd_extraction',
                contactType: person.role === 'nbs' ? 'nbs' : 'borrower',
                tags: [person.role === 'nbs' ? 'non-borrowing-spouse' : 'co-borrower'],
              },
            });
            contactId = contact.id;
          }

          // Create borrower record for co-borrowers (NBS don't get borrower records)
          if (person.role === 'co_borrower') {
            // Create a minimal borrower record
            const borrower = await prisma.borrower.create({
              data: {
                firstName: person.firstName,
                lastName: person.lastName,
                legalFirstName: person.firstName,
                legalLastName: person.lastName,
                email: person.email || `${person.firstName.toLowerCase()}.${person.lastName.toLowerCase()}@placeholder.local`,
                dobEncrypted: '',
                ssnEncrypted: '',
                ssnLastFour: '0000',
                ...(contactId ? { contact: { connect: { id: contactId } } } : {}),
              },
            });

            // Link to loan as co-borrower
            await prisma.loanBorrower.create({
              data: {
                loanId: id,
                borrowerId: borrower.id,
                borrowerType: 'co_borrower',
                ordinal: 1,
              },
            });

            personsCreated.push({ ...person, borrowerId: borrower.id, contactId });
          } else {
            // NBS — just the contact, no borrower/loan link
            personsCreated.push({ ...person, contactId });
          }
        }
      }

      await prisma.loanEvent.create({
        data: {
          loanId: id,
          eventType: 'cd_approved',
          actorType: 'mlo',
          actorId: session.user.id,
          newValue: 'approved',
          details: {
            extractedData: cd,
            fieldsUpdated: Object.keys(loanUpdate).filter(k => k !== 'cdApprovedAt' && k !== 'cdApprovedBy'),
            ...(nicknameUpdate ? { nicknameUpdate } : {}),
            ...(personsCreated.length > 0 ? { personsCreated } : {}),
            ...(notes ? { notes } : {}),
          },
        },
      });

      return NextResponse.json({
        success: true,
        cdApprovedAt: now.toISOString(),
        fieldsUpdated: Object.keys(loanUpdate).filter(k => k !== 'cdApprovedAt' && k !== 'cdApprovedBy'),
        personsCreated,
      });
    }

    if (action === 'dispute') {
      // Clear CD + extraction — MLO needs to re-upload
      await prisma.loan.update({
        where: { id },
        data: {
          cdWorkDriveFileId: null,
          cdFileName: null,
          cdExtractedData: null,
          cdProcessedAt: null,
          cdApprovedAt: null,
          cdApprovedBy: null,
        },
      });

      await prisma.loanEvent.create({
        data: {
          loanId: id,
          eventType: 'cd_disputed',
          actorType: 'mlo',
          actorId: session.user.id,
          newValue: 'disputed',
          details: {
            reason: notes || 'MLO disputed extracted CD data',
          },
        },
      });

      return NextResponse.json({ success: true, cleared: true });
    }

    return NextResponse.json({ error: 'Invalid action. Use "approve" or "dispute".' }, { status: 400 });
  } catch (error) {
    console.error('CD approve/dispute error:', error);
    return NextResponse.json({ error: 'Failed to process CD action' }, { status: 500 });
  }
}

// ─── POST: Send to Payroll ──────────────────────────────────
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;
    const loan = await verifyMloAccess(id, session);
    if (!loan) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (loan.status !== 'funded') {
      return NextResponse.json({ error: 'Loan must be in Funded status' }, { status: 400 });
    }

    if (!loan.cdWorkDriveFileId) {
      return NextResponse.json(
        { error: 'Upload the final Closing Disclosure before sending to payroll' },
        { status: 400 }
      );
    }

    if (!loan.cdApprovedAt) {
      return NextResponse.json(
        { error: 'CD data must be reviewed and approved before sending to payroll' },
        { status: 400 }
      );
    }

    if (loan.payrollSentAt) {
      return NextResponse.json(
        { error: 'Already sent to payroll. Upload a new CD to re-send.' },
        { status: 400 }
      );
    }

    const now = new Date();

    // Re-read loan with fresh data (approval may have updated fields)
    const freshLoan = await prisma.loan.findUnique({
      where: { id },
      include: {
        borrower: { select: { firstName: true, lastName: true, email: true } },
        mlo: { select: { firstName: true, lastName: true, email: true, nmls: true } },
      },
    });

    // Parse state from property address
    const propState = freshLoan.propertyAddress?.state || null;

    // Build TrackerPortal payload
    // Pull reimbursement data from MLO-confirmed selections (Section B picker)
    const cdData = freshLoan.cdExtractedData?.data || {};
    const grossComp = freshLoan.brokerCompensation ? Number(freshLoan.brokerCompensation) : null;
    const reimbSelections = cdData._reimbursementSelections || [];
    const totalReimb = reimbSelections.reduce((sum, r) => sum + (r.editedAmount || 0), 0);
    // Use totalDueToBroker from CD if available, otherwise sum components
    const wireTotal = cdData.totalDueToBroker
      ? Number(cdData.totalDueToBroker)
      : (grossComp || 0) + totalReimb;

    const trackerPayload = {
      borrowerName: `${freshLoan.borrower.firstName} ${freshLoan.borrower.lastName}`,
      loanNumber: freshLoan.lenderLoanNumber || freshLoan.loanNumber,
      propertyAddress: freshLoan.propertyAddress
        ? `${freshLoan.propertyAddress.street}, ${freshLoan.propertyAddress.city}, ${freshLoan.propertyAddress.state} ${freshLoan.propertyAddress.zipCode}`
        : null,
      propertyState: propState,
      lender: freshLoan.lenderName,
      loanAmount: freshLoan.loanAmount ? Number(freshLoan.loanAmount) : null,
      loanType: freshLoan.loanType,
      loanPurpose: freshLoan.purpose ? freshLoan.purpose.charAt(0).toUpperCase() + freshLoan.purpose.slice(1) : null,
      interestRate: freshLoan.interestRate ? Number(freshLoan.interestRate) : null,
      loanTerm: freshLoan.loanTerm ? Math.round(freshLoan.loanTerm / 12) : null,
      grossComp,
      reimbursements: reimbSelections.length > 0 ? reimbSelections : null,
      totalReimb: totalReimb || null,
      wireTotal,
      closingDate: freshLoan.closingDate?.toISOString()?.split('T')[0] || null,
      fundingDate: freshLoan.fundingDate?.toISOString()?.split('T')[0] || null,
      loName: freshLoan.mlo ? `${freshLoan.mlo.firstName} ${freshLoan.mlo.lastName}` : null,
      loNmls: freshLoan.mlo?.nmls || null,
      confirmedBy: freshLoan.mlo ? freshLoan.mlo.firstName.toLowerCase() : session.user.id,
      confirmedAt: freshLoan.cdApprovedAt?.toISOString() || now.toISOString(),
      cdWorkDriveFileId: freshLoan.cdWorkDriveFileId || null,
    };

    // POST to TrackerPortal
    let trackerResult = null;
    try {
      const trackerRes = await fetch('https://tracker.netratemortgage.com/api/payroll/commission-confirmed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tracker-api-key': process.env.TRACKER_API_KEY || 'agent',
        },
        body: JSON.stringify(trackerPayload),
      });
      trackerResult = await trackerRes.json();
      if (!trackerRes.ok) {
        console.error('TrackerPortal error:', trackerResult);
      }
    } catch (trackerErr) {
      console.error('TrackerPortal POST failed:', trackerErr);
      trackerResult = { error: trackerErr.message };
    }

    // Mark loan as sent regardless of TrackerPortal result
    await prisma.loan.update({
      where: { id },
      data: { payrollSentAt: now },
    });

    await prisma.loanEvent.create({
      data: {
        loanId: id,
        eventType: 'payroll_sent',
        actorType: 'mlo',
        actorId: session.user.id,
        newValue: 'Sent to payroll',
        details: {
          trackerPayload,
          trackerResult,
          sentAt: now.toISOString(),
          sentBy: session.user.id,
        },
      },
    });

    return NextResponse.json({
      success: true,
      payrollSentAt: now.toISOString(),
      trackerResult,
    });
  } catch (error) {
    console.error('Send to payroll error:', error);
    return NextResponse.json({ error: 'Failed to send to payroll' }, { status: 500 });
  }
}
