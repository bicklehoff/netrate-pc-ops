'use client';

// Economic calendar — static for now, will be agent-generated in Phase D
const ECONOMIC_EVENTS = [
  {
    date: 'Thu Mar 20',
    time: '8:30 AM',
    name: 'Initial Jobless Claims',
    data: null,
    highlight: false,
    future: true,
  },
  {
    date: 'Thu Mar 20',
    time: '10:00 AM',
    name: 'Existing Home Sales (Feb)',
    data: null,
    highlight: false,
    future: true,
  },
  {
    date: 'Fri Apr 3',
    time: '8:30 AM',
    name: 'March Jobs Report',
    data: null,
    highlight: false,
    future: true,
  },
  {
    date: 'Thu Apr 10',
    time: '8:30 AM',
    name: 'CPI (March)',
    data: null,
    highlight: false,
    future: true,
  },
  {
    date: 'Wed May 6',
    time: '2:00 PM',
    name: 'FOMC Rate Decision',
    data: null,
    highlight: false,
    future: true,
  },
];

// Estimate APR: rate + cost of ~$4,100 in fees ($999 lender + ~$3,100 third-party) on $400K / 30yr
function estimateAPR(rate) {
  if (!rate) return null;
  const loanAmount = 400000;
  const totalFees = 4100; // typical lender + third-party
  const r = rate / 100 / 12;
  const n = 360;
  const payment = loanAmount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  const effectiveAmount = loanAmount - totalFees;
  // Solve for APR iteratively
  let aprGuess = rate / 100;
  for (let i = 0; i < 20; i++) {
    const rg = aprGuess / 12;
    const pv = payment * (1 - Math.pow(1 + rg, -n)) / rg;
    const deriv = payment * (n * Math.pow(1 + rg, -n - 1) / rg - (1 - Math.pow(1 + rg, -n)) / (rg * rg)) / 12;
    aprGuess -= (pv - effectiveAmount) / deriv;
  }
  return aprGuess * 100;
}

function RateRow({ product, rate, change }) {
  const chgClass = change > 0 ? 'text-red-500' : change < 0 ? 'text-green-500' : 'text-slate-500';
  const chgText =
    change > 0
      ? `+${change.toFixed(3)}`
      : change < 0
        ? change.toFixed(3)
        : 'unch';
  const apr = estimateAPR(rate);
  return (
    <tr>
      <td className="py-2 text-slate-200 font-semibold text-[15px] border-t border-white/10">
        {product}
      </td>
      <td className="py-2 text-right border-t border-white/10">
        <span className="text-white font-bold text-[15px]">
          {rate ? rate.toFixed(3) + '%' : '—'}
        </span>
        {apr && (
          <span className="text-slate-400 text-[11px] ml-1">
            ({apr.toFixed(3)}% APR)
          </span>
        )}
        {' '}
        <span className={`text-[13px] ${chgClass}`}>{chgText}</span>
      </td>
    </tr>
  );
}

export default function Sidebar({ fredLatest }) {
  return (
    <div className="flex flex-col">
      {/* Treasury Yields */}
      <div className="px-6 py-5 border-b border-white/10">
        <h3 className="text-slate-300 text-[13px] font-bold uppercase tracking-wide mb-3.5">
          Treasury Yields
        </h3>
        {['DGS2', 'DGS5', 'DGS10', 'DGS30'].map((key) => {
          const d = fredLatest?.[key];
          if (!d) return null;
          const labelMap = { DGS2: '2-Year', DGS5: '5-Year', DGS10: '10-Year', DGS30: '30-Year' };
          const chgColor =
            d.change > 0 ? 'text-red-500' : d.change < 0 ? 'text-green-500' : 'text-slate-500';
          const chgText = d.change
            ? (d.change > 0 ? '+' : '') + d.change.toFixed(3)
            : '';
          return (
            <div
              key={key}
              className="flex justify-between py-2 border-b border-white/10 last:border-b-0 text-[15px]"
            >
              <span className="text-slate-300">{labelMap[key]}</span>
              <span>
                <span className="text-white font-bold">{d.value.toFixed(3)}%</span>
                <span className={`text-[13px] ml-2 ${chgColor}`}>{chgText}</span>
              </span>
            </div>
          );
        })}
      </div>

      {/* Economic Calendar */}
      <div className="px-6 py-5">
        <h3 className="text-slate-300 text-[13px] font-bold uppercase tracking-wide mb-3.5">
          Economic Calendar
        </h3>
        {ECONOMIC_EVENTS.map((ev, i) => (
          <div
            key={i}
            className={`py-2.5 border-b border-white/10 last:border-b-0 ${
              ev.highlight ? 'border-l-[3px] border-l-amber-500 pl-2.5 -ml-2.5' : ''
            } ${ev.future ? 'opacity-80' : ''}`}
          >
            <div className="text-slate-400 text-xs font-semibold">
              {ev.date} &middot; {ev.time}
            </div>
            <div className={`text-sm font-semibold mt-0.5 ${ev.future ? 'text-slate-300' : 'text-slate-200'}`}>
              {ev.name}
            </div>
            {ev.data && <div className="text-slate-300 text-[13px] mt-0.5">{ev.data}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
