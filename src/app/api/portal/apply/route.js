// API: Submit Loan Application
// POST /api/portal/apply
//
// Receives all form data, creates borrower + loan + co-borrower records.
// Encrypts SSN and DOB before storage.
// Creates initial loan_event for the submission.
// Supports up to 3 co-borrowers (4 total borrowers per loan).

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import prisma from '@/lib/prisma';
import { encrypt, ssnLastFour } from '@/lib/encryption';
import { createLoanFolder } from '@/lib/zoho-workdrive';

// ─── Rate Limiting (in-memory, per IP) ──────────────────────
// 5 submissions per hour per IP. Map auto-cleans expired entries.
const rateLimitMap = new Map();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  // Clean expired entries periodically (every 100 checks)
  if (rateLimitMap.size > 100) {
    for (const [key, val] of rateLimitMap) {
      if (now - val.windowStart > RATE_LIMIT_WINDOW_MS) {
        rateLimitMap.delete(key);
      }
    }
  }

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count };
}

// ─── Input Validation Helpers ───────────────────────────────
function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function validateSSN(ssn) {
  const digits = String(ssn).replace(/\D/g, '');
  if (digits.length !== 9) return 'SSN must contain exactly 9 digits';
  // Invalid SSN patterns (IRS rules)
  if (digits.startsWith('000')) return 'Invalid SSN';
  if (digits.substring(3, 5) === '00') return 'Invalid SSN';
  if (digits.substring(5) === '0000') return 'Invalid SSN';
  if (digits === '999999999') return 'Invalid SSN';
  // Known test/invalid SSNs
  if (['123456789', '111111111', '222222222', '333333333', '444444444',
       '555555555', '666666666', '777777777', '888888888'].includes(digits)) {
    return 'Invalid SSN';
  }
  return null;
}

function validateDOB(dob) {
  const date = new Date(dob);
  if (isNaN(date.getTime())) return 'Invalid date of birth';
  const now = new Date();
  const age = (now - date) / (365.25 * 24 * 60 * 60 * 1000);
  if (age < 18) return 'Applicant must be at least 18 years old';
  if (age > 100) return 'Invalid date of birth';
  return null;
}

function validatePhone(phone) {
  if (!phone) return null; // Phone is optional
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length !== 10 && digits.length !== 11) return 'Phone must be 10 digits';
  return null;
}

function sanitize(str) {
  if (typeof str !== 'string') return str;
  return str.trim().replace(/[<>]/g, '');
}

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
  const emailLower = (sanitize(email) || email || '').toLowerCase().trim();
  const ssnDigits = String(ssn).replace(/\D/g, '');

  // Validation already handled in POST handler — just check digit count here
  if (ssnDigits.length !== 9) {
    throw new Error('SSN must contain exactly 9 digits');
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
        firstName: sanitize(firstName),
        lastName: sanitize(lastName),
        phone: phone ? sanitize(phone) : null,
        dobEncrypted,
        ssnEncrypted,
        ssnLastFour: lastFour,
      },
    });
  } else {
    borrower = await prisma.borrower.create({
      data: {
        email: emailLower,
        firstName: sanitize(firstName),
        lastName: sanitize(lastName),
        phone: phone ? sanitize(phone) : null,
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
    // ─── Rate Limiting ─────────────────────────────────────────
    const headersList = await headers();
    const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim()
      || headersList.get('x-real-ip')
      || 'unknown';
    const rateCheck = checkRateLimit(ip);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many submissions. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await request.json();

    // ─── Basic Validation ────────────────────────────────────
    if (!body.firstName || !body.lastName || !body.email || !body.ssn || !body.dob || !body.purpose) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // ─── Input Validation ────────────────────────────────────
    if (!validateEmail(body.email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const ssnError = validateSSN(body.ssn);
    if (ssnError) {
      return NextResponse.json({ error: ssnError }, { status: 400 });
    }

    const dobError = validateDOB(body.dob);
    if (dobError) {
      return NextResponse.json({ error: dobError }, { status: 400 });
    }

    const phoneError = validatePhone(body.phone);
    if (phoneError) {
      return NextResponse.json({ error: phoneError }, { status: 400 });
    }

    if (!['purchase', 'refinance'].includes(body.purpose)) {
      return NextResponse.json({ error: 'Invalid loan purpose' }, { status: 400 });
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

      // HMDA Demographics (optional)
      hmdaEthnicity: body.hmdaEthnicity || null,
      hmdaRace: body.hmdaRace?.length > 0 ? body.hmdaRace : null,
      hmdaSex: body.hmdaSex || null,

      // Consent
      authorizeVerification: body.authorizeVerification ?? false,
      authorizeCreditPull: body.authorizeCreditPull ?? false,
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

    // ─── WorkDrive Folder Creation (non-blocking) ──────────
    // Create loan folder in Zoho WorkDrive for document storage.
    // Wrapped in try/catch — WorkDrive failure should NOT block submission.
    try {
      const folder = await createLoanFolder({
        borrowerFirstName: sanitize(body.firstName),
        borrowerLastName: sanitize(body.lastName),
        purpose: body.purpose,
      });

      // Store folder IDs on the loan for doc upload routing
      await prisma.loan.update({
        where: { id: loan.id },
        data: {
          workDriveFolderId: folder.rootFolderId,
          workDriveSubfolders: folder.subfolders,
        },
      });

      console.log(`WorkDrive folder created for loan ${loan.id}: ${folder.rootFolderId}`);
    } catch (wdError) {
      // Log but don't fail the application
      console.error('WorkDrive folder creation failed (non-fatal):', wdError?.message);
    }

    return NextResponse.json({
      success: true,
      loanId: loan.id,
      borrowerId: borrower.id,
    });

  } catch (error) {
    console.error('Application submission error:', error?.message, error?.stack);

    // Surface validation-style errors (from upsertBorrower) with 400 instead of 500
    const msg = error?.message || '';
    if (msg.includes('SSN') || msg.includes('date of birth') || msg.includes('Invalid') || msg.includes('must be')) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Something went wrong. Please try again or contact support.' },
      { status: 500 }
    );
  }
}
