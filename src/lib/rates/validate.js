/**
 * Rate Sheet Validation
 *
 * Validates parser output before writing to DB.
 * Fails loud — throws on critical issues, warns on minor ones.
 *
 * Usage:
 *   const { validatePrograms } = require('./validate');
 *   const warnings = validatePrograms(programs);
 *   // warnings = [] if clean, or ['warning message', ...] for non-critical issues
 *   // Throws Error for critical issues (malformed data, missing fields)
 */

/**
 * Validate an array of parsed programs before DB write.
 * @param {Array} programs - Parser output programs array
 * @returns {string[]} warnings - Non-critical issues found
 * @throws {Error} on critical validation failures
 */
function validatePrograms(programs) {
  if (!Array.isArray(programs) || programs.length === 0) {
    throw new Error('No programs to validate');
  }

  const warnings = [];
  const productKeys = new Set();

  for (let i = 0; i < programs.length; i++) {
    const p = programs[i];
    const label = p.name || `program[${i}]`;

    // Required fields
    if (!p.name) throw new Error(`Program ${i}: missing name`);
    if (!p.loanType) throw new Error(`${label}: missing loanType`);
    if (!p.term) throw new Error(`${label}: missing term`);

    // Rate sanity checks
    if (!p.rates || p.rates.length === 0) {
      warnings.push(`${label}: no rates`);
      continue;
    }

    for (const r of p.rates) {
      // Hard fail: rate must be numeric and reasonable
      if (typeof r.rate !== 'number' || isNaN(r.rate) || r.rate < 1.0 || r.rate > 15.0) {
        throw new Error(`${label}: invalid rate ${r.rate}`);
      }
      // Hard fail: price must be numeric
      if (typeof r.price !== 'number' || isNaN(r.price)) {
        throw new Error(`${label}: invalid price ${r.price} at rate ${r.rate}`);
      }
      // Warn on unusual prices (don't fail — DSCR/NonQM have wide ranges)
      if (r.price < 70.0 || r.price > 115.0) {
        warnings.push(`${label}: unusual price ${r.price} at rate ${r.rate}`);
      }
      if (!r.lockDays || r.lockDays < 1) {
        throw new Error(`${label}: invalid lockDays ${r.lockDays}`);
      }
    }

    // Loan amount range sanity
    const range = p.loanAmountRange || {};
    if (range.min != null && range.max != null && range.min > range.max) {
      throw new Error(`${label}: loan amount min (${range.min}) > max (${range.max})`);
    }

    // Duplicate product check
    const key = p.name + '|' + (range.min || 0) + '-' + (range.max || '');
    if (productKeys.has(key)) {
      warnings.push(`${label}: duplicate product key ${key}`);
    }
    productKeys.add(key);
  }

  // Aggregate checks
  const byLoanType = {};
  for (const p of programs) {
    const lt = p.loanType || 'unknown';
    byLoanType[lt] = (byLoanType[lt] || 0) + 1;
  }

  // Should have at least some conventional programs
  if (!byLoanType.conventional && !byLoanType.fha) {
    warnings.push('No conventional or FHA programs found');
  }

  // Should have a reasonable number of programs
  if (programs.length < 20) {
    warnings.push(`Only ${programs.length} programs — expected at least 20 for a full rate sheet`);
  }

  return warnings;
}

module.exports = { validatePrograms };
