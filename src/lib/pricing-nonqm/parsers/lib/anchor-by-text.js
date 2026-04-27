/**
 * Anchor parser extraction at text markers instead of fixed row indices.
 *
 * Per RESICENTRAL-LLPA-INVENTORY-2026-04-27.md §6: row indices shift across
 * programs (e.g. Premier's FICO grid starts row 16; Select's at row 14).
 * Anchoring by markers like "FICO Score" / "Max Price" / "Misc Adjustments"
 * is robust to those shifts AND to minor revisions of the source workbook.
 */

import { cellStr } from './cells.js';

/**
 * Find the first row in [startRow, endRow) where `data[i][col]` matches
 * `regex`. Returns the row index, or -1 if no match.
 *
 * @param {Array<Array>} data - 2D array (rows × cols) from XLSX.sheet_to_json
 * @param {number} col - column index (0-based)
 * @param {RegExp} regex
 * @param {Object} [opts]
 * @param {number} [opts.startRow=0]
 * @param {number} [opts.endRow] - defaults to data.length
 * @returns {number}
 */
export function findRowByTextInCol(data, col, regex, opts = {}) {
  const startRow = opts.startRow ?? 0;
  const endRow = opts.endRow ?? data.length;
  for (let i = startRow; i < endRow; i++) {
    const v = cellStr(data[i]?.[col]);
    if (v && regex.test(v)) return i;
  }
  return -1;
}

/**
 * Find the first cell in [startRow, endRow) — across ALL columns — whose
 * text matches `regex`. Returns `{ row, col }` or null.
 *
 * Useful when the marker can land in different columns across programs
 * (anchor unstable on column axis, stable on text content).
 *
 * @param {Array<Array>} data
 * @param {RegExp} regex
 * @param {Object} [opts]
 * @param {number} [opts.startRow=0]
 * @param {number} [opts.endRow]
 * @returns {{row: number, col: number}|null}
 */
export function findCellByText(data, regex, opts = {}) {
  const startRow = opts.startRow ?? 0;
  const endRow = opts.endRow ?? data.length;
  for (let i = startRow; i < endRow; i++) {
    const row = data[i];
    if (!row) continue;
    for (let j = 0; j < row.length; j++) {
      const v = cellStr(row[j]);
      if (v && regex.test(v)) return { row: i, col: j };
    }
  }
  return null;
}
