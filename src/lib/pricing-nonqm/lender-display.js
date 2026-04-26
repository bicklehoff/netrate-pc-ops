/**
 * Static lookup for DSCR-product lenders.
 *
 * Per Work/Dev/PRICING-ARCHITECTURE.md §10 AD-5 + AD-7:
 *   - displayName    — UI-facing label (e.g. "EverStream"); overrides
 *                      lender_code as the display string in tables, badges.
 *   - licensedStates — 2-letter codes this lender lends in. The DSCR
 *                      pricer skips a lender entirely when scenario.state
 *                      isn't in this list, before doing any LLPA work.
 *
 * NetRate is licensed in CA, CO, OR, TX (per CLAUDE.md). A lender's
 * licensedStates is the intersection of their licensing with our coverage
 * — adding a state here does not make NetRate licensed there.
 *
 * To add a new lender: append a new key to LENDER_INFO. The multi-lender
 * loader picks it up automatically once an active DSCR sheet exists for
 * that lender_code in nonqm_rate_sheets.
 */

export const LENDER_INFO = {
  everstream: {
    displayName: 'EverStream',
    licensedStates: ['CA', 'CO', 'OR', 'TX'],
  },
};

export function getLenderDisplay(lender_code) {
  return LENDER_INFO[lender_code]?.displayName ?? lender_code;
}

export function isLicensedInState(lender_code, state) {
  const info = LENDER_INFO[lender_code];
  if (!info || !state) return false;
  return info.licensedStates.includes(String(state).toUpperCase());
}

export function knownLenderCodes() {
  return Object.keys(LENDER_INFO);
}
