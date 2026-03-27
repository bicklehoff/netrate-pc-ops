/**
 * EverStream Rate Sheet Parser
 *
 * Parses two companion files:
 *   1. Rate CSV — flat CSV with Product, Commit Period, Note Rate, FinalBasePrice, Release Time
 *   2. LLPA XLSX — Excel workbook with 19 sheets of LLPA matrices
 *
 * Exports: parseRates, parseLLPAs, parse, lenderId
 */

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unused-vars */
const XLSX = require('xlsx');

const lenderId = 'everstream';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function round(n, decimals = 6) {
  return Math.round(n * 10 ** decimals) / 10 ** decimals;
}

/**
 * Parse a product name string into structured fields.
 *
 * Examples:
 *   "FNMA 25/30yr Fixed - 175k < Bal <= 200k Elite"
 *   "FHLMC 10/6 SOFR Arm High Balance Elite"
 *   "FHA Streamline 20/25/30Yr Fixed > 200K <= 225K Core"
 *   "DSCR Rate Sheet1 5yr/6m ARM Elite"
 *   "VA 5/1 CMT Elite"
 *   "FHLMC NOO 25/30Yr Fixed > 400K Core"
 *   "FHLMC SH 25/30Yr Fixed > 400K Core"
 *   "Expanded Prime Plus 5/6 Arm Core"
 *   "Non-QM Rate Sheet1 30 Yr. Fixed Elite"
 *   "NonQM DSCR 5/6 SOFR ARM Elite"
 */
function parseProductName(name) {
  const raw = name;
  let s = name.trim();

  // --- Tier ---
  let tier = 'elite';
  if (/\bCore\b/i.test(s)) tier = 'core';
  s = s.replace(/\b(Elite|Core)\b/gi, '').trim();

  // --- Occupancy ---
  let occupancy = 'primary';
  if (/\bNOO\b/.test(s) || /\bNonOwner\b/i.test(s)) {
    occupancy = 'investment';
    s = s.replace(/\bNOO\b/g, '').replace(/\bNonOwner\b/gi, '').trim();
  } else if (/\bSH\b/.test(s)) {
    occupancy = 'secondary';
    s = s.replace(/\bSH\b/g, '').trim();
  }

  // --- High Balance ---
  let isHighBalance = false;
  if (/\bHigh\s*Bal(ance)?\b/i.test(s) || /\bHighBal\b/i.test(s)) {
    isHighBalance = true;
    s = s.replace(/\bHigh\s*Balance\b/gi, '').replace(/\bHighBal\b/gi, '').trim();
  }

  // --- FICO filter ---
  let ficoFilter = null;
  const ficoMatch = s.match(/Fico\s*<\s*(\d+)/i);
  if (ficoMatch) {
    ficoFilter = { max: parseInt(ficoMatch[1], 10) - 1 };
    s = s.replace(/[-–]?\s*Fico\s*<\s*\d+/gi, '').trim();
  }

  // --- Loan amount range ---
  let loanAmountMin = 0;
  let loanAmountMax = null;

  // Elite patterns: "175k < Bal <= 200k", "Bal <= 85k", "Bal > 400k"
  const eliteBalMatch = s.match(/[-–]\s*(?:(\d+)k?\s*<\s*)?Bal\s*(?:<=?\s*(\d+)k)?/i);
  if (eliteBalMatch) {
    if (eliteBalMatch[1]) loanAmountMin = parseInt(eliteBalMatch[1], 10) * 1000;
    if (eliteBalMatch[2]) loanAmountMax = parseInt(eliteBalMatch[2], 10) * 1000;
    s = s.replace(/[-–]\s*(?:\d+k?\s*<\s*)?Bal\s*(?:<=?\s*\d+k)?/gi, '').trim();
  }

  // Check for "Bal > Xk" (no upper bound)
  const balGtMatch = s.match(/[-–]\s*Bal\s*>\s*(\d+)k/i);
  if (balGtMatch) {
    loanAmountMin = parseInt(balGtMatch[1], 10) * 1000;
    loanAmountMax = null;
    s = s.replace(/[-–]\s*Bal\s*>\s*\d+k/gi, '').trim();
  }

  // Core patterns: "> 175K <= 200K", "> 400K", "<= 85K"
  const coreBalMatch = s.match(/>\s*(\d+)K\s*(?:<=?\s*(\d+)K)?/i);
  if (coreBalMatch && !eliteBalMatch && !balGtMatch) {
    loanAmountMin = parseInt(coreBalMatch[1], 10) * 1000;
    if (coreBalMatch[2]) loanAmountMax = parseInt(coreBalMatch[2], 10) * 1000;
    s = s.replace(/>\s*\d+K\s*(?:<=?\s*\d+K)?/gi, '').trim();
  }
  const coreLteMatch = s.match(/<=?\s*(\d+)K\b/i);
  if (coreLteMatch && !eliteBalMatch && !balGtMatch && !coreBalMatch) {
    loanAmountMax = parseInt(coreLteMatch[1], 10) * 1000;
    s = s.replace(/<=?\s*\d+K\b/gi, '').trim();
  }

  // --- ARM detection ---
  let isARM = false;
  let armStructure = null;
  // Patterns: "5/6 SOFR ARM 2-1-5", "5/6 SOFR Arm", "10/6 SOFR ARM", "5/1 CMT",
  //           "5yr/6m ARM", "10yr/6m ARM", "3/6 Arm"
  const armMatch = s.match(/(\d+)(?:yr)?\/(\d+)(?:m)?\s*(?:SOFR\s+)?(?:CMT\s+)?(?:ARM|Arm)(?:\s+\d+-\d+-\d+)?/i);
  if (armMatch) {
    isARM = true;
    armStructure = `${armMatch[1]}/${armMatch[2]}`;
    s = s.replace(/\d+(?:yr)?\/\d+(?:m)?\s*(?:SOFR\s+)?(?:CMT\s+)?(?:ARM|Arm)(?:\s+\d+-\d+-\d+)?/gi, '').trim();
  }
  // Also catch "5/1 CMT" without ARM suffix
  if (!isARM) {
    const cmtMatch = s.match(/(\d+)\/(\d+)\s*CMT/i);
    if (cmtMatch) {
      isARM = true;
      armStructure = `${cmtMatch[1]}/${cmtMatch[2]}`;
      s = s.replace(/\d+\/\d+\s*CMT/gi, '').trim();
    }
  }

  // --- Streamline ---
  const isStreamline = /\bStreamline\b/i.test(s);
  s = s.replace(/\bStreamline\b/gi, '').trim();

  // --- Loan type / investor ---
  let loanType, investor, category, subcategory;

  if (/^FNMA\b/i.test(s)) {
    loanType = 'conventional'; investor = 'fnma'; category = 'agency'; subcategory = 'conventional';
    s = s.replace(/^FNMA\b/i, '').trim();
  } else if (/^FHLMC\b/i.test(s)) {
    loanType = 'conventional'; investor = 'fhlmc'; category = 'agency'; subcategory = 'conventional';
    s = s.replace(/^FHLMC\b/i, '').trim();
  } else if (/^FHA\b/i.test(s)) {
    loanType = 'fha'; investor = 'fha'; category = 'agency'; subcategory = 'fha';
    s = s.replace(/^FHA\b/i, '').trim();
  } else if (/^VA\b/i.test(s)) {
    loanType = 'va'; investor = 'va'; category = 'agency'; subcategory = 'va';
    s = s.replace(/^VA\b/i, '').trim();
  } else if (/^Jumbo\b/i.test(s)) {
    loanType = 'conventional'; investor = null; category = 'agency'; subcategory = 'jumbo';
    s = s.replace(/^Jumbo\b/i, '').trim();
  } else if (/^DSCR\b/i.test(s)) {
    loanType = 'dscr'; investor = null; category = 'nonqm'; subcategory = 'dscr';
    s = s.replace(/^DSCR\b/i, '').trim();
  } else if (/^Non-?QM\b/i.test(s)) {
    loanType = 'nonqm'; investor = null; category = 'nonqm'; subcategory = 'nonqm';
    s = s.replace(/^Non-?QM\b/i, '').trim();
  } else if (/^NonQM\s+DSCR\b/i.test(s)) {
    loanType = 'dscr'; investor = null; category = 'nonqm'; subcategory = 'dscr';
    s = s.replace(/^NonQM\s+DSCR\b/i, '').trim();
  } else if (/^Expanded\s+Prime\s+Plus\b/i.test(s)) {
    loanType = 'bankstatement'; investor = null; category = 'nonqm'; subcategory = 'bankstatement';
    s = s.replace(/^Expanded\s+Prime\s+Plus\b/i, '').trim();
  } else {
    loanType = 'unknown'; investor = null; category = 'unknown'; subcategory = 'unknown';
  }

  // Handle "NonQM DSCR" where NonQM comes first (already consumed above won't match
  // if the original name was "NonQM DSCR 5/6 SOFR ARM Elite")
  if (loanType === 'unknown' && /NonQM/i.test(raw)) {
    loanType = 'dscr'; investor = null; category = 'nonqm'; subcategory = 'dscr';
  }

  // --- Term ---
  let term = 30; // default
  // "25/30yr", "10/15Yr", "20/25/30Yr", "10yr", "15yr", "20yr", "30yr", "30 Yr."
  // For multi-term like "25/30yr" take the largest
  const termMatch = s.match(/(\d+(?:\/\d+)*)\s*(?:Yr\.?|yr)/i);
  if (termMatch) {
    const parts = termMatch[1].split('/').map(Number);
    term = Math.max(...parts);
    s = s.replace(/\d+(?:\/\d+)*\s*(?:Yr\.?|yr)/gi, '').trim();
  } else if (/\b(\d+)\s*Year\b/i.test(s)) {
    term = parseInt(s.match(/(\d+)\s*Year/i)[1], 10);
    s = s.replace(/\d+\s*Year/gi, '').trim();
  }

  // --- Product type ---
  let productType = 'fixed';
  if (isARM) productType = 'arm';
  if (/\bFixed\b/i.test(s)) productType = 'fixed';
  s = s.replace(/\bFixed\b/gi, '').trim();

  // --- DSCR sheet number ---
  let dscrSheet = null;
  const dscrSheetMatch = s.match(/\b(?:Rate\s*Sheet|Select\s*Rate\s*Sheet|Plus)\s*(\d+)?/i);
  if (dscrSheetMatch) {
    dscrSheet = dscrSheetMatch[1] ? parseInt(dscrSheetMatch[1], 10) : null;
    s = s.replace(/\b(?:Rate\s*Sheet|Select\s*Rate\s*Sheet|Plus)\s*\d*/gi, '').trim();
  }

  // --- State filters (FL, TX in Core products) ---
  let stateFilter = null;
  const stateMatch = s.match(/\b(FL|TX)\b/);
  if (stateMatch) {
    stateFilter = stateMatch[1];
    s = s.replace(/\b(FL|TX)\b/, '').trim();
  }

  // --- PR occupancy in remaining text ---
  if (/\bPR\b/.test(s)) { occupancy = 'primary'; s = s.replace(/\bPR\b/, '').trim(); }

  // Clean up extra hyphens/dashes/spaces
  s = s.replace(/[-–—]+/g, ' ').replace(/\s+/g, ' ').trim();

  return {
    rawName: raw,
    loanType,
    investor,
    category,
    subcategory,
    term,
    productType,
    armStructure,
    tier,
    occupancy,
    isHighBalance,
    loanAmountRange: { min: loanAmountMin, max: loanAmountMax },
    ficoFilter,
    isStreamline,
    dscrSheet,
    stateFilter,
  };
}

