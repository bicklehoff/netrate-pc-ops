// API: Payroll — CD Upload + Extraction + Approval + Send to Payroll
// PUT   /api/portal/mlo/loans/:id/payroll — Upload CD, trigger extraction via Claude
// PATCH /api/portal/mlo/loans/:id/payroll — Approve or dispute extracted CD data
// POST  /api/portal/mlo/loans/:id/payroll — Send approved CD + loan data to payroll
// GET   /api/portal/mlo/loans/:id/payroll — Get payroll/extraction status
//
// Flow: Upload CD → auto-extract via Claude → MLO reviews → MLO approves → Send to Payroll

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
        select: { id: true, firstName: true, lastName: true, email: true },
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

    return NextResponse.json({
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
    });
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

    // Trigger CD extraction via Claude
    const loanContext = {
      borrowerName: loan.borrower
        ? `${loan.borrower.firstName} ${loan.borrower.lastName}`
        : null,
      loanNumber: loan.loanNumber,
      propertyAddress: loan.propertyAddress,
    };

    const extraction = await extractCdData(uploaded.id, loanContext);

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

    return NextResponse.json({
      success: true,
      cdWorkDriveFileId: uploaded.id,
      cdFileName: file.name,
      cdExtractedData: extraction,
      cdProcessedAt: new Date().toISOString(),
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
    const { action, notes } = body;

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
      await prisma.loan.update({
        where: { id },
        data: {
          cdApprovedAt: now,
          cdApprovedBy: session.user.id,
        },
      });

      await prisma.loanEvent.create({
        data: {
          loanId: id,
          eventType: 'cd_approved',
          actorType: 'mlo',
          actorId: session.user.id,
          newValue: 'approved',
          details: {
            extractedData: loan.cdExtractedData.data,
            ...(notes ? { notes } : {}),
          },
        },
      });

      return NextResponse.json({
        success: true,
        cdApprovedAt: now.toISOString(),
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

    const payrollData = {
      loanId: loan.id,
      borrowerName: `${loan.borrower.firstName} ${loan.borrower.lastName}`,
      borrowerEmail: loan.borrower.email,
      mloName: loan.mlo ? `${loan.mlo.firstName} ${loan.mlo.lastName}` : null,
      mloEmail: loan.mlo?.email || null,
      loanNumber: loan.loanNumber,
      lenderName: loan.lenderName,
      loanType: loan.loanType,
      loanAmount: loan.loanAmount ? Number(loan.loanAmount) : null,
      interestRate: loan.interestRate ? Number(loan.interestRate) : null,
      loanTerm: loan.loanTerm,
      purpose: loan.purpose,
      propertyAddress: loan.propertyAddress,
      cdWorkDriveFileId: loan.cdWorkDriveFileId,
      cdFileName: loan.cdFileName,
      cdExtractedData: loan.cdExtractedData,
      cdApprovedAt: loan.cdApprovedAt?.toISOString() || null,
      workDriveFolderId: loan.workDriveFolderId,
      closingFolderId: loan.workDriveSubfolders?.CLOSING || null,
      workDriveSubfolders: loan.workDriveSubfolders || null,
      sentAt: now.toISOString(),
      sentBy: session.user.id,
    };

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
        details: payrollData,
      },
    });

    return NextResponse.json({
      success: true,
      payrollSentAt: now.toISOString(),
      payrollData,
    });
  } catch (error) {
    console.error('Send to payroll error:', error);
    return NextResponse.json({ error: 'Failed to send to payroll' }, { status: 500 });
  }
}
