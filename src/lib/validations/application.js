// Zod Validation Schemas — Loan Application
// Used by both client (React Hook Form) and server (API routes).
// Based on PORTAL-ARCHITECTURE-PLAN.md field tables.

import { z } from 'zod';

// ─── Helpers ─────────────────────────────────────────────────

// Coerce empty string → undefined so Zod shows a clear required error
const requiredNumber = (msg) =>
  z.preprocess(
    (val) => (val === '' || val === undefined || val === null ? undefined : Number(val)),
    z.number({ required_error: msg, invalid_type_error: msg }).min(0, msg)
  );

const requiredPositiveNumber = (msg) =>
  z.preprocess(
    (val) => (val === '' || val === undefined || val === null ? undefined : Number(val)),
    z.number({ required_error: msg, invalid_type_error: msg }).positive(msg)
  );

const optionalNumber = z.preprocess(
  (val) => (val === '' || val === undefined || val === null ? undefined : Number(val)),
  z.number().min(0).optional()
);

// ─── Step 1: About You ─────────────────────────────────────

export const step1Schema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  email: z.string().email('Please enter a valid email'),
  phone: z.string().min(10, 'Please enter a valid phone number').max(20),
  dob: z.string().min(1, 'Date of birth is required'), // Validated as date string, encrypted before storage
  ssn: z
    .string()
    .regex(/^\d{3}-?\d{2}-?\d{4}$/, 'Please enter a valid SSN (XXX-XX-XXXX)')
    .transform((val) => val.replace(/\D/g, '')), // Strip dashes for storage
  purpose: z.enum(['purchase', 'refinance'], {
    required_error: 'Please select loan purpose',
  }),
});

// ─── Step 2: Property (Purchase) ────────────────────────────

export const step2PurchaseSchema = z.object({
  occupancy: z.enum(['primary', 'secondary', 'investment'], {
    required_error: 'Please select occupancy type',
  }),
  purchasePrice: requiredPositiveNumber('Please enter purchase price'),
  downPayment: requiredNumber('Down payment must be 0 or more'),
  propertyAddress: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
  }).optional(),
  propertyType: z.enum(['sfr', 'condo', 'townhome', 'multi_unit', 'manufactured'], {
    required_error: 'Please select property type',
  }),
  numUnits: optionalNumber,
});

// ─── Step 2: Property (Refinance) ───────────────────────────

export const step2RefinanceSchema = z.object({
  refiPurpose: z.enum(['rate_term', 'limited', 'cashout', 'streamline'], {
    required_error: 'Please select refinance purpose',
  }),
  occupancy: z.enum(['primary', 'secondary', 'investment'], {
    required_error: 'Please select occupancy type',
  }),
  estimatedValue: requiredPositiveNumber('Please enter estimated property value'),
  currentBalance: requiredPositiveNumber('Please enter current mortgage balance'),
  cashOutAmount: optionalNumber,
  propertyAddress: z.object({
    street: z.string().min(1, 'Street address is required'),
    city: z.string().min(1, 'City is required'),
    state: z.string().min(1, 'State is required'),
    zip: z.string().min(5, 'ZIP code is required'),
  }),
  propertyType: z.enum(['sfr', 'condo', 'townhome', 'multi_unit', 'manufactured'], {
    required_error: 'Please select property type',
  }),
  numUnits: optionalNumber,
});

// ─── Step 3: Address History ────────────────────────────────

export const step3Schema = z.object({
  currentAddress: z.object({
    street: z.string().min(1, 'Street address is required'),
    city: z.string().min(1, 'City is required'),
    state: z.string().min(1, 'State is required'),
    zip: z.string().min(5, 'ZIP code is required'),
  }),
  addressYears: requiredNumber('Please enter years at address'),
  addressMonths: optionalNumber,
  mailingAddressSame: z.boolean().optional(),
  mailingAddress: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
  }).optional().nullable(),
  maritalStatus: z.enum(['married', 'unmarried', 'separated'], {
    required_error: 'Please select marital status',
  }),
});

