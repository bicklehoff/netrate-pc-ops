/**
 * The Loan Store (TLS) Rate Sheet Parser
 *
 * Parses a single CSV file with format:
 *   Publication Effective Date: MM/DD/YYYY HH:MM:SS
 *   (blank line)
 *   Product Code,Rate,15 Days Lock,30 Days Lock,45 Days Lock,60 Days Lock
 *   CONF30,5.875,0.037,0.115,0.251,0.397
 *   ...
 *
 * Prices are in discount/rebate format:
 *   positive = cost (points the borrower pays)
 *   negative = rebate (lender credit)
 *   0 = par
 *
 * Product codes encode: loan type, term, product variant
 *   CONF30 = Conventional 30yr Fixed
 *   FHA30 = FHA 30yr Fixed
 *   VA30 = VA 30yr Fixed
 *   USDA30 = USDA 30yr Fixed
 *   CONF30HB = Conventional 30yr High Balance
 *   J30_E1 = Jumbo 30yr (tier E1)
 *   N30_E35_DSCR = Non-QM 30yr DSCR (tier E35)
 *   N30_E35_BKST = Non-QM 30yr Bank Statement (tier E35)
 *   H1M_WB_HELOC = HELOC
 *   CONF301/0BD = Conventional 30yr 1-0 Buydown
 *   etc.
 *
 * Exports: parseRates, parse, lenderId
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const lenderId = 'tls';

// ---------------------------------------------------------------------------
// Product Code Decoder
// ---------------------------------------------------------------------------

/**
 * Map a TLS product code to structured fields.
 *
 * Naming conventions observed:
 *   Prefix: CONF, FHA, VA, USDA, J (Jumbo), N (Non-QM), H (HELOC)
 *   Term: number after prefix (10, 15, 20, 25, 30, 40)
 *   Suffixes: HB (high balance), HR (HomeReady), HP (HomePossible),
 *             STR (streamline), IRRRL (VA streamline), R (refi-only?)
 *   Buydown: 1/0BD, 2/1BD, 3/2/1BD
 *   Non-QM tiers: E32, E35, E39, E40, E43, E44, E45
 *   Non-QM doc: DSCR, BKST (bank statement), FULL_BKST, INV_BKST, ASSET_BKST, EXP_BKST
 *   Non-QM features: I/O (interest only), MAX, EXC
 *   ARM: 5/6ARM, 7/6ARM, 10/6ARM
 *   2nds: _2ND suffix with OO/NOO
 */
