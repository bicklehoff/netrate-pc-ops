// State-level third-party closing cost estimates
// Title, escrow, appraisal, recording, etc.
// These are ESTIMATES — actual fees vary by county, title company, and loan amount.
// Excludes lender fees (those come from rateData.lender.lenderFees).

export const STATE_DEFAULTS = {
  CO: { label: 'Colorado', thirdPartyCosts: 2800 },
  TX: { label: 'Texas', thirdPartyCosts: 3200 },
  OR: { label: 'Oregon', thirdPartyCosts: 2600 },
  CA: { label: 'California', thirdPartyCosts: 3500 },
};

export const DEFAULT_STATE = 'CO';

export function getThirdPartyCosts(stateCode) {
  return STATE_DEFAULTS[stateCode]?.thirdPartyCosts ?? STATE_DEFAULTS[DEFAULT_STATE].thirdPartyCosts;
}
