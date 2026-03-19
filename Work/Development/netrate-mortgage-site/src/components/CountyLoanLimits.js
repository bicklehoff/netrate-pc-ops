'use client';

import { useState, useMemo } from 'react';
import loanLimitData from '@/data/loan-limits-2025.json';

const STATE_LABELS = {
  CO: 'Colorado',
  CA: 'California',
  TX: 'Texas',
  OR: 'Oregon',
};

const LOAN_TYPES = [
  { value: 'conventional', label: 'Conventional' },
  { value: 'fha', label: 'FHA' },
  { value: 'va', label: 'VA' },
];

// FHA floor = 65% of conforming baseline; FHA ceiling = 150% of conforming baseline
// For high-cost areas, FHA limit = lesser of 150% of baseline or county conforming limit
function getFhaLimit(conformingLimit, baseline) {
  const fhaFloor = Math.ceil(baseline * 0.65);
  const fhaCeiling = Math.ceil(baseline * 1.50);
  // FHA limit follows conforming limit but capped at FHA ceiling
  if (conformingLimit > baseline) {
    return Math.min(conformingLimit, fhaCeiling);
  }
  return fhaFloor;
}

// VA follows conforming limits (no cap for full-entitlement borrowers since 2020)
function getVaLimit(conformingLimit) {
  return conformingLimit;
}

export default function CountyLoanLimits({ defaultState }) {
  const [state, setState] = useState(defaultState || 'CO');
  const [county, setCounty] = useState('');
  const [loanType, setLoanType] = useState('conventional');

  const counties = useMemo(() => {
    return loanLimitData.states[state] || [];
  }, [state]);

  const selectedCounty = useMemo(() => {
    return counties.find(c => c.fips === county);
  }, [counties, county]);

  const limits = useMemo(() => {
    if (!selectedCounty) return null;
    const { conforming } = selectedCounty;
    const baseline = loanLimitData.baseline;
    const isHighBalance = conforming > baseline;

    if (loanType === 'fha') {
      const fhaLimit = getFhaLimit(conforming, baseline);
      return {
        limit: fhaLimit,
        label: fhaLimit > Math.ceil(baseline * 0.65) ? 'FHA High-Cost Area Limit' : 'FHA Floor Limit',
        isHighBalance: fhaLimit > Math.ceil(baseline * 0.65),
      };
    }

    if (loanType === 'va') {
      return {
        limit: getVaLimit(conforming),
        label: isHighBalance ? 'VA High-Balance Limit' : 'VA Conforming Limit',
        isHighBalance,
        note: 'Full-entitlement VA borrowers have no loan limit cap since 2020.',
      };
    }

    // Conventional
    return {
      limit: conforming,
      label: isHighBalance ? 'High-Balance Conforming Limit' : 'Conforming Loan Limit',
      isHighBalance,
    };
  }, [selectedCounty, loanType]);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-1">County Loan Limit Lookup</h3>
      <p className="text-sm text-gray-500 mb-5">{loanLimitData.year} FHFA conforming loan limits</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">State</label>
          <select
            value={state}
            onChange={e => { setState(e.target.value); setCounty(''); }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            {Object.entries(STATE_LABELS).map(([code, label]) => (
              <option key={code} value={code}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">County</label>
          <select
            value={county}
            onChange={e => setCounty(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">Select county...</option>
            {counties.map(c => (
              <option key={c.fips} value={c.fips}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Loan Type</label>
          <select
            value={loanType}
            onChange={e => setLoanType(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            {LOAN_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      {limits && selectedCounty && (
        <div className="bg-gray-50 rounded-lg p-5 border border-gray-100">
          <div className="flex items-baseline justify-between flex-wrap gap-2">
            <div>
              <p className="text-sm text-gray-500">{selectedCounty.name} County, {STATE_LABELS[state]}</p>
              <p className="text-xs text-gray-400 mt-0.5">{limits.label}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900 tabular-nums">
                ${limits.limit.toLocaleString('en-US')}
              </p>
              {limits.isHighBalance && (
                <span className="inline-block text-xs bg-brand/10 text-brand font-medium px-2 py-0.5 rounded-full mt-1">
                  High-Cost Area
                </span>
              )}
            </div>
          </div>
          {limits.note && (
            <p className="text-xs text-gray-400 mt-3 border-t border-gray-200 pt-3">{limits.note}</p>
          )}
          {loanType === 'conventional' && (
            <p className="text-xs text-gray-400 mt-3 border-t border-gray-200 pt-3">
              {loanLimitData.year} baseline: ${loanLimitData.baseline.toLocaleString('en-US')} | High-balance ceiling: ${loanLimitData.highBalanceCeiling.toLocaleString('en-US')}
            </p>
          )}
        </div>
      )}

      {!county && (
        <p className="text-sm text-gray-400 text-center py-4">Select a county to see loan limits.</p>
      )}

      <p className="text-xs text-gray-400 mt-4">
        Source: FHFA {loanLimitData.year} conforming loan limits. FHA limits calculated per HUD formula. Limits are for single-family (1-unit) properties.
      </p>
    </div>
  );
}
