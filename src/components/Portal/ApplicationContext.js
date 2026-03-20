// Application Form Context
// Holds form data across all 6 steps of the wizard.
// Data persists in sessionStorage so refreshing a step doesn't lose progress.
//
// SECURITY: SSN and DOB are PII and are NOT persisted to sessionStorage.
// If the user refreshes the page, they must re-enter SSN and DOB on Step 1.
// All other non-PII fields are safely restored from storage.

'use client';

import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';

const ApplicationContext = createContext(null);

const STORAGE_KEY = 'netrate_application';

const DEFAULT_DATA = {
  // Step 1: About You
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  dob: '',       // PII — not saved to sessionStorage
  ssn: '',       // PII — not saved to sessionStorage
  purpose: '',

  // Step 2: Property (purchase)
  occupancy: '',
  purchasePrice: '',
  downPayment: '',
  propertyIdentified: '',
  propertyType: '',
  numUnits: '',

  // Step 2: Property (refinance)
  refiPurpose: '',
  estimatedValue: '',
  currentBalance: '',
  cashOutAmount: '',

  // Step 2: Property (shared)
  propertyAddress: { street: '', city: '', state: '', zip: '' },

  // Step 3: Address History
  currentAddress: { street: '', city: '', state: '', zip: '' },
  currentAddressSameAsProperty: false,
  addressYears: '',
  addressMonths: '',
  mailingAddressSame: true,
  mailingAddress: { street: '', city: '', state: '', zip: '' },
  maritalStatus: '',

  // Co-borrowers (up to 3; added via Step 3 when married)
  coBorrowers: [],
  coBorrowerDecisionMade: false, // Tracks if married borrower chose add-spouse or solo

  // Step 4: Employment & Income
  employmentStatus: '',
  employerName: '',
  positionTitle: '',
  yearsInPosition: '',
  monthlyBaseIncome: '',
  otherMonthlyIncome: '',
  otherIncomeSource: '',

  // Step 5: Declarations (1003 Section 5a & 5b)
  primaryResidence: true,
  priorOwnership3Years: false,
  priorPropertyType: '',
  priorPropertyTitleHeld: '',
  familyRelationshipSeller: false,
  undisclosedBorrowing: false,
  undisclosedBorrowingAmount: '',
  applyingForOtherMortgage: false,
  applyingForNewCredit: false,
  priorityLien: false,
  coSignerOnDebt: false,
  outstandingJudgments: false,
  delinquentFederalDebt: false,
  lawsuitParty: false,
  deedInLieu: false,
  preForeclosureSale: false,
  foreclosure: false,
  bankruptcy: false,
  bankruptcyChapter: '',
  citizenshipStatus: '',

  // HMDA Demographics (optional — Government Monitoring)
  hmdaEthnicity: '',
  hmdaRace: [],
  hmdaSex: '',
};

// Fields that must NEVER be saved to sessionStorage (PII)
const PII_FIELDS = ['ssn', 'dob'];

// Step completion checks — returns true if the key required fields for a step have data.
// Note: SSN and DOB (PII) are excluded from Step 1 completion because they are cleared
// on page refresh for security. Step 1 shows as "complete" based on non-PII fields.
function isStepComplete(stepNum, data) {
  switch (stepNum) {
    case 1:
      return !!(data.firstName && data.lastName && data.email && data.phone && data.purpose);
    case 2:
      if (data.purpose === 'purchase') {
        return !!(data.occupancy && data.purchasePrice && data.propertyType);
      }
      if (data.purpose === 'refinance') {
        return !!(data.occupancy && data.refiPurpose && data.estimatedValue && data.currentBalance && data.propertyType);
      }
      return false;
    case 3:
      return !!(data.currentAddress?.street && data.currentAddress?.city && data.maritalStatus);
    case 4:
      return !!(data.employmentStatus && data.monthlyBaseIncome);
    case 5:
      return !!data.citizenshipStatus;
    case 6:
      return false; // Review is never "complete" until submitted
    default:
      return false;
  }
}

function loadFromStorage() {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        data: { ...DEFAULT_DATA, ...parsed.data },
        currentStep: parsed.currentStep || 1,
      };
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

