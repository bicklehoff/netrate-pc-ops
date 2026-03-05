// HECM Rate Sheet Data — FOA Broker Pricing
// Last updated: 3/3/2026

// ============================================
// ASL PRICING TABLE (Monthly CMT Cap 10 & Cap 5 — same pricing)
// Rows = margin, Columns = PLU% buckets (0-10%, 10-20%, ..., 90-100%)
// Values = pricing as % of UPB (YSP = price - 100)
// From FOA rate sheet dated 3/3/2026
// ============================================
export const FOA_PRICING = {
  // margin: [0-10%, 10-20%, 20-30%, 30-40%, 40-50%, 50-60%, 60-70%, 70-80%, 80-90%, 90-100%]
  3.000: [115.100, 110.760, 108.440, 107.290, 106.420, 106.420, 105.870, 105.440, 105.240, 105.040],
  2.875: [115.100, 110.760, 108.440, 107.290, 106.420, 106.420, 105.870, 105.440, 105.240, 105.040],
  2.750: [115.100, 110.760, 108.440, 107.290, 106.420, 106.420, 105.870, 105.440, 105.240, 105.040],
  2.625: [114.470, 110.510, 108.440, 107.290, 106.420, 106.420, 105.870, 105.440, 105.240, 105.040],
  2.500: [114.050, 110.100, 108.440, 107.290, 106.420, 106.420, 105.870, 105.440, 105.240, 105.040],
  2.375: [112.430, 109.010, 108.150, 106.800, 106.120, 106.250, 105.620, 105.150, 105.100, 104.930],
  2.250: [110.940, 107.810, 107.050, 105.930, 105.600, 105.550, 105.050, 104.680, 104.550, 104.680],
  2.125: [108.940, 106.010, 105.800, 105.180, 104.680, 104.930, 104.680, 104.300, 104.100, 104.180],
  2.000: [108.190, 105.760, 104.930, 104.550, 104.430, 104.550, 104.180, 103.930, 103.800, 103.800],
  1.875: [105.190, 103.510, 103.430, 103.430, 103.550, 103.680, 103.300, 103.180, 103.180, 103.050],
  1.750: [103.190, 102.260, 102.300, 102.550, 102.550, 102.800, 102.550, 102.480, 102.430, 102.430],
  1.625: [101.190, 101.260, 101.680, 101.800, 101.930, 102.050, 101.930, 101.800, 101.800, 101.800],
  1.500: [ 98.310,  99.910, 100.800, 101.180, 101.300, 101.300, 101.300, 101.300, 101.300, 101.300],
  1.375: [ 96.810,  97.810,  99.500, 100.000, 100.500, 100.500, 100.500, 100.500, 100.500, 100.500],
  1.250: [ 95.810,  96.810,  98.700,  99.200,  99.700,  99.700,  99.700,  99.700,  99.700,  99.700],
};

// Moneyhouse ASL pricing (from rate sheet 2/18/2026) — used by the interactive calculator
export const ASL_PRICING = {
  2.750: [100.000, 100.000, 100.000, 100.000, 100.000, 100.000, 100.000, 100.000, 100.000, 100.000],
  2.625: [100.000, 100.000, 104.000, 104.000, 104.000, 104.000, 104.000, 104.000, 104.000, 105.500],
  2.500: [100.000, 105.000, 105.000, 106.550, 106.250, 106.000, 105.450, 105.240, 105.390, 105.000],
  2.375: [105.000, 104.000, 108.375, 107.120, 106.515, 106.210, 105.780, 105.240, 105.000, 104.950],
  2.250: [105.000, 107.357, 107.000, 105.947, 105.730, 105.610, 105.500, 105.440, 105.000, 104.780],
  2.125: [104.800, 106.231, 105.745, 105.220, 104.715, 104.740, 105.190, 105.080, 104.640, 104.480],
  2.000: [104.000, 107.410, 104.720, 104.010, 104.370, 103.880, 104.550, 104.240, 103.990, 103.910],
  1.875: [101.000, 103.028, 103.210, 103.180, 103.350, 103.410, 103.300, 103.180, 103.050, 103.050],
  1.750: [101.000, 102.000, 102.100, 102.310, 102.310, 102.550, 102.340, 102.230, 102.410, 102.430],
  1.625: [101.000, 100.000, 101.430, 101.580, 101.700, 101.910, 101.680, 101.900, 101.900, 101.800],
  1.500: [100.000, 100.000, 100.550, 101.000, 101.080, 101.080, 101.080, 101.080, 101.300, 101.300],
  1.375: [100.000, 100.000, 100.000,  99.625,  99.750, 100.000, 100.165, 100.200, 100.210, 100.230],
};

