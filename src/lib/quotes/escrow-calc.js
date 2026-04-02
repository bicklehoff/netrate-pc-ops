/**
 * Escrow & Prepaid Calculator — RESPA aggregate method
 *
 * Handles:
 *   Section F — Prepaids (HOI, flood, hail/wind, prepaid interest / interest credit)
 *   Section G — Initial escrow reserves (empty when not escrowing)
 *
 * Interest credit rule:
 *   If funding day ≤ 6: lender credits days 1-fundingDay (negative F line item).
 *     First payment = 1st of NEXT month.
 *   If funding day > 6: borrower pays remaining days in month (positive F line item).
 *     First payment = 1st of MONTH AFTER NEXT.
 *
 * HOI / Flood / Hail-Wind prepaid (Section F):
 *   Collected if: purpose = purchase OR policy effective/renewal date is within 60 days of funding.
 *
 * Section G (RESPA aggregate):
 *   13-month simulation from funding date through 12 payment months.
 *   Initial deposit = amount needed so balance never drops below 2-month cushion.
 *
 * State tax schedules (due dates, 1-indexed month):
 *   CO: Feb 28 + Apr 30 (semi-annual)
 *   CA: Nov 1 + Feb 1  (semi-annual)
 *   TX: Jan 31          (annual)  + MUD: Jan 31
 *   OR: Nov 15          (annual)
 */

// Tax schedule: { type: 'annual'|'semiannual', dues: [[month1indexed, day], ...] }
const TAX_SCHEDULE = {
  CO: { type: 'semiannual', dues: [[2, 28], [4, 30]] },
  CA: { type: 'semiannual', dues: [[11, 1], [2, 1]] },
  TX: { type: 'annual',     dues: [[1, 31]] },
  OR: { type: 'annual',     dues: [[11, 15]] },
};
const TAX_SCHEDULE_DEFAULT = { type: 'semiannual', dues: [[6, 1], [12, 1]] };

const CREDIT_THRESHOLD_DAY = 6;  // Funding on day ≤ this → interest credit
const CUSHION_MONTHS = 2;        // RESPA standard 2-month cushion

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function parseDate(d) {
  if (!d) return null;
  if (d instanceof Date) return isNaN(d.getTime()) ? null : d;
  const parsed = new Date(d + 'T12:00:00');
  return isNaN(parsed.getTime()) ? null : parsed;
}

function daysInMonth(year, month0indexed) {
  return new Date(year, month0indexed + 1, 0).getDate();
}

/** Next occurrence of [month (1-indexed), day] on or after refDate */
function nextDueDate(refDate, month1indexed, day) {
  const year = refDate.getFullYear();
  for (const yr of [year, year + 1, year + 2]) {
    // Handle Feb 28 in non-leap years — use last day of Feb if needed
    const maxDay = daysInMonth(yr, month1indexed - 1);
    const actualDay = Math.min(day, maxDay);
    const d = new Date(yr, month1indexed - 1, actualDay);
    if (d >= refDate) return d;
  }
  return null;
}

/** Year-month integer for comparison: YYYY*12 + month0indexed */
function ym(date) {
  return date.getFullYear() * 12 + date.getMonth();
}

// ─────────────────────────────────────────────────────────────────────────────
// First payment date derivation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Derive first payment date and interest credit/charge from funding date.
 *
 * @param {Date|string} fundingDate
 * @returns {{ firstPaymentDate: Date, isCredit: boolean, fundingDay: number }}
 */
export function deriveFirstPaymentDate(fundingDate) {
  const funding = parseDate(fundingDate);
  if (!funding) return { firstPaymentDate: null, isCredit: false, fundingDay: null };

  const day = funding.getDate();
  const isCredit = day <= CREDIT_THRESHOLD_DAY;

  // isCredit: first payment = 1st of next month
  // not credit: first payment = 1st of month after next
  const fp = new Date(funding.getFullYear(), funding.getMonth() + (isCredit ? 1 : 2), 1);

  return { firstPaymentDate: fp, isCredit, fundingDay: day };
}

/**
 * Format a Date as YYYY-MM-DD.
 */
