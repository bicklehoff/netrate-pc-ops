/**
 * Parse FHFA 2026 loan limits CSV and generate the county-loan-limits.js module
 * Run: node scripts/parse-fhfa-csv.js
 */
const fs = require('fs');
const path = require('path');

const csv = fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'fhfa-loan-limits-2026.csv'), 'utf8');
const lines = csv.split('\n');
const data = {};

function parseMoney(s) {
  return parseInt(s.replace(/[$,\s]/g, ''));
}

function titleCase(str) {
  return str
    .toLowerCase()
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
    .replace(/\bOf\b/g, 'of')
    .replace(/\bAnd\b/g, 'and')
    .replace(/^De /g, 'De ')
    .replace(/Mc([a-z])/g, (m, c) => 'Mc' + c.toUpperCase())
    .replace(/^St\b/, 'St');
}

for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('FIPS') || trimmed.startsWith('"')) continue;

  // Split by comma, but handle quoted fields
  const parts = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current);

  if (parts.length < 9) continue;

  const stateCode = parts[0].trim();
  const countyCode = parts[1].trim();
  const countyName = parts[2].trim();
  const state = parts[3].trim();
  const cbsa = parts[4].trim();
  const lim1 = parseMoney(parts[5]);
  const lim2 = parseMoney(parts[6]);
  const lim3 = parseMoney(parts[7]);
  const lim4 = parseMoney(parts[8]);

  if (isNaN(lim1)) continue;

  const fips = stateCode.padStart(2, '0') + countyCode.padStart(3, '0');

  // Clean county name
  let name = countyName
    .replace(/ COUNTY$/i, '')
    .replace(/ PARISH$/i, '')
    .replace(/ MUNICIPIO$/i, '')
    .replace(/ BOROUGH$/i, '')
    .replace(/ CENSUS AREA$/i, '')
    .replace(/ CITY AND BOROUGH$/i, '')
    .replace(/ MUNICIPALITY$/i, '')
    .replace(/ ISLAND$/i, '');

  name = titleCase(name);

  if (!data[state]) data[state] = [];
  data[state].push({ name, fips, oneUnit: lim1, twoUnit: lim2, threeUnit: lim3, fourUnit: lim4 });
}

// Sort states and counties
const sortedStates = Object.keys(data).sort();
let totalCounties = 0;
for (const s of sortedStates) {
  data[s].sort((a, b) => a.name.localeCompare(b.name));
  totalCounties += data[s].length;
}

console.log(`Parsed ${totalCounties} counties across ${sortedStates.length} states/territories`);

// Show high-cost areas in our 4 states
for (const st of ['CA', 'CO', 'TX', 'OR']) {
  const highCost = (data[st] || []).filter(c => c.oneUnit > 832750);
  if (highCost.length > 0) {
    console.log(`${st} high-cost counties (${highCost.length}):`);
    highCost.forEach(c => console.log(`  ${c.name}: $${c.oneUnit.toLocaleString()}`));
  } else {
    console.log(`${st}: all baseline ($832,750)`);
  }
}

// Generate the JS module
const BASELINE_1UNIT = 832750;
const BASELINE_2UNIT = 1066250;
const BASELINE_3UNIT = 1288800;
const BASELINE_4UNIT = 1601750;
const HIGH_BALANCE_CEILING = 1249125;

// Build compact data: only store counties that differ from baseline
// Format: { state: [ [name, fips, 1unit], ... ] } — omit 2/3/4 unit since they're proportional
// Actually, multi-unit limits are always proportional to 1-unit, so we only need 1-unit per county

// Verify proportionality
let proportional = true;
for (const st of sortedStates) {
  for (const c of data[st]) {
    const ratio2 = c.twoUnit / c.oneUnit;
    const ratio3 = c.threeUnit / c.oneUnit;
    const ratio4 = c.fourUnit / c.oneUnit;
    const expected2 = BASELINE_2UNIT / BASELINE_1UNIT;
    const expected3 = BASELINE_3UNIT / BASELINE_1UNIT;
    const expected4 = BASELINE_4UNIT / BASELINE_1UNIT;
    if (Math.abs(ratio2 - expected2) > 0.001 || Math.abs(ratio3 - expected3) > 0.001 || Math.abs(ratio4 - expected4) > 0.001) {
      console.log(`Non-proportional: ${st} ${c.name} ratios: ${ratio2.toFixed(4)} ${ratio3.toFixed(4)} ${ratio4.toFixed(4)}`);
      proportional = false;
    }
  }
}
if (proportional) {
  console.log('All multi-unit limits are proportional to 1-unit. Can use multipliers.');
}

