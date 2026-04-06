// Initial Document List — auto-generated at application submission
// Based on what we know at intake: purpose, employment type, co-borrowers.
// These become Document records (status: 'requested') so the borrower
// sees them on their dashboard checklist immediately.

// ─── Base items everyone needs ──────────────────────────────
const UNIVERSAL = [
  { docType: 'ID', label: 'Government-issued photo ID (driver\'s license or passport)' },
  { docType: 'AST', label: 'Bank statements — most recent 2 months, all pages' },
];

// ─── Income by employment type ──────────────────────────────
const INCOME_W2 = [
  { docType: 'INC', label: 'W-2s — most recent 2 years' },
  { docType: 'INC', label: 'Pay stubs — most recent 30 days' },
];

const INCOME_SELF_EMPLOYED = [
  { docType: 'INC', label: 'Personal tax returns — most recent 2 years (all pages and schedules)' },
  { docType: 'INC', label: 'Business tax returns — most recent 2 years (all pages and schedules)' },
  { docType: 'INC', label: 'Year-to-date profit & loss statement' },
  { docType: 'INC', label: 'Business license or articles of organization' },
];

const INCOME_RETIRED = [
  { docType: 'INC', label: 'Social Security / pension award letter' },
  { docType: 'INC', label: 'Most recent tax return (if filing)' },
  { docType: 'AST', label: 'Retirement account statements — most recent 2 months' },
];

const INCOME_OTHER = [
  { docType: 'INC', label: 'Income documentation (varies — we\'ll confirm what\'s needed)' },
];

// ─── Purpose-specific ────────────────────────────────────────
const PURCHASE_ITEMS = [
  { docType: 'PUR', label: 'Fully executed purchase contract' },
  { docType: 'PUR', label: 'Earnest money deposit receipt' },
];

const REFINANCE_ITEMS = [
  { docType: 'DOC', label: 'Current mortgage statement' },
  { docType: 'HOI', label: 'Current homeowners insurance declarations page' },
];

/**
 * Build the initial document list for a new application.
 * @param {Object} scenario
 * @param {string} scenario.purpose — 'purchase' or 'refinance'
 * @param {string} scenario.employmentStatus — e.g. 'Employed (W-2)', 'Self-Employed (1099 / Business Owner)', 'Retired', etc.
 * @param {Array}  scenario.coBorrowers — array of { firstName, employmentStatus }
 * @returns {Array<{ docType: string, label: string, notes?: string }>}
 */
export function getInitialDocList({ purpose, employmentStatus, coBorrowers = [] }) {
  const items = [];

  // Universal items
  items.push(...UNIVERSAL);

  // Income docs based on employment
  items.push(...getIncomeItems(employmentStatus));

  // Purpose-specific
  if (purpose === 'purchase') {
    items.push(...PURCHASE_ITEMS);
  } else {
    items.push(...REFINANCE_ITEMS);
  }

  // Co-borrower docs
  for (const cb of coBorrowers) {
    if (!cb.firstName) continue;
    const name = cb.firstName;

    items.push({
      docType: 'ID',
      label: `${name} — Government-issued photo ID`,
    });

    const cbIncome = getIncomeItems(cb.employmentStatus);
    for (const inc of cbIncome) {
      items.push({
        docType: inc.docType,
        label: `${name} — ${inc.label}`,
      });
    }
  }

  return items;
}

function getIncomeItems(employmentStatus) {
  const status = (employmentStatus || '').toLowerCase();
  if (status.includes('self-employed') || status.includes('1099') || status.includes('business owner')) {
    return INCOME_SELF_EMPLOYED;
  }
  if (status.includes('retired')) {
    return INCOME_RETIRED;
  }
  if (status.includes('employed') || status.includes('w-2') || status.includes('w2')) {
    return INCOME_W2;
  }
  return INCOME_OTHER;
}
