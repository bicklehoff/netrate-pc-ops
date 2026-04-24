/**
 * Picklists — constants-driven enums for form controls that map to URLA
 * fields or fixed option sets.
 *
 * USE THIS MODULE instead of hardcoding these arrays per-form. Consolidates
 * Pass 6 MLO-2/MLO-3 findings where QuoteScenarioForm, leads/[id]/page,
 * RateAlertForm, etc. each had their own slightly-divergent copies.
 *
 * DB-driven picklists (STATES, LOAN_TYPES) live in ref_licensed_states +
 * ref_loan_types and are loaded via src/lib/picklists/db-loader.js.
 *
 * Canonical values resolved by DB audit 2026-04-20 (see D7 audit doc §8
 * PR D7-3). Summary:
 *   - loan_purpose 'cashout' wins over 'cash_out' (0 rows persist either
 *     today; code convention wins; QuoteScenarioForm + QuoteWizard already
 *     write 'cashout')
 *   - property_type canonical is pricing-native ('sfr'/'condo'/'townhome'/
 *     'pud'/'multi_unit'/'manufactured') — see audit doc for the
 *     unification story. Migration 015 normalized loans.property_type
 *     to this vocab.
 *   - occupancy 'secondary' canonical; legacy 'primary_residence' (1)
 *     and form-level 'second_home' migrated to the canonical code
 */

// Loan purpose — 3-level URLA hierarchy (see vocab audit 2026-04-20).
//
// LOAN_PURPOSES — top-level, used for pricing scenarios (flat 3-value enum)
// and loans.purpose (flat 2-value enum, cashout bucket empty at level 1).
// Scenarios keep cashout as a top-level value for LLPA-grid lookup.
export const LOAN_PURPOSES = [
  { value: 'purchase',  label: 'Purchase' },
  { value: 'refinance', label: 'Rate/Term Refi' },
  { value: 'cashout',   label: 'Cash-Out Refi' },
];

// REFI_PURPOSES — URLA level 2. Only populated when loans.purpose='refinance'.
// 'limited' is a small cashout refi that doesn't trip cashout LLPAs.
// 'streamline' pairs with loan_type='fha' (FHA Streamline) or 'va' (IRRRL).
export const REFI_PURPOSES = [
  { value: 'rate_term',  label: 'Rate/Term' },
  { value: 'limited',    label: 'Limited Cash-Out' },
  { value: 'cashout',    label: 'Cash-Out' },
  { value: 'streamline', label: 'Streamline' },
];

// CASHOUT_REASONS — URLA level 3. Only populated when refi_purpose='cashout'.
export const CASHOUT_REASONS = [
  { value: 'debt_consolidation', label: 'Debt Consolidation' },
  { value: 'home_improvement',   label: 'Home Improvement' },
  { value: 'other',              label: 'Other' },
];

// Property type — loans.property_type + scenarios.property_type.
// Canonical: pricing-native. Rate sheet parsers emit this vocab; ZOD
// application validator enforces it; MISMO + MCR exporters translate
// from it. Per Work/Dev/audits/SCENARIO-VOCABULARY-AUDIT-2026-04-20.md.
export const PROPERTY_TYPES = [
  { value: 'sfr',          label: 'Single Family' },
  { value: 'condo',        label: 'Condo' },
  { value: 'townhome',     label: 'Townhome' },
  { value: 'pud',          label: 'PUD' },
  { value: 'multi_unit',   label: '2-4 Unit' },
  { value: 'manufactured', label: 'Manufactured' },
];

// Occupancy — loans.occupancy + scenarios.occupancy.
// Canonical codes match dominant DB values: primary (688 loans),
// investment (83), secondary (5). Legacy 'primary_residence' + form-level
// 'second_home' consolidate to these.
export const OCCUPANCY = [
  { value: 'primary',    label: 'Primary Residence' },
  { value: 'secondary',  label: 'Second Home' },
  { value: 'investment', label: 'Investment' },
];

// Loan terms in years — scenarios.term + loans.loan_term.
export const TERMS = [30, 25, 20, 15];

// Rate lock window in days — scenarios.lock_days.
export const LOCK_DAYS = [15, 30, 45, 60];

// Helper — look up a { value, label } in any picklist, for rendering
// back from a stored code. Returns null if not found.
export function findPicklistEntry(list, value) {
  if (!value) return null;
  return list.find((item) => item.value === value) || null;
}
