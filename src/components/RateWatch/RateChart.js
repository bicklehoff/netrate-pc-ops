'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import {
  Chart,
  LineElement,
  PointElement,
  LineController,
  TimeScale,
  LinearScale,
  Filler,
  Tooltip,
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import annotationPlugin from 'chartjs-plugin-annotation';

Chart.register(
  LineElement,
  PointElement,
  LineController,
  TimeScale,
  LinearScale,
  Filler,
  Tooltip,
  annotationPlugin
);

// Custom plugin: shade spread between lines, label endpoints, show savings pill
const spreadPlugin = {
  id: 'spreadPlugin',
  afterDatasetsDraw(chart) {
    const ds0 = chart.data.datasets[0]; // NetRate
    const ds1 = chart.data.datasets[1]; // Freddie Mac
    const meta0 = chart.getDatasetMeta(0);
    const meta1 = chart.getDatasetMeta(1);
    if (!meta0.data.length || !meta1.data.length) return;

    const ctx = chart.ctx;
    ctx.save();

    // 1. Shade the spread area
    const points0 = [];
    const points1 = [];
    for (let i = 0; i < meta0.data.length; i++) {
      if (ds0.data[i] !== null && ds1.data[i] !== null) {
        points0.push({ x: meta0.data[i].x, y: meta0.data[i].y });
        points1.push({ x: meta1.data[i].x, y: meta1.data[i].y });
      }
    }
    if (points0.length > 1) {
      ctx.beginPath();
      ctx.moveTo(points1[0].x, points1[0].y);
      for (let i = 1; i < points1.length; i++) ctx.lineTo(points1[i].x, points1[i].y);
      for (let i = points0.length - 1; i >= 0; i--) ctx.lineTo(points0[i].x, points0[i].y);
      ctx.closePath();
      ctx.fillStyle = 'rgba(239,68,68,0.08)';
      ctx.fill();
    }

    // 2. Find last real data points
    let lastIdx0 = ds0.data.length - 1;
    while (lastIdx0 >= 0 && ds0.data[lastIdx0] === null) lastIdx0--;
    let lastIdx1 = ds1.data.length - 1;
    while (lastIdx1 >= 0 && ds1.data[lastIdx1] === null) lastIdx1--;
    if (lastIdx0 < 0 || lastIdx1 < 0) { ctx.restore(); return; }

    const p0 = meta0.data[lastIdx0];
    const p1 = meta1.data[lastIdx1];
    if (!p0 || !p1) { ctx.restore(); return; }

    const val0 = ds0.data[lastIdx0];
    const val1 = ds1.data[lastIdx1];
    const spread = (val1 - val0).toFixed(2);

    // 3. NetRate endpoint pill
    ctx.beginPath();
    ctx.arc(p0.x, p0.y, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#0891b2';
    ctx.fill();
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.stroke();

    const nrText = 'NetRate: ' + val0 + '%';
    ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, sans-serif';
    let tw = ctx.measureText(nrText).width;
    let px = p0.x + 14;
    let py = p0.y;
    ctx.fillStyle = 'rgba(8,145,178,0.9)';
    ctx.beginPath();
    ctx.roundRect(px - 6, py - 11, tw + 12, 22, 4);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'middle';
    ctx.fillText(nrText, px, py);

    // 4. Freddie Mac endpoint pill
    ctx.beginPath();
    ctx.arc(p1.x, p1.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#ef4444';
    ctx.fill();
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.stroke();

    const fmText = "Nat'l Avg: " + val1.toFixed(2) + '%';
    ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, sans-serif';
    tw = ctx.measureText(fmText).width;
    px = p1.x + 14;
    py = p1.y;
    ctx.fillStyle = 'rgba(239,68,68,0.8)';
    ctx.beginPath();
    ctx.roundRect(px - 6, py - 10, tw + 12, 20, 4);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'middle';
    ctx.fillText(fmText, px, py);

    // 5. Arrow + savings pill
    const midY = (p0.y + p1.y) / 2;
    const midX = p0.x + 14;
    const saveText = 'Save ' + spread + '% with NetRate';
    ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, sans-serif';
    tw = ctx.measureText(saveText).width;

    ctx.beginPath();
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(34,197,94,0.6)';
    ctx.lineWidth = 1.5;
    ctx.moveTo(p0.x + 4, p0.y - 8);
    ctx.lineTo(p0.x + 4, p1.y + 8);
    ctx.stroke();

    // Arrow caps
    ctx.beginPath();
    ctx.moveTo(p0.x + 1, p0.y - 5);
    ctx.lineTo(p0.x + 4, p0.y - 10);
    ctx.lineTo(p0.x + 7, p0.y - 5);
    ctx.fillStyle = 'rgba(34,197,94,0.6)';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(p0.x + 1, p1.y + 5);
    ctx.lineTo(p0.x + 4, p1.y + 10);
    ctx.lineTo(p0.x + 7, p1.y + 5);
    ctx.fill();

    // Green pill
    ctx.fillStyle = 'rgba(34,197,94,0.9)';
    ctx.beginPath();
    ctx.roundRect(midX + 8, midY - 12, tw + 14, 24, 5);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'middle';
    ctx.fillText(saveText, midX + 15, midY);

    ctx.restore();
  },
};

Chart.register(spreadPlugin);

// Economic calendar events
const PAST_EVENTS = [
  { date: '2025-12-18', label: 'FOMC Rate Cut' },
  { date: '2026-01-09', label: 'Jobs Report' },
  { date: '2026-01-20', label: 'Inauguration' },
  { date: '2026-01-29', label: 'FOMC Hold' },
  { date: '2026-02-07', label: 'Jobs Report' },
  { date: '2026-02-12', label: 'CPI Hot' },
  { date: '2026-03-07', label: 'Jobs Report' },
  { date: '2026-03-12', label: 'CPI Cool' },
  { date: '2026-03-18', label: 'FOMC Hold' },
];

const FUTURE_EVENTS = [
  { date: '2026-04-03', label: 'Jobs Report' },
  { date: '2026-04-10', label: 'CPI' },
  { date: '2026-05-06', label: 'FOMC' },
];

function interpolateFreddieMac(fredData, dates) {
  if (!fredData || fredData.length === 0) return dates.map(() => null);
  // Sort ascending by date
  const sorted = [...fredData].sort((a, b) => new Date(a.date) - new Date(b.date));

  return dates.map((dateStr) => {
    const dTime = new Date(dateStr).getTime();
    let before = null;
    let after = null;
    for (let i = 0; i < sorted.length; i++) {
      const fmTime = new Date(sorted[i].date).getTime();
      if (fmTime <= dTime) before = { time: fmTime, rate: sorted[i].value };
      if (fmTime >= dTime && !after) after = { time: fmTime, rate: sorted[i].value };
    }
    if (!before && !after) return null;
    if (!before) return after.rate;
    if (!after) return before.rate;
    if (before.time === after.time) return before.rate;
    const pct = (dTime - before.time) / (after.time - before.time);
    return Math.round((before.rate + pct * (after.rate - before.rate)) * 1000) / 1000;
  });
}

function smoothData(values, window = 5) {
  return values.map((v, i) => {
    const start = Math.max(0, i - window + 1);
    const slice = values.slice(start, i + 1).filter((x) => x !== null);
    if (slice.length === 0) return null;
    return Math.round((slice.reduce((a, b) => a + b, 0) / slice.length) * 1000) / 1000;
  });
}

function getXMax(days) {
  const today = new Date();
  let lookAhead = days === 30 ? 21 : days === 90 ? 35 : 60;
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + lookAhead);

  let furthest = new Date(today);
  furthest.setDate(furthest.getDate() + 14);
  for (const ev of FUTURE_EVENTS) {
    const evDate = new Date(ev.date);
    if (evDate <= maxDate && evDate > furthest) furthest = evDate;
  }
  furthest.setDate(furthest.getDate() + 3);
  return furthest.toISOString().split('T')[0];
}

function buildAnnotations(days) {
  const cutoff = new Date();
  if (days > 0) cutoff.setDate(cutoff.getDate() - days);
  const today = new Date().toISOString().split('T')[0];
  const annotations = {};
  const xMax = getXMax(days);

  // Past events
  PAST_EVENTS.forEach((ev, i) => {
    if (days > 0 && new Date(ev.date) < cutoff) return;
    annotations['past' + i] = {
      type: 'line',
      xMin: ev.date,
      xMax: ev.date,
      borderColor: 'rgba(148,163,184,0.25)',
      borderWidth: 1,
      borderDash: [4, 4],
      label: {
        display: true,
        content: ev.label,
        position: 'start',
        backgroundColor: 'rgba(15,23,42,0.85)',
        color: '#94a3b8',
        font: { size: 10, weight: '500' },
        padding: { top: 3, bottom: 3, left: 5, right: 5 },
        borderRadius: 3,
      },
    };
  });

  // Future events
  FUTURE_EVENTS.forEach((ev, i) => {
    if (new Date(ev.date) > new Date(xMax)) return;
    annotations['future' + i] = {
      type: 'line',
      xMin: ev.date,
      xMax: ev.date,
      borderColor: 'rgba(245,158,11,0.6)',
      borderWidth: 2,
      label: {
        display: true,
        content: ev.label,
        position: 'start',
        backgroundColor: 'rgba(245,158,11,0.15)',
        borderColor: 'rgba(245,158,11,0.5)',
        borderWidth: 1,
        color: '#fbbf24',
        font: { size: 11, weight: '700' },
        padding: { top: 4, bottom: 4, left: 6, right: 6 },
        borderRadius: 3,
      },
    };
  });

  // Today line
  annotations['today'] = {
    type: 'line',
    xMin: today,
    xMax: today,
    borderColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderDash: [2, 2],
  };

  // Month bands
  const xMaxDate = new Date(xMax);
  const startDate = days > 0 ? cutoff : new Date('2025-12-01');
  let mCursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  let mIndex = 0;
  while (mCursor <= xMaxDate) {
    const mStart = mCursor.toISOString().split('T')[0];
    const nextMonth = new Date(mCursor.getFullYear(), mCursor.getMonth() + 1, 1);
    const mEnd = nextMonth.toISOString().split('T')[0];
    const monthName = mCursor.toLocaleDateString('en-US', { month: 'short' });
    const year = mCursor.getFullYear();
    const label = mCursor.getMonth() === 0 || mIndex === 0 ? monthName + ' ' + year : monthName;

    if (mIndex % 2 === 0) {
      annotations['monthBg' + mIndex] = {
        type: 'box',
        xMin: mStart,
        xMax: mEnd,
        backgroundColor: 'rgba(255,255,255,0.035)',
        borderWidth: 0,
        drawTime: 'beforeDatasetsDraw',
      };
    }

    annotations['monthLabel' + mIndex] = {
      type: 'label',
      xValue: new Date(mCursor.getFullYear(), mCursor.getMonth(), 15).toISOString().split('T')[0],
      yValue: 'max',
      yAdjust: 8,
      content: label,
      color: '#cbd5e1',
      font: { size: 14, weight: '700' },
      position: 'start',
    };

    if (mIndex > 0) {
      annotations['monthDiv' + mIndex] = {
        type: 'line',
        xMin: mStart,
        xMax: mStart,
        borderColor: 'rgba(71,85,105,0.5)',
        borderWidth: 1,
        drawTime: 'beforeDatasetsDraw',
      };
    }

    mCursor = nextMonth;
    mIndex++;
  }

  return annotations;
}

const CREDIT_MAP = { '760': '760+', '740': '740-759', '700': '700-719' };
const CREDIT_TIERS = ['760', '740', '700'];
const TIME_RANGES = [
  { label: '1 Mo', days: 30 },
  { label: '3 Mo', days: 90 },
  { label: 'All Time', days: 0 },
];

export default function RateChart({ rateHistory, fredData: serverFredData }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const [creditTier, setCreditTier] = useState('760');
  const [timeRange, setTimeRange] = useState(90);
  const [fredData, setFredData] = useState(serverFredData || {});

  // Client-side FRED data fetch as fallback (SSR fetch often fails during build)
  useEffect(() => {
    if (fredData?.MORTGAGE30US?.length > 0) return; // already have data
    fetch('/api/rates/fred?series=all&days=365')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.series?.MORTGAGE30US) {
          setFredData(data.series);
        }
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const buildChart = useCallback(() => {
    if (!canvasRef.current) return;

    // Filter rate history by credit tier and time range
    const tierKey = CREDIT_MAP[creditTier];
    let filtered = rateHistory.filter((r) => r.credit_score_tier === tierKey);
    if (timeRange > 0) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - timeRange);
      filtered = filtered.filter((r) => new Date(r.date) >= cutoff);
    }
    filtered.sort((a, b) => new Date(a.date) - new Date(b.date));

    const dates = filtered.map((r) => r.date);
    const rawValues = filtered.map((r) => parseFloat(r.rate));
    const values = smoothData(rawValues);

    // Interpolate Freddie Mac data (no offset — FRED data is already accurate)
    const fm30 = fredData?.MORTGAGE30US || [];
    const fmValues = interpolateFreddieMac(fm30, dates);

    // Extend into future
    const xMax = getXMax(timeRange);
    const extLabels = [...dates];
    const extValues = [...values];
    const extFmValues = [...fmValues];

    if (dates.length > 0) {
      let d = new Date(dates[dates.length - 1]);
      d.setDate(d.getDate() + 1);
      const endDate = new Date(xMax);
      while (d <= endDate) {
        if (d.getDay() !== 0 && d.getDay() !== 6) {
          extLabels.push(d.toISOString().split('T')[0]);
          extValues.push(null);
          extFmValues.push(null);
        }
        d.setDate(d.getDate() + 1);
      }
    }

    // Y-axis range
    const allVals = values.concat(fmValues.filter((v) => v !== null));
    const mn = allVals.length > 0 ? Math.min(...allVals) : 5;
    const mx = allVals.length > 0 ? Math.max(...allVals) : 7;

    const config = {
      type: 'line',
      data: {
        labels: extLabels,
        datasets: [
          {
            label: 'NetRate Wholesale',
            data: extValues,
            borderColor: '#0891b2',
            backgroundColor: 'rgba(8,145,178,0.08)',
            fill: true,
            tension: 0.3,
            pointRadius: 1.5,
            pointHoverRadius: 5,
            pointBackgroundColor: '#0891b2',
            pointBorderColor: '#1e293b',
            pointBorderWidth: 1,
            borderWidth: 2.5,
            spanGaps: false,
            order: 1,
          },
          {
            label: 'National Avg (Freddie Mac)',
            data: extFmValues,
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239,68,68,0.05)',
            fill: false,
            tension: 0.3,
            pointRadius: 1.5,
            pointHoverRadius: 5,
            pointBackgroundColor: '#ef4444',
            pointBorderColor: '#1e293b',
            pointBorderWidth: 1,
            borderWidth: 2.5,
            spanGaps: true,
            order: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 2.2,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0f172a',
            borderColor: '#334155',
            borderWidth: 1,
            titleColor: '#94a3b8',
            bodyColor: '#fff',
            bodyFont: { size: 16, weight: '700' },
            titleFont: { size: 13 },
            padding: 12,
            displayColors: true,
            filter: (item) => item.raw !== null,
            callbacks: {
              title: (items) => {
                if (!items.length) return '';
                const d = new Date(items[0].label + 'T12:00:00');
                return d.toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                });
              },
              label: (item) => {
                if (item.raw === null) return '';
                if (item.datasetIndex === 0) return ' NetRate: ' + item.raw + '%';
                if (item.datasetIndex === 1) return " Nat'l Avg: " + item.raw.toFixed(2) + '%';
              },
              afterBody: (items) => {
                const nr = items.find((i) => i.datasetIndex === 0 && i.raw !== null);
                const fm = items.find((i) => i.datasetIndex === 1 && i.raw !== null);
                if (nr && fm) return [' You save: ' + (fm.raw - nr.raw).toFixed(3) + '%'];
                return [];
              },
            },
          },
          annotation: {
            annotations: buildAnnotations(timeRange),
          },
        },
        scales: {
          x: {
            type: 'time',
            time: { unit: 'week', displayFormats: { week: 'MMM d' } },
            grid: { display: false },
            ticks: { color: '#94a3b8', font: { size: 12, weight: '500' }, maxRotation: 0 },
            min: dates[0],
            max: xMax,
          },
          y: {
            title: {
              display: true,
              text: 'Mortgage Rate',
              color: '#cbd5e1',
              font: { size: 13, weight: '600' },
            },
            ticks: {
              color: '#cbd5e1',
              font: { size: 13, weight: '600' },
              callback: (v) => v.toFixed(3) + '%',
              stepSize: 0.125,
            },
            grid: { color: 'rgba(51,65,85,0.5)' },
            min: Math.floor((mn - 0.25) * 8) / 8,
            max: Math.ceil((mx + 0.25) * 8) / 8,
          },
        },
      },
    };

    if (chartRef.current) chartRef.current.destroy();
    chartRef.current = new Chart(canvasRef.current.getContext('2d'), config);
  }, [rateHistory, fredData, creditTier, timeRange]);

  useEffect(() => {
    buildChart();
    return () => {
      if (chartRef.current) chartRef.current.destroy();
    };
  }, [buildChart]);

  return (
    <div>
      {/* Title row */}
      <h2 className="text-white text-sm font-bold mb-1">Rate History</h2>

      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-500 uppercase tracking-wide">Score</span>
          <div className="flex">
            {CREDIT_TIERS.map((tier) => (
              <button
                key={tier}
                onClick={() => setCreditTier(tier)}
                className={`px-2 py-0.5 text-[11px] font-semibold border border-slate-600 transition-all first:rounded-l last:rounded-r ${
                  creditTier === tier
                    ? 'bg-brand text-white border-brand'
                    : 'bg-surface text-slate-400 hover:text-white'
                }`}
              >
                {tier === '760' ? '760+' : tier}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-500 uppercase tracking-wide">Range</span>
          <div className="flex">
            {TIME_RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => setTimeRange(r.days)}
                className={`px-2 py-0.5 text-[11px] font-semibold border border-slate-600 transition-all first:rounded-l last:rounded-r ${
                  timeRange === r.days
                    ? 'bg-brand text-white border-brand'
                    : 'bg-surface text-slate-400 hover:text-white'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        {/* Inline legend */}
        <div className="flex items-center gap-3 ml-auto text-[10px] text-slate-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-brand" />NetRate</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500" />Nat&apos;l Avg</span>
          <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-red-500/30" />Spread</span>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-surface rounded-xl p-4">
        <canvas ref={canvasRef} style={{ maxHeight: '300px' }} />
      </div>
    </div>
  );
}
