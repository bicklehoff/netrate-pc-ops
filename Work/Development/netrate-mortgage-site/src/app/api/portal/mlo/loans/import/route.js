// API: MISMO XML Import
// POST /api/portal/mlo/loans/import — Preview: parse XML, return extracted data (no DB writes)
// PUT  /api/portal/mlo/loans/import — Commit: parse XML, create borrower + loan + loanBorrower records
//
// Accepts: multipart FormData with an XML file
// Auth: MLO or Admin required (NextAuth session)

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { encrypt, ssnLastFour } from '@/lib/encryption';
import { parseMismoXml } from '@/lib/mismo-parser';
import { createLoanFolder } from '@/lib/zoho-workdrive';

// ─── POST: Preview (parse only, no DB writes) ──────────────

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.userType !== 'mlo') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const xmlString = await extractXmlFromRequest(request);
    const result = parseMismoXml(xmlString);

    // Strip SSN from preview (show only last 4)
    const previewBorrowers = result.borrowers.map((b) => ({
      ...b,
      ssn: b.ssn ? `***-**-${b.ssn.slice(-4)}` : null,
    }));

    return NextResponse.json({
      success: true,
      preview: true,
      loan: result.loan,
      borrowers: previewBorrowers,
      property: result.property,
      stats: result.stats,
    });
  } catch (error) {
    console.error('MISMO preview error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to parse XML file' },
      { status: 400 }
    );
  }
}

// ─── PUT: Commit (create records) ───────────────────────────

export async function PUT(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.userType !== 'mlo') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse the form data — may include overrides
    const formData = await request.formData();
    const file = formData.get('file');
    const statusOverride = formData.get('status') || 'processing';
    const assignToSelf = formData.get('assignToSelf') !== 'false';

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No XML file provided' }, { status: 400 });
    }

    const xmlString = await file.text();
    const result = parseMismoXml(xmlString);

    if (!result.primaryBorrower) {
      return NextResponse.json({ error: 'No borrower found in XML' }, { status: 400 });
    }

    const primary = result.primaryBorrower;

    // Validate minimum required data
    if (!primary.firstName || !primary.lastName) {
      return NextResponse.json({ error: 'Borrower name is required' }, { status: 400 });
    }

    // ─── Environment Check ────────────────────────────────
    if (!process.env.PII_ENCRYPTION_KEY) {
      console.error('FATAL: PII_ENCRYPTION_KEY not set');
      return NextResponse.json(
        { error: 'Server configuration error. Contact support.' },
        { status: 500 }
      );
    }

    // ─── Create/Update Primary Borrower ───────────────────
    const borrower = await upsertBorrowerFromImport(primary);

    // ─── Create Loan Record ───────────────────────────────
    const loanData = result.loan;
    const propAddress = result.property?.address || null;

    const loan = await prisma.loan.create({
      data: {
        borrowerId: borrower.id,
        mloId: assignToSelf ? session.user.id : null,
        status: statusOverride,
        ballInCourt: 'mlo',
        purpose: loanData.purpose,
        occupancy: loanData.occupancy,

        // Loan classification
        loanType: loanData.loanType,
        lenderName: loanData.lenderName,
        loanNumber: loanData.loanNumber,
        loanAmount: loanData.loanAmount,
        interestRate: loanData.interestRate,
        loanTerm: loanData.loanTerm,

        // Property
        propertyAddress: propAddress,
        propertyType: loanData.propertyType,
        numUnits: loanData.numUnits,
        purchasePrice: loanData.purchasePrice,
        estimatedValue: loanData.estimatedValue,

        // Primary borrower data on loan (backward compat)
        currentAddress: primary.currentAddress,
        addressYears: primary.addressYears,
        addressMonths: primary.addressMonths,
        maritalStatus: primary.maritalStatus,
        employmentStatus: primary.employmentStatus,
        employerName: primary.employerName,
        positionTitle: primary.positionTitle,
        yearsInPosition: primary.yearsInPosition,
        monthlyBaseIncome: primary.monthlyBaseIncome,
        otherMonthlyIncome: primary.otherMonthlyIncome,
        otherIncomeSource: primary.otherIncomeSource,
        presentHousingExpense: loanData.presentHousingExpense,
        declarations: primary.declarations,

        numBorrowers: result.borrowers.length,
        applicationStep: 6,
        submittedAt: new Date(),
      },
    });

    // ─── Create LoanBorrower for Primary ──────────────────
    await prisma.loanBorrower.create({
      data: {
        loanId: loan.id,
        borrowerId: borrower.id,
        borrowerType: 'primary',
        ordinal: 0,
        maritalStatus: primary.maritalStatus,
        currentAddress: primary.currentAddress,
        addressYears: primary.addressYears,
        addressMonths: primary.addressMonths,
        employmentStatus: primary.employmentStatus,
        employerName: primary.employerName,
        positionTitle: primary.positionTitle,
        yearsInPosition: primary.yearsInPosition,
        monthlyBaseIncome: primary.monthlyBaseIncome,
        otherMonthlyIncome: primary.otherMonthlyIncome,
        otherIncomeSource: primary.otherIncomeSource,
        declarations: primary.declarations,
      },
    });

    // ─── Create Co-Borrower Records ───────────────────────
    for (const cb of result.coBorrowers) {
      if (!cb.firstName || !cb.lastName) continue;

      const cbBorrower = await upsertBorrowerFromImport(cb);

      await prisma.loanBorrower.create({
        data: {
          loanId: loan.id,
          borrowerId: cbBorrower.id,
          borrowerType: 'co_borrower',
          ordinal: cb.ordinal,
          maritalStatus: cb.maritalStatus,
          currentAddress: cb.currentAddress,
          addressYears: cb.addressYears,
          addressMonths: cb.addressMonths,
          employmentStatus: cb.employmentStatus,
          employerName: cb.employerName,
          positionTitle: cb.positionTitle,
          yearsInPosition: cb.yearsInPosition,
          monthlyBaseIncome: cb.monthlyBaseIncome,
          otherMonthlyIncome: cb.otherMonthlyIncome,
          otherIncomeSource: cb.otherIncomeSource,
          declarations: cb.declarations,
        },
      });
    }

    // ─── Audit Trail ──────────────────────────────────────
    await prisma.loanEvent.create({
      data: {
        loanId: loan.id,
        eventType: 'status_change',
        actorType: 'mlo',
        actorId: session.user.id,
        oldValue: null,
        newValue: statusOverride,
        details: {
          source: 'mismo_xml_import',
          numBorrowers: result.borrowers.length,
          loanNumber: loanData.loanNumber,
          lenderName: loanData.lenderName,
        },
      },
    });

    // ─── WorkDrive Folder (non-blocking) ──────────────────
    try {
      const folder = await createLoanFolder({
        borrowerFirstName: primary.firstName,
        borrowerLastName: primary.lastName,
        purpose: loanData.purpose || 'purchase',
      });

      await prisma.loan.update({
        where: { id: loan.id },
        data: {
          workDriveFolderId: folder.rootFolderId,
          workDriveSubfolders: folder.subfolders,
        },
      });

      console.log(`WorkDrive folder created for imported loan ${loan.id}: ${folder.rootFolderId}`);
    } catch (wdError) {
      console.error('WorkDrive folder creation failed for import (non-fatal):', wdError?.message);
    }

    return NextResponse.json({
      success: true,
      loanId: loan.id,
      borrowerId: borrower.id,
      borrowerName: `${primary.firstName} ${primary.lastName}`,
      loanNumber: loanData.loanNumber,
      status: statusOverride,
    });
  } catch (error) {
    console.error('MISMO import error:', error?.message, error?.stack);
    return NextResponse.json(
      { error: error?.message || 'Import failed. Please check the XML file format.' },
      { status: 500 }
    );
  }
}