function saveToStorage(data, currentStep) {
  try {
    const safeData = { ...data };
    // Strip primary borrower PII
    for (const field of PII_FIELDS) {
      delete safeData[field];
    }
    // Strip co-borrower PII
    if (safeData.coBorrowers?.length) {
      safeData.coBorrowers = safeData.coBorrowers.map((cb) => {
        const safeCb = { ...cb };
        for (const field of PII_FIELDS) {
          delete safeCb[field];
        }
        return safeCb;
      });
    }
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ data: safeData, currentStep })
    );
  } catch {
    // Storage full or unavailable
  }
}

export function ApplicationProvider({ children }) {
  // Initialize state synchronously from sessionStorage to avoid race conditions
  const [data, setData] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_DATA;
    const saved = loadFromStorage();
    return saved ? saved.data : DEFAULT_DATA;
  });

  const [currentStep, setCurrentStep] = useState(() => {
    if (typeof window === 'undefined') return 1;
    const saved = loadFromStorage();
    return saved ? saved.currentStep : 1;
  });

  // Track whether we've done the initial load (skip first save)
  const initialized = useRef(false);

  // Save to sessionStorage when data or step changes (skip initial)
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      return;
    }
    saveToStorage(data, currentStep);
  }, [data, currentStep]);

  const updateData = useCallback((stepData) => {
    setData((prev) => ({ ...prev, ...stepData }));
  }, []);

  // ─── Co-borrower helpers ────────────────────────────────────

  const addCoBorrower = useCallback((coBorrower) => {
    setData((prev) => {
      if (prev.coBorrowers.length >= 3) return prev; // Max 3 co-borrowers (4 total)
      const newCb = {
        id: crypto.randomUUID(),
        relationship: 'spouse',
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        dob: '',   // PII
        ssn: '',   // PII
        // Address
        currentAddress: { street: '', city: '', state: '', zip: '' },
        addressYears: '',
        addressMonths: '',
        mailingAddressSame: true,
        mailingAddress: { street: '', city: '', state: '', zip: '' },
        // Employment
        employmentStatus: '',
        employerName: '',
        positionTitle: '',
        yearsInPosition: '',
        monthlyBaseIncome: '',
        otherMonthlyIncome: '',
        otherIncomeSource: '',
        // Declarations — prefill with false defaults so Yes/No buttons start on "No"
        declarations: {
          coSignerOnDebt: false,
          outstandingJudgments: false,
          delinquentFederalDebt: false,
          lawsuitParty: false,
          deedInLieu: false,
          preForeclosureSale: false,
          foreclosure: false,
          bankruptcy: false,
          bankruptcyChapter: '',
          citizenshipStatus: '',
        },
        ...coBorrower,
      };
      return { ...prev, coBorrowers: [...prev.coBorrowers, newCb] };
    });
  }, []);

  const removeCoBorrower = useCallback((id) => {
    setData((prev) => ({
      ...prev,
      coBorrowers: prev.coBorrowers.filter((cb) => cb.id !== id),
    }));
  }, []);

  const updateCoBorrower = useCallback((id, updates) => {
    setData((prev) => ({
      ...prev,
      coBorrowers: prev.coBorrowers.map((cb) =>
        cb.id === id ? { ...cb, ...updates } : cb
      ),
    }));
  }, []);

  const resetData = useCallback(() => {
    setData(DEFAULT_DATA);
    setCurrentStep(1);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  }, []);

  // Memoized step completion array: [false, true/false, true/false, ...]
  // Index 0 is unused (steps are 1-indexed).
  const stepCompletions = useMemo(
    () => [false, ...Array.from({ length: 6 }, (_, i) => isStepComplete(i + 1, data))],
    [data]
  );

  return (
    <ApplicationContext.Provider
      value={{
        data,
        updateData,
        resetData,
        currentStep,
        setCurrentStep,
        stepCompletions,
        addCoBorrower,
        removeCoBorrower,
        updateCoBorrower,
      }}
    >
      {children}
    </ApplicationContext.Provider>
  );
}

export function useApplication() {
  const ctx = useContext(ApplicationContext);
  if (!ctx) {
    throw new Error('useApplication must be used within ApplicationProvider');
  }
  return ctx;
}
