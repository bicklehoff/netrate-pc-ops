/**
 * County Property Tax Rates — Placeholder Module
 * For use in mortgage payment calculations (PITI)
 *
 * Rates are expressed as annual percentage of assessed value.
 * These are approximate effective rates — actual rates vary by jurisdiction,
 * assessed value ratio, exemptions, and special districts.
 *
 * TODO: Populate with real data from county assessor records.
 * Priority: CO, CA, TX, OR (our 4 licensed states)
 */

// State-level average effective property tax rates (as decimal, e.g., 0.0055 = 0.55%)
// Source: US Census Bureau, Tax Foundation estimates
const STATE_AVERAGES = {
  AL: 0.0040, AK: 0.0119, AZ: 0.0062, AR: 0.0062,
  CA: 0.0071, CO: 0.0051, CT: 0.0198, DE: 0.0057,
  DC: 0.0056, FL: 0.0089, GA: 0.0092, HI: 0.0028,
  ID: 0.0063, IL: 0.0197, IN: 0.0085, IA: 0.0157,
  KS: 0.0141, KY: 0.0083, LA: 0.0055, ME: 0.0130,
  MD: 0.0099, MA: 0.0112, MI: 0.0154, MN: 0.0107,
  MS: 0.0065, MO: 0.0097, MT: 0.0074, NE: 0.0163,
  NV: 0.0053, NH: 0.0186, NJ: 0.0240, NM: 0.0068,
  NY: 0.0146, NC: 0.0077, ND: 0.0098, OH: 0.0157,
  OK: 0.0090, OR: 0.0090, PA: 0.0153, RI: 0.0136,
  SC: 0.0057, SD: 0.0122, TN: 0.0064, TX: 0.0168,
  UT: 0.0058, VT: 0.0182, VA: 0.0082, WA: 0.0092,
  WV: 0.0058, WI: 0.0161, WY: 0.0057,
};

/**
 * County-level property tax rates for our 4 licensed states
 * Format: { state: { countyName: rate } }
 * Rate is annual effective rate as decimal (0.01 = 1%)
 *
 * PLACEHOLDER — rates below are state averages until real county data is loaded.
 * When real data is available, override individual county entries.
 */
