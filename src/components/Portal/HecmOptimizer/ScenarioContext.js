'use client';

import { createContext, useContext, useReducer, useMemo, useCallback } from 'react';
import { calculateAllScenarios, getYoungestAge, calcOriginationFee } from '@/lib/hecm/calculations';

const ScenarioContext = createContext(null);

// Standard HECM fee line items (HUD line numbers)
// cost = total fee, poc = paid outside closing, borrower = cost - poc (auto-calc)
const DEFAULT_FEES = [
  { hudLine: '804', name: 'Appraisal fee', payee: '', cost: 675, poc: 675 },
  { hudLine: '805', name: 'Credit report', payee: 'CTI Credit Technology', cost: 144.40, poc: 0 },
  { hudLine: '807', name: 'Flood certification', payee: 'Platinum Data Solutions', cost: 5.50, poc: 0 },
  { hudLine: '808', name: 'Document preparation', payee: 'QuantumReverse', cost: 140, poc: 0 },
  { hudLine: '809', name: 'MERS registration', payee: '', cost: 24.95, poc: 0 },
  { hudLine: '810', name: 'Courier fee', payee: '', cost: 0, poc: 0 },
  { hudLine: '812', name: 'Tax verification fee', payee: 'Lereta, LLC', cost: 25, poc: 0 },
  { hudLine: '815', name: 'Trust review fee (Lender)', payee: '', cost: 0, poc: 0 },
  { hudLine: '1102', name: 'Settlement or closing fee', payee: 'Allegiant Reverse Services', cost: 595, poc: 0 },
  { hudLine: '1103', name: "Owner's title insurance", payee: '', cost: 0, poc: 0 },
  { hudLine: '1104', name: "Lender's title insurance", payee: 'Stewart Title', cost: 1350, poc: 0 },
  { hudLine: '1109', name: 'Tax certificate fee', payee: '', cost: 30, poc: 0 },
  { hudLine: '1110', name: 'Title endorsement fee', payee: '', cost: 20, poc: 0 },
  { hudLine: '1111', name: 'Overnight fee', payee: '', cost: 250, poc: 0 },
  { hudLine: '1112', name: 'Notary fees', payee: '', cost: 60, poc: 0 },
  { hudLine: '1113', name: 'Recording service', payee: '', cost: 35, poc: 0 },
  { hudLine: '1114', name: 'Release fee', payee: '', cost: 45, poc: 0 },
  { hudLine: '1115', name: 'Attorney review fee', payee: '', cost: 25, poc: 0 },
  { hudLine: '1202', name: 'Recording charges mortgage', payee: '', cost: 86, poc: 0 },
  { hudLine: '1204', name: 'City/County tax/stamps deed', payee: '', cost: 0, poc: 0 },
  { hudLine: '1303', name: 'Counseling fee', payee: '', cost: 175, poc: 175 },
];

const DEFAULT_STATE = {
  // Prospect
  todayDate: new Date().toISOString().slice(0, 10),
  reference_number: '',
  borrower_name: '',
  co_borrower_name: '',
  borrowerDOB: '',
  coBorrowerDOB: '',
  cellPhone: '',
  emailBorrower: '',
  emailCoBorrower: '',
  // Property
  address: '',
  city: '',
  state: '',
  zip: '',
  county: '',
  home_value: 0,
  previousAppraisal: 0,
  altContact: '',
  // Employment (for application section)
  employer: '',
  employerPhone: '',
  jobTitle: '',
  startDate: '',
  income: 0,
  assets: '',
  notes: '',
  // Property details
  yearBuilt: 0,
  purchaseDate: '',
  numInHouse: 0,
  sqft: 0,
  lotSize: 0,
  totalRooms: 0,
  bedrooms: 0,
  bathrooms: 0,
  garage: '',
  ac: '',
  water: '',
  sewer: '',
  homestead: '',
  zoning: '',
  propTax: 0,
  taxYear: 0,
  subdivision: '',
  legalDescription: '',
  // Refi
  isRefi: false,
  currentLender: '',
  loan_number: '',
  origMCA: 0,
  origMargin: 0,
  origMIP: 0,
  origExpectedRate: 0,
  origDate: '',
  currentPL: 0,
  current_balance: 0,
  currentPayoff: 0,
  origUFMIP: 0,
  // Rates & Costs
  oneYearCMT: 0,
  tenYearCMT: 0,
  mipRate: 0.50,
  fhaLimit: 1209750,
  existingLiens: 0,
  lenderCredit: 0,
  margins: [2.750, 2.500, 2.250],
  productTypes: ['cmtMonthlyCap5', 'cmtMonthlyCap5', 'cmtMonthlyCap5'],
  fixedRates: [0, 0, 0],
  origFee: 0,
  origFeeOverride: false,
  thirdPartyCosts: 0,
  fees: DEFAULT_FEES.map(f => ({ ...f })),
  // Application fields
  nbsName: '',
  nbsDOB: '',
  nbsRemainInHome: '',
  nbsOnTitle: '',
  counselingAgency: '',
  counselorName: '',
  counselingDate: '',
  counselingCertNumber: '',
  counselingMethod: '',
  propertyHeldIn: '',
  trustName: '',
  trustDate: '',
  trusteeName: '',
  poaOnFile: '',
  poaName: '',
  disbursementType: '',
  termLength: 0,
  combinationDetails: '',
  initialDrawAmount: 0,
  monthlyPropTax: 0,
  monthlyInsurance: 0,
  monthlyHOA: 0,
  monthlyFlood: 0,
  propTaxCurrent: '',
  insuranceCurrent: '',
  lesaRequired: '',
  lesaAmount: 0,
  ssnLast4Borrower: '',
  ssnLast4CoBorrower: '',
  maritalBorrower: '',
  maritalCoBorrower: '',
  citizenship: '',
  priorBankruptcy: '',
  bankruptcyDetails: '',
  priorForeclosure: '',
  foreclosureDate: '',
  outstandingJudgments: '',
  judgmentDetails: '',
  applicationNotes: '',
  checkCounseling: false,
  checkID: false,
  checkTrust: false,
  checkSSA: false,
  checkTaxBill: false,
  checkInsurance: false,
  checkMortgageStmt: false,
  checkPOA: false,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value };
    case 'SET_MARGIN': {
      const margins = [...state.margins];
      margins[action.index] = action.value;
      return { ...state, margins };
    }
    case 'SET_PRODUCT_TYPE': {
      const productTypes = [...state.productTypes];
      productTypes[action.index] = action.value;
      return { ...state, productTypes };
    }
    case 'SET_FIXED_RATE': {
      const fixedRates = [...state.fixedRates];
      fixedRates[action.index] = action.value;
      return { ...state, fixedRates };
    }
    case 'SET_FEE': {
      const fees = state.fees.map((f, i) =>
        i === action.index ? { ...f, [action.field]: action.value } : f
      );
      return { ...state, fees };
    }
    case 'ADD_FEE': {
      const fees = [...state.fees, { hudLine: '', name: '', payee: '', cost: 0, poc: 0 }];
      return { ...state, fees };
    }
    case 'REMOVE_FEE': {
      const fees = state.fees.filter((_, i) => i !== action.index);
      return { ...state, fees };
    }
    case 'LOAD_STATE':
      return { ...DEFAULT_STATE, ...action.state };
    case 'RESET':
      return { ...DEFAULT_STATE, fees: DEFAULT_FEES.map(f => ({ ...f })) };
    default:
      return state;
  }
}