function decodeProductCode(code) {
  const raw = code;
  let loanType, category, subcategory, term, productType, occupancy;
  let isHighBalance = false;
  let isStreamline = false;
  let isBuydown = false;
  let buydownStructure = null;
  let armStructure = null;
  let isInterestOnly = false;
  let docType = null;
  let tier = null;
  let variant = null;

  // --- HELOC ---
  if (/^H\d+M.*HELOC$/i.test(code)) {
    return {
      raw, loanType: 'heloc', category: 'other', subcategory: 'heloc',
      term: 30, productType: 'variable', occupancy: 'primary',
      isHighBalance: false, isStreamline: false, isBuydown: false,
      armStructure: null, isInterestOnly: false, docType: null, tier: null,
    };
  }

  // --- 2nd Liens (Non-QM) ---
  if (/_2ND$/i.test(code)) {
    const nooMatch = /NOO/.test(code);
    occupancy = nooMatch ? 'investment' : 'primary';
    const termMatch = code.match(/^N(\d+)/);
    term = termMatch ? parseInt(termMatch[1], 10) : 30;
    const tierMatch = code.match(/_E(\d+)_/);
    tier = tierMatch ? `E${tierMatch[1]}` : null;
    return {
      raw, loanType: 'second', category: 'nonqm', subcategory: 'second',
      term, productType: 'fixed', occupancy,
      isHighBalance: false, isStreamline: false, isBuydown: false,
      armStructure: null, isInterestOnly: false, docType: null, tier,
    };
  }

  // --- Non-QM (N prefix) ---
  if (/^N\d/.test(code)) {
    category = 'nonqm';

    // Interest only
    isInterestOnly = /I\/O/.test(code);

    // ARM
    const armMatch = code.match(/(\d+)\/(\d+)_/);
    if (armMatch && code.startsWith('N7/6')) {
      armStructure = '7/6';
      productType = 'arm';
    } else {
      productType = 'fixed';
    }

    // Term (first number after N, or after I/O_)
    const termMatch = code.match(/^N(?:\d+\/\d+_)?(\d+)/);
    if (!termMatch && isInterestOnly) {
      const ioTerm = code.match(/I\/O_[A-Z]*(\d+)/);
      term = ioTerm ? parseInt(ioTerm[1], 10) : 30;
    } else {
      term = termMatch ? parseInt(termMatch[1], 10) : 30;
    }

    // Tier
    const tierMatch = code.match(/_E(\d+)_/);
    tier = tierMatch ? `E${tierMatch[1]}` : null;

    // Doc type / subcategory
    if (/DSCR/.test(code)) {
      loanType = 'dscr'; subcategory = 'dscr'; docType = 'dscr';
    } else if (/BKST/.test(code)) {
      loanType = 'bankstatement'; subcategory = 'bankstatement';
      if (/INV_BKST/.test(code)) docType = 'investor-bankstatement';
      else if (/FULL_BKST/.test(code)) docType = 'full-bankstatement';
      else if (/ASSET_BKST/.test(code)) docType = 'asset-bankstatement';
      else if (/EXP_BKST/.test(code)) docType = 'expanded-bankstatement';
      else docType = 'bankstatement';
    } else {
      loanType = 'nonqm'; subcategory = 'nonqm'; docType = null;
    }

    // Variant flags
    const isMax = /_MAX/.test(code);
    const isExc = /_EXC/.test(code);
    variant = isMax ? 'max' : isExc ? 'exclusive' : null;

    return {
      raw, loanType, category, subcategory,
      term, productType, occupancy: 'primary',
      isHighBalance: false, isStreamline: false, isBuydown: false,
      armStructure, isInterestOnly, docType, tier, variant,
    };
  }

  // --- ARM detection for agency ---
  if (/ARM$/i.test(code)) {
    productType = 'arm';
    const armMatch = code.match(/(\d+)\/(\d+)(?:HB)?ARM/i);
    if (armMatch) armStructure = `${armMatch[1]}/${armMatch[2]}`;
  } else {
    productType = 'fixed';
  }

  // --- Jumbo (J prefix) ---
  if (/^J\d/.test(code)) {
    loanType = 'conventional'; category = 'agency'; subcategory = 'jumbo';
    const termMatch = code.match(/^J(\d+)/);
    term = termMatch ? parseInt(termMatch[1], 10) : 30;
    const tierMatch = code.match(/_E(\d+)/);
    tier = tierMatch ? `E${tierMatch[1]}` : null;
    return {
      raw, loanType, category, subcategory,
      term, productType, occupancy: 'primary',
      isHighBalance: false, isStreamline: false, isBuydown: false,
      armStructure, isInterestOnly: false, docType: null, tier,
    };
  }

  // --- Agency products ---
  occupancy = 'primary';

  // Conventional
  if (/^CONF/i.test(code)) {
    loanType = 'conventional'; category = 'agency'; subcategory = 'conventional';
    const termMatch = code.match(/^CONF(\d+)/i);
    term = termMatch ? parseInt(termMatch[1], 10) : 30;
    isHighBalance = /HB/i.test(code);
    isStreamline = false;

    // Buydowns
    if (/BD$/i.test(code)) {
      isBuydown = true;
      const bdMatch = code.match(/(\d+(?:\/\d+)*)BD/i);
      buydownStructure = bdMatch ? bdMatch[1] : null;
    }

    // HomeReady / HomePossible
    if (/HR/i.test(code) && !/IRRRL/.test(code)) variant = 'homeready';
    else if (/HP/i.test(code)) variant = 'homepossible';

    return {
      raw, loanType, category, subcategory,
      term, productType, occupancy,
      isHighBalance, isStreamline, isBuydown, buydownStructure,
      armStructure, isInterestOnly: false, docType: null, tier: null, variant,
    };
  }

  // FHA
  if (/^FHA/i.test(code)) {
    loanType = 'fha'; category = 'agency'; subcategory = 'fha';
    const termMatch = code.match(/^FHA(\d+)/i);
    term = termMatch ? parseInt(termMatch[1], 10) : 30;
    isHighBalance = /HB/i.test(code);
    isStreamline = /STR/i.test(code);

    if (/BD$/i.test(code)) {
      isBuydown = true;
      const bdMatch = code.match(/(\d+(?:\/\d+)*)BD/i);
      buydownStructure = bdMatch ? bdMatch[1] : null;
    }

    // CalHFA or other special programs
    if (/CF\d/.test(code)) variant = 'calhfa';

    return {
      raw, loanType, category, subcategory,
      term, productType, occupancy,
      isHighBalance, isStreamline, isBuydown, buydownStructure,
      armStructure, isInterestOnly: false, docType: null, tier: null, variant,
    };
  }

  // VA
  if (/^VA/i.test(code)) {
    loanType = 'va'; category = 'agency'; subcategory = 'va';
    const termMatch = code.match(/^VA(\d+)/i);
    term = termMatch ? parseInt(termMatch[1], 10) : 30;
    isHighBalance = /HB/i.test(code);
    isStreamline = /IRRRL/i.test(code);

    if (/BD$/i.test(code)) {
      isBuydown = true;
      const bdMatch = code.match(/(\d+(?:\/\d+)*)BD/i);
      buydownStructure = bdMatch ? bdMatch[1] : null;
    }

    return {
      raw, loanType, category, subcategory,
      term, productType, occupancy,
      isHighBalance, isStreamline, isBuydown, buydownStructure,
      armStructure, isInterestOnly: false, docType: null, tier: null,
    };
  }

  // USDA
  if (/^USDA/i.test(code)) {
    loanType = 'usda'; category = 'agency'; subcategory = 'usda';
    const termMatch = code.match(/^USDA(\d+)/i);
    term = termMatch ? parseInt(termMatch[1], 10) : 30;
    isHighBalance = /HB/i.test(code);

    return {
      raw, loanType, category, subcategory,
      term, productType, occupancy,
      isHighBalance, isStreamline: false, isBuydown: false,
      armStructure, isInterestOnly: false, docType: null, tier: null,
    };
  }

  // Fallback
  return {
    raw, loanType: 'unknown', category: 'unknown', subcategory: 'unknown',
    term: 30, productType: 'fixed', occupancy: 'primary',
    isHighBalance: false, isStreamline: false, isBuydown: false,
    armStructure: null, isInterestOnly: false, docType: null, tier: null,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProgramId(p) {
  const parts = [];
  if (p.subcategory) parts.push(p.subcategory);
  if (p.term) parts.push(`${p.term}yr`);
  parts.push(p.productType);
  if (p.armStructure) parts.push(p.armStructure.replace('/', '-'));
  if (p.occupancy !== 'primary') parts.push(p.occupancy);
  if (p.isHighBalance) parts.push('highbal');
  if (p.isStreamline) parts.push('streamline');
  if (p.isBuydown && p.buydownStructure) parts.push(`bd${p.buydownStructure}`);
  if (p.isInterestOnly) parts.push('io');
  if (p.docType) parts.push(p.docType);
  if (p.tier) parts.push(p.tier.toLowerCase());
  if (p.variant) parts.push(p.variant);
  return parts.join('_');
}

function makeProgramName(p) {
  const parts = [];

  // Loan type
  switch (p.subcategory) {
    case 'conventional': parts.push('Conventional'); break;
    case 'fha': parts.push('FHA'); break;
    case 'va': parts.push('VA'); break;
    case 'usda': parts.push('USDA'); break;
    case 'jumbo': parts.push('Jumbo'); break;
    case 'dscr': parts.push('DSCR'); break;
    case 'bankstatement': parts.push('Bank Statement'); break;
    case 'nonqm': parts.push('Non-QM'); break;
    case 'second': parts.push('2nd Lien'); break;
    case 'heloc': parts.push('HELOC'); break;
    default: parts.push(p.subcategory || 'Unknown');
  }

  if (p.isStreamline) parts.push('Streamline');
  if (p.term) parts.push(`${p.term}yr`);

  if (p.productType === 'arm' && p.armStructure) {
    parts.push(`${p.armStructure} ARM`);
  } else if (p.productType === 'fixed') {
    parts.push('Fixed');
  }

  if (p.isHighBalance) parts.push('High Balance');
  if (p.isInterestOnly) parts.push('I/O');
  if (p.isBuydown && p.buydownStructure) parts.push(`${p.buydownStructure} Buydown`);

  // Variant
  if (p.variant === 'homeready') parts.push('HomeReady');
  if (p.variant === 'homepossible') parts.push('HomePossible');
  if (p.variant === 'calhfa') parts.push('CalHFA');

  // Doc type for Non-QM
  if (p.docType === 'investor-bankstatement') parts.push('(Investor)');
  if (p.docType === 'full-bankstatement') parts.push('(Full Doc)');
  if (p.docType === 'asset-bankstatement') parts.push('(Asset)');
  if (p.docType === 'expanded-bankstatement') parts.push('(Expanded)');

  if (p.tier) parts.push(`[${p.tier}]`);

  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// CSV Parser
// ---------------------------------------------------------------------------

/**
 * Parse TLS rate CSV content into normalized programs array.
 * @param {string} csvContent - raw CSV text
 * @returns {{ sheetDate: string, programs: Array }}
 */
function parseRates(csvContent) {
  const lines = csvContent.trim().split(/\r?\n/);
  if (lines.length < 3) return { sheetDate: null, programs: [] };

  // Extract date from first line: "Publication Effective Date: MM/DD/YYYY HH:MM:SS"
  let sheetDate = null;
  const dateMatch = lines[0].match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (dateMatch) {
    sheetDate = `${dateMatch[3]}-${dateMatch[1]}-${dateMatch[2]}`;
  }

  // Find the header line (Product Code,Rate,...)
  let headerIdx = -1;
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    if (lines[i].startsWith('Product Code')) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return { sheetDate, programs: [] };

  // Parse header to get lock period columns
  const header = lines[headerIdx].split(',').map(h => h.trim());
  const lockColumns = [];
  for (let i = 2; i < header.length; i++) {
    const m = header[i].match(/(\d+)\s*Days?\s*Lock/i);
    if (m) lockColumns.push({ idx: i, days: parseInt(m[1], 10) });
  }

  // Parse data rows
  const productGroups = {};
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(',');
    const code = parts[0]?.trim();
    if (!code || code === 'Product Code') continue;

    const rate = parseFloat(parts[1]);
    if (isNaN(rate)) continue;

    if (!productGroups[code]) productGroups[code] = [];

    for (const lc of lockColumns) {
      const price = parseFloat(parts[lc.idx]);
      if (isNaN(price)) continue;
      productGroups[code].push({
        rate,
        lockDays: lc.days,
        price,  // discount/rebate format (positive = cost, negative = credit)
      });
    }
  }

  // Convert to normalized programs
  const programs = [];
  for (const [code, entries] of Object.entries(productGroups)) {
    const decoded = decodeProductCode(code);
    const id = makeProgramId(decoded);
    const name = makeProgramName(decoded);

    const lockDaysSet = new Set(entries.map(e => e.lockDays));
    const lockDays = [...lockDaysSet].sort((a, b) => a - b);

    programs.push({
      id,
      name,
      productCode: code,
      category: decoded.category,
      subcategory: decoded.subcategory,
      loanType: decoded.loanType,
      term: decoded.term,
      productType: decoded.productType,
      armStructure: decoded.armStructure,
      occupancy: decoded.occupancy,
      isHighBalance: decoded.isHighBalance,
      isStreamline: decoded.isStreamline,
      isBuydown: decoded.isBuydown || false,
      buydownStructure: decoded.buydownStructure || null,
      isInterestOnly: decoded.isInterestOnly || false,
      docType: decoded.docType || null,
      tier: decoded.tier || null,
      variant: decoded.variant || null,
      priceFormat: 'discount',  // TLS uses discount/rebate, not 100-based
      rates: entries,
      lockDays,
    });
  }

  return { sheetDate, programs };
}

/**
 * Full parse (TLS only has one file — rates CSV. No separate LLPA file.)
 * LLPAs are baked into the product-level pricing (different product codes per tier).
 */
function parse({ ratesCsv }) {
  const { sheetDate, programs } = parseRates(ratesCsv);

  return {
    sheetDate,
    programs,
    llpas: null,             // No LLPA sheets — tier-encoded in product codes, uses GSE defaults
    loanAmountAdj: [],
    stateAdj: {},
    specPayups: {},
    pricingSpecials: null,
    occupancyAdj: null,
    lenderFee: 1281,
    compCap: { purchase: 4595, refinance: 3595 },
  };
}

module.exports = { parseRates, parse, lenderId, decodeProductCode };
