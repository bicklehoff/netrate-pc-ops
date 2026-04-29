import { readHomepageCache } from '@/lib/rates/homepage-cache';
import { getCurrentModule } from '@/lib/calc-modules';

// ISR: refresh every 10 minutes so the seed rate tracks the homepage cache.
export const revalidate = 600;

export default async function PurchaseCalculatorPage() {
  let parRate = null;
  try {
    const cache = await readHomepageCache();
    parRate = cache?.conv30?.rate ?? null;
  } catch {
    // Swallow — client falls back to hardcoded default.
  }

  // Local var named `mod` not `module` — Next.js ESLint reserves `module`.
  const mod = getCurrentModule('purchase-calculator');
  if (!mod) {
    throw new Error('Module purchase-calculator not registered');
  }
  const Standalone = mod.views.standalone;

  return (
    <>
      <h1 className="sr-only">Mortgage Purchase Calculator</h1>
      <Standalone parRate={parRate} />
    </>
  );
}