const COUNTY_TAX_RATES = {
  CO: {
    // Front Range / Metro Denver
    'Adams': 0.0059,
    'Arapahoe': 0.0048,
    'Boulder': 0.0055,
    'Broomfield': 0.0048,
    'Denver': 0.0054,
    'Douglas': 0.0049,
    'El Paso': 0.0048,
    'Jefferson': 0.0053,
    'Larimer': 0.0055,
    'Weld': 0.0055,
    // Mountain / Resort
    'Eagle': 0.0038,
    'Garfield': 0.0038,
    'Grand': 0.0042,
    'Pitkin': 0.0032,
    'Routt': 0.0042,
    'Summit': 0.0041,
    'San Miguel': 0.0038,
    // Other
    'Mesa': 0.0052,
    'Pueblo': 0.0059,
  },

  CA: {
    // Bay Area
    'Alameda': 0.0074,
    'Contra Costa': 0.0080,
    'Marin': 0.0071,
    'San Francisco': 0.0062,
    'San Mateo': 0.0059,
    'Santa Clara': 0.0067,
    'Santa Cruz': 0.0072,
    'Sonoma': 0.0073,
    // SoCal
    'Los Angeles': 0.0072,
    'Orange': 0.0068,
    'Riverside': 0.0095,
    'San Bernardino': 0.0088,
    'San Diego': 0.0073,
    'Santa Barbara': 0.0063,
    'Ventura': 0.0072,
    // Central Valley
    'Fresno': 0.0081,
    'Sacramento': 0.0077,
    'San Joaquin': 0.0090,
    // Central Coast
    'Monterey': 0.0067,
    'San Luis Obispo': 0.0068,
    // North
    'Napa': 0.0068,
  },

  TX: {
    // Note: TX has no state income tax; property tax rates are among the highest in the US
    'Bexar': 0.0188,     // San Antonio
    'Collin': 0.0178,    // Plano / McKinney
    'Dallas': 0.0180,
    'Denton': 0.0172,
    'El Paso': 0.0220,
    'Fort Bend': 0.0215,
    'Harris': 0.0193,    // Houston
    'Hidalgo': 0.0195,
    'Tarrant': 0.0200,   // Fort Worth
    'Travis': 0.0174,    // Austin
    'Williamson': 0.0190,
    'Montgomery': 0.0178,
    'Galveston': 0.0218,
    'Brazoria': 0.0213,
    'Nueces': 0.0195,    // Corpus Christi
    'Webb': 0.0165,      // Laredo
    'Cameron': 0.0180,   // Brownsville
    'Lubbock': 0.0172,
    'Bell': 0.0198,      // Killeen
    'McLennan': 0.0195,  // Waco (note: stored with proper casing)
    'Hays': 0.0186,
  },

  OR: {
    // Note: OR has no sales tax; property taxes fund local services
    'Baker': 0.0085,
    'Benton': 0.0095,    // Corvallis
    'Clackamas': 0.0095,
    'Deschutes': 0.0082, // Bend
    'Douglas': 0.0078,
    'Jackson': 0.0088,   // Medford
    'Lane': 0.0099,      // Eugene
    'Linn': 0.0092,
    'Marion': 0.0095,    // Salem
    'Multnomah': 0.0107, // Portland
    'Polk': 0.0089,
    'Washington': 0.0094,
    'Yamhill': 0.0089,
    'Clatsop': 0.0082,
    'Columbia': 0.0087,
    'Josephine': 0.0070, // Grants Pass
    'Klamath': 0.0076,
    'Lincoln': 0.0080,
  },
};

/**
 * Get the property tax rate for a county
 * @param {string} state - State abbreviation
 * @param {string} county - County name (without "County" suffix)
 * @returns {number} Annual effective tax rate as decimal, or state average if county not found
 */
function getPropertyTaxRate(state, county) {
  const stateUpper = state?.toUpperCase();
  if (!stateUpper) return 0.01; // national average fallback

  // Try county-specific rate first
  const stateData = COUNTY_TAX_RATES[stateUpper];
  if (stateData) {
    // Normalize county name
    const normalizedCounty = county
      ?.trim()
      .replace(/\s+county$/i, '')
      .replace(/\s+parish$/i, '');

    if (normalizedCounty && stateData[normalizedCounty]) {
      return stateData[normalizedCounty];
    }

    // Case-insensitive search
    const lcCounty = normalizedCounty?.toLowerCase();
    if (lcCounty) {
      const match = Object.entries(stateData).find(
        ([k]) => k.toLowerCase() === lcCounty
      );
      if (match) return match[1];
    }
  }

  // Fall back to state average
  return STATE_AVERAGES[stateUpper] || 0.01;
}

/**
 * Calculate annual property tax
 * @param {number} homeValue - Estimated home value
 * @param {string} state - State abbreviation
 * @param {string} county - County name
 * @returns {number} Estimated annual property tax
 */
function calculateAnnualPropertyTax(homeValue, state, county) {
  const rate = getPropertyTaxRate(state, county);
  return Math.round(homeValue * rate);
}

/**
 * Calculate monthly property tax (for PITI calculations)
 * @param {number} homeValue - Estimated home value
 * @param {string} state - State abbreviation
 * @param {string} county - County name
 * @returns {number} Estimated monthly property tax
 */
function calculateMonthlyPropertyTax(homeValue, state, county) {
  return Math.round(calculateAnnualPropertyTax(homeValue, state, county) / 12);
}

module.exports = {
  STATE_AVERAGES,
  COUNTY_TAX_RATES,
  getPropertyTaxRate,
  calculateAnnualPropertyTax,
  calculateMonthlyPropertyTax,
};
