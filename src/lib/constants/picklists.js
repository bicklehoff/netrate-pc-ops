/**
 * Picklists — constants-driven enums for form controls that map to URLA
 * fields or fixed option sets.
 *
 * USE THIS MODULE instead of hardcoding these arrays per-form. Consolidates
 * Pass 6 MLO-2/MLO-3 findings where QuoteScenarioForm, leads/[id]/page,
 * StrikeRateForm, etc. each had their own slightly-divergent copies.
 *
 * DB-driven picklists (STATES, LOAN_TYPES) live in ref_licensed_states +
 * ref_loan_types and are loaded via src/lib/picklists/db-loader.js.
 *
 * Canonical values resolved by DB audit 2026-04-20 (see D7 audit doc §8
 * PR D7-3). Summary:
 *   - loan_purpose 'cashout' wins over 'cash_out' (0 rows persist either
 *     today; code convention wins; QuoteScenarioForm + QuoteWizard already
 *     write 'cashout')
 *   - property_type 'single_family' canonical; legacy 'sfr' (2 loans) +
 *     'SFH-Detached' (11) + 'sitebuilt' (6) left as-is pending cleanup
 *   - occupancy 'secondary' canonical; legacy 'primary_residence' (1)
 *     and form-level 'second_home' migrated to the canonical code
 */

// Loan purpose — scenarios.loan_purpose enum.
// Lead detail page extends this with heloc / reverse entries pending a
// separate UX split (purpose vs loan_type conflation). Tracked as open item.
export const LOAN_PURPOSES = [
  { value: 'purchase',  label: 'Purchase' },
  { value: 'refinance', label: 'Rate/Term Refi' },
  { value: 'cashout',   label: 'Cash-Out Refi' },
];

// Property type — loans.property_type + scenarios.property_type.
// Canonical set; legacy rows in loans (SFH-Detached, sitebuilt, sfr, Condo)
// are mapped via src/lib/picklists/aliases.js if a UI needs to render
// back-compat labels; not included here.
export const PROPERTY_TYPES = [
  { value: 'single_family', label: 'Single Family' },
  { value: 'condo',         label: 'Condo' },
  { value: 'townhome',      label: 'Townhome' },
  { value: 'pud',           label: 'PUD' },
  { value: '2-4unit',       label: '2-4 Unit' },
  { value: 'manufactured',  label: 'Manufactured' },
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
