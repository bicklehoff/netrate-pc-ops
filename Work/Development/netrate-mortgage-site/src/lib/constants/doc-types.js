// Document Naming Protocol — 3-letter prefix system
// Pattern: PREFIX-SUBTYPE-IDENTIFIER-DATE
// Examples: INC-W2-JOHN-2024, AST-CHASE-4752-08.01.2025, TTL-COMMITMENT-123MAIN-03.12.2026
//
// Same taxonomy used for both document labels and condition types.

export const DOC_PREFIXES = {
  APP: { label: 'Appraisal', description: 'Appraisal reports, waivers, rebuttals', defaultFolder: 'FLOOR' },
  AST: { label: 'Assets', description: 'Bank statements, retirement, brokerage, gift letters', defaultFolder: 'FLOOR' },
  CRD: { label: 'Credit', description: 'Credit reports, supplements, inquiries', defaultFolder: 'FLOOR' },
  DOC: { label: 'Disclosures', description: 'CD, LE, note, deed of trust, SSA-89 (outbound)', defaultFolder: 'CLOSING' },
  HOI: { label: 'Insurance', description: 'Homeowner insurance binders, dec pages, flood certs', defaultFolder: 'FLOOR' },
  INC: { label: 'Income', description: 'W-2s, paystubs, 1099s, tax returns, VOE, P&L', defaultFolder: 'FLOOR' },
  INV: { label: 'Invoice', description: 'Appraisal fees, credit fees, other charges', defaultFolder: 'EXTRA' },
  LND: { label: 'Land', description: 'Tax certs, assessor printouts, DataTree, REO details', defaultFolder: 'EXTRA' },
  LOE: { label: 'Letter of Explanation', description: 'Employment gaps, credit inquiries, large deposits', defaultFolder: 'FLOOR' },
  PUR: { label: 'Purchase', description: 'Purchase contract, addendums, amendments', defaultFolder: 'FLOOR' },
  TTL: { label: 'Title', description: 'Title commitment, prelim, CPL, payoffs, liens', defaultFolder: 'FLOOR' },
};

// Subtypes per prefix — used by Claude API to classify documents
export const DOC_SUBTYPES = {
  APP: ['FULL', 'DESKTOP', 'WAIVER', 'REBUTTAL', 'RECERT', 'INVOICE'],
  AST: ['BANK-STMT', 'RETIREMENT', 'BROKERAGE', 'GIFT-LETTER', 'EARNEST-MONEY', 'VOD'],
  CRD: ['REPORT', 'SUPPLEMENT', 'STATEMENT', 'LOE'],
  DOC: ['CD', 'LE', 'NOTE', 'DEED-OF-TRUST', 'SSA-89', 'VOD', 'INITIAL-DISCLOSURES'],
  HOI: ['BINDER', 'DEC-PAGE', 'QUOTE', 'FLOOD-CERT', 'CONDO-MASTER'],
  INC: ['W2', 'PAYSTUB', '1099', 'TAX-RETURN', 'AWARD-LETTER', 'VOE', 'P-AND-L', 'PENSION', 'SSA'],
  INV: ['APPRAISAL-FEE', 'CREDIT-FEE', 'OTHER'],
  LND: ['TAX-CERT', 'ASSESSOR', 'DATATREE', 'LEGAL-DESC', 'CONDO-CERT', 'HOA-QUESTIONNAIRE', 'REO'],
  LOE: ['GENERAL', 'CREDIT', 'INCOME', 'GAP', 'LARGE-DEPOSIT', 'ADDRESS'],
  PUR: ['CONTRACT', 'ADDENDUM', 'AMENDMENT', 'EARNEST-RECEIPT', 'COUNTER'],
  TTL: ['COMMITMENT', 'PRELIM', 'CPL', 'VESTING-DEED', 'SURVEY', 'PAYOFF', 'LIEN-RELEASE'],
};

// Map condition types (from Condition model) to doc prefixes
export const CONDITION_TO_PREFIX = {
  appraisal: 'APP',
  income: 'INC',
  credit: 'CRD',
  title: 'TTL',
  hoi: 'HOI',
  purchase: 'PUR',
  doc: 'DOC',
  land: 'LND',
  loe: 'LOE',
  investment: 'AST',
  client: null,   // Client conditions are general — no specific prefix
  realtor: null,  // Realtor conditions are general
  lender: null,   // Lender conditions vary
};

// Reverse: prefix → condition type
export const PREFIX_TO_CONDITION = {
  APP: 'appraisal',
  AST: 'investment',
  CRD: 'credit',
  DOC: 'doc',
  HOI: 'hoi',
  INC: 'income',
  INV: null,       // Invoices don't map to conditions
  LND: 'land',
  LOE: 'loe',
  PUR: 'purchase',
  TTL: 'title',
};

/**
 * Build a standardized document filename from parts.
 * @param {string} prefix — 3-letter prefix (INC, AST, etc.)
 * @param {string} subtype — document subtype (W2, BANK-STMT, etc.)
 * @param {string} [identifier] — person name, account last 4, property ref
 * @param {string} [date] — relevant date (2024, 08.01.2025, etc.)
 * @param {string} [extension] — file extension (default: pdf)
 * @returns {string} — formatted filename
 */
export function buildDocName(prefix, subtype, identifier, date, extension = 'pdf') {
  const parts = [prefix, subtype, identifier, date].filter(Boolean);
  return `${parts.join('-')}.${extension}`;
}

/**
 * Parse a standardized filename back to its parts.
 * @param {string} filename — e.g. "INC-W2-JOHN-2024.pdf"
 * @returns {object|null} — { prefix, subtype, identifier, date, extension, category } or null if not parseable
 */
export function parseDocName(filename) {
  if (!filename) return null;

  // Split extension
  const dotIdx = filename.lastIndexOf('.');
  const extension = dotIdx > 0 ? filename.slice(dotIdx + 1).toLowerCase() : null;
  const nameOnly = dotIdx > 0 ? filename.slice(0, dotIdx) : filename;

  const parts = nameOnly.split('-');
  if (parts.length < 2) return null;

  const prefix = parts[0].toUpperCase();
  if (!DOC_PREFIXES[prefix]) return null;

  return {
    prefix,
    subtype: parts[1] || null,
    identifier: parts.length > 3 ? parts.slice(2, -1).join('-') : (parts[2] || null),
    date: parts.length > 3 ? parts[parts.length - 1] : null,
    extension,
    category: DOC_PREFIXES[prefix],
  };
}

/**
 * Check if a filename follows the naming protocol.
 * @param {string} filename
 * @returns {boolean}
 */
export function isNamedDoc(filename) {
  return parseDocName(filename) !== null;
}

// All valid prefixes as an array
export const ALL_PREFIXES = Object.keys(DOC_PREFIXES);
