/**
 * Calculator module services — the impure-operation surface the framework
 * mediates between modules and the world.
 *
 * Modules declare capabilities (needsRates, needsToday, etc.) and the
 * orchestrator (orchestrator.js) injects the matching service functions.
 * Modules never import these directly — they receive them as the second
 * arg to compute(). This is the inversion that lets us swap "live"
 * services for "frozen" services at quote-send time, which in turn
 * lets a sent quote re-render with stable inputs.
 *
 * Add a new service when a module needs a new kind of impure data
 * source. Keep each service single-purpose; orchestrator decides what
 * to inject based on capability flags.
 *
 * Spec: Work/Dev/AD-11A-CALCULATOR-MODULE-REGISTRY.md §4
 */

/**
 * Live rate fetch — wraps POST /api/pricing for use by rate-pulling
 * modules (purchase calculator, refinance calculator, second-lien
 * comparison, DSCR). The shape mirrors what those calcs already pass
 * today; module migrations just delegate to this instead of inlining
 * the fetch.
 *
 * Returns the parsed JSON response or throws on non-2xx. Modules can
 * surface a soft warning in result.warnings[] if rates are unavailable
 * rather than letting compute throw, depending on their UX needs.
 *
 * @param {Object} input
 * @param {number} input.loanAmount
 * @param {string} input.loanPurpose       - 'purchase' | 'refinance' | 'cashout'
 * @param {string} [input.loanType]        - 'conventional' (default) | 'fha' | 'va' | 'usda' | 'jumbo'
 * @param {number} input.creditScore
 * @param {number} [input.propertyValue]
 * @param {string} input.state
 * @param {string} [input.county]
 * @param {number} [input.term]            - 30 default
 * @param {string} [input.productType]     - 'fixed' default
 * @param {number} [input.lockDays]        - 30 default
 * @param {AbortSignal} [input.signal]     - For useCompute hook cancellation.
 * @returns {Promise<{results: Array, effectiveDate: string|null, parRow?: Object|null}>}
 */
export async function fetchRatesLive(input) {
  const { signal, ...body } = input;
  const res = await fetch('/api/pricing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      loanAmount: body.loanAmount,
      loanPurpose: body.loanPurpose,
      loanType: body.loanType || 'conventional',
      creditScore: body.creditScore,
      propertyValue: body.propertyValue ?? null,
      state: body.state,
      county: body.county || null,
      term: body.term || 30,
      productType: body.productType || 'fixed',
      lockDays: body.lockDays || 30,
    }),
    signal,
  });
  if (!res.ok) {
    throw new Error(`fetchRatesLive: /api/pricing returned ${res.status}`);
  }
  const data = await res.json();
  if (data.error) throw new Error(`fetchRatesLive: ${data.error}`);
  return {
    results: data.results || [],
    effectiveDate: data.effectiveDate || null,
    parRow: data.parRow || null,
  };
}

/**
 * Build the service bundle for a module based on its capability flags.
 * The orchestrator calls this with `liveServices=true` for standalone
 * (live compute) and `liveServices=false` with explicit overrides for
 * frozen (snapshot-on-send) compute.
 *
 * @param {import('./types.js').ModuleCapabilities} capabilities
 * @param {Object} [overrides] - Override service functions (snapshot mode).
 * @returns {import('./types.js').ModuleServices}
 */
export function buildServices(capabilities, overrides = {}) {
  /** @type {import('./types.js').ModuleServices} */
  const services = {};
  if (capabilities.needsRates) {
    services.fetchRates = overrides.fetchRates || fetchRatesLive;
  }
  if (capabilities.needsHecmRefData) {
    if (!overrides.fetchHecmRefData) {
      throw new Error(
        'buildServices: module needs HECM ref data but no service is wired yet — add fetchHecmRefDataLive when first HECM module migrates',
      );
    }
    services.fetchHecmRefData = overrides.fetchHecmRefData;
  }
  if (capabilities.needsToday) {
    services.today = overrides.today || new Date();
  }
  return services;
}