// ─── Step 4: Employment & Income ────────────────────────────

export const step4Schema = z.object({
  employmentStatus: z.enum(['employed', 'self_employed', 'retired', 'other'], {
    required_error: 'Please select employment status',
  }),
  employerName: z.string().optional(),
  positionTitle: z.string().optional(),
  yearsInPosition: optionalNumber,
  monthlyBaseIncome: requiredPositiveNumber('Please enter monthly income'),
  otherMonthlyIncome: optionalNumber,
  otherIncomeSource: z.string().optional(),
});

// ─── Step 5: Declarations (1003 Sections 5a & 5b) ──────────

export const step5Schema = z.object({
  // Section 5a — About this Property and Your Money
  primaryResidence: z.boolean(),
  priorOwnership3Years: z.boolean(),                    // 5a-A1
  priorPropertyType: z.string().optional(),             // 5a-A2: PR, SR, SH, IP
  priorPropertyTitleHeld: z.string().optional(),        // 5a-A2: S, SP, O
  familyRelationshipSeller: z.boolean(),                // 5a-B (purchase only)
  undisclosedBorrowing: z.boolean(),                    // 5a-C
  undisclosedBorrowingAmount: optionalNumber,            // 5a-C amount
  applyingForOtherMortgage: z.boolean(),                // 5a-D1
  applyingForNewCredit: z.boolean(),                    // 5a-D2
  priorityLien: z.boolean(),                            // 5a-E (e.g. PACE)

  // Section 5b — About Your Finances
  coSignerOnDebt: z.boolean(),                          // 5b-F
  outstandingJudgments: z.boolean(),                    // 5b-G
  delinquentFederalDebt: z.boolean(),                   // 5b-H
  lawsuitParty: z.boolean(),                            // 5b-I
  deedInLieu: z.boolean(),                              // 5b-J (replaces obligatedForeclosure)
  preForeclosureSale: z.boolean(),                      // 5b-K
  foreclosure: z.boolean(),                             // 5b-L
  bankruptcy: z.boolean(),                              // 5b-M
  bankruptcyChapter: z.string().optional(),             // 5b-M: 7, 11, 12, 13

  // General
  citizenshipStatus: z.enum(['citizen', 'permanent_resident', 'non_permanent_resident'], {
    required_error: 'Please select citizenship status',
  }),
});

// ─── Co-Borrower Schemas ──────────────────────────────────────

// Identity fields collected in Step 3 when adding a co-borrower
export const coBorrowerIdentitySchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  email: z.string().email('Please enter a valid email'),
  phone: z.string().min(10, 'Please enter a valid phone number').max(20),
  dob: z.string().min(1, 'Date of birth is required'),
  ssn: z
    .string()
    .regex(/^\d{3}-?\d{2}-?\d{4}$/, 'Please enter a valid SSN (XXX-XX-XXXX)')
    .transform((val) => val.replace(/\D/g, '')),
  relationship: z.enum(['spouse', 'parent', 'other'], {
    required_error: 'Please select relationship',
  }),
});

// Co-borrower address fields (same shape as primary)
export const coBorrowerAddressSchema = z.object({
  currentAddress: z.object({
    street: z.string().min(1, 'Street address is required'),
    city: z.string().min(1, 'City is required'),
    state: z.string().min(1, 'State is required'),
    zip: z.string().min(5, 'ZIP code is required'),
  }),
  addressYears: requiredNumber('Please enter years at address'),
  addressMonths: optionalNumber,
  mailingAddressSame: z.boolean().optional(),
  mailingAddress: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
  }).optional().nullable(),
});

// Co-borrower employment (same shape as step4)
export const coBorrowerEmploymentSchema = step4Schema;

// Co-borrower declarations (same shape as step5)
export const coBorrowerDeclarationsSchema = step5Schema;

// ─── Full Application (all steps combined for final submission) ──

export const fullApplicationSchema = z.object({
  ...step1Schema.shape,
  // Step 2 is conditional — handled separately
  ...step3Schema.shape,
  ...step4Schema.shape,
  declarations: step5Schema,
});
