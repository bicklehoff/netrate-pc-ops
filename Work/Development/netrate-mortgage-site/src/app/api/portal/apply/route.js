// API: Submit Loan Application
// POST /api/portal/apply
//
// Receives all form data, creates borrower + loan records.
// Encrypts SSN and DOB before storage.
// Creates initial loan_event for the submission.

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { encrypt, ssnLastFour } from '@/lib/encryption';

// ─── Safe parsers (return null instead of NaN) ─────────────
function safeInt(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = parseInt(val, 10);
  return Number.isNaN(n) ? null : n;
}

function safeDecimal(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = parseFloat(val);
  return Number.isNaN(n) ? null : n;
}

function safeJson(val) {
  if (!val || typeof val !== 'object') return null;
  return val;
}

export async function POST(request) {
  try {
    const body = await request.json();

    // ─── Basic Validation ────────────────────────────────────
    if (!body.firstName || !body.lastName || !body.email || !body.ssn || !body.dob || !body.purpose) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // ─── Environment Check ───────────────────────────────────
    if (!process.env.PII_ENCRYPTION_KEY) {
      console.error('FATAL: PII_ENCRYPTION_KEY environment variable is not set');
      return NextResponse.json(
        { error: 'Server configuration error. Please contact support.' },
        { status: 500 }
      );
    }

    const email = body.email.toLowerCase().trim();

    // ─── Encrypt PII ─────────────────────────────────────────
    const ssnDigits = String(body.ssn).replace(/\D/g, '');
    if (ssnDigits.length !== 9) {
      return NextResponse.json(
        { error: 'SSN must contain exactly 9 digits' },
        { status: 400 }
      );
    }
    const ssnEncrypted = encrypt(ssnDigits);
    const dobEncrypted = encrypt(String(body.dob));
    const lastFour = ssnLastFour(ssnDigits);

    // ─── Create or Find Borrower ─────────────────────────────
    let borrower = await prisma.borrower.findUnique({
      where: { email },
    });

    if (borrower) {
      // Existing borrower — update their info
      borrower = await prisma.borrower.update({
        where: { email },
        data: {
          firstName: body.firstName,
          lastName: body.lastName,
          phone: body.phone || null,
          dobEncrypted,
          ssnEncrypted,
          ssnLastFour: lastFour,
        },
      });
    } else {
      // New borrower
      borrower = await prisma.borrower.create({
        data: {
          email,
          firstName: body.firstName,
          lastName: body.lastName,
          phone: body.phone || null,
          dobEncrypted,
          ssnEncrypted,
          ssnLastFour: lastFour,
        },
      });
    }

    // ─── Build Declarations Object (1003 Sections 5a & 5b) ──
    const declarations = {
      // Section 5a — Property & Money
      primaryResidence: body.primaryResidence ?? true,
      priorOwnership3Years: body.priorOwnership3Years ?? false,
      priorPropertyType: body.priorPropertyType || null,
      priorPropertyTitleHeld: body.priorPropertyTitleHeld || null,
      familyRelationshipSeller: body.familyRelationshipSeller ?? false,
      undisclosedBorrowing: body.undisclosedBorrowing ?? false,
      undisclosedBorrowingAmount: safeDecimal(body.undisclosedBorrowingAmount),
      applyingForOtherMortgage: body.applyingForOtherMortgage ?? false,
      applyingForNewCredit: body.applyingForNewCredit ?? false,
      priorityLien: body.priorityLien ?? false,

      // Section 5b — Your Finances
      coSignerOnDebt: body.coSignerOnDebt ?? false,
      outstandingJudgments: body.outstandingJudgments ?? false,
      delinquentFederalDebt: body.delinquentFederalDebt ?? false,
      lawsuitParty: body.lawsuitParty ?? false,
      deedInLieu: body.deedInLieu ?? false,
      preForeclosureSale: body.preForeclosureSale ?? false,
      foreclosure: body.foreclosure ?? false,
      bankruptcy: body.bankruptcy ?? false,
      bankruptcyChapter: body.bankruptcyChapter || null,

      // General
      citizenshipStatus: body.citizenshipStatus || null,
    };

    // ─── Create Loan Record ──────────────────────────────────
    const loan = await prisma.loan.create({
      data: {
        borrowerId: borrower.id,
        status: 'applied',
        ballInCourt: 'mlo',
        purpose: body.purpose,
        occupancy: body.occupancy || null,

        // Property
        propertyAddress: safeJson(body.propertyAddress),
        propertyType: body.propertyType || null,
        numUnits: safeInt(body.numUnits),
        purchasePrice: safeDecimal(body.purchasePrice),
        downPayment: safeDecimal(body.downPayment),
        estimatedValue: safeDecimal(body.estimatedValue),
        currentBalance: safeDecimal(body.currentBalance),
        refiPurpose: body.refiPurpose || null,
        cashOutAmount: safeDecimal(body.cashOutAmount),

        // Address
        currentAddress: safeJson(body.currentAddress),
        addressYears: safeInt(body.addressYears),
        addressMonths: safeInt(body.addressMonths),
        mailingAddress: body.mailingAddressSame ? null : safeJson(body.mailingAddress),
        maritalStatus: body.maritalStatus || null,

        // Employment
        employmentStatus: body.employmentStatus || null,
        employerName: body.employerName || null,
        positionTitle: body.positionTitle || null,
        yearsInPosition: safeInt(body.yearsInPosition),
        monthlyBaseIncome: safeDecimal(body.monthlyBaseIncome),
        otherMonthlyIncome: safeDecimal(body.otherMonthlyIncome),
        otherIncomeSource: body.otherIncomeSource || null,

        // Declarations
        declarations,

        // Metadata
        applicationStep: 6,
        submittedAt: new Date(),
      },
    });

    // ─── Audit Trail ─────────────────────────────────────────
    await prisma.loanEvent.create({
      data: {
        loanId: loan.id,
        eventType: 'status_change',
        actorType: 'borrower',
        actorId: borrower.id,
        oldValue: 'draft',
        newValue: 'applied',
        details: { source: 'web_application' },
      },
    });

    return NextResponse.json({
      success: true,
      loanId: loan.id,
      borrowerId: borrower.id,
    });

  } catch (error) {
    console.error('Application submission error:', error?.message, error?.stack);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again or contact support.' },
      { status: 500 }
    );
  }
}
