/**
 * Generic FICO × (C)LTV grid extractor.
 *
 * Reads a rectangular block of LLPAs (or price caps) keyed by FICO band
 * × LTV/CLTV band. The caller supplies the band arrays, the anchor row
 * (first FICO band row), the starting column (first LTV column), and any
 * baseFields to merge into every emitted rule.
 *
 * Block layout assumed by this util:
 *
 *   col → startCol     startCol+1     ...     startCol+ltv.length-1
 *   row
 *   anchor   ┌────────┬────────┬───────┬────────────────────┐
 *            │ fico[0]/ltv[0] │ ... │ fico[0]/ltv[N-1]   │
 *   anchor+1 │ fico[1]/ltv[0] │ ... │ fico[1]/ltv[N-1]   │
 *   ...      │  ...           │     │                     │
 *   a+M-1    │ fico[M-1]/ltv[0]│... │ fico[M-1]/ltv[N-1] │
 *            └────────┴────────┴───────┴────────────────────┘
 *
 * Used by every DSCR parser (Everstream's per-section grids; ResiCentral's
 * §5.1 single grid per program — see RESICENTRAL-LLPA-INVENTORY-2026-04-27).
 */

import { parseCell, isNa } from './cells.js';

/**
 * @typedef {Object} Band
 * @property {number} min
 * @property {number} max
 * @property {string} [label]
 */

/**
 * Extract a FICO×LTV grid into rule rows.
 *
 * @param {Array<Array>} data - sheet rows
 * @param {number} anchorRow - first FICO band row (0-based)
 * @param {{fico: Band[], ltv: Band[]}} bands - row + column band definitions
 * @param {Object} [opts]
 * @param {number} [opts.startCol=1] - first LTV data column
 * @param {string} [opts.payloadField='llpa_points'] - which numeric field to populate
 * @param {string} [opts.ruleType='fico_cltv_grid']
 * @param {'cltv'|'ltv'} [opts.ltvKey='cltv'] - controls min/max key prefix on output
 * @param {Object} [opts.baseFields] - merged into every emitted rule
 *   (e.g. lender_code, tier, product_type, occupancy, loan_purpose)
 * @returns {Array<Object>} rules ready for nonqm_adjustment_rules
 */
export function extractFicoLtvGrid(data, anchorRow, bands, opts = {}) {
  const startCol = opts.startCol ?? 1;
  const payloadField = opts.payloadField ?? 'llpa_points';
  const ruleType = opts.ruleType ?? 'fico_cltv_grid';
  const ltvKey = opts.ltvKey ?? 'cltv';
  const baseFields = opts.baseFields ?? {};
  const minKey = `${ltvKey}_min`;
  const maxKey = `${ltvKey}_max`;

  const rules = [];

  for (let i = 0; i < bands.fico.length; i++) {
    const row = data[anchorRow + i];
    if (!row) continue;
    const fico = bands.fico[i];

    for (let j = 0; j < bands.ltv.length; j++) {
      const rawVal = row[startCol + j];
      const num = parseCell(rawVal);
      if (num === null && !isNa(rawVal)) continue;
      const ltv = bands.ltv[j];

      const rule = {
        ...baseFields,
        rule_type: ruleType,
        fico_min: fico.min,
        fico_max: fico.max,
        [minKey]: ltv.min,
        [maxKey]: ltv.max,
        not_offered: isNa(rawVal),
      };
      if (!isNa(rawVal)) rule[payloadField] = num;
      rules.push(rule);
    }
  }

  return rules;
}
