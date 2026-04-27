/**
 * Parse a rate-sheet effective date from various sources.
 *
 * ResiCentral encodes the effective date in the workbook filename
 * delivered via GCS:
 *
 *   `67370_04242026_1128199760.xlsx` → 2026-04-24
 *
 * Pattern: `<lender_id>_<MMDDYYYY>_<seq>.xlsx`. The MMDDYYYY token is
 * extracted by regex; we don't trust the lender_id prefix to be a fixed
 * length across vendors.
 *
 * Everstream embeds its effective date in sheet metadata (handled by
 * that parser directly); this module is the filename-first helper.
 */

/**
 * Parse the effective date from a ResiCentral-style filename.
 *
 * @param {string} filename
 * @returns {Date|null} UTC midnight on the parsed date, or null
 */
export function parseEffectiveDateFromFilename(filename) {
  if (!filename) return null;
  const m = String(filename).match(/(\d{2})(\d{2})(\d{4})/);
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  const year = Number(m[3]);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  if (year < 2000 || year > 2100) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return null;
  }
  return d;
}
