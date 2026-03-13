// GA4 Custom Event Helpers — fire gtag events for conversion tracking
// GA4 property: G-QPEE5ZSZ79
//
// Events:
//   lead_form_submit       — any lead form successfully submitted (Google Ads conversion)
//   rate_tool_interaction   — user changes scenario inputs
//   get_this_rate_click     — user clicks "Get This Rate" (future)
//   rate_tool_page_engagement — user spends 30+ seconds on /rates

/**
 * Safe gtag wrapper — no-op if gtag isn't loaded.
 */
function gtag(...args) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag(...args);
  }
}

/**
 * Fire when a lead form is successfully submitted.
 * This is the primary Google Ads conversion event.
 *
 * @param {string} formName — 'contact' | 'get_this_rate' | 'quote_request'
 * @param {string} [leadSource] — e.g. 'Contact Form', 'Rate Tool - Selected Rate'
 */
export function trackLeadFormSubmit(formName, leadSource) {
  gtag('event', 'lead_form_submit', {
    form_name: formName,
    lead_source: leadSource || formName,
  });
}

/**
 * Fire when user changes scenario inputs in the rate tool.
 * Debounce at the call site — don't fire on every keystroke.
 *
 * @param {object} scenario — { purpose, fico, loanAmount, propertyValue, ltv, state }
 */
export function trackRateToolInteraction(scenario) {
  gtag('event', 'rate_tool_interaction', {
    action: 'scenario_change',
    loan_purpose: scenario?.purpose || '',
    credit_score: scenario?.fico || '',
    loan_amount: scenario?.loanAmount || '',
  });
}

/**
 * Fire when user clicks "Get This Rate" button.
 *
 * @param {object} params — { rate, loanType, lender }
 */
export function trackGetThisRateClick({ rate, loanType, lender }) {
  gtag('event', 'get_this_rate_click', {
    rate: rate || '',
    loan_type: loanType || '',
    lender: lender || '',
  });
}

/**
 * Start a 30-second engagement timer for the /rates page.
 * Call once on mount. Returns a cleanup function to clear the timer.
 *
 * @returns {function} cleanup — call on unmount
 */
export function startEngagementTimer() {
  const timer = setTimeout(() => {
    gtag('event', 'rate_tool_page_engagement', {
      time_on_page: 30,
    });
  }, 30000);

  return () => clearTimeout(timer);
}
