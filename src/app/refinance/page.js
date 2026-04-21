import { readHomepageCache } from '@/lib/rates/homepage-cache';
import RefinanceLanding from './content';

// Dynamic render required — page reads searchParams (ICanBuy URL params).
// homepage_rate_cache read per request is cheap (indexed DB lookup); the
// in-memory cache inside readHomepageCache is invalidated by writer, not
// TTL, so fresh rates land within seconds of a new cron compute.

// Metadata kept minimal on purpose: this is a paid-ad destination, not
// an organic SEO target. If we want to rank organically we'll write a
// separate /refinance-guide or similar.
export const metadata = {
  title: 'Today\'s Refinance Rates | NetRate Mortgage',
  description: 'Live par refinance rates across conventional, FHA, and VA products. Save your scenario and get a call back within 30 minutes.',
  alternates: { canonical: 'https://www.netratemortgage.com/refinance' },
  robots: {
    // Let bots index but not the param-ed versions; those are paid traffic.
    index: true,
    follow: true,
  },
};

/**
 * Defaults used when ICanBuy URL params are missing. Mirrors the broad
 * "what a typical refi shopper looks like" profile from Claw's spec
 * (CO, $450K, FICO 720-759, 30yr fixed, primary).
 */
const DEFAULT_PARAMS = {
  purpose: 'refinance',
  state: 'CO',
  amount: 450000,
  propertyValue: 600000,
  fico: 740,
  term: 30,
  occupancy: 'primary',
};

/**
 * Parse ICanBuy-style URL params into a normalized scenario. Accepts the
 * flexible set Claw listed (zip/state, amount/loanAmount, purpose/loanType,
 * fico/credit, term/product) so we stay compatible regardless of the
 * final ICanBuy param names.
 */
function parseScenario(searchParams) {
  const p = searchParams || {};
  const asNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const purpose = (p.purpose || p.loanType || '').toString().toLowerCase();
  const normalizedPurpose =
    purpose.includes('cash') ? 'cashout' :
    purpose.includes('purchase') ? 'purchase' :
    purpose ? 'refinance' : DEFAULT_PARAMS.purpose;

  return {
    purpose: normalizedPurpose,
    state: (p.state || p.propertyState || '').toString().toUpperCase().slice(0, 2) || DEFAULT_PARAMS.state,
    amount: asNum(p.amount) ?? asNum(p.loanAmount) ?? DEFAULT_PARAMS.amount,
    propertyValue: asNum(p.propertyValue) ?? asNum(p.homeValue) ?? DEFAULT_PARAMS.propertyValue,
    fico: asNum(p.fico) ?? asNum(p.credit) ?? DEFAULT_PARAMS.fico,
    term: asNum(p.term) ?? DEFAULT_PARAMS.term,
    occupancy: (p.occupancy || DEFAULT_PARAMS.occupancy).toString().toLowerCase(),
    // Raw attribution — passed through to the save-scenario form so the
    // /api/leads/form endpoint can persist full provenance.
    utmSource: p.utm_source || p.utmSource || 'icanbuy',
    utmMedium: p.utm_medium || p.utmMedium || 'cpc',
    utmCampaign: p.utm_campaign || p.utmCampaign || null,
  };
}

export default async function RefinancePage({ searchParams }) {
  const params = await searchParams;
  const scenario = parseScenario(params);

  // Pull the homepage_rate_cache — same source the homepage uses.
  // If it fails, the client component renders a graceful "rates loading"
  // state; the form still works.
  let rates = null;
  try {
    rates = await readHomepageCache();
  } catch {
    // swallow — client handles null gracefully
  }

  return <RefinanceLanding scenario={scenario} rates={rates} />;
}
