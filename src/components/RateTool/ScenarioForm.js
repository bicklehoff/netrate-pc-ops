'use client';

import { useMemo } from 'react';
import { getFicoBand } from '@/lib/rates/engine';
import { STATE_DEFAULTS, getThirdPartyCosts } from '@/lib/rates/closing-costs';

export default function ScenarioForm({ scenario, onChange }) {
  const update = (field, value) => onChange({ ...scenario, [field]: value });

  const loanAmount = useMemo(() => {
    if (scenario.purpose === "purchase") {
      return scenario.propertyValue * (1 - scenario.downPaymentPct / 100);
    }
    return scenario.currentPayoff || 0;
  }, [scenario.purpose, scenario.propertyValue, scenario.downPaymentPct, scenario.currentPayoff]);

  const ltv = useMemo(() => {
    if (!scenario.propertyValue) return 0;
    return (loanAmount / scenario.propertyValue) * 100;
  }, [loanAmount, scenario.propertyValue]);

  useMemo(() => {
    if (scenario.loanAmount !== loanAmount || scenario.ltv !== ltv) {
      onChange({ ...scenario, loanAmount, ltv });
    }
  }, [loanAmount, ltv]);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 my-4">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Your Scenario</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Loan Purpose</label>
          <select value={scenario.purpose} onChange={e => update("purpose", e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white">
            <option value="purchase">Purchase</option>
            <option value="refi">Rate/Term Refinance</option>
            <option value="cashout">Cash-Out Refinance</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Loan Type</label>
          <select value={scenario.loanType || 'conventional'} onChange={e => update("loanType", e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white">
            <option value="conventional">Conventional</option>
            <option value="fha">FHA</option>
            <option value="va">VA</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Property Type</label>
          <select value={scenario.propertyType} onChange={e => update("propertyType", e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white">
            <option value="sfr">Single Family</option>
            <option value="condo">Condo</option>
            <option value="townhome">Townhome</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
            {scenario.purpose === "purchase" ? "Purchase Price" : "Property Value"}
          </label>
          <input type="number" value={scenario.propertyValue || ""} placeholder="$"
            onChange={e => update("propertyValue", Number(e.target.value))}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
        </div>
        {scenario.purpose === "purchase" ? (
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Down Payment %</label>
            <input type="number" value={scenario.downPaymentPct || ""} placeholder="%"
              onChange={e => update("downPaymentPct", Number(e.target.value))}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
        ) : (
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Current Payoff</label>
            <input type="number" value={scenario.currentPayoff || ""} placeholder="$"
              onChange={e => update("currentPayoff", Number(e.target.value))}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Credit Score</label>
          <input type="number" min={500} max={850} step={1} value={scenario.fico || ""}
            onChange={e => {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v)) update("fico", Math.min(850, Math.max(500, v)));
            }}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
        </div>
        {scenario.purpose !== "purchase" && (
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Current Rate</label>
            <input type="number" step="0.125" value={scenario.currentRate || ""} placeholder="%"
              onChange={e => update("currentRate", Number(e.target.value))}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            <p className="text-xs text-gray-400 mt-1">Your existing mortgage rate &mdash; used to calculate savings</p>
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">State</label>
          <select value={scenario.state || 'CO'} onChange={e => {
            const st = e.target.value;
            onChange({ ...scenario, state: st, thirdPartyCosts: getThirdPartyCosts(st) });
          }}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white">
            {Object.entries(STATE_DEFAULTS).map(([code, { label }]) => (
              <option key={code} value={code}>{label}</option>
            ))}
          </select>
        </div>
      </div>
      {loanAmount > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-6 text-sm text-gray-600">
          <span>Loan Amount: <strong className="text-gray-800">${loanAmount.toLocaleString("en-US", { maximumFractionDigits: 0 })}</strong></span>
          <span>LTV: <strong className="text-gray-800">{ltv.toFixed(1)}%</strong></span>
          <span>FICO Band: <strong className="text-gray-800">{getFicoBand(scenario.fico)}</strong></span>
          <span>State: <strong className="text-gray-800">{scenario.state || 'CO'}</strong></span>
        </div>
      )}
    </div>
  );
}