export function ScenarioProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, DEFAULT_STATE);

  // Auto-calculate origination fee when home value changes (unless overridden)
  const origFeeCalc = useMemo(() => {
    if (state.origFeeOverride) return state.origFee;
    return state.home_value > 0 ? calcOriginationFee(state.home_value) : 0;
  }, [state.home_value, state.origFee, state.origFeeOverride]);

  // Auto-sum borrower-paid fees into thirdPartyCosts
  const feesTotal = useMemo(() => {
    return state.fees.reduce((sum, f) => sum + Math.max((f.cost || 0) - (f.poc || 0), 0), 0);
  }, [state.fees]);

  // Effective state with computed origFee and fee-derived thirdPartyCosts
  const effectiveState = useMemo(() => ({
    ...state,
    origFee: origFeeCalc,
    thirdPartyCosts: feesTotal,
  }), [state, origFeeCalc, feesTotal]);

  // Calculate all 3 scenarios on every state change
  const results = useMemo(() => {
    return calculateAllScenarios(effectiveState);
  }, [effectiveState]);

  const age = useMemo(() => {
    return getYoungestAge(state.borrowerDOB, state.coBorrowerDOB);
  }, [state.borrowerDOB, state.coBorrowerDOB]);

  const setField = useCallback((field, value) => {
    dispatch({ type: 'SET_FIELD', field, value });
  }, []);

  const setMargin = useCallback((index, value) => {
    dispatch({ type: 'SET_MARGIN', index, value });
  }, []);

  const setProductType = useCallback((index, value) => {
    dispatch({ type: 'SET_PRODUCT_TYPE', index, value });
  }, []);

  const setFixedRate = useCallback((index, value) => {
    dispatch({ type: 'SET_FIXED_RATE', index, value });
  }, []);

  const loadState = useCallback((savedState) => {
    dispatch({ type: 'LOAD_STATE', state: savedState });
  }, []);

  const resetState = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const setFee = useCallback((index, field, value) => {
    dispatch({ type: 'SET_FEE', index, field, value });
  }, []);

  const addFee = useCallback(() => {
    dispatch({ type: 'ADD_FEE' });
  }, []);

  const removeFee = useCallback((index) => {
    dispatch({ type: 'REMOVE_FEE', index });
  }, []);

  const value = useMemo(() => ({
    state: effectiveState,
    rawState: state,
    results,
    age,
    feesTotal,
    dispatch,
    setField,
    setMargin,
    setProductType,
    setFixedRate,
    setFee,
    addFee,
    removeFee,
    loadState,
    resetState,
  }), [effectiveState, state, results, age, feesTotal, setField, setMargin, setProductType, setFixedRate, setFee, addFee, removeFee, loadState, resetState]);

  return (
    <ScenarioContext.Provider value={value}>
      {children}
    </ScenarioContext.Provider>
  );
}

export function useScenario() {
  const ctx = useContext(ScenarioContext);
  if (!ctx) throw new Error('useScenario must be used within ScenarioProvider');
  return ctx;
}

export { DEFAULT_STATE, DEFAULT_FEES };
