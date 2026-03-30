// Loan Types — maps to CORE's Loan_Type picklist
// Used for Loan.loanType field, condition templates, checklists

export const LOAN_TYPES = {
  CONVENTIONAL: 'conventional',
  FHA: 'fha',
  VA: 'va',
  USDA: 'usda',
  HECM: 'hecm',
  DSCR: 'dscr',
  OTHER: 'other',
};

export const LOAN_TYPE_LABELS = {
  conventional: 'Conventional',
  fha: 'FHA',
  va: 'VA',
  usda: 'USDA Rural',
  hecm: 'HECM (Reverse)',
  dscr: 'DSCR',
  other: 'Other',
};

export const LOAN_TERMS = {
  THIRTY_YEAR: 360,
  TWENTY_YEAR: 240,
  FIFTEEN_YEAR: 180,
};

export const LOAN_TERM_LABELS = {
  360: '30 Year Fixed',
  240: '20 Year Fixed',
  180: '15 Year Fixed',
};

export const LOAN_PURPOSES = {
  PURCHASE: 'purchase',
  REFINANCE: 'refinance',
  CASH_OUT: 'cash_out',
  // Future: construction, const_perm, heloc
};