export function fmtDate(d) {
  if (!d) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Prepaid interest
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @returns {{ days: number, perDiem: number, total: number, isCredit: boolean }}
 *   total is negative for a credit, positive for a charge.
 */
export function calcPrepaidInterest(fundingDate, loanAmount, annualRate) {
  const funding = parseDate(fundingDate);
  if (!funding || !loanAmount || !annualRate) {
    return { days: 0, perDiem: 0, total: 0, isCredit: false };
  }

  const day = funding.getDate();
  const isCredit = day <= CREDIT_THRESHOLD_DAY;
  const dim = daysInMonth(funding.getFullYear(), funding.getMonth());

  // Credit: days 1 through fundingDay inclusive
  // Charge: days fundingDay+1 through end of month (= dim - day)
  const days = isCredit ? day : dim - day;

  const perDiem = Math.round((loanAmount * (annualRate / 100) / 365) * 100) / 100;
  const total = isCredit
    ? -Math.round(perDiem * days * 100) / 100
    : Math.round(perDiem * days * 100) / 100;

  return { days, perDiem, total, isCredit };
}

// ─────────────────────────────────────────────────────────────────────────────
// RESPA aggregate analysis
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simulate 13 months of escrow activity (closing month + 12 payment months).
 * Returns the required initial deposit so balance never drops below cushion.
 *
 * @param {Array<{ monthly: number, disbursements: Array<{ date: Date, amount: number }> }>} items
 * @param {Date} firstPaymentDate
 * @param {Date} fundingDate
 * @param {number} [cushionMonths=2]
 * @returns {{ initialDeposit: number, totalMonthly: number, cushion: number }}
 */
function respaAggregate(items, firstPaymentDate, fundingDate, cushionMonths = CUSHION_MONTHS) {
  if (!items.length || !firstPaymentDate || !fundingDate) {
    return { initialDeposit: 0, totalMonthly: 0, cushion: 0 };
  }

  const totalMonthly = Math.round(items.reduce((s, i) => s + i.monthly, 0) * 100) / 100;
  const cushion = Math.round(totalMonthly * cushionMonths * 100) / 100;

  const fundingYM = ym(fundingDate);
  const firstPmtYM = ym(firstPaymentDate);

  // Build disbursement map: ym → total amount due
  const disbMap = new Map();
  for (const item of items) {
    for (const disb of item.disbursements) {
      const k = ym(disb.date);
      disbMap.set(k, (disbMap.get(k) || 0) + disb.amount);
    }
  }

  // Simulate 14 months starting from funding month
  let balance = 0;
  let minBalance = 0;

  for (let m = 0; m < 14; m++) {
    const curYM = fundingYM + m;

    // Monthly payment collected starting from first payment month
    if (curYM >= firstPmtYM) {
      balance += totalMonthly;
    }

    // Disbursements due this month
    if (disbMap.has(curYM)) {
      balance -= disbMap.get(curYM);
    }

    minBalance = Math.min(minBalance, balance);
  }

  const initialDeposit = Math.max(0, Math.ceil((cushion - minBalance) * 100) / 100);
  return { initialDeposit, totalMonthly, cushion };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate Section F (prepaids) and Section G (initial escrow reserves).
 *
 * @param {Object} params
 * @param {Date|string} params.fundingDate       — closing/funding date
 * @param {number}      params.loanAmount
 * @param {number}      params.annualRate        — e.g. 6.75
 * @param {string}      params.state             — CO, CA, TX, OR
 * @param {string}      params.purpose           — purchase, refinance, cashout
 * @param {boolean}     params.isEscrowing       — false → Section G is empty
 * @param {number}      params.annualTaxes
 * @param {number}      params.annualInsurance   — HOI
 * @param {Date|string} [params.hoiEffectiveDate] — HOI policy effective/renewal date
 *                                                  (purchase: defaults to fundingDate)
 * @param {boolean}     params.hasFlood
 * @param {number}      params.annualFlood
 * @param {boolean}     params.hasMud            — TX MUD tax
 * @param {number}      params.annualMud
 * @param {boolean}     params.hasHailWind       — TX hail/wind separate policy
 * @param {number}      params.annualHailWind
 * @param {Object}      [params.overrideDueDates] — editable due date overrides
 *   Keys: tax_0, tax_1 (per installment), hoi, flood, mud, hw → YYYY-MM-DD strings
 *
 * @returns {{
 *   firstPaymentDate: Date|null,
 *   firstPaymentDateStr: string,
 *   isInterestCredit: boolean,
 *   prepaidInterest: { days, perDiem, total, isCredit },
 *   sectionFItems: Array<{ label: string, amount: number }>,
 *   sectionGItems: Array<{ label: string, amount: number }>,
 *   escrowMonthly: { taxes, insurance, flood, mud, hailWind, total },
 *   escrowItems: Array<{ key, label, monthly, dueDate, dateStr, installment, monthsFromFirstPmt }>,
 *   respa: { totalMonthly, cushion, initialDeposit },
 * }}
 */
export function calculateEscrowSections({
  fundingDate,
  loanAmount = 0,
  annualRate = 0,
  state = 'CO',
  purpose = 'purchase',
  isEscrowing = true,
  annualTaxes = 0,
  annualInsurance = 0,
  hoiEffectiveDate = null,
  hasFlood = false,
  annualFlood = 0,
  hasMud = false,
  annualMud = 0,
  hasHailWind = false,
  annualHailWind = 0,
  overrideDueDates = {},
} = {}) {
  const funding = parseDate(fundingDate);
  const { firstPaymentDate, isCredit: isInterestCredit } = funding
    ? deriveFirstPaymentDate(funding)
    : { firstPaymentDate: null, isCredit: false };

  // ── Prepaid interest ────────────────────────────────────────────────────────
  const prepaidInterest = funding
    ? calcPrepaidInterest(funding, loanAmount, annualRate)
    : { days: 0, perDiem: 0, total: 0, isCredit: false };

  // ── HOI 60-day rule ─────────────────────────────────────────────────────────
  // Purchase: always collect (policy starts at funding)
  // Refi/cashout: collect if policy renews within 60 days of funding
  const isPurchase = purpose === 'purchase';
  let hoiAtClose = false;
  if (annualInsurance > 0) {
    if (isPurchase) {
      hoiAtClose = true;
    } else if (funding) {
      const effDate = parseDate(hoiEffectiveDate);
      if (effDate) {
        const daysDiff = Math.abs((effDate.getTime() - funding.getTime()) / 86400000);
        hoiAtClose = daysDiff <= 60;
      }
    }
  }

  // ── Section F ───────────────────────────────────────────────────────────────
  const sectionFItems = [];

  if (hoiAtClose) {
    sectionFItems.push({ label: "Homeowner's Insurance (12 months)", amount: annualInsurance });
  }
  if (hasFlood && annualFlood > 0) {
    sectionFItems.push({ label: 'Flood Insurance (12 months)', amount: annualFlood });
  }
  if (hasHailWind && annualHailWind > 0) {
    sectionFItems.push({ label: 'Hail/Wind Insurance (12 months)', amount: annualHailWind });
  }
  if (prepaidInterest.perDiem > 0) {
    const label = prepaidInterest.isCredit
      ? `Interest Credit (${prepaidInterest.days} days @ $${prepaidInterest.perDiem}/day)`
      : `Prepaid Interest (${prepaidInterest.days} days @ $${prepaidInterest.perDiem}/day)`;
    sectionFItems.push({ label, amount: prepaidInterest.total }); // negative for credit
  }

  // ── Build escrow items (for RESPA aggregate + show-your-work display) ───────
  // Each entry represents one disbursement event (installment or renewal).
  // overrideDueDates keys: tax_0, tax_1, hoi, flood, mud, hw
  const escrowItemsList = []; // flat: one entry per disbursement

  const resolvedDate = (key, computed) =>
    overrideDueDates[key] ? parseDate(overrideDueDates[key]) : computed;

  const monthsFromFirstPmt = (dueDate) => {
    if (!firstPaymentDate || !dueDate) return null;
    const diff = (dueDate.getFullYear() - firstPaymentDate.getFullYear()) * 12
               + (dueDate.getMonth() - firstPaymentDate.getMonth());
    return Math.max(0, diff);
  };

  if (firstPaymentDate && funding) {
    const schedule = TAX_SCHEDULE[state] || TAX_SCHEDULE_DEFAULT;

    // Property taxes — one entry per installment
    if (annualTaxes > 0) {
      const installmentAmt = schedule.type === 'semiannual' ? annualTaxes / 2 : annualTaxes;
      const monthly = Math.round(annualTaxes / 12 * 100) / 100;
      const labels = schedule.type === 'semiannual'
        ? ['Property Tax — 1st Installment', 'Property Tax — 2nd Installment']
        : ['Property Tax'];

      schedule.dues.forEach(([m, d], idx) => {
        const key = `tax_${idx}`;
        const computed = nextDueDate(firstPaymentDate, m, d);
        const dueDate = resolvedDate(key, computed);
        if (dueDate) {
          escrowItemsList.push({
            key,
            label: labels[idx] || `Property Tax — Installment ${idx + 1}`,
            monthly,
            dueDate,
            dateStr: fmtDate(dueDate),
            installment: installmentAmt,
            monthsFromFirstPmt: monthsFromFirstPmt(dueDate),
          });
        }
      });
    }

    // HOI reserves
    if (annualInsurance > 0 && hoiAtClose) {
      const effDate = parseDate(hoiEffectiveDate) || (isPurchase ? funding : null);
      if (effDate) {
        const computed = new Date(effDate);
        computed.setFullYear(computed.getFullYear() + 1);
        const dueDate = resolvedDate('hoi', computed);
        if (dueDate) {
          escrowItemsList.push({
            key: 'hoi',
            label: "Homeowner's Insurance",
            monthly: Math.round(annualInsurance / 12 * 100) / 100,
            dueDate,
            dateStr: fmtDate(dueDate),
            installment: annualInsurance,
            monthsFromFirstPmt: monthsFromFirstPmt(dueDate),
          });
        }
      }
    }

    // Flood insurance
    if (hasFlood && annualFlood > 0) {
      const computed = new Date(funding);
      computed.setFullYear(computed.getFullYear() + 1);
      const dueDate = resolvedDate('flood', computed);
      if (dueDate) {
        escrowItemsList.push({
          key: 'flood',
          label: 'Flood Insurance',
          monthly: Math.round(annualFlood / 12 * 100) / 100,
          dueDate,
          dateStr: fmtDate(dueDate),
          installment: annualFlood,
          monthsFromFirstPmt: monthsFromFirstPmt(dueDate),
        });
      }
    }

    // TX: MUD tax
    if (hasMud && annualMud > 0) {
      const computed = nextDueDate(firstPaymentDate, 1, 31);
      const dueDate = resolvedDate('mud', computed);
      if (dueDate) {
        escrowItemsList.push({
          key: 'mud',
          label: 'MUD Tax',
          monthly: Math.round(annualMud / 12 * 100) / 100,
          dueDate,
          dateStr: fmtDate(dueDate),
          installment: annualMud,
          monthsFromFirstPmt: monthsFromFirstPmt(dueDate),
        });
      }
    }

    // TX: Hail/Wind
    if (hasHailWind && annualHailWind > 0) {
      const computed = new Date(funding);
      computed.setFullYear(computed.getFullYear() + 1);
      const dueDate = resolvedDate('hw', computed);
      if (dueDate) {
        escrowItemsList.push({
          key: 'hw',
          label: 'Hail/Wind Insurance',
          monthly: Math.round(annualHailWind / 12 * 100) / 100,
          dueDate,
          dateStr: fmtDate(dueDate),
          installment: annualHailWind,
          monthsFromFirstPmt: monthsFromFirstPmt(dueDate),
        });
      }
    }
  }

  // ── Section G (RESPA aggregate) ─────────────────────────────────────────────
  const sectionGItems = [];
  let respaResult = { totalMonthly: 0, cushion: 0, initialDeposit: 0 };

  if (isEscrowing && escrowItemsList.length > 0 && firstPaymentDate && funding) {
    // Convert flat escrowItemsList to RESPA format (group by key, combine disbursements)
    const respaItems = escrowItemsList.map(item => ({
      monthly: item.monthly,
      disbursements: [{ date: item.dueDate, amount: item.installment }],
    }));

    respaResult = respaAggregate(respaItems, firstPaymentDate, funding);
    const { initialDeposit, totalMonthly } = respaResult;

    // Apportion initial deposit across items by monthly proportion
    for (const item of escrowItemsList) {
      const proportion = totalMonthly > 0 ? item.monthly / totalMonthly : 1 / escrowItemsList.length;
      const itemDeposit = Math.round(initialDeposit * proportion * 100) / 100;
      const months = item.monthly > 0 ? Math.round(itemDeposit / item.monthly * 10) / 10 : 0;
      sectionGItems.push({
        label: `${item.label} (${months} months)`,
        amount: itemDeposit,
      });
    }

    // Fix rounding on last item
    const sumG = sectionGItems.reduce((s, i) => s + i.amount, 0);
    if (sectionGItems.length > 0 && Math.abs(sumG - initialDeposit) > 0.01) {
      const last = sectionGItems[sectionGItems.length - 1];
      last.amount = Math.round((last.amount + (initialDeposit - sumG)) * 100) / 100;
    }
  }

  // ── Monthly escrow breakdown (for PITI display) ──────────────────────────────
  const escrowMonthly = {
    taxes:     isEscrowing && annualTaxes > 0      ? Math.round(annualTaxes / 12)      : 0,
    insurance: isEscrowing && annualInsurance > 0  ? Math.round(annualInsurance / 12)  : 0,
    flood:     isEscrowing && hasFlood && annualFlood > 0       ? Math.round(annualFlood / 12)      : 0,
    mud:       isEscrowing && hasMud && annualMud > 0           ? Math.round(annualMud / 12)         : 0,
    hailWind:  isEscrowing && hasHailWind && annualHailWind > 0 ? Math.round(annualHailWind / 12)   : 0,
  };
  escrowMonthly.total = Object.values(escrowMonthly).reduce((s, v) => s + v, 0);

  return {
    firstPaymentDate,
    firstPaymentDateStr: fmtDate(firstPaymentDate),
    isInterestCredit,
    prepaidInterest,
    sectionFItems,
    sectionGItems,
    escrowMonthly,
    escrowItems: escrowItemsList,  // for show-your-work display
    respa: respaResult,
  };
}
