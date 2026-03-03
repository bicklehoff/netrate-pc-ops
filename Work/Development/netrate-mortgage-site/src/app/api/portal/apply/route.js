// API: Submit Loan Application
// POST /api/portal/apply
//
// Receives all form data, creates borrower + loan + co-borrower records.
// Encrypts SSN and DOB before storage.
// Creates initial loan_event for the submission.
// Supports up to 3 co-borrowers (4 total borrowers per loan).

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

// ─── Create or find a Borrower record ──────────────────────
async function upsertBorrower({ firstName, lastName, email, phone, ssn, dob }) {
  const emailLower = email.toLowerCase().trim();
  const ssnDigits = String(ssn).replace(/\D/g, '');
  if (ssnDigits.length !== 9) {
    throw new Error(`SSN must contain exactly 9 digits (got ${ssnDigits.length})`);
  }

  const ssnEncrypted = encrypt(ssnDigits);
  const dobEncrypted = encrypt(String(dob));
  const lastFour = ssnLastFour(ssnDigits);

  let borrower = await prisma.borrower.findUnique({
    where: { email: emailLower },
  });

  if (borrower) {
    borrower = await prisma.borrower.update({
      where: { email: emailLower },
      data: {
        firstName,
        lastName,
        phone: phone || null,
        dobEncrypted,
        ssnEncrypted,
        ssnLastFour: lastFour,
      },
    });
  } else {
    borrower = await prisma.borrower.create({
      data: {
        email: emailLower,
        firstName,
        lastName,
        phone: phone || null,
        dobEncrypted,
        ssnEncrypted,
        ssnLastFour: lastFour,
      },
    });
  }

  return borrower;
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

    // ─── Create Primary Borrower ──────────────────────────────
    const borrower = await upsertBorrower({
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      phone: body.phone,
      ssn: body.ssn,
      dob: body.dob,
    });

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

    const coBorrowers = body.coBorrowers || [];
    const numBorrowers = 1 + coBorrowers.length;

    // ─── Create Loan Record ──────────────────────────────────
    const loan = await prisma.loan.create({
      data: {
        borrowerId: borrower.id,
        status: 'applied',
        ballInCourt: 'mlo',
        purpose: body.purpose,
        occupancy: body.occupancy || null,
        numBorrowers,

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

        // Address (primary borrower — kept on Loan for backward compat)
        currentAddress: safeJson(body.currentAddress),
        addressYears: safeInt(body.addressYears),
        addressMonths: safeInt(body.addressMonths),
        mailingAddress: body.mailingAddressSame ? null : safeJson(body.mailingAddress),
        maritalStatus: body.maritalStatus || null,

        // Employment (primary borrower — kept on Loan for backward compat)
        employmentStatus: body.employmentStatus || null,
        employerName: body.employerName || null,
        positionTitle: body.positionTitle || null,
        yearsInPosition: safeInt(body.yearsInPosition),
        monthlyBaseIncome: safeDecimal(body.monthlyBaseIncome),
        otherMonthlyIncome: safeDecimal(body.otherMonthlyIncome),
        otherIncomeSource: body.otherIncomeSource || null,

        // Declarations (primary borrower)
        declarations,

        // Metadata
        applicationStep: 6,
        submittedAt: new Date(),
      },
    });

    // ─── Create LoanBorrower for Primary ─────────────────────
    await prisma.loanBorrower.create({
      data: {
        loanId: loan.id,
        borrowerId: borrower.id,
        borrowerType: 'primary',
        ordinal: 0,
        maritalStatus: body.maritalStatus || null,
        currentAddress: safeJson(body.currentAddress),
        addressYears: safeInt(body.addressYears),
        addressMonths: safeInt(body.addressMonths),
        mailingAddress: body.mailingAddressSame ? null : safeJson(body.mailingAddress),
        employmentStatus: body.employmentStatus || null,
        employerName: body.employerName || null,
        positionTitle: body.positionTitle || null,
        yearsInPosition: safeInt(body.yearsInPosition),
        monthlyBaseIncome: safeDecimal(body.monthlyBaseIncome),
        otherMonthlyIncome: safeDecimal(body.otherMonthlyIncome),
        otherIncomeSource: body.otherIncomeSource || null,
        declarations,
      },
    });

    // ─── Create Co-Borrower Records ──────────────────────────
    for (let i = 0; i < coBorrowers.length; i++) {
      const cb = coBorrowers[i];
      if (!cb.firstName || !cb.lastName || !cb.email || !cb.ssn || !cb.dob) {
        continue; // Skip incomplete co-borrowers
      }

      const cbBorrower = await upsertBorrower({
        firstName: cb.firstName,
        lastName: cb.lastName,
        email: cb.email,
        phone: cb.phone,
        ssn: cb.ssn,
        dob: cb.dob,
      });

      await prisma.loanBorrower.create({
        data: {
          loanId: loan.id,
          borrowerId: cbBorrower.id,
          borrowerType: 'co_borrower',
          ordinal: i + 1,
          relationship: cb.relationship || null,
          maritalStatus: body.maritalStatus || null, // Shared marital status
          currentAddress: safeJson(cb.currentAddress),
          addressYears: safeInt(cb.addressYears),
          addressMonths: safeInt(cb.addressMonths),
          mailingAddress: cb.mailingAddressSame ? null : safeJson(cb.mailingAddress),
          employmentStatus: cb.employmentStatus || null,
          employerName: cb.employerName || null,
          positionTitle: cb.positionTitle || null,
          yearsInPosition: safeInt(cb.yearsInPosition),
          monthlyBaseIncome: safeDecimal(cb.monthlyBaseIncome),
          otherMonthlyIncome: safeDecimal(cb.otherMonthlyIncome),
          otherIncomeSource: cb.otherIncomeSource || null,
          declarations: cb.declarations || null,
        },
      });
    }

    // ─── Audit Trail ─────────────────────────────────────────
    await prisma.loanEvent.create({
      data: {
        loanId: loan.id,
        eventType: 'status_change',
        actorType: 'borrower',
        actorId: borrower.id,
        oldValue: 'draft',
        newValue: 'applied',
        details: {
          source: 'web_application',
          numBorrowers,
          coBorrowerNames: coBorrowers.map((cb) => `${cb.firstName} ${cb.lastName}`),
        },
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