// HECM Fixed Rate Options (from FOA rate sheet 3/3/2026)
export const HECM_FIXED_RATES = [
  { rate: 7.930, premium: 103, origFee: 2000, lenderCredit: 0, minComp: 5000 },
  { rate: 7.810, premium: 103, origFee: 3000, lenderCredit: 0, minComp: 5000 },
  { rate: 7.680, premium: 103, origFee: 4250, lenderCredit: 0, minComp: 5000 },
  { rate: 7.560, premium: 103, origFee: 6000, lenderCredit: 0, minComp: 5000 },
];

// Moneyhouse Fixed Rate Options (from rate sheet 2/18/2026)
export const MH_FIXED_RATES = [
  { rate: 7.680, mhFee: 'HUD Max', lenderCredit: 0, lenderPaidPrice: 102.800, borrowerPaidPrice: 100.000 },
  { rate: 7.810, mhFee: '$4,000',  lenderCredit: 0, lenderPaidPrice: 102.800, borrowerPaidPrice: 100.000 },
  { rate: 7.930, mhFee: '$2,000',  lenderCredit: 0, lenderPaidPrice: 102.800, borrowerPaidPrice: 100.000 },
];

// HomeSafe Standard (Proprietary Fixed)
export const HOMESAFE_STANDARD = [
  { tier: 'Fixed Tier 1: Low LTV',  rate: 7.990, lesaRate: 8.240, premium: 103.00, origFee: '1.0% of PL' },
  { tier: 'Fixed Tier 2: Std LTV',  rate: 8.950, lesaRate: 9.200, premium: 103.00, origFee: '0.0% of PL' },
  { tier: 'Fixed Tier 3: High LTV', rate: 8.980, lesaRate: 9.230, premium: 103.00, origFee: '2.0% of PL' },
];

// HomeSafe Select (Proprietary Adjustable)
export const HOMESAFE_SELECT = [
  { margin: 5.749, lesaMargin: 5.999, util25_80: 105.00, util80_90: 103.50, util90_100: 102.25 },
  { margin: 5.625, lesaMargin: 5.875, util25_80: 104.25, util80_90: 103.00, util90_100: 102.00 },
  { margin: 5.499, lesaMargin: 5.751, util25_80: 103.50, util80_90: 102.25, util90_100: 101.75 },
];

// LLPA Adjustments (Moneyhouse rate sheet)
export function getLLPAAdjustment(age) {
  if (age >= 62 && age <= 74) return -0.500;
  if (age >= 87 && age <= 89) return 0.750;
  if (age >= 90) return -5.500;
  return 0;
}

// PLU% bucket pricing lookup
export function getASLPricing(pricingTable, margin, pluPct) {
  const row = pricingTable[margin];
  if (!row) return null;
  const plu = Math.max(0.01, Math.min(pluPct, 100));
  let idx = Math.floor((plu - 0.01) / 10);
  idx = Math.max(0, Math.min(idx, 9));
  const price = row[idx];
  if (!price || price === 0) return null;
  return price;
}

// FOA pricing lookup (for optimizer grid)
export function getFOAPricing(margin, pluPct) {
  return getASLPricing(FOA_PRICING, margin, pluPct);
}
