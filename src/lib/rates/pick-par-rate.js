/**
 * Par-rate selection — pure function.
 *
 * Given a priced ladder of {rate, finalPrice} entries across any number of
 * (lender × program) combinations for a single scenario, returns the rate a
 * borrower would actually take. Matches LoanSifter's default behavior and
 * MND's par methodology:
 *
 *   1. Group by rate. At each rate, keep the best outcome for the borrower
 *      (highest finalPrice — what they'd actually receive after comp + LLPAs).
 *   2. Filter to rates whose best outcome is at or above par (finalPrice >= 100).
 *   3. Pick the LOWEST such rate — the cheapest rate a borrower can get
 *      without buying it down with points.
 *   4. Fallback: if nothing reaches par (rare — inverted sheet, thin scenario),
 *      return the combo closest to par so consumers don't break. Callers can
 *      detect this via `reason: 'fallback_closest'` and log accordingly.
 *
 * This lives outside any data-loading module so every surface that needs to
 * collapse a ladder to "today's rate" — homepage, rate-watch, /rates, DSCR
 * widget, email subject lines, rate alerts — uses the same rule.
 *
 * The ladder is indifferent to product family. Callers are responsible for
 * filtering the ladder to a single scenario's worth of priced combos before
 * calling this.
 */

/**
 * @typedef {object} PricedRow
 * @property {number} rate        Note rate (e.g. 5.990)
 * @property {number} finalPrice  Price after LLPAs + comp (100 = par, >100 = credit)
 */

/**
 * @param {PricedRow[]} ladder  priced combos to choose from
 * @returns {{ rate: number, finalPrice: number, reason: 'par'|'fallback_closest' } | null}
 *   null only when the input is empty or every entry is non-finite.
 */
export function pickParRate(ladder) {
  if (!Array.isArray(ladder) || ladder.length === 0) return null;

  // 1. Group by rate, keep max finalPrice at each rate.
  const bestAtRate = new Map();
  for (const row of ladder) {
    const r = Number(row.rate);
    const p = Number(row.finalPrice);
    if (!Number.isFinite(r) || !Number.isFinite(p)) continue;
    const existing = bestAtRate.get(r);
    if (!existing || p > existing.finalPrice) {
      bestAtRate.set(r, { rate: r, finalPrice: p });
    }
  }

  if (bestAtRate.size === 0) return null;

  // 2. Filter to rates at or above par.
  const atOrAbovePar = [...bestAtRate.values()].filter(x => x.finalPrice >= 100);

  // 3. Happy path — lowest qualifying rate wins. Rates are unique in this pool
  //    by construction, so no meaningful tiebreak is possible; `<` is enough.
  if (atOrAbovePar.length > 0) {
    const picked = atOrAbovePar.reduce((best, r) => r.rate < best.rate ? r : best);
    return { rate: picked.rate, finalPrice: picked.finalPrice, reason: 'par' };
  }

  // 4. Fallback — closest to par. Tiebreak by lower rate (borrower-friendly).
  const picked = [...bestAtRate.values()].reduce((best, r) => {
    const dR = Math.abs(100 - r.finalPrice);
    const dB = Math.abs(100 - best.finalPrice);
    if (dR < dB) return r;
    if (dR > dB) return best;
    return r.rate < best.rate ? r : best;
  });
  return { rate: picked.rate, finalPrice: picked.finalPrice, reason: 'fallback_closest' };
}
