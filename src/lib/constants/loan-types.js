// Loan-type code lookups — label maps for rendering persisted codes
// back to their display names. Picklists/dropdowns live in
// src/lib/constants/picklists.js (constants-driven) + ref_loan_types
// (DB-driven, via src/lib/picklists/db-loader.js). Codes here stay in
// sync with ref_loan_types.code / ref_loan_types.display_label.

export const LOAN_TYPES = {
  CONVENTIONAL: 'conventional',
  FHA: 'fha',
  VA: 'va',
  USDA: 'usda',
  JUMBO: 'jumbo',
  DSCR: 'dscr',
  BANKSTATEMENT: 'bankstatement',
  HELOC: 'heloc',
  HECM: 'hecm',
  OTHER: 'other',
};

export const LOAN_TYPE_LABELS = {
  conventional: 'Conventional',
  fha: 'FHA',
  va: 'VA',
  usda: 'USDA',
  jumbo: 'Jumbo',
  dscr: 'DSCR',
  bankstatement: 'Bank Statement',
  heloc: 'HELOC',
  hecm: 'HECM (Reverse)',
  other: 'Other',
};

export const LOAN_TERMS = {
  THIRTY_YEAR: 360,
  TWENTY_FIVE_YEAR: 300,
  TWENTY_YEAR: 240,
  FIFTEEN_YEAR: 180,
};

export const LOAN_TERM_LABELS = {
  360: '30 Year Fixed',
  300: '25 Year Fixed',
  240: '20 Year Fixed',
  180: '15 Year Fixed',
};

// Note: canonical loan_purpose picklist lives in src/lib/constants/picklists.js
// (LOAN_PURPOSES array of { value, label }). This map is retained for any
// future code-only lookups but is not currently imported.
export const LOAN_PURPOSES = {
  PURCHASE: 'purchase',
  REFINANCE: 'refinance',
  CASHOUT: 'cashout',
};
