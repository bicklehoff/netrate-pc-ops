// Broker compensation split — one source of truth for the house-fee rate
// and the gross-to-LO-comp calculation.
//
// Prior to this module, HOUSE_FEE_RATE was hardcoded in two separate
// component files (PayrollSection and CompensationSection) with the
// comp-split math inlined in each. A change to comp policy that updated
// only one file would silently pay LOs the wrong amount.
//
// Change this rate ONLY when broker comp policy changes. The number is
// not scraped from a lender sheet — it's a NetRate internal policy.

/**
 * House fee rate as a decimal. 12.948857% of gross broker compensation
 * is retained as the house fee; the remainder is paid to the LO.
 */
export const HOUSE_FEE_RATE = 0.12948857;

/**
 * Split a gross broker comp amount into house fee + LO comp.
 * @param {number} gross — gross broker compensation (from CD or tracker)
 * @returns {{ gross: number, houseFee: number, loComp: number }} — all dollars
 *   If gross is null/undefined/non-finite, returns houseFee: null, loComp: null
 *   so callers can distinguish "no data" from "zero comp."
 */
export function splitCompensation(gross) {
  const g = Number(gross);
  if (!Number.isFinite(g)) {
    return { gross: null, houseFee: null, loComp: null };
  }
  const houseFee = g * HOUSE_FEE_RATE;
  const loComp = g - houseFee;
  return { gross: g, houseFee, loComp };
}
