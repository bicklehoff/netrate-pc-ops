import Link from 'next/link';
import RateTool from '@/components/RateTool';
import StrikeRateForm from '@/components/RateTool/StrikeRateForm';
import TrustBar from '@/components/TrustBar';
import { fetchGCSFile, isGCSConfigured } from '@/lib/gcs';

export const metadata = {
  title: "Today's Mortgage Rates | NetRate Mortgage",
  description: "See today's real wholesale mortgage rates with transparent pricing. Enter your scenario and get instant rate quotes with full cost breakdown.",
};

// Revalidate every 5 minutes (ISR) — fetches fresh rates from GCS on this interval
export const revalidate = 300;

const GCS_BUCKET = process.env.GCS_BUCKET_NAME || 'netrate-rates';

async function getRateData() {
  if (!isGCSConfigured()) return null;

  try {
    const manifest = await fetchGCSFile(GCS_BUCKET, 'live/manifest.json');

    const lenders = await Promise.all(
      manifest.lenders.map((entry) =>
        fetchGCSFile(GCS_BUCKET, `live/${entry.file}`)
      )
    );

    // Strip proprietary lender names from consumer-facing page
    const cleanLenders = lenders.map((data) => {
      if (data?.lender) {
        const clean = Object.fromEntries(
          Object.entries(data.lender).filter(([k]) => k !== 'name')
        );
        return { ...data, lender: clean };
      }
      return data;
    });

    return { lenders: cleanLenders, manifest, source: 'gcs' };
  } catch (err) {
    console.error('GCS fetch failed in rates page, using static fallback:', err.message);
    return null; // RateTool will use its bundled static data
  }
}

export default async function RatesPage({ searchParams }) {
  const rateData = await getRateData();
  const sp = await searchParams;
  const defaultState = sp?.state || null;

  return (
    <div>
      <TrustBar />
      <div className="bg-brand/10 border-b border-brand/20">
        <p className="text-center py-1.5 px-4 text-sm font-semibold text-brand">
          No credit pull. No Social Security number needed to check rates. Just rates.
        </p>
      </div>
      <div className="max-w-3xl mx-auto px-4 py-4">
      <RateTool initialRateData={rateData} defaultState={defaultState} />

      {/* Strike Rate / Rate Alert signup */}
      <div className="mt-10">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Not ready yet? Set a Strike Rate.</h2>
        <p className="text-sm text-gray-600 mb-4">
          Tell us your target rate — we&apos;ll email you the moment it&apos;s available. No commitment, no credit pull.
        </p>
        <StrikeRateForm source="rate-tool" />
      </div>

      {/* Apply CTA */}
      <div className="mt-10 bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Like what you see?</h2>
        <p className="text-sm text-gray-600 mb-4">
          Ready to proceed? Start an application — it takes about 10 minutes.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link
            href="/portal/apply"
            className="bg-brand text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-brand-dark transition-colors"
          >
            Apply Now
          </Link>
          <Link
            href="/contact"
            className="text-brand font-medium hover:text-brand-dark transition-colors text-sm"
          >
            Or get a quote first &rarr;
          </Link>
        </div>
      </div>
      </div>
    </div>
  );
}
