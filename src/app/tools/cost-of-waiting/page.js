import { readHomepageCache } from '@/lib/rates/homepage-cache';
import { getCurrentModule } from '@/lib/calc-modules';

// ISR: refresh every 10 minutes so the seed rate tracks the homepage cache.
export const revalidate = 600;

export default async function CostOfWaitingPage() {
  let parRate = null;
  try {
    const cache = await readHomepageCache();
    parRate = cache?.conv30?.rate ?? null;
  } catch {
    // Swallow — client falls back to hardcoded default.
  }

  // Render the registered module's StandaloneView. The module owns the
  // full UI now; this page is just the SSR wrapper that fetches parRate.
  // Local var named `mod` not `module` — Next.js ESLint reserves `module`.
  const mod = getCurrentModule('cost-of-waiting');
  if (!mod) {
    // Defensive — should never happen since the registry is compile-time.
    throw new Error('Module cost-of-waiting not registered');
  }
  const Standalone = mod.views.standalone;

  return (
    <>
      <h1 className="sr-only">Cost of Waiting to Buy a Home</h1>
      <Standalone parRate={parRate} />
    </>
  );
}
