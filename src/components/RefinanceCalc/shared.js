/**
 * Shared utilities and input components for the Refinance Calculator.
 * Extracted from the original page.js for reuse across sub-components.
 */

export function dollar(n) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

export const STATE_DEFAULTS = {
  CO: { label: 'Colorado', hardCosts: 2800, taxRate: 0.0055, taxSchedule: 'semi-annual', taxDue: ['Mar 1', 'Jun 15'] },
  CA: { label: 'California', hardCosts: 3500, taxRate: 0.0075, taxSchedule: 'semi-annual', taxDue: ['Nov 1', 'Feb 1'] },
  TX: { label: 'Texas', hardCosts: 3200, taxRate: 0.018, taxSchedule: 'annual', taxDue: ['Jan 31'] },
  OR: { label: 'Oregon', hardCosts: 2600, taxRate: 0.0098, taxSchedule: 'semi-annual', taxDue: ['Nov 15', 'May 15'] },
};

export function ltvTier(ltv) {
  if (ltv <= 60) return { color: 'text-emerald-700', bg: 'bg-emerald-50' };
  if (ltv <= 70) return { color: 'text-emerald-600', bg: 'bg-emerald-50' };
  if (ltv <= 75) return { color: 'text-green-600', bg: 'bg-green-50' };
  if (ltv <= 80) return { color: 'text-gray-700', bg: 'bg-gray-50' };
  if (ltv <= 85) return { color: 'text-amber-700', bg: 'bg-amber-50' };
  if (ltv <= 90) return { color: 'text-orange-700', bg: 'bg-orange-50' };
  return { color: 'text-red-700', bg: 'bg-red-50' };
}

export function NumInput({ label, prefix, suffix, value, onChange, step, min, help }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <div className="mt-1 relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{prefix}</span>}
        <input
          type="number"
          value={value}
          onChange={e => onChange(e.target.value)}
          step={step || 1}
          min={min || 0}
          className={`w-full border border-gray-200 rounded-lg py-2.5 text-sm focus:border-brand focus:ring-2 focus:ring-brand/10 outline-none transition-colors ${prefix ? 'pl-7' : 'pl-3'} ${suffix ? 'pr-10' : 'pr-3'}`}
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{suffix}</span>}
      </div>
      {help && <span className="text-xs text-gray-400 mt-1 block leading-snug">{help}</span>}
    </label>
  );
}

export function SelectInput({ label, value, onChange, options, help }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="mt-1 w-full border border-gray-200 rounded-lg py-2.5 px-3 text-sm focus:border-brand focus:ring-2 focus:ring-brand/10 outline-none transition-colors bg-white"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {help && <span className="text-xs text-gray-400 mt-1 block leading-snug">{help}</span>}
    </label>
  );
}

export function Toggle({ label, checked, onChange, help }) {
  return (
    <div className="flex flex-col">
      <span className="text-sm font-medium text-gray-700 mb-1">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? 'bg-brand' : 'bg-gray-200'}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
      {help && <span className="text-xs text-gray-400 mt-1 block leading-snug">{help}</span>}
    </div>
  );
}

export function DateInput({ label, value, onChange, help }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <input
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="mt-1 w-full border border-gray-200 rounded-lg py-2.5 px-3 text-sm focus:border-brand focus:ring-2 focus:ring-brand/10 outline-none transition-colors"
      />
      {help && <span className="text-xs text-gray-400 mt-1 block leading-snug">{help}</span>}
    </label>
  );
}

/**
 * Compute escrow setup (soft costs) for a refinance closing.
 * Includes tax reserves, insurance reserves, and any bills due within 60 days.
 */
export function computeEscrowSetup({ doesEscrow, effectiveTax, annualInsurance, closeDate, effectiveRenewal, stateInfo }) {
  const breakdown = [];

  if (doesEscrow) {
    const monthlyTax = effectiveTax / 12;
    const taxReserves = Math.round(monthlyTax * 3);
    breakdown.push({ label: 'Tax reserves (3 mo)', amount: taxReserves });

    const monthlyIns = annualInsurance / 12;
    const insReserves = Math.round(monthlyIns * 2);
    breakdown.push({ label: 'Insurance reserves (2 mo)', amount: insReserves });
  }

  // 60-day rule: anything due within 60 days of close must be paid at closing
  const sixtyDaysOut = new Date(closeDate.getTime() + 60 * 86400000);
  const renewalDate = new Date(effectiveRenewal);
  if (renewalDate <= sixtyDaysOut && renewalDate >= closeDate) {
    breakdown.push({ label: 'Insurance premium (due within 60 days)', amount: Math.round(annualInsurance) });
  }

  if (doesEscrow) {
    const taxDueThisYear = stateInfo.taxDue.map(d => new Date(d + ', ' + closeDate.getFullYear()));
    for (let t = 0; t < taxDueThisYear.length; t++) {
      const td = taxDueThisYear[t];
      if (td <= sixtyDaysOut && td >= closeDate) {
        const installmentAmt = stateInfo.taxSchedule === 'annual' ? effectiveTax : Math.round(effectiveTax / 2);
        breakdown.push({ label: 'Tax installment (due ' + stateInfo.taxDue[t] + ')', amount: installmentAmt });
      }
    }
  }

  const total = breakdown.reduce((sum, item) => sum + item.amount, 0);
  return { breakdown, total };
}
