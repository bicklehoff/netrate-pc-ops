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
      assets: result.assets,
      liabilities: result.liabilities,
      reos: result.reos,
      transaction: result.transaction,
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
    const mloId = formData.get('mloId') || null;

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
        mloId: mloId || null,
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
    const primaryLB = await prisma.loanBorrower.create({
      data: {
        loanId: loan.id,
        borrowerId: borrower.id,
        borrowerType: 'primary',
        ordinal: 0,
        maritalStatus: primary.maritalStatus,
        citizenship: primary.citizenship,
        housingType: primary.housingType,
        monthlyRent: primary.monthlyRent,
        currentAddress: primary.currentAddress,
        addressYears: primary.addressYears,
        addressMonths: primary.addressMonths,
        previousAddress: primary.previousAddress,
        previousAddressYears: primary.previousAddressYears,
        previousAddressMonths: primary.previousAddressMonths,
        cellPhone: primary.cellPhone,
        suffix: primary.suffix,
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

    // Create 1003 sub-models for primary borrower
    await create1003BorrowerModels(primaryLB.id, primary);

    // ─── Create Co-Borrower Records ───────────────────────
    for (const cb of result.coBorrowers) {
      if (!cb.firstName || !cb.lastName) continue;

      const cbBorrower = await upsertBorrowerFromImport(cb);

      const cbLB = await prisma.loanBorrower.create({
        data: {
          loanId: loan.id,
          borrowerId: cbBorrower.id,
          borrowerType: 'co_borrower',
          ordinal: cb.ordinal,
          maritalStatus: cb.maritalStatus,
          citizenship: cb.citizenship,
          housingType: cb.housingType,
          monthlyRent: cb.monthlyRent,
          currentAddress: cb.currentAddress,
          addressYears: cb.addressYears,
          addressMonths: cb.addressMonths,
          previousAddress: cb.previousAddress,
          previousAddressYears: cb.previousAddressYears,
          previousAddressMonths: cb.previousAddressMonths,
          cellPhone: cb.cellPhone,
          suffix: cb.suffix,
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

      // Create 1003 sub-models for co-borrower
      await create1003BorrowerModels(cbLB.id, cb);
    }

    // ─── Create Loan-Level 1003 Models ────────────────────
    await create1003LoanModels(loan.id, result);

    // ─── Create Contacts for All Borrowers ─────────────────
    // Every borrower becomes a Contact (marketable, searchable, linkable to future leads)
    await upsertContactFromBorrower(borrower, primary, 'xml_import');

    for (const cb of result.coBorrowers) {
      if (!cb.firstName || !cb.lastName) continue;
      const cbBorrower = await prisma.borrower.findFirst({
        where: {
          firstName: cb.firstName,
          lastName: cb.lastName,
        },
        orderBy: { createdAt: 'desc' },
      });
      if (cbBorrower) {
        await upsertContactFromBorrower(cbBorrower, cb, 'xml_import');
      }
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

/**
 * Create or update a Contact record from a Borrower.
 * Links Contact to Borrower via borrowerId.
 * If Contact already exists for this borrower, updates it.
 */
async function upsertContactFromBorrower(borrower, rawData, source) {
  try {
    // Check if Contact already exists for this borrower
    let contact = await prisma.contact.findUnique({
      where: { borrowerId: borrower.id },
    });

    if (contact) {
      // Update with latest info
      contact = await prisma.contact.update({
        where: { id: contact.id },
        data: {
          firstName: rawData.firstName || contact.firstName,
          lastName: rawData.lastName || contact.lastName,
          email: rawData.email || contact.email,
          phone: rawData.phone || contact.phone,
          source: contact.source, // Don't overwrite source
        },
      });
    } else {
      // Also check by email to avoid duplicates
      if (rawData.email) {
        contact = await prisma.contact.findFirst({
          where: { email: rawData.email.toLowerCase().trim() },
        });
      }

      if (contact) {
        // Link existing contact to borrower
        contact = await prisma.contact.update({
          where: { id: contact.id },
          data: {
            borrowerId: borrower.id,
            firstName: rawData.firstName || contact.firstName,
            lastName: rawData.lastName || contact.lastName,
            phone: rawData.phone || contact.phone,
          },
        });
      } else {
        // Create new Contact
        contact = await prisma.contact.create({
          data: {
            firstName: rawData.firstName || 'Unknown',
            lastName: rawData.lastName || 'Unknown',
            email: rawData.email ? rawData.email.toLowerCase().trim() : null,
            phone: rawData.phone || null,
            source,
            tags: ['borrower'],
            borrowerId: borrower.id,
          },
        });
      }
    }

    return contact;
  } catch (error) {
    // Non-fatal — log and continue (loan import should not fail if contact creation fails)
    console.error('Contact creation failed (non-fatal):', error?.message);
    return null;
  }
}

/**
 * Create 1003 per-borrower models: LoanEmployment[], LoanIncome, LoanDeclaration
 */
async function create1003BorrowerModels(loanBorrowerId, borrowerData) {
  try {
    // Employments
    if (borrowerData.employments?.length > 0) {
      for (const emp of borrowerData.employments) {
        if (!emp) continue;
        await prisma.loanEmployment.create({
          data: {
            loanBorrowerId,
            isPrimary: emp.isPrimary ?? true,
            employerName: emp.employerName || null,
            employerAddress: emp.employerAddress || null,
            employerPhone: emp.employerPhone || null,
            position: emp.position || null,
            startDate: emp.startDate ? new Date(emp.startDate) : null,
            endDate: emp.endDate ? new Date(emp.endDate) : null,
            yearsOnJob: emp.yearsOnJob || null,
            monthsOnJob: emp.monthsOnJob || null,
            selfEmployed: emp.selfEmployed ?? false,
          },
        });
      }
    }

    // Income
    const inc = borrowerData.detailedIncome;
    if (inc) {
      const hasAnyIncome = inc.baseMonthly || inc.overtimeMonthly || inc.bonusMonthly
        || inc.commissionMonthly || inc.dividendsMonthly || inc.interestMonthly
        || inc.rentalIncomeMonthly || inc.otherMonthly;
      if (hasAnyIncome) {
        await prisma.loanIncome.create({
          data: {
            loanBorrowerId,
            baseMonthly: inc.baseMonthly || null,
            overtimeMonthly: inc.overtimeMonthly || null,
            bonusMonthly: inc.bonusMonthly || null,
            commissionMonthly: inc.commissionMonthly || null,
            dividendsMonthly: inc.dividendsMonthly || null,
            interestMonthly: inc.interestMonthly || null,
            rentalIncomeMonthly: inc.rentalIncomeMonthly || null,
            otherMonthly: inc.otherMonthly || null,
            otherIncomeSource: inc.otherIncomeSource || null,
          },
        });
      }
    }

    // Declarations
    const decl = borrowerData.structuredDeclaration;
    if (decl) {
      await prisma.loanDeclaration.create({
        data: {
          loanBorrowerId,
          outstandingJudgments: decl.outstandingJudgments ?? null,
          bankruptcy: decl.bankruptcy ?? null,
          bankruptcyType: decl.bankruptcyType || null,
          foreclosure: decl.foreclosure ?? null,
          partyToLawsuit: decl.partyToLawsuit ?? null,
          loanDefault: decl.loanDefault ?? null,
          alimonyObligation: decl.alimonyObligation ?? null,
          delinquentFederalDebt: decl.delinquentFederalDebt ?? null,
          coSignerOnOtherLoan: decl.coSignerOnOtherLoan ?? null,
          intentToOccupy: decl.intentToOccupy ?? null,
          ownershipInterestLastThreeYears: decl.ownershipInterestLastThreeYears ?? null,
          propertyTypeOfOwnership: decl.propertyTypeOfOwnership || null,
        },
      });
    }
  } catch (error) {
    console.error('1003 borrower models creation failed (non-fatal):', error?.message);
  }
}

/**
 * Create 1003 loan-level models: LoanAsset[], LoanLiability[], LoanREO[], LoanTransaction
 */
async function create1003LoanModels(loanId, result) {
  try {
    // Assets
    for (const asset of (result.assets || [])) {
      await prisma.loanAsset.create({
        data: {
          loanId,
          borrowerType: null, // Could map from relationship labels
          institution: asset.institution || null,
          accountType: asset.accountType || null,
          accountNumber: asset.accountNumber || null,
          balance: asset.balance || null,
          isJoint: false,
        },
      });
    }

    // Liabilities
    for (const liab of (result.liabilities || [])) {
      await prisma.loanLiability.create({
        data: {
          loanId,
          creditor: liab.creditor || null,
          accountNumber: liab.accountNumber || null,
          liabilityType: liab.liabilityType || null,
          monthlyPayment: liab.monthlyPayment || null,
          unpaidBalance: liab.unpaidBalance || null,
          monthsRemaining: liab.monthsRemaining || null,
          paidOffAtClosing: liab.paidOffAtClosing ?? false,
        },
      });
    }

    // REOs
    for (const reo of (result.reos || [])) {
      await prisma.loanREO.create({
        data: {
          loanId,
          address: reo.address || null,
          propertyType: reo.propertyType || null,
          presentMarketValue: reo.presentMarketValue || null,
          mortgageBalance: reo.mortgageBalance || null,
          mortgagePayment: reo.mortgagePayment || null,
          grossRentalIncome: reo.grossRentalIncome || null,
          netRentalIncome: reo.netRentalIncome || null,
          insuranceTaxesMaintenance: reo.insuranceTaxesMaintenance || null,
          status: reo.status || 'retained',
        },
      });
    }

    // Transaction
    const tx = result.transaction;
    if (tx) {
      const hasTxData = tx.purchasePrice || tx.closingCostsEstimate || tx.discountPoints
        || tx.sellerConcessions || tx.cashFromBorrower;
      if (hasTxData) {
        await prisma.loanTransaction.create({
          data: {
            loanId,
            purchasePrice: tx.purchasePrice || null,
            closingCostsEstimate: tx.closingCostsEstimate || null,
            discountPoints: tx.discountPoints || null,
            sellerConcessions: tx.sellerConcessions || null,
            cashFromBorrower: tx.cashFromBorrower || null,
          },
        });
      }
    }

    // Update loan with amortization type
    if (result.loan.amortizationType) {
      await prisma.loan.update({
        where: { id: loanId },
        data: { amortizationType: result.loan.amortizationType },
      });
    }
  } catch (error) {
    console.error('1003 loan models creation failed (non-fatal):', error?.message);
  }
}
