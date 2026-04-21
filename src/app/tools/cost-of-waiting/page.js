import { readHomepageCache } from '@/lib/rates/homepage-cache';
import CostOfWaitingClient from './content';

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
  return <CostOfWaitingClient parRate={parRate} />;
}
