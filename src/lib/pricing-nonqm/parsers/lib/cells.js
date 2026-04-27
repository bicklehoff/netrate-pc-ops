/**
 * Cell-level helpers shared by every NonQM rate-sheet parser.
 *
 * Pure, side-effect-free coercion + parsing primitives. Behavior matches
 * the original implementation embedded in `everstream-llpas.js` so the
 * D9c.6.3 refactor can swap-in these helpers with byte-identical output.
 */

/**
 * Coerce a cell value to a trimmed string. null/undefined → ''.
 * Numbers stringify normally (0 → '0', NaN → 'NaN').
 */
export function cellStr(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

/**
 * True iff the cell text is "NA" or "N/A" (case-insensitive, trimmed).
 * Lenders are inconsistent: Everstream + ResiCentral Premier/Elite/Select
 * use bare "NA"; ResiCentral Investor Premier uses "N/A". Both encode the
 * same "not offered" semantic, so we accept either form. "n.a.", "n a",
 * etc. still return false.
 */
export function isNa(v) {
  if (v === null || v === undefined) return false;
  return /^n\/?a$/i.test(String(v).trim());
}

/**
 * Parse a cell value as a number. Returns null for null / undefined /
 * empty / "NA" / non-numeric strings / non-finite numbers.
 */
export function parseCell(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (!s || isNa(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
