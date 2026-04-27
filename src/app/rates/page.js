import Link from 'next/link';
import RateTool from '@/components/RateTool';
import TrustBar from '@/components/TrustBar';

export const metadata = {
  title: "Today's Mortgage Rates | NetRate Mortgage",
  description: "See today's real wholesale mortgage rates with transparent pricing. Enter your scenario and get instant rate quotes with full cost breakdown.",
  alternates: {
    canonical: 'https://www.netratemortgage.com/rates',
  },
};

// Revalidate every 30 min — rates change once/day when new sheet is parsed
export const revalidate = 1800;

export default async function RatesPage({ searchParams }) {
  const sp = await searchParams;
  const defaultState = sp?.state || null;

  // BRP reprice flow: pre-fill scenario from URL params
  const prefill = {};
  if (sp?.purpose) prefill.purpose = sp.purpose;
  if (sp?.loanType) prefill.loanType = sp.loanType;
  if (sp?.propertyType) prefill.propertyType = sp.propertyType;
  if (sp?.propertyValue) prefill.propertyValue = Number(sp.propertyValue);
  if (sp?.downPaymentPct) prefill.downPaymentPct = Number(sp.downPaymentPct);
  if (sp?.loanAmount) prefill.loanAmount = Number(sp.loanAmount);
  if (sp?.fico) prefill.fico = Number(sp.fico);
  if (sp?.term) prefill.term = Number(sp.term);
  if (sp?.county) prefill.county = sp.county;
  if (sp?.currentPayoff) prefill.currentPayoff = Number(sp.currentPayoff);
  if (sp?.currentRate) prefill.currentRate = Number(sp.currentRate);

  // BRP token — if present, user came from their rate portal
  const brpToken = sp?.token || null;

  return (
    <div>
      <TrustBar />
      <div className="bg-brand border-b border-brand-dark">
        <p className="text-center py-2 px-4 text-sm font-semibold text-white">
          No credit pull. No Social Security number needed to check rates. Just rates.
        </p>
      </div>
      <div className="bg-[#F5F7FA] min-h-screen">
      <div className="max-w-3xl mx-auto px-4 py-8">
      <RateTool defaultState={defaultState} prefill={Object.keys(prefill).length ? prefill : null} brpToken={brpToken} />

      {/* Apply CTA */}
      <div className="mt-10 bg-white rounded-2xl border border-gray-100 shadow-[0_4px_24px_rgba(2,76,79,0.06)] p-6 text-center">
        <h2 className="text-lg font-bold text-gray-900 mb-2">Like what you see?</h2>
        <p className="text-sm text-gray-500 mb-5">
          Ready to proceed? Start an application — it takes about 10 minutes.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link
            href="/portal/apply"
            className="bg-go text-white px-6 py-2.5 rounded-nr-md font-bold hover:bg-go-dark transition-colors"
          >
            Apply Now
          </Link>
          <Link
            href="/contact"
            className="border-2 border-brand text-brand px-6 py-2.5 rounded-2xl font-medium hover:bg-brand hover:text-white transition-colors text-sm"
          >
            Get a Quote First
          </Link>
        </div>
      </div>
      </div>
      </div>
    </div>
  );
}
