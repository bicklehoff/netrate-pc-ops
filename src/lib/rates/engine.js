/**
 * NetRate Mortgage — Rate Math Helpers
 * Pure functions, no UI dependencies.
 *
 * calculatePI and calculateAPR re-exported from the canonical mortgage-math.js.
 * getFicoBand and getLtvBandIndex remain here (used by pricing engine and components).
 */

export { calculateMonthlyPI as calculatePI, calculateAPR } from '@/lib/mortgage-math';

export function getFicoBand(fico) {
  if (fico >= 800) return ">=800";
  if (fico >= 780) return "780-799";
  if (fico >= 760) return "760-779";
  if (fico >= 740) return "740-759";
  if (fico >= 720) return "720-739";
  if (fico >= 700) return "700-719";
  if (fico >= 680) return "680-699";
  if (fico >= 660) return "660-679";
  if (fico >= 640) return "640-659";
  return "620-639";
}

export function getLtvBandIndex(ltv) {
  if (ltv <= 30) return 0;
  if (ltv <= 60) return 1;
  if (ltv <= 70) return 2;
  if (ltv <= 75) return 3;
  if (ltv <= 80) return 4;
  if (ltv <= 85) return 5;
  if (ltv <= 90) return 6;
  if (ltv <= 95) return 7;
  return 8;
}
