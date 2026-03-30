'use client';

import { useMemo, useState, useCallback } from 'react';
import { getFicoBand } from '@/lib/rates/engine';
import { STATE_DEFAULTS, getThirdPartyCosts } from '@/lib/rates/closing-costs';

export default function ScenarioForm({ scenario, onChange, onSubmit, loading }) {
  const update = (field, value) => onChange({ ...scenario, [field]: value });

  // Track which purchase field was last edited to avoid circular updates
  // 'pct' = down payment %, 'dollars' = down payment $, 'loan' = loan amount
  const [lastEdited, setLastEdited] = useState('pct');

  // Purchase: interlinked fields — any one drives the other two
  const purchaseCalc = useMemo(() => {
    const pv = scenario.propertyValue || 0;
    if (!pv) return { loanAmount: 0, downPct: 0, downDollars: 0, ltv: 0 };

    let loanAmount, downPct, downDollars;

    if (lastEdited === 'pct') {
      downPct = scenario.downPaymentPct || 0;
      // Calculate loan from LTV directly (not pv - down) to match LoanSifter
      loanAmount = Math.floor(pv * (1 - downPct / 100));
      downDollars = pv - loanAmount;
    } else if (lastEdited === 'dollars') {
      downDollars = scenario.downPaymentDollars || 0;
      downPct = pv > 0 ? Math.round((downDollars / pv) * 10000) / 100 : 0;
      loanAmount = Math.floor(pv - downDollars);
    } else if (lastEdited === 'loan') {
      loanAmount = Math.floor(scenario.manualLoanAmount || 0);
      downDollars = pv - loanAmount;
      downPct = pv > 0 ? Math.round((downDollars / pv) * 10000) / 100 : 0;
    }

    // Always round loan down and LTV down — avoid pricing into higher tier on $1 rounding
    const ltv = pv > 0 ? Math.floor((loanAmount / pv) * 10000) / 100 : 0;
    return { loanAmount, downPct, downDollars, ltv };
  }, [scenario.propertyValue, scenario.downPaymentPct, scenario.downPaymentDollars, scenario.manualLoanAmount, lastEdited]);

  // Refi: loan amount entered directly
  const refiCalc = useMemo(() => {
    const pv = scenario.propertyValue || 0;
    const loan = Math.floor(scenario.newLoanAmount || scenario.currentPayoff || 0);
    const ltv = pv > 0 ? Math.floor((loan / pv) * 10000) / 100 : 0;
    return { loanAmount: loan, ltv };
  }, [scenario.propertyValue, scenario.newLoanAmount, scenario.currentPayoff]);

  const isPurchase = scenario.purpose === 'purchase';
  const isFha = scenario.loanType === 'fha';
  const loanAmount = isPurchase ? purchaseCalc.loanAmount : refiCalc.loanAmount;
  const ltv = isPurchase ? purchaseCalc.ltv : refiCalc.ltv;

  // Sync loanAmount and ltv to parent scenario
  useMemo(() => {
    if (scenario.loanAmount !== loanAmount || scenario.ltv !== ltv) {
      onChange({ ...scenario, loanAmount, ltv });
    }
  }, [loanAmount, ltv]);

  const handleDownPct = useCallback((val) => {
    setLastEdited('pct');
    onChange({ ...scenario, downPaymentPct: val });
  }, [scenario, onChange]);

  const handleDownDollars = useCallback((val) => {
    setLastEdited('dollars');
    onChange({ ...scenario, downPaymentDollars: val });
  }, [scenario, onChange]);

  const handleLoanAmount = useCallback((val) => {
    setLastEdited('loan');
    onChange({ ...scenario, manualLoanAmount: val });
  }, [scenario, onChange]);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 my-3">
      <h2 className="text-base font-semibold text-gray-800 mb-3">Your Scenario</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2">
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Loan Purpose</label>
          <select value={scenario.purpose} onChange={e => update("purpose", e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm bg-white">
            <option value="purchase">Purchase</option>
            <option value="refi">Rate/Term Refinance</option>
            <option value="cashout">Cash-Out Refinance</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Loan Type</label>
          <select value={scenario.loanType || 'conventional'} onChange={e => {
              const lt = e.target.value;
              const newDown = lt === 'fha' ? 3.5 : lt === 'va' ? 0 : 25;
              const newFico = lt === 'fha' ? 680 : lt === 'va' ? 720 : 780;
              const newPV = lt === 'fha' ? 400000 : lt === 'va' ? 400000 : 533334;
              onChange({ ...scenario, loanType: lt, downPaymentPct: newDown, fico: newFico, propertyValue: newPV });
              setLastEdited('pct');
            }}
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm bg-white">
            <option value="conventional">Conventional</option>
            <option value="fha">FHA</option>
            <option value="va">VA</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Amortization Type</label>
          <select value={scenario.productType || 'fixed'} onChange={e => update("productType", e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm bg-white">
            <option value="fixed">Fixed</option>
            <option value="arm">ARM</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Property Type</label>
          <select value={scenario.propertyType} onChange={e => update("propertyType", e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm bg-white">
            <option value="sfr">Single Family</option>
            <option value="condo">Condo</option>
            <option value="townhome">Townhome</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
            {isPurchase ? "Purchase Price" : "Property Value"}
          </label>
          <input type="number" value={scenario.propertyValue || ""} placeholder="$"
            onChange={e => update("propertyValue", Number(e.target.value))}
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm" />
        </div>

        {/* Purchase: three interlinked fields */}
        {isPurchase && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Down Payment %</label>
              <input type="number" step="0.5" min="0" max="99"
                value={lastEdited === 'pct' ? (scenario.downPaymentPct || "") : (purchaseCalc.downPct || "")}
                placeholder="%"
                onChange={e => handleDownPct(Number(e.target.value))}
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Down Payment $</label>
              <input type="number" step="1000"
                value={lastEdited === 'dollars' ? (scenario.downPaymentDollars || "") : (purchaseCalc.downDollars || "")}
                placeholder="$"
                onChange={e => handleDownDollars(Number(e.target.value))}
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Loan Amount</label>
              <input type="number" step="1000"
                value={lastEdited === 'loan' ? (scenario.manualLoanAmount || "") : (purchaseCalc.loanAmount || "")}
                placeholder="$"
                onChange={e => handleLoanAmount(Number(e.target.value))}
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm" />
            </div>
          </>
        )}

        {/* Refi: New Loan Amount */}
        {!isPurchase && (
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">New Loan Amount</label>
            <input type="number" value={scenario.newLoanAmount || scenario.currentPayoff || ""} placeholder="$"
              onChange={e => update("newLoanAmount", Number(e.target.value))}
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm" />
            <p className="text-xs text-gray-400 mt-1">Your new mortgage balance</p>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
            Credit Score: <span className="text-gray-800 font-semibold">{scenario.fico || 780}</span>
          </label>
          <input type="range" min={580} max={850} step={5} value={scenario.fico || 780}
            onChange={e => update("fico", parseInt(e.target.value, 10))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand" />
          <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
            <span>580</span><span>660</span><span>740</span><span>850</span>
          </div>
        </div>
        {!isPurchase && (
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Current Rate</label>
            <input type="number" step="0.125" value={scenario.currentRate || ""} placeholder="%"
              onChange={e => update("currentRate", Number(e.target.value))}
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm" />
            <p className="text-xs text-gray-400 mt-1">Your existing mortgage rate &mdash; used to calculate savings</p>
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">State</label>
          <select value={scenario.state || 'CO'} onChange={e => {
            const st = e.target.value;
            onChange({ ...scenario, state: st, thirdPartyCosts: getThirdPartyCosts(st) });
          }}
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm bg-white">
            {Object.entries(STATE_DEFAULTS).map(([code, { label }]) => (
              <option key={code} value={code}>{label}</option>
            ))}
          </select>
        </div>
      </div>
      {loanAmount > 0 && (
        <div className="mt-3 pt-2 border-t border-gray-100 flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600">
          <span>Base Loan: <strong className="text-gray-800">${loanAmount.toLocaleString("en-US", { maximumFractionDigits: 0 })}</strong></span>
          {isFha && (
            <span>w/ UFMIP: <strong className="text-gray-800">${Math.floor(loanAmount * 1.0175).toLocaleString("en-US")}</strong></span>
          )}
          <span>LTV: <strong className="text-gray-800">{ltv.toFixed(1)}%</strong></span>
          <span>FICO Band: <strong className="text-gray-800">{getFicoBand(scenario.fico)}</strong></span>
          <span>State: <strong className="text-gray-800">{scenario.state || 'CO'}</strong></span>
        </div>
      )}
      {loanAmount > 0 && (
        <button
          onClick={onSubmit}
          disabled={loading}
          className="mt-3 w-full bg-brand text-white py-2.5 rounded-lg font-semibold hover:bg-brand-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Fetching Your Rates...
            </>
          ) : 'Get My Rates'}
        </button>
      )}
    </div>
  );
}
