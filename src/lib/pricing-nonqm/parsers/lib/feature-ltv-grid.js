/**
 * Generic feature × LTV grid extractor.
 *
 * Reads a block where each row is a feature/category label (loan_size,
 * dscr_ratio, property_type, prepay term, etc.) and the columns are
 * LTV bands. The caller supplies a `classify` function that turns a row's
 * label into structured rule fields (rule_type + dimension keys), or
 * returns null/undefined to skip the row.
 *
 * Used by:
 *   - ResiCentral's "Product Feature × LTV" block (§5.2 of inventory),
 *     which mixes DSCR ratio / UPB band / property type / prepay /
 *     misc features under one anchor.
 *   - Everstream's "Global LLPAs" block (after the D9c.6.3 refactor).
 */

import { cellStr, parseCell, isNa } from './cells.js';

/**
 * @callback ClassifyLabel
 * @param {string} label - the trimmed label string from `labelCol` (or the
 *   sub-label when `categoryCol` is set)
 * @param {Object} [ctx]
 * @param {string} [ctx.category] - present only when `categoryCol` is set;
 *   the most recent non-empty value seen in `categoryCol` (forward-fills
 *   across rows where the category cell is blank, per Elite/Select layout
 *   in inventory §10.6)
 * @returns {Object|null|undefined}
 *   Structured rule fields including `rule_type`. May include any of:
 *   property_type, loan_size_min/max, dscr_ratio_min/max, feature,
 *   doc_type, prepay_years, loan_purpose, occupancy. Return null to skip.
 */

/**
 * @typedef {Object} Band
 * @property {number} min
 * @property {number} max
 * @property {string} [label]
 */

/**
 * Extract a feature × LTV grid into rule rows.
 *
 * @param {Array<Array>} data
 * @param {number} startRow - first feature row (inclusive)
 * @param {number} endRow - one past the last row (exclusive)
 * @param {Band[]} ltvBands - column bands ordered left-to-right
 * @param {ClassifyLabel} classify
 * @param {Object} [opts]
 * @param {number} [opts.labelCol=0]
 * @param {number} [opts.startCol=1]
 * @param {number} [opts.categoryCol] - when set, the sheet uses a 2-col
 *   layout with a category column to the LEFT of `labelCol`. The category
 *   cell forward-fills: the most recent non-empty value applies to all
 *   subsequent rows until a new value appears. The classify callback
 *   receives `(subLabel, { category })`. The emitted `raw_label` is
 *   `"${category} / ${subLabel}"`. ResiCentral Elite uses col 3 = category,
 *   col 4 = sub-label; Select uses col 2 = category, col 3 = sub-label.
 *   Premier and Investor Premier omit this option (single-col labels).
 * @param {'cltv'|'ltv'} [opts.ltvKey='cltv']
 * @param {Object} [opts.baseFields] - merged into every emitted rule
 * @param {number} [opts.valueScale=1] - multiplier applied to every parsed
 *   `llpa_points` value before emit. ResiCentral stores LLPAs as decimal
 *   fractions of par; pass `valueScale: 100` to convert to points. Default
 *   is 1 (no change). Does not affect `not_offered` cells.
 * @returns {Array<Object>} rules ready for nonqm_adjustment_rules
 */
export function extractFeatureLtvGrid(data, startRow, endRow, ltvBands, classify, opts = {}) {
  const labelCol = opts.labelCol ?? 0;
  const startCol = opts.startCol ?? 1;
  const categoryCol = opts.categoryCol;       // undefined = single-col mode
  const ltvKey = opts.ltvKey ?? 'cltv';
  const baseFields = opts.baseFields ?? {};
  const valueScale = opts.valueScale ?? 1;
  const minKey = `${ltvKey}_min`;
  const maxKey = `${ltvKey}_max`;

  const rules = [];
  let activeCategory = null;       // forward-filled when categoryCol is set

  for (let r = startRow; r < endRow; r++) {
    const row = data[r];
    if (!row) continue;

    if (categoryCol !== undefined) {
      const cat = cellStr(row[categoryCol]);
      if (cat) activeCategory = cat;
    }

    const label = cellStr(row[labelCol]);
    if (!label) continue;

    const classified = categoryCol !== undefined
      ? classify(label, { category: activeCategory })
      : classify(label);
    if (!classified) continue;

    const rawLabel = categoryCol !== undefined && activeCategory
      ? `${activeCategory} / ${label}`
      : label;

    for (let j = 0; j < ltvBands.length; j++) {
      const rawVal = row[startCol + j];
      const num = parseCell(rawVal);
      if (num === null && !isNa(rawVal)) continue;
      const ltv = ltvBands[j];

      // Round to 6 decimals to clean up float artifacts from valueScale.
      const scaled = isNa(rawVal) ? null : Math.round(num * valueScale * 1_000_000) / 1_000_000;
      rules.push({
        ...baseFields,
        ...classified,
        [minKey]: ltv.min,
        [maxKey]: ltv.max,
        llpa_points: scaled,
        not_offered: isNa(rawVal),
        raw_label: rawLabel,
      });
    }
  }

  return rules;
}
