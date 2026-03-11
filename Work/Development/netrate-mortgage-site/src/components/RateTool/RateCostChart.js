// Rate vs. Cost Chart — Visual tradeoff between rate and upfront cost
// Green zone = lender credit covers costs. Red zone = borrower pays out of pocket.
// Uses same priced rates data already computed in RateResults.

'use client';

import { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { CHART_COLORS, CHART_FONTS, TOOLTIP_STYLE, formatDollarFull, formatRate, formatPI } from './chartHelpers';

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  const isCredit = d.creditDollars < 0;
  return (
    <div style={TOOLTIP_STYLE}>
      <p className="font-semibold text-gray-800">{formatRate(d.rate)}</p>
      <p className="text-sm text-gray-600">P&I: {formatPI(d.monthlyPI)}/mo</p>
      <p className={`text-sm font-medium ${isCredit ? 'text-green-700' : 'text-red-600'}`}>
        {isCredit ? 'Credit' : 'Cost'}: {formatDollarFull(Math.abs(d.creditDollars))}
      </p>
      <p className="text-sm text-gray-500">
        Net: {formatDollarFull(d.netCost)}
      </p>
    </div>
  );
}

export default function RateCostChart({ visibleRates, lenderFees, thirdPartyCosts }) {
  const data = useMemo(() => {
    return visibleRates.map(r => ({
      rate: r.rate,
      rateLabel: formatRate(r.rate),
      netCost: r.creditDollars + lenderFees + (thirdPartyCosts || 0),
      monthlyPI: r.monthlyPI,
      creditDollars: r.creditDollars,
    }));
  }, [visibleRates, lenderFees, thirdPartyCosts]);

  // Compute zero-crossing position for gradient split
  const gradientOffset = useMemo(() => {
    const maxVal = Math.max(...data.map(d => d.netCost));
    const minVal = Math.min(...data.map(d => d.netCost));
    if (maxVal <= 0) return 1;       // all credit (green)
    if (minVal >= 0) return 0;       // all cost (red)
    return maxVal / (maxVal - minVal);
  }, [data]);

  if (data.length === 0) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 my-4 print:hidden">
      <h3 className="text-sm font-semibold text-gray-700 mb-1">Rate vs. Total Cost</h3>
      <p className="text-xs text-gray-500 mb-3">
        <span className="text-green-600 font-medium">Green</span> = lender credit covers costs.{' '}
        <span className="text-red-600 font-medium">Red</span> = you pay out of pocket.
      </p>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
          <defs>
            <linearGradient id="rateCostGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.cost} stopOpacity={0.25} />
              <stop offset={`${(gradientOffset * 100).toFixed(1)}%`} stopColor={CHART_COLORS.cost} stopOpacity={0.05} />
              <stop offset={`${(gradientOffset * 100).toFixed(1)}%`} stopColor={CHART_COLORS.credit} stopOpacity={0.05} />
              <stop offset="100%" stopColor={CHART_COLORS.credit} stopOpacity={0.25} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
          <XAxis
            dataKey="rateLabel"
            tick={CHART_FONTS.tick}
            tickLine={false}
            interval={data.length > 8 ? 1 : 0}
          />
          <YAxis
            tickFormatter={(v) => `$${(v / 1000).toFixed(1)}K`}
            tick={CHART_FONTS.tick}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine
            y={0}
            stroke={CHART_COLORS.brand}
            strokeDasharray="6 3"
            strokeWidth={1.5}
            label={{ value: 'PAR', position: 'right', fill: CHART_COLORS.brand, fontSize: 11, fontWeight: 600 }}
          />
          <Area
            type="monotone"
            dataKey="netCost"
            stroke={CHART_COLORS.brand}
            strokeWidth={2}
            fill="url(#rateCostGradient)"
            dot={{ r: 3, fill: CHART_COLORS.brand, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: CHART_COLORS.brand, strokeWidth: 2, stroke: 'white' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