/**
 * Generate a stable program ID from parsed fields
 */
function makeProgramId(p) {
  const parts = [];
  if (p.investor) parts.push(p.investor);
  else if (p.subcategory) parts.push(p.subcategory);
  parts.push(`${p.term}yr`);
  parts.push(p.productType);
  if (p.armStructure) parts.push(p.armStructure.replace('/', '-'));
  parts.push(p.tier);
  if (p.occupancy !== 'primary') parts.push(p.occupancy);
  if (p.isHighBalance) parts.push('highbal');
  if (p.isStreamline) parts.push('streamline');
  if (p.ficoFilter) parts.push(`fico_lt${p.ficoFilter.max + 1}`);
  if (p.stateFilter) parts.push(p.stateFilter.toLowerCase());
  if (p.loanAmountRange.min || p.loanAmountRange.max) {
    const minK = p.loanAmountRange.min ? `${p.loanAmountRange.min / 1000}k` : '0';
    const maxK = p.loanAmountRange.max ? `${p.loanAmountRange.max / 1000}k` : 'up';
    parts.push(`${minK}-${maxK}`);
  }
  return parts.join('_');
}

/**
 * Make a human-readable name from parsed fields
 */
function makeProgramName(p) {
  const parts = [];
  if (p.investor) parts.push(p.investor.toUpperCase());
  else if (p.subcategory === 'jumbo') parts.push('Jumbo');
  else if (p.subcategory === 'dscr') parts.push('DSCR');
  else if (p.subcategory === 'nonqm') parts.push('Non-QM');
  else if (p.subcategory === 'bankstatement') parts.push('Expanded Prime Plus');
  if (p.isStreamline) parts.push('Streamline');
  parts.push(`${p.term}yr`);
  if (p.productType === 'arm') {
    parts.push(`${p.armStructure} ARM`);
  } else {
    parts.push('Fixed');
  }
  const tier = p.tier.charAt(0).toUpperCase() + p.tier.slice(1);
  parts.push(tier);
  if (p.occupancy === 'investment') parts.push('NOO');
  if (p.occupancy === 'secondary') parts.push('SH');
  if (p.isHighBalance) parts.push('High Balance');
  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// CSV Parser
// ---------------------------------------------------------------------------

/**
 * Parse the rate CSV content into normalized programs array.
 * @param {string} csvContent - raw CSV text
 * @returns {{ sheetDate: string, programs: Array }}
 */
function parseRates(csvContent) {
  const lines = csvContent.trim().split(/\r?\n/);
  if (lines.length < 2) return { sheetDate: null, programs: [] };

  // Skip header, filter to 30-day locks only (only lock period we display)
  const header = lines[0].split(',');
  const rows = lines.slice(1).map(line => {
    const parts = line.split(',');
    return {
      product: parts[0],
      lockDays: parseInt(parts[1], 10),
      rate: parseFloat(parts[2]),
      price: parseFloat(parts[3]),
      releaseTime: parts[4],
    };
  }).filter(r => r.lockDays === 30)
    .filter(r => {
      // Exclude state-specific products (FL, TX, NY variants)
      // These have state codes embedded in the product name like "FNMA 25/30Yr Fixed FL > 400K Core"
      // They use different base prices that only apply in those states
      return !/ (FL|TX|NY|CA|IL|PA|NJ|CT|MA|MD|VA|GA|OH|MI|WA|AZ|NV|MN) /.test(r.product);
    });

  // Extract sheet date from Release Time
  let sheetDate = null;
  if (rows.length > 0 && rows[0].releaseTime) {
    const m = rows[0].releaseTime.match(/(\d+)\/(\d+)\/(\d+)/);
    if (m) {
      const month = m[1].padStart(2, '0');
      const day = m[2].padStart(2, '0');
      const year = m[3].length === 4 ? m[3] : `20${m[3]}`;
      sheetDate = `${year}-${month}-${day}`;
    }
  }

  // Group rows by product name
  const productGroups = {};
  for (const row of rows) {
    if (!productGroups[row.product]) productGroups[row.product] = [];
    productGroups[row.product].push(row);
  }

  const programs = [];

  for (const [productName, entries] of Object.entries(productGroups)) {
    const parsed = parseProductName(productName);
    const id = makeProgramId(parsed);
    const name = makeProgramName(parsed);

    // Collect all lock days
    const lockDaysSet = new Set(entries.map(e => e.lockDays));
    const lockDays = [...lockDaysSet].sort((a, b) => a - b);

    // Build rates array
    const rates = entries.map(e => ({
      rate: e.rate,
      lockDays: e.lockDays,
      price: e.price,
    }));

    programs.push({
      id,
      name,
      category: parsed.category,
      subcategory: parsed.subcategory,
      loanType: parsed.loanType,
      investor: parsed.investor,
      term: parsed.term,
      productType: parsed.productType,
      armStructure: parsed.armStructure,
      tier: parsed.tier,
      occupancy: parsed.occupancy,
      isHighBalance: parsed.isHighBalance,
      loanAmountRange: parsed.loanAmountRange,
      ficoFilter: parsed.ficoFilter,
      isStreamline: parsed.isStreamline || false,
      stateFilter: parsed.stateFilter,
      priceFormat: '100-based',
      rates,
      lockDays,
    });
  }

  return { sheetDate, programs };
}

// ---------------------------------------------------------------------------
// XLSX / LLPA Parser
// ---------------------------------------------------------------------------

/**
 * Read a cell value from a worksheet, handling missing cells.
 */
function cellVal(ws, r, c) {
  const addr = XLSX.utils.encode_cell({ r, c });
  const cell = ws[addr];
  if (!cell) return null;
  return cell.v;
}

function cellStr(ws, r, c) {
  const v = cellVal(ws, r, c);
  if (v == null) return '';
  return String(v).trim();
}

function cellNum(ws, r, c) {
  const v = cellVal(ws, r, c);
  if (v == null || v === '' || v === 'na' || v === 'NA' || v === 'n/a') return null;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return isNaN(n) ? null : round(n, 4);
}

/**
 * Find the row range of the sheet.
 */
function sheetRange(ws) {
  if (!ws['!ref']) return { startRow: 0, endRow: 0, startCol: 0, endCol: 0 };
  const range = XLSX.utils.decode_range(ws['!ref']);
  return { startRow: range.s.r, endRow: range.e.r, startCol: range.s.c, endCol: range.e.c };
}

// Standard LTV band labels for agency LLPA sheets
const STANDARD_LTV_BANDS = [
  '0-30', '30.01-60', '60.01-70', '70.01-75', '75.01-80',
  '80.01-85', '85.01-90', '90.01-95', '95.01-97'
];

// DSCR CLTV band labels
const DSCR_CLTV_BANDS = [
  '0-50', '50.01-55', '55.01-60', '60.01-65', '65.01-70',
  '70.01-75', '75.01-80', '80.01-85', '85.01-90', '90.01-95'
];

/**
 * Parse a conventional agency LLPA sheet (Elite FNMA LLPA, Elite FHLMC LLPA).
 * Structure: sections for Purchase, Rate/Term, Cashout (each Terms > 15yr).
 * Each section has a FICO x LTV grid followed by a Loan Attribute grid.
 */
function parseConvLLPASheet(ws) {
  const { endRow, endCol } = sheetRange(ws);
  const result = {};
  const sections = [];
  let currentSection = null;
  let mode = null; // 'fico_ltv' or 'attributes'
  let ltvBandCols = [];
  let ltvBandLabels = [];

  function readLtvHeaders(row, startCol) {
    ltvBandCols = [];
    ltvBandLabels = [];
    for (let c = startCol; c <= Math.min(endCol, 12); c++) {
      const label = cellStr(ws, row, c);
      if (label && /\d/.test(label)) {
        ltvBandCols.push(c);
        ltvBandLabels.push(label.replace(/[%\s]/g, ''));
      }
    }
  }

  function readLtvValues(row) {
    const bands = {};
    for (let i = 0; i < ltvBandCols.length; i++) {
      bands[ltvBandLabels[i]] = cellNum(ws, row, ltvBandCols[i]);
    }
    return bands;
  }

  for (let r = 0; r <= endRow; r++) {
    const b = cellStr(ws, r, 1);

    // --- Section headers (create new section objects) ---
    const sectionMatch = detectConvSectionHeader(b);
    if (sectionMatch) {
      currentSection = { ...sectionMatch, ficoLtv: [], attributes: [] };
      sections.push(currentSection);
      mode = null;
      continue;
    }

    // --- Attribute sub-header (stays in current section) ---
    if (/Loan\s+Attribute/i.test(b)) {
      mode = null; // will be set to 'attributes' when we see Product Feature row
      continue;
    }

    if (!currentSection) continue;

    // --- FICO header row ---
    if (b === 'FICO' || b === 'FICO Range') {
      readLtvHeaders(r, 2);
      mode = 'fico_ltv';
      continue;
    }

    // --- Product Feature header row ---
    if (b === 'Product Feature') {
      readLtvHeaders(r, 2);
      mode = 'attributes';
      continue;
    }

    // --- Data rows ---
    if (mode === 'fico_ltv' && b) {
      const ficoBand = parseFicoBand(b);
      if (ficoBand) {
        currentSection.ficoLtv.push({
          ficoMin: ficoBand.min,
          ficoMax: ficoBand.max,
          ltvBands: readLtvValues(r),
        });
      }
    }

    if (mode === 'attributes' && b && !/^\(/.test(b) && !/^LTV/.test(b)) {
      const ltvBands = readLtvValues(r);
      const hasAny = Object.values(ltvBands).some(v => v !== null);
      if (hasAny) {
        currentSection.attributes.push({ name: b, ltvBands });
      }
    }

    // Reset mode on empty row
    if (!b && mode) {
      mode = null;
    }
  }

  // Organize into output structure
  for (const section of sections) {
    if (!result[section.purpose]) result[section.purpose] = {};
    result[section.purpose][section.termGroup] = {
      ficoLtv: section.ficoLtv,
      attributes: section.attributes,
    };
  }

  return result;
}

/**
 * Detect a conventional LLPA section header from column B text.
 * Returns { purpose, termGroup } or null.
 */
function detectConvSectionHeader(text) {
  if (!text) return null;
  // Purchase
  if (/Purchase\s+LLPAs?\s*\(Terms?\s*>\s*15/i.test(text)) return { purpose: 'purchase', termGroup: 'longTerm' };
  if (/Purchase\s+LLPAs?\s*\(Terms?\s*<=?\s*15/i.test(text)) return { purpose: 'purchase', termGroup: 'shortTerm' };
  // Rate/Term
  if (/Rate\/Term\s+Refinance\s+LLPAs?\s*\(Terms?\s*>\s*15/i.test(text)) return { purpose: 'rateTerm', termGroup: 'longTerm' };
  if (/Rate\/Term\s+Refinance\s+LLPAs?\s*\(Terms?\s*<=?\s*15/i.test(text)) return { purpose: 'rateTerm', termGroup: 'shortTerm' };
  if (/Rate\/Term\s+Refinance\s+FICO/i.test(text)) return { purpose: 'rateTerm', termGroup: 'longTerm' };
  // Cashout
  if (/Cash\s*Out\s+Refinance\s+LLPAs?\s*\(Terms?\s*>\s*15/i.test(text)) return { purpose: 'cashout', termGroup: 'longTerm' };
  if (/Cash\s*Out\s+Refinance\s+LLPAs?\s*\(Terms?\s*<=?\s*15/i.test(text)) return { purpose: 'cashout', termGroup: 'shortTerm' };
  if (/Cash\s*Out\s+Refinance\s+LLPAs?\s*\(all/i.test(text)) return { purpose: 'cashout', termGroup: 'longTerm' };
  if (/Cash\s*Out\s+Refinance\s+FICO/i.test(text)) return { purpose: 'cashout', termGroup: 'longTerm' };
  return null;
}

/**
 * Parse a government LLPA sheet (Elite FHA LLPA, Elite VA LLPA).
 * These have a different structure:
 *   - FICO x Loan Amount adjustment grid (not LTV)
 *   - State tiers
 *   - Purpose adjustments (Purchase/R-T/Cashout) by state tier x FICO x LTV
 */
function parseGovtLLPASheet(ws) {
  const { endRow, endCol } = sheetRange(ws);
  const result = {
    ficoLoanAmount: [],
    stateTiers: [],
    purposeAdjustments: {},
  };

  let mode = null;
  let loanAmountCols = [];
  let loanAmountLabels = [];
  let purposeLtvCols = [];
  let purposeLtvLabels = [];
  let currentPurpose = null;
  let currentTier = null;

  for (let r = 0; r <= endRow; r++) {
    const a = cellStr(ws, r, 0);
    const b = cellStr(ws, r, 1);
    const text = b || a;

    // FICO/Loan Amount section
    if (/FICO\/Loan\s+Amount/i.test(text)) {
      mode = 'fico_loan_amount';
      continue;
    }

    // State tiers section
    if (/State\s+Tiers/i.test(text)) {
      mode = 'state_tiers';
      continue;
    }

    // Purpose adjustment headers
    if (/Purchase\s+Adjustments/i.test(text)) {
      currentPurpose = 'purchase';
      mode = 'purpose_header';
      continue;
    }
    if (/(?:Rate\/?Term|Non\s*Cash\s*Out|NCO)\s+(?:Refi(?:nance)?|Refinance)\s+Adjustments/i.test(text) ||
        /R\/T\s+Refi\s+Adjustments/i.test(text)) {
      currentPurpose = 'rateTerm';
      mode = 'purpose_header';
      continue;
    }
    if (/Cash\s*Out\s+(?:Refi(?:nance)?\s+)?Adjustments/i.test(text)) {
      currentPurpose = 'cashout';
      mode = 'purpose_header';
      continue;
    }

    // FICO header for loan amount grid
    if (mode === 'fico_loan_amount' && (b === 'FICO' || text === 'FICO')) {
      loanAmountCols = [];
      loanAmountLabels = [];
      const startC = b === 'FICO' ? 2 : 1;
      for (let c = startC; c <= Math.min(endCol, 12); c++) {
        const label = cellStr(ws, r, c);
        if (label && /[\d$<>=]/.test(label)) {
          loanAmountCols.push(c);
          loanAmountLabels.push(label);
        }
      }
      continue;
    }

    // Parse FICO x loan amount data
    if (mode === 'fico_loan_amount' && loanAmountCols.length > 0) {
      const label = b || a;
      if (label) {
        const ficoBand = parseFicoBand(label);
        if (ficoBand) {
          const amounts = {};
          for (let i = 0; i < loanAmountCols.length; i++) {
            amounts[loanAmountLabels[i]] = cellNum(ws, r, loanAmountCols[i]);
          }
          result.ficoLoanAmount.push({
            ficoMin: ficoBand.min,
            ficoMax: ficoBand.max,
            loanAmountAdj: amounts,
          });
        }
      }
      if (!label) mode = null;
    }

    // Parse state tiers
    if (mode === 'state_tiers') {
      if (b === 'Tier') continue; // header row
      const tierNum = cellNum(ws, r, 1);
      const stateGroup = cellStr(ws, r, 2);
      if (tierNum !== null && stateGroup) {
        result.stateTiers.push({
          tier: tierNum,
          states: stateGroup.split(/[,\s]+/).map(s => s.trim()).filter(Boolean),
        });
      }
      if (!b && !a) mode = null;
    }

    // Parse purpose adjustment headers (detect the LTV column headers)
    if (mode === 'purpose_header') {
      // Look for the row with State Tier, FICO, and LTV columns
      const hasTier = /State\s+Tier/i.test(b) || /State\s+Tier/i.test(a);
      const hasFico = text === 'FICO' || /FICO/i.test(cellStr(ws, r, 2));
      if (hasTier || hasFico) {
        purposeLtvCols = [];
        purposeLtvLabels = [];
        for (let c = 3; c <= Math.min(endCol, 12); c++) {
          const label = cellStr(ws, r, c);
          if (label && /[\d%<>=]/.test(label)) {
            purposeLtvCols.push(c);
            purposeLtvLabels.push(label.replace(/\s/g, ''));
          }
        }
        mode = 'purpose_data';
        currentTier = null;
        if (!result.purposeAdjustments[currentPurpose]) {
          result.purposeAdjustments[currentPurpose] = [];
        }
        continue;
      }
    }

    // Parse purpose data rows
    if (mode === 'purpose_data') {
      const tierVal = cellNum(ws, r, 1);
      const ficoText = cellStr(ws, r, 2);
      if (tierVal !== null) currentTier = tierVal;
      if (ficoText && currentTier !== null) {
        const ficoBand = parseFicoBand(ficoText);
        if (ficoBand) {
          const ltvAdj = {};
          for (let i = 0; i < purposeLtvCols.length; i++) {
            ltvAdj[purposeLtvLabels[i]] = cellNum(ws, r, purposeLtvCols[i]);
          }
          result.purposeAdjustments[currentPurpose].push({
            stateTier: currentTier,
            ficoMin: ficoBand.min,
            ficoMax: ficoBand.max,
            ltvAdj,
          });
        }
      }
      if (!tierVal && !ficoText && !a) {
        // Check if next section starts
        const nextText = cellStr(ws, r + 1, 1) || cellStr(ws, r + 1, 0);
        if (!nextText || /Adjustments|LLPAs|Caps|Other/i.test(nextText)) {
          mode = null;
        }
      }
    }
  }

  return result;
}

/**
 * Parse a FICO band string like "780-799", "≥800", ">=780", "800+", "< 620(1)"
 */
function parseFicoBand(s) {
  s = s.trim();
  // "≥800" or ">=800" or "800+"
  let m = s.match(/[≥>=]+\s*(\d+)/);
  if (m) return { min: parseInt(m[1], 10), max: 999 };
  m = s.match(/(\d+)\+/);
  if (m) return { min: parseInt(m[1], 10), max: 999 };
  // "780-799", "780 - 799"
  m = s.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (m) return { min: parseInt(m[1], 10), max: parseInt(m[2], 10) };
  // "< 620" or "<620"
  m = s.match(/<\s*(\d+)/);
  if (m) return { min: 0, max: parseInt(m[1], 10) - 1 };
  return null;
}

/**
 * Parse a Core Conv LLPA sheet.
 * Structure: FICO/LTV sections for Purchase, Non-Cashout Refi, Cashout Refi,
 * then separate Product Feature attribute sections per purpose, then Risk-Based adjustments.
 */
function parseCoreLLPASheet(ws) {
  const { endRow, endCol } = sheetRange(ws);
  const result = {};
  // Map purpose key to section object
  const sectionMap = {};
  let currentPurpose = null;
  let mode = null;
  let ltvBandCols = [];
  let ltvBandLabels = [];

  function readLtvHeaders(row) {
    ltvBandCols = [];
    ltvBandLabels = [];
    for (let c = 1; c <= Math.min(endCol, 14); c++) {
      const label = cellStr(ws, row, c);
      if (label && /\d/.test(label) && !/FICO/i.test(label)) {
        ltvBandCols.push(c);
        ltvBandLabels.push(label.replace(/[%\s]/g, ''));
      }
    }
  }

  function readLtvValues(row) {
    const bands = {};
    for (let i = 0; i < ltvBandCols.length; i++) {
      bands[ltvBandLabels[i]] = cellNum(ws, row, ltvBandCols[i]);
    }
    return bands;
  }

  function ensureSection(purpose) {
    if (!sectionMap[purpose]) {
      sectionMap[purpose] = { ficoLtv: [], attributes: [] };
    }
    return sectionMap[purpose];
  }

  for (let r = 0; r <= endRow; r++) {
    const a = cellStr(ws, r, 0);
    const headerText = a;

    // --- Detect FICO/LTV sections ---
    if (/Purchase\s*[-–]?\s*(?:FICO|LLPAs)/i.test(headerText) && !/Product\s+Feature/i.test(headerText)) {
      currentPurpose = 'purchase';
      ensureSection(currentPurpose);
      mode = null;
      continue;
    }
    if (/Non\s*Cash\s*[Oo]ut\s+Refinance\s*[-–]?\s*(?:FICO|LLPAs)/i.test(headerText) && !/Product\s+Feature/i.test(headerText)) {
      currentPurpose = 'rateTerm';
      ensureSection(currentPurpose);
      mode = null;
      continue;
    }
    if (/Cash\s*[Oo]ut\s+Refinance\s*[-–]?\s*(?:FICO|LLPAs)/i.test(headerText) && !/Product\s+Feature/i.test(headerText)) {
      currentPurpose = 'cashout';
      ensureSection(currentPurpose);
      mode = null;
      continue;
    }

    // --- Detect Product Feature attribute sections ---
    if (/Purchase\s*[-–]?\s*LLPAs\s+by\s+Product\s+Feature/i.test(headerText)) {
      currentPurpose = 'purchase';
      ensureSection(currentPurpose);
      mode = null;
      continue;
    }
    if (/Non\s*Cash\s*[Oo]ut\s+Refinance\s*[-–]?\s*LLPAs\s+by\s+Product\s+Feature/i.test(headerText)) {
      currentPurpose = 'rateTerm';
      ensureSection(currentPurpose);
      mode = null;
      continue;
    }
    if (/Cash\s*[Oo]ut\s+Refinance\s*[-–]?\s*LLPAs\s+by\s+Product\s+Feature/i.test(headerText)) {
      currentPurpose = 'cashout';
      ensureSection(currentPurpose);
      mode = null;
      continue;
    }

    // --- Risk-Based section (additional data, separate purpose) ---
    if (/Risk\s+Based\s+Price\s+Adjustments/i.test(headerText)) {
      currentPurpose = 'riskBased';
      ensureSection(currentPurpose);
      mode = null;
      continue;
    }

    if (!currentPurpose) continue;

    // Detect FICO/Product Feature header rows
    if (a === 'FICO Range' || a === 'FICO') {
      readLtvHeaders(r);
      mode = 'fico_ltv';
      continue;
    }
    if (a === 'Product Feature') {
      readLtvHeaders(r);
      mode = 'attributes';
      continue;
    }

    // Data rows
    if (mode === 'fico_ltv' && a) {
      const ficoBand = parseFicoBand(a);
      if (ficoBand) {
        ensureSection(currentPurpose).ficoLtv.push({
          ficoMin: ficoBand.min,
          ficoMax: ficoBand.max,
          ltvBands: readLtvValues(r),
        });
      }
    }

    if (mode === 'attributes' && a && !/^\(/.test(a)) {
      const ltvBands = readLtvValues(r);
      const hasAny = Object.values(ltvBands).some(v => v !== null);
      if (hasAny) {
        ensureSection(currentPurpose).attributes.push({ name: a, ltvBands });
      }
    }

    // Reset mode on empty row
    if (!a && mode) {
      mode = null;
    }
  }

  // Organize into output — each purpose gets longTerm key (Core sheets don't split by term)
  for (const [purpose, section] of Object.entries(sectionMap)) {
    result[purpose] = { longTerm: section };
  }

  return result;
}

/**
 * Parse a DSCR LLPA sheet (e.g., "Elite DSCR 1 LLPAs")
 * These have FICO x CLTV grids broken by occupancy/purpose:
 *   Primary Purchase, Primary NCO Refi, Primary CO Refi,
 *   Second Purchase, Second NCO Refi, Second CO Refi,
 *   NOO Purchase, NOO NCO Refi, NOO CO Refi
 * Two main sections: Fixed Rate LLPAs and ARM LLPAs
 */
function parseDSCRLLPASheet(ws) {
  const { endRow, endCol } = sheetRange(ws);
  const result = { fixed: {}, arm: {} };

  let productTypeSection = 'fixed'; // 'fixed' or 'arm'
  let currentPurpose = null;
  let mode = null;
  let cltvBandCols = [];
  let cltvBandLabels = [];

  for (let r = 0; r <= endRow; r++) {
    const a = cellStr(ws, r, 0);

    // Detect Fixed vs ARM section
    if (/^Fixed\s+Rate\s+LLPAs/i.test(a)) {
      productTypeSection = 'fixed';
      continue;
    }
    if (/^ARM\s+LLPAs/i.test(a)) {
      productTypeSection = 'arm';
      continue;
    }

    // Detect purpose/occupancy headers
    if (/^Primary\s+Purchase$/i.test(a)) { currentPurpose = 'primaryPurchase'; continue; }
    if (/^Primary\s+NCO\s+Refi$/i.test(a)) { currentPurpose = 'primaryRateTerm'; continue; }
    if (/^Primary\s+CO\s+Refi$/i.test(a)) { currentPurpose = 'primaryCashout'; continue; }
    if (/^Second\s+Purchase$/i.test(a)) { currentPurpose = 'secondPurchase'; continue; }
    if (/^Second\s+NCO\s+Refi$/i.test(a)) { currentPurpose = 'secondRateTerm'; continue; }
    if (/^Second\s+CO\s+Refi$/i.test(a)) { currentPurpose = 'secondCashout'; continue; }
    if (/^NOO\s+Purchase$/i.test(a)) { currentPurpose = 'nooPurchase'; continue; }
    if (/^NOO\s+NCO\s+Refi$/i.test(a)) { currentPurpose = 'nooRateTerm'; continue; }
    if (/^NOO\s+CO\s+Refi$/i.test(a)) { currentPurpose = 'nooCashout'; continue; }

    // Detect CLTV header
    if (a === 'Credit Score') {
      cltvBandCols = [];
      cltvBandLabels = [];
      // Read CLTV band labels from row above (the range row) and this row
      // Row above has min values like "0 -", "50.01 -", row has max values like "50", "55"
      for (let c = 1; c <= 10; c++) {
        const rangeStart = cellStr(ws, r - 1, c);
        const rangeEnd = cellStr(ws, r, c);
        if (rangeStart && rangeEnd && /\d/.test(rangeStart)) {
          // Clean up labels: "0 -" → "0", "50.01 -" → "50.01"
          const cleanStart = rangeStart.replace(/\s*-\s*$/, '').trim();
          cltvBandCols.push(c);
          cltvBandLabels.push(`${cleanStart}-${rangeEnd}`);
        }
      }
      mode = 'fico_cltv';
      continue;
    }

    if (!currentPurpose) continue;

    if (mode === 'fico_cltv' && a) {
      const ficoBand = parseFicoBand(a);
      if (ficoBand) {
        const cltvBands = {};
        for (let i = 0; i < cltvBandCols.length; i++) {
          cltvBands[cltvBandLabels[i]] = cellNum(ws, r, cltvBandCols[i]);
        }

        if (!result[productTypeSection][currentPurpose]) {
          result[productTypeSection][currentPurpose] = [];
        }
        result[productTypeSection][currentPurpose].push({
          ficoMin: ficoBand.min,
          ficoMax: ficoBand.max,
          cltvBands,
        });
      }
    }
  }

  return result;
}

/**
 * Parse a Core sheet with a unique/non-standard format (FHA, VA, Jumbo, Non-QM).
 * Rather than try to force these into a common schema, we extract all grids
 * as labeled sections with their column headers and data rows.
 */
function parseRawGridSheet(ws) {
  const { endRow, endCol } = sheetRange(ws);
  const sections = [];
  let currentSection = null;
  let headerCols = [];
  let headerLabels = [];

  for (let r = 0; r <= endRow; r++) {
    // Collect all non-empty cells in this row
    const cells = [];
    for (let c = 0; c <= endCol; c++) {
      const v = cellStr(ws, r, c);
      if (v) cells.push({ col: c, val: v });
    }
    if (cells.length === 0) continue;

    // Detect section headers: rows where the first non-empty cell looks like a title
    // (long text, no numeric data in most columns)
    const firstVal = cells[0].val;
    const numericCells = cells.filter(c => /^-?\d/.test(c.val) || c.val === 'n/a' || c.val === 'na');

    // Header detection: row has a label in col 0 or 1 and few/no numeric values,
    // or contains marker words
    if (cells.length <= 3 && numericCells.length === 0 && firstVal.length > 5) {
      currentSection = { title: firstVal, grids: [] };
      sections.push(currentSection);
      headerCols = [];
      headerLabels = [];
      continue;
    }

    // Detect column header rows: contains range-like labels or FICO/CLTV headers
    if (/FICO|Credit\s+Score|Amort|Range/i.test(firstVal) ||
        cells.some(c => /^[<>=≤≥]\s*\d/.test(c.val) || /\d+\s*[-–]\s*\d+/.test(c.val))) {
      // Check if this looks like a header row (has labels, not data)
      const hasNumericData = cells.some(c =>
        /^-?\d+\.?\d*$/.test(c.val) && !/^\d{3,}$/.test(c.val)); // exclude FICO-like numbers
      if (!hasNumericData || cells.length > 5) {
        headerCols = cells.map(c => c.col);
        headerLabels = cells.map(c => c.val);
        continue;
      }
    }

    // Data rows: have numeric values
    if (numericCells.length > 0 && headerCols.length > 0 && currentSection) {
      const rowData = {};
      for (let i = 0; i < headerCols.length; i++) {
        const val = cellStr(ws, r, headerCols[i]) || null;
        rowData[headerLabels[i]] = val;
      }
      // Also capture any values beyond the header columns
      for (const cell of cells) {
        if (!headerCols.includes(cell.col)) {
          rowData[`col_${cell.col}`] = cell.val;
        }
      }
      currentSection.grids.push(rowData);
    }
  }

  return { format: 'raw', sections };
}

/**
 * Parse the "Product Loan Amount LLPAs" sheet.
 * This has:
 *   - Rows 3-4: Column headers (product x term → loan amount bands)
 *   - Rows 5+: Data rows with product name, term, and adjustments by loan amount band
 *   - Additional columns for underwriting fee, property type, FICO adjustments, etc.
 */
function parseLoanAmountSheet(ws) {
  const { endRow, endCol } = sheetRange(ws);

  // Parse loan amount band headers from rows 3-4 (0-indexed)
  const loanAmountBands = [];
  for (let c = 2; c <= 28; c++) {
    const minVal = cellVal(ws, 3, c);
    const maxVal = cellVal(ws, 4, c);
    if (minVal != null && maxVal != null) {
      loanAmountBands.push({
        col: c,
        min: typeof minVal === 'number' ? minVal : parseInt(String(minVal).replace(/,/g, ''), 10),
        max: typeof maxVal === 'number' ? maxVal : parseInt(String(maxVal).replace(/,/g, ''), 10),
      });
    }
  }

  const products = [];

  for (let r = 5; r <= endRow; r++) {
    const productName = cellStr(ws, r, 0);
    const term = cellStr(ws, r, 1);

    // Skip header rows and empty rows
    if (!productName || !term || /header/i.test(productName)) continue;

    const loanAmountAdj = {};
    for (const band of loanAmountBands) {
      const val = cellNum(ws, r, band.col);
      loanAmountAdj[`${band.min}-${band.max}`] = val;
    }

    // Parse additional adjustment columns
    const additionalAdj = {};
    const uwFee = cellNum(ws, r, 30);
    if (uwFee !== null) additionalAdj.underwritingFee = uwFee;

    const condoAdj = cellNum(ws, r, 32);
    if (condoAdj !== null) additionalAdj.condo = condoAdj;

    const mfgAdj = cellNum(ws, r, 33);
    if (mfgAdj !== null) additionalAdj.manufactured = mfgAdj;

    const ltvFicoAdj = cellNum(ws, r, 35);
    if (ltvFicoAdj !== null) additionalAdj.ltv95FicoLt700 = ltvFicoAdj;

    const ltv95Adj = cellNum(ws, r, 36);
    if (ltv95Adj !== null) additionalAdj.ltv95 = ltv95Adj;

    const ltv85Adj = cellNum(ws, r, 37);
    if (ltv85Adj !== null) additionalAdj.ltv85 = ltv85Adj;

    const flCondoAdj = cellNum(ws, r, 38);
    if (flCondoAdj !== null) additionalAdj.floridaCondo = flCondoAdj;

    const manualUW = cellNum(ws, r, 40);
    if (manualUW !== null) additionalAdj.manualUW = manualUW;

    // FICO adjustments (cols 43-48)
    const ficoAdj = {};
    const ficoRanges = [
      { col: 44, label: '0-619' },
      { col: 45, label: '620-639' },
      { col: 46, label: '640-699' },
      { col: 47, label: '700+' },
      { col: 48, label: '0-680' },
    ];
    for (const fr of ficoRanges) {
      const val = cellNum(ws, r, fr.col);
      if (val !== null) ficoAdj[fr.label] = val;
    }
    if (Object.keys(ficoAdj).length > 0) additionalAdj.fico = ficoAdj;

    // Purpose adjustments (cols 50-52)
    const purchaseAdj = cellNum(ws, r, 50);
    const rateTermAdj = cellNum(ws, r, 51);
    const cashoutAdj = cellNum(ws, r, 52);
    if (purchaseAdj !== null || rateTermAdj !== null || cashoutAdj !== null) {
      additionalAdj.purpose = {
        purchase: purchaseAdj,
        rateTerm: rateTermAdj,
        cashout: cashoutAdj,
      };
    }

    // State MI (col 54)
    const stateMI = cellNum(ws, r, 54);
    if (stateMI !== null) additionalAdj.stateMI = stateMI;

    // DSCR < 1 (col 56)
    const dscrLt1 = cellStr(ws, r, 56);
    if (dscrLt1 && dscrLt1 !== '-') additionalAdj.dscrLt1 = dscrLt1;

    products.push({
      product: productName,
      term,
      loanAmountAdj,
      additionalAdj,
    });
  }

  return { loanAmountBands: loanAmountBands.map(b => ({ min: b.min, max: b.max })), products };
}

/**
 * Parse all LLPA sheets from the XLSX workbook.
 * @param {Buffer} xlsxBuffer - raw XLSX file buffer
 * @returns {Object} structured LLPA data
 */
function parseLLPAs(xlsxBuffer) {
  const wb = XLSX.read(xlsxBuffer, { type: 'buffer' });

  const llpas = {
    elite: {},
    core: {},
    loanAmount: null,
  };

  // Conventional LLPA sheets (FICO x LTV grids)
  const convSheetMap = {
    'Elite FNMA LLPA': { tier: 'elite', key: 'fnma' },
    'Elite FHLMC LLPA': { tier: 'elite', key: 'fhlmc' },
  };

  // Government LLPA sheets (FICO x Loan Amount + state tiers + purpose adjustments)
  const govtSheetMap = {
    'Elite FHA LLPA': { tier: 'elite', key: 'fha' },
    'Elite VA LLPA': { tier: 'elite', key: 'va' },
  };

  // Core Conv uses the same format as Elite agency (FICO x LTV by purpose)
  const coreSheetMap = {
    'Core Conv LLPAs': { tier: 'core', key: 'conventional' },
  };

  const dscrSheetMap = {
    'Elite DSCR 1 LLPAs': { tier: 'elite', key: 'dscr1' },
    'Elite DSCR 2 LLPAs': { tier: 'elite', key: 'dscr2' },
    'Elite DSCR 5 LLPAs': { tier: 'elite', key: 'dscr5' },
    'Elite Non QM 1 LLPAs': { tier: 'elite', key: 'nonqm1' },
  };

  for (const [sheetName, config] of Object.entries(convSheetMap)) {
    if (wb.Sheets[sheetName]) {
      try {
        llpas[config.tier][config.key] = parseConvLLPASheet(wb.Sheets[sheetName]);
      } catch (e) {
        console.error(`Error parsing ${sheetName}:`, e.message);
        llpas[config.tier][config.key] = { error: e.message };
      }
    }
  }

  for (const [sheetName, config] of Object.entries(govtSheetMap)) {
    if (wb.Sheets[sheetName]) {
      try {
        llpas[config.tier][config.key] = parseGovtLLPASheet(wb.Sheets[sheetName]);
      } catch (e) {
        console.error(`Error parsing ${sheetName}:`, e.message);
        llpas[config.tier][config.key] = { error: e.message };
      }
    }
  }

  for (const [sheetName, config] of Object.entries(coreSheetMap)) {
    if (wb.Sheets[sheetName]) {
      try {
        llpas[config.tier][config.key] = parseCoreLLPASheet(wb.Sheets[sheetName]);
      } catch (e) {
        console.error(`Error parsing ${sheetName}:`, e.message);
        llpas[config.tier][config.key] = { error: e.message };
      }
    }
  }

  for (const [sheetName, config] of Object.entries(dscrSheetMap)) {
    if (wb.Sheets[sheetName]) {
      try {
        llpas[config.tier][config.key] = parseDSCRLLPASheet(wb.Sheets[sheetName]);
      } catch (e) {
        console.error(`Error parsing ${sheetName}:`, e.message);
        llpas[config.tier][config.key] = { error: e.message };
      }
    }
  }

  // Core FHA, VA, Jumbo, Non-QM have unique formats — parse as raw grids
  const rawCoreSheets = {
    'Core FHA LLPAs': 'fha',
    'Core VA LLPAs': 'va',
    'Core Jumbo LLPAs': 'jumbo',
    'Core Non-QM': 'nonqm',
  };
  for (const [sheetName, key] of Object.entries(rawCoreSheets)) {
    if (wb.Sheets[sheetName]) {
      try {
        llpas.core[key] = parseRawGridSheet(wb.Sheets[sheetName]);
      } catch (e) {
        console.error(`Error parsing ${sheetName}:`, e.message);
        llpas.core[key] = { error: e.message };
      }
    }
  }

  // Parse Product Loan Amount LLPAs
  if (wb.Sheets['Product Loan Amount LLPAs']) {
    try {
      llpas.loanAmount = parseLoanAmountSheet(wb.Sheets['Product Loan Amount LLPAs']);
    } catch (e) {
      console.error('Error parsing Product Loan Amount LLPAs:', e.message);
      llpas.loanAmount = { error: e.message };
    }
  }

  return llpas;
}

/**
 * Convert a parsed FICO/LTV section into the standard engine format.
 * Input: { ficoLtv: [{ ficoMin, ficoMax, ltvBands: { "0-30": 0.25, ... } }], attributes: [...] }
 * Output: { matrix: { ">=780": [vals...], ... }, ltvBands: [...] }
 */
function convertFicoLtvToStandard(section) {
  if (!section?.ficoLtv?.length) return null;

  const rawLtvBands = Object.keys(section.ficoLtv[0].ltvBands);
  // Normalize LTV band labels: "≤30" → "<=30"
  const ltvBands = rawLtvBands.map(b => b.replace(/≤/g, '<=').replace(/≥/g, '>='));
  const matrix = {};

  for (const row of section.ficoLtv) {
    let ficoKey;
    if (row.ficoMax >= 999 || row.ficoMax >= 850) {
      ficoKey = `>=${row.ficoMin}`;
    } else {
      ficoKey = `${row.ficoMin}-${row.ficoMax}`;
    }
    // Negate: EverStream sheet uses negative = cost, engine expects positive = cost
    matrix[ficoKey] = rawLtvBands.map(band => {
      const v = row.ltvBands[band];
      return v === null || v === undefined ? null : (v === 0 ? 0 : -v);
    });
  }

  // Convert attributes to standard format (also negate)
  const additional = {};
  if (section.attributes) {
    for (const attr of section.attributes) {
      const key = attr.name.toLowerCase();
      const values = rawLtvBands.map(band => {
        const v = attr.ltvBands[band];
        return v === null || v === undefined ? null : (v === 0 ? 0 : -v);
      });
      if (/arm/i.test(key)) additional.arm = values;
      else if (/condo/i.test(key)) additional.condo = values;
      else if (/2\s*unit/i.test(key)) additional['2unit'] = values;
      else if (/3.*4\s*unit/i.test(key)) additional['3to4unit'] = values;
      else if (/investment/i.test(key)) additional.investment = values;
      else if (/second\s*home/i.test(key)) additional.secondHome = values;
      else if (/secondary\s*fin|subordinate/i.test(key)) additional.subFinancing = values;
      else if (/highbal.*frm|highbal.*fixed/i.test(key)) additional.highBalFixed = values;
      else if (/highbal.*arm/i.test(key)) additional.highBalArm = values;
      else if (/manufactured/i.test(key)) additional.manufactured = values;
    }
  }

  return { matrix, ltvBands, additional };
}

/**
 * Convert parsed LLPAs into the standard format for the pricing engine.
 * Uses Elite FNMA as the primary source (most common products).
 */
function convertLlpasToStandard(llpas) {
  if (!llpas?.elite?.fnma) return { llpas: null, additionalAdjustments: null };

  const fnma = llpas.elite.fnma;
  const result = { purchase: {}, refinance: {}, cashout: {}, ltvBands: [] };
  const additional = { purchase: {}, refinance: {}, cashout: {} };

  const purchaseData = convertFicoLtvToStandard(fnma.purchase?.longTerm);
  if (purchaseData) {
    result.purchase = purchaseData.matrix;
    result.ltvBands = purchaseData.ltvBands;
    additional.purchase = purchaseData.additional;
  }

  const refiData = convertFicoLtvToStandard(fnma.rateTerm?.longTerm);
  if (refiData) {
    result.refinance = refiData.matrix;
    additional.refinance = refiData.additional;
  }

  const cashoutData = convertFicoLtvToStandard(fnma.cashout?.longTerm);
  if (cashoutData) {
    result.cashout = cashoutData.matrix;
    additional.cashout = cashoutData.additional;
  }

  return { llpas: result, additionalAdjustments: additional };
}

/**
 * Combined parser — takes CSV content and XLSX buffer, returns normalized output.
 * @param {string} csvContent
 * @param {Buffer} xlsxBuffer
 * @returns {Object}
 */
function parse(csvContent, xlsxBuffer) {
  const { sheetDate, programs } = parseRates(csvContent);
  const rawLlpas = xlsxBuffer ? parseLLPAs(xlsxBuffer) : null;

  // Convert to standard format
  const { llpas, additionalAdjustments } = rawLlpas ? convertLlpasToStandard(rawLlpas) : { llpas: null, additionalAdjustments: null };

  return {
    lenderId,
    sheetDate,
    programs,
    llpas,
    loanAmountAdj: [],
    stateAdj: { MI: { adj30yr: 0.1, adj15yr: 0.1 } },
    specPayups: {},
    pricingSpecials: null,
    occupancyAdj: null,
    lenderFee: 999,
    compCap: { purchase: 4595, refinance: 3595 },
    // EverStream-specific
    agencyLlpas: additionalAdjustments,
    rawLlpas,
  };
}

module.exports = { parseRates, parseLLPAs, parse, lenderId };
