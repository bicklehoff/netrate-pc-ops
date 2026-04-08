// Normalize phone numbers to E.164 format (+1XXXXXXXXXX for US)
// Used everywhere a phone number enters or is looked up in the system
// to prevent duplicate contacts from format mismatches.

/**
 * Normalize a phone string to E.164 format.
 * Returns null if the input can't be parsed as a valid US phone number.
 *
 * Examples:
 *   '(303) 444-5251'  → '+13034445251'
 *   '303-444-5251'    → '+13034445251'
 *   '3034445251'      → '+13034445251'
 *   '13034445251'     → '+13034445251'
 *   '+13034445251'    → '+13034445251'
 *   ''                → null
 *   null              → null
 */
export function normalizePhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits[0] === '1') return `+${digits}`;
  // Already has country code or non-US — return as-is with + prefix
  if (digits.length > 11) return `+${digits}`;
  return null; // Too short to be a valid number
}

/**
 * Normalize for lookup — returns the normalized phone, or the original
 * string if normalization fails (so partial searches still work).
 */
export function normalizePhoneForLookup(raw) {
  return normalizePhone(raw) || raw;
}
