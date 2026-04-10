// Break-Even Visualizer — Cumulative savings over time vs. total refi cost
// Shows the crossover point where savings exceed cost.
// Only renders for refinance scenarios.

'use client';

import { useState, useMemo } from 'react';
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { calculatePI } from '@/lib/rates/engine';
import { CHART_COLORS, CHART_FONTS, TOOLTIP_STYLE, formatDollarFull, formatRate } from './chartHelpers';

function computeBreakEven(rate, currentRate, loanAmount, lenderFees, thirdPartyCosts) {
  const currentPI = calculatePI(currentRate, loanAmount);
  const monthlySavings = currentPI - rate.monthlyPI;

  if (monthlySavings <= 0) return null;

  // Total refi cost: lender fees + third-party + credit/charge
  // creditDollars negative = lender credit (reduces cost)
  // creditDollars positive = discount points (increases cost)
  const totalCost = lenderFees + (thirdPartyCosts || 0) + rate.creditDollars;

  // If totalCost <= 0, lender credit covers everything — instant break-even
  if (totalCost <= 0) {
    return {
      data: [
        { month: 0, savings: 0, cost: 0 },
        { month: 12, savings: monthlySavings * 12, cost: 0 },
      ],
      monthlySavings,
      totalCost: 0,
      breakEvenMonths: 0,
      annualSavings: monthlySavings * 12,
    };
  }

  const breakEvenMonths = totalCost / monthlySavings;

  // Dynamic horizon: break-even + 50% padding, min 12, max 120
  const horizon = Math.min(Math.max(Math.ceil(breakEvenMonths * 1.5), 12), 120);

  const data = [];
  for (let m = 0; m <= horizon; m++) {
    data.push({
      month: m,
      savings: m * monthlySavings,
      cost: totalCost,
    });
  }

  return {
    data,
    monthlySavings,
    totalCost,
    breakEvenMonths,
    annualSavings: monthlySavings * 12,
  };
}

function BreakEvenTooltip({ active, payload }) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div style={TOOLTIP_STYLE}>
      <p className="font-semibold text-gray-800">Month {d.month}</p>
      <p className="text-sm text-green-700">Cumulative Savings: {formatDollarFull(d.savings)}</p>
      <p className="text-sm text-red-600">Total Refi Cost: {formatDollarFull(d.cost)}</p>
      <p className={`text-sm font-medium ${d.savings >= d.cost ? 'text-green-700' : 'text-gray-500'}`}>
        Net: {formatDollarFull(d.savings - d.cost)}
      </p>
    </div>
  );
}

export default function BreakEvenChart({ candidateRates, currentRate, loanAmount, lenderFees, thirdPartyCosts }) {
  const [activeIdx, setActiveIdx] = useState(0);

  const results = useMemo(() => {
    return candidateRates.map(r =>
      computeBreakEven(r, currentRate, loanAmount, lenderFees, thirdPartyCosts)
    );
  }, [candidateRates, currentRate, loanAmount, lenderFees, thirdPartyCosts]);

  const activeResult = results[activeIdx];
  const activeRate = candidateRates[activeIdx];

  if (!activeResult) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 my-4 text-center text-gray-500 text-sm print:hidden">
        Your current rate is already competitive — a refinance wouldn&apos;t save you money at these rates.
      </div>
    );
  }

  const { data, monthlySavings, totalCost, breakEvenMonths, annualSavings } = activeResult;

  return (
    <div className="bg-white border border-gray-200 rounded-lg my-4 overflow-hidden print:hidden">
      <div className="px-5 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700">Break-Even Analysis</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          See how quickly your monthly savings recover the cost of refinancing.
        </p>
      </div>

      {/* Rate pill selector */}
      {candidateRates.length > 1 && (
        <div className="px-5 pt-3 flex flex-wrap gap-2">
          {candidateRates.map((r, i) => (
            <button
              key={r.rate}
              onClick={() => setActiveIdx(i)}
              className={`text-xs rounded-full px-3 py-1.5 font-medium transition-colors ${
                i === activeIdx
                  ? 'bg-brand text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {formatRate(r.rate)}
            </button>
          ))}
        </div>
      )}

      {/* Hero stats */}
      <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Monthly Savings</p>
          <p className="text-lg font-bold text-green-700">${Math.round(monthlySavings)}/mo</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Refi Cost</p>
          <p className="text-lg font-bold text-gray-800">{formatDollarFull(totalCost)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Break Even</p>
          <p className="text-lg font-bold text-brand">
            {breakEvenMonths === 0 ? 'Instant' : `${breakEvenMonths.toFixed(1)} mo`}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Annual Savings</p>
          <p className="text-lg font-bold text-green-700">{formatDollarFull(annualSavings)}/yr</p>
        </div>
      </div>

      {/* Chart */}
      <div className="px-4 pb-4">
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
            <defs>
              <linearGradient id="savingsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS.savings} stopOpacity={0.2} />
                <stop offset="100%" stopColor={CHART_COLORS.savings} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
            <XAxis
              dataKey="month"
              tick={CHART_FONTS.tick}
              tickLine={false}
              label={{ value: 'Months After Refinance', position: 'insideBottom', offset: -2, ...CHART_FONTS.label }}
            />
            <YAxis
              tickFormatter={(v) => `$${(v / 1000).toFixed(1)}K`}
              tick={CHART_FONTS.tick}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<BreakEvenTooltip />} />
            {breakEvenMonths > 0 && breakEvenMonths <= 120 && (
              <ReferenceLine
                x={Math.round(breakEvenMonths)}
                stroke={CHART_COLORS.brand}
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: `${breakEvenMonths.toFixed(1)} mo`,
                  position: 'top',
                  fill: CHART_COLORS.brand,
                  fontSize: 11,
                  fontWeight: 600,
                }}
              />
            )}
            <Area
              type="monotone"
              dataKey="savings"
              stroke={CHART_COLORS.savings}
              strokeWidth={2.5}
              fill="url(#savingsGradient)"
              dot={false}
              name="Cumulative Savings"
            />
            <Line
              type="monotone"
              dataKey="cost"
              stroke={CHART_COLORS.costLine}
              strokeWidth={2}
              strokeDasharray="8 4"
              dot={false}
              name="Total Refi Cost"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Summary text */}
      <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-500">
        {breakEvenMonths === 0 ? (
          <p>This rate earns you a lender credit that covers your closing costs — <strong className="text-green-700">you save from day one.</strong></p>
        ) : (
          <p>
            At {formatRate(activeRate.rate)}, you recover the full cost of refinancing in{' '}
            <strong className="text-brand">{breakEvenMonths.toFixed(1)} months</strong>, then save{' '}
            <strong className="text-green-700">${Math.round(monthlySavings)}/mo</strong> for the life of the loan.
          </p>
        )}
      </div>
    </div>
  );
}