// Write output as JSON data embedded in JS module
// Store all 4 unit limits for non-baseline counties (FHFA rounds independently)
// For baseline counties, store 0 and use the exact baseline constants

// Find the high-balance ceiling values from the data (counties at max)
const maxEntry = data['CA'].find(c => c.name === 'Alameda'); // known ceiling county
const HB_2UNIT = maxEntry.twoUnit;
const HB_3UNIT = maxEntry.threeUnit;
const HB_4UNIT = maxEntry.fourUnit;

const jsContent = `/**
 * FHFA 2026 Conforming Loan Limits by County
 * Source: https://www.fhfa.gov/data/conforming-loan-limit
 * Generated: ${new Date().toISOString().split('T')[0]}
 *
 * Data covers all ${totalCounties} US counties/territories.
 * All multi-unit limits use exact FHFA-published values (not calculated from multipliers).
 */

// 2026 Baseline conforming loan limits
const YEAR = 2026;
const BASELINE_1UNIT = ${BASELINE_1UNIT};
const BASELINE_2UNIT = ${BASELINE_2UNIT};
const BASELINE_3UNIT = ${BASELINE_3UNIT};
const BASELINE_4UNIT = ${BASELINE_4UNIT};

// High-balance ceiling = 150% of baseline (exact FHFA values)
const HIGH_BALANCE_CEILING_1UNIT = ${HIGH_BALANCE_CEILING};
const HIGH_BALANCE_CEILING_2UNIT = ${HB_2UNIT};
const HIGH_BALANCE_CEILING_3UNIT = ${HB_3UNIT};
const HIGH_BALANCE_CEILING_4UNIT = ${HB_4UNIT};

// State abbreviation to FIPS code mapping
const STATE_FIPS = {
${sortedStates.map(st => {
  const fipsPrefix = data[st][0].fips.slice(0, 2);
  return `  '${st}': '${fipsPrefix}',`;
}).join('\n')}
};

/**
 * County data: { STATE: [[name, fips, 1unit, 2unit, 3unit, 4unit], ...] }
 * Baseline counties use [name, fips, 0] (0 = use baseline constants).
 * High-cost counties use [name, fips, 1unit, 2unit, 3unit, 4unit] with exact FHFA values.
 */
const COUNTY_DATA = ${JSON.stringify(
  Object.fromEntries(
    sortedStates.map(st => [
      st,
      data[st].map(c => {
        if (c.oneUnit === BASELINE_1UNIT) return [c.name, c.fips, 0];
        return [c.name, c.fips, c.oneUnit, c.twoUnit, c.threeUnit, c.fourUnit];
      })
    ])
  )
).replace(/],\[/g, '],\n  [').replace(/\[\[/g, '[\n  [').replace(/\]\]/g, ']\n]').replace(/"([A-Z]{2})":\[/g, '\n  "$1": [')};

/**
 * Normalize county name for matching (case-insensitive, strips common suffixes)
 */
function normalizeCounty(county) {
  return county
    .trim()
    .toLowerCase()
    .replace(/\\s+county$/i, '')
    .replace(/\\s+parish$/i, '')
    .replace(/\\s+borough$/i, '')
    .replace(/\\s+census area$/i, '')
    .replace(/\\s+municipio$/i, '')
    .replace(/\\s+municipality$/i, '');
}

/**
 * Normalize state input — accepts abbreviation or full name
 */
const STATE_NAMES = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
  'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
  'district of columbia': 'DC', 'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI',
  'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
  'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME',
  'maryland': 'MD', 'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN',
  'mississippi': 'MS', 'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE',
  'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM',
  'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH',
  'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI',
  'south carolina': 'SC', 'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX',
  'utah': 'UT', 'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA',
  'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY',
  'puerto rico': 'PR', 'guam': 'GU', 'virgin islands': 'VI',
  'american samoa': 'AS', 'northern mariana islands': 'MP',
};

function normalizeState(state) {
  if (!state) return null;
  const s = state.trim();
  // Already an abbreviation
  if (s.length === 2) return s.toUpperCase();
  // Full name
  return STATE_NAMES[s.toLowerCase()] || null;
}

/**
 * Look up loan limits for a specific county
 * @param {string} state - State abbreviation or full name
 * @param {string} county - County name (with or without "County" suffix)
 * @returns {object|null} Loan limit details or null if not found
 */
function getLoanLimits(state, county) {
  const stateAbbr = normalizeState(state);
  if (!stateAbbr || !COUNTY_DATA[stateAbbr]) return null;

  const normalizedCounty = normalizeCounty(county);
  const counties = COUNTY_DATA[stateAbbr];

  const match = counties.find(([name]) => name.toLowerCase() === normalizedCounty);
  if (!match) return null;

  const [name, fips, lim1, lim2, lim3, lim4] = match;
  const isBaseline = lim1 === 0;

  return {
    year: YEAR,
    state: stateAbbr,
    county: name,
    fips,
    conforming1Unit: isBaseline ? BASELINE_1UNIT : lim1,
    conforming2Unit: isBaseline ? BASELINE_2UNIT : lim2,
    conforming3Unit: isBaseline ? BASELINE_3UNIT : lim3,
    conforming4Unit: isBaseline ? BASELINE_4UNIT : lim4,
    highBalance: !isBaseline,
    isBaseline,
    // FHA floor = 65% of baseline, FHA ceiling = conforming ceiling
    fhaLimit: isBaseline
      ? Math.round(BASELINE_1UNIT * 0.65)
      : Math.min(lim1, HIGH_BALANCE_CEILING_1UNIT),
  };
}

/**
 * Classify a loan amount based on county limits
 * @param {number} loanAmount - The loan amount to classify
 * @param {string} state - State abbreviation or full name
 * @param {string} county - County name
 * @param {number} [units=1] - Number of units (1-4)
 * @returns {string} "conforming" | "highBalance" | "jumbo" | null if county not found
 */
function classifyLoan(loanAmount, state, county, units = 1) {
  const limits = getLoanLimits(state, county);
  if (!limits) return null;

  const unitKey = \`conforming\${units}Unit\`;
  const conformingLimit = limits[unitKey];

  // Baseline for this unit count
  const baselines = { 1: BASELINE_1UNIT, 2: BASELINE_2UNIT, 3: BASELINE_3UNIT, 4: BASELINE_4UNIT };
  const baseline = baselines[units] || BASELINE_1UNIT;

  if (loanAmount <= baseline) {
    return 'conforming';
  }
  if (loanAmount <= conformingLimit) {
    return 'highBalance';
  }
  return 'jumbo';
}

/**
 * Get all counties for a state
 * @param {string} state - State abbreviation or full name
 * @returns {Array} Array of { name, fips, oneUnitLimit }
 */
function getCountiesByState(state) {
  const stateAbbr = normalizeState(state);
  if (!stateAbbr || !COUNTY_DATA[stateAbbr]) return [];

  return COUNTY_DATA[stateAbbr].map(([name, fips, lim1]) => ({
    name,
    fips,
    oneUnitLimit: lim1 === 0 ? BASELINE_1UNIT : lim1,
  }));
}

/**
 * Get all high-cost counties for a state (where limit exceeds baseline)
 * @param {string} state - State abbreviation or full name
 * @returns {Array} Array of { name, fips, oneUnitLimit }
 */
function getHighCostCounties(state) {
  return getCountiesByState(state).filter(c => c.oneUnitLimit > BASELINE_1UNIT);
}

/**
 * Get all available states
 * @returns {string[]} Array of state abbreviations
 */
function getStates() {
  return Object.keys(COUNTY_DATA);
}

module.exports = {
  YEAR,
  BASELINE_1UNIT,
  BASELINE_2UNIT,
  BASELINE_3UNIT,
  BASELINE_4UNIT,
  HIGH_BALANCE_CEILING_1UNIT,
  HIGH_BALANCE_CEILING_2UNIT,
  HIGH_BALANCE_CEILING_3UNIT,
  HIGH_BALANCE_CEILING_4UNIT,
  STATE_FIPS,
  getLoanLimits,
  classifyLoan,
  getCountiesByState,
  getHighCostCounties,
  getStates,
};
`;

fs.writeFileSync(path.join(__dirname, '..', 'src', 'data', 'county-loan-limits.js'), jsContent);
console.log('\nWrote county-loan-limits.js');
console.log(`File size: ${(jsContent.length / 1024).toFixed(1)} KB`);