// ─── Helpers ──────────────────────────────────────────────

async function extractXmlFromRequest(request) {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || typeof file === 'string') {
      throw new Error('No XML file provided');
    }
    return await file.text();
  }

  // Fallback: raw XML body
  return await request.text();
}

/**
 * Create or update a Borrower record from imported data.
 * If no SSN, generates a placeholder email for lookup.
 * If no email, generates one from name + timestamp.
 */
async function upsertBorrowerFromImport({ firstName, lastName, email, phone, ssn, dob }) {
  // Generate email if missing (required for borrower record)
  const borrowerEmail = email
    ? email.toLowerCase().trim()
    : `${(firstName || 'unknown').toLowerCase()}.${(lastName || 'unknown').toLowerCase()}.import.${Date.now()}@placeholder.netrate.local`;

  // Handle SSN: encrypt if present, use placeholder if not
  let ssnEncrypted;
  let lastFour;
  if (ssn && ssn.replace(/\D/g, '').length === 9) {
    const ssnDigits = ssn.replace(/\D/g, '');
    ssnEncrypted = encrypt(ssnDigits);
    lastFour = ssnLastFour(ssnDigits);
  } else {
    // Placeholder — SSN not in file (common for exports)
    ssnEncrypted = encrypt('000000000');
    lastFour = '0000';
  }

  // Handle DOB: encrypt if present, use placeholder if not
  const dobEncrypted = dob ? encrypt(String(dob)) : encrypt('1900-01-01');

  // Check if borrower exists by email
  let borrower = await prisma.borrower.findUnique({
    where: { email: borrowerEmail },
  });

  if (borrower) {
    borrower = await prisma.borrower.update({
      where: { email: borrowerEmail },
      data: {
        firstName: firstName || borrower.firstName,
        lastName: lastName || borrower.lastName,
        phone: phone || borrower.phone,
        dobEncrypted,
        ssnEncrypted,
        ssnLastFour: lastFour,
      },
    });
  } else {
    borrower = await prisma.borrower.create({
      data: {
        email: borrowerEmail,
        firstName: firstName || 'Unknown',
        lastName: lastName || 'Unknown',
        phone: phone || null,
        dobEncrypted,
        ssnEncrypted,
        ssnLastFour: lastFour,
      },
    });
  }

  return borrower;
}
