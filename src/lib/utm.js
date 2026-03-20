// UTM Parameter Capture Utility
// Reads UTM parameters from the current URL query string.
// Used by all lead capture forms to pass marketing attribution to Zoho CRM.

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

/**
 * Read UTM parameters from the current page URL.
 * Returns an object with only non-empty UTM values.
 * Safe to call server-side (returns empty object).
 */
export function getUtmParams() {
  if (typeof window === 'undefined') return {};

  const params = new URLSearchParams(window.location.search);
  const utm = {};

  for (const key of UTM_KEYS) {
    const value = params.get(key);
    if (value) {
      utm[key] = value;
    }
  }

  return utm;
}

/**
 * Format UTM params into a readable string for Zoho CRM Description field.
 * Returns empty string if no UTM params present.
 * Example: "UTM: source=google, medium=cpc, campaign=co-refi-rates"
 */
export function formatUtmString(utmParams) {
  const entries = Object.entries(utmParams);
  if (entries.length === 0) return '';

  const parts = entries.map(([key, value]) => `${key.replace('utm_', '')}=${value}`);
  return `UTM: ${parts.join(', ')}`;
}
