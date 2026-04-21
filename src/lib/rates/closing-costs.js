// State-level third-party closing cost estimates — CLIENT DISPLAY MIRROR.
// Title, escrow, appraisal, recording, etc. ESTIMATES — actual fees vary
// by county, title company, and loan amount. Excludes lender fees (those
// come from rateData.lender.lenderFees).
//
// ─── Role after D9d migration 024 (2026-04-22) ──────────────────────
// Server code reads third-party costs from ref_state_closing_costs via
// src/lib/rates/ref-state-closing-costs.js — that is the source of
// truth. This file exists for synchronous client-side UX: RateTool's
// initial form state (set inside a useState initializer) and the state
// dropdown labels in ScenarioForm. A round-trip to the DAL for the
// initial render would add a spinner/flash for no correctness benefit.
//
// Drift between this mirror and the DB is prevented by
// scripts/check-state-closing-costs-parity.mjs. Update BOTH when
// refreshing state cost baselines.
//
// Do not import from this file in server-side pricing or fee code.

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
