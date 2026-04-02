'use client';

function TickerStat({ label, value, change, changeColor }) {
  return (
    <div className="flex flex-col">
      <span className="text-slate-400 text-[10px] uppercase tracking-wider font-bold">{label}</span>
      <span className="text-slate-900 text-sm font-bold tabular-nums">
        {value}
        {change && (
          <span className={`text-xs ml-1 font-medium ${changeColor || 'text-slate-400'}`}>{change}</span>
        )}
      </span>
    </div>
  );
}

function Separator() {
  return <div className="w-px h-6 bg-slate-200" />;
}

export default function TickerBar({ fredLatest, todayRate, rateHistory }) {
  const now = new Date();
  const cutoff90 = new Date(now);
  cutoff90.setDate(cutoff90.getDate() - 90);
  const recent = (rateHistory || []).filter(
    (r) => r.credit_score_tier === '760+' && new Date(r.date) >= cutoff90
  );
  let low90 = null;
  let high90 = null;
  let low90Date = '';
  let high90Date = '';

  for (const r of recent) {
    const rate = parseFloat(r.rate);
    if (low90 === null || rate < low90) {
      low90 = rate;
      low90Date = new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    if (high90 === null || rate > high90) {
      high90 = rate;
      high90Date = new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  }

  const fm30 = fredLatest?.MORTGAGE30US;
  const spread = fm30 && todayRate ? (fm30.value - todayRate).toFixed(3) : null;

  const chgColor = (val) =>
    val > 0 ? 'text-red-500' : val < 0 ? 'text-emerald-600' : 'text-slate-400';

  return (
    <div className="flex items-center gap-5 px-4 py-2.5 bg-white/60 backdrop-blur-sm rounded-xl border border-slate-100 overflow-x-auto scrollbar-hide">
      {fredLatest?.MORTGAGE15US && (
        <>
          <TickerStat
            label="15yr Fixed"
            value={fredLatest.MORTGAGE15US.value.toFixed(2) + '%'}
            change={
              fredLatest.MORTGAGE15US.change
                ? (fredLatest.MORTGAGE15US.change > 0 ? '+' : '') +
                  fredLatest.MORTGAGE15US.change.toFixed(2)
                : null
            }
            changeColor={chgColor(fredLatest.MORTGAGE15US.change)}
          />
          <Separator />
        </>
      )}
      {fredLatest?.DGS10 && (
        <>
          <TickerStat
            label="10yr Treasury"
            value={fredLatest.DGS10.value.toFixed(3) + '%'}
            change={
              fredLatest.DGS10.change
                ? (fredLatest.DGS10.change > 0 ? '+' : '') +
                  fredLatest.DGS10.change.toFixed(3)
                : null
            }
            changeColor={chgColor(fredLatest.DGS10.change)}
          />
          <Separator />
        </>
      )}
      {fredLatest?.DGS30 && (
        <>
          <TickerStat
            label="30yr Treasury"
            value={fredLatest.DGS30.value.toFixed(3) + '%'}
            change={
              fredLatest.DGS30.change
                ? (fredLatest.DGS30.change > 0 ? '+' : '') +
                  fredLatest.DGS30.change.toFixed(3)
                : null
            }
            changeColor={chgColor(fredLatest.DGS30.change)}
          />
          <Separator />
        </>
      )}
      {low90 !== null && (
        <>
          <TickerStat
            label="90-Day Low"
            value={low90.toFixed(3) + '%'}
            change={low90Date}
            changeColor="text-slate-400"
          />
          <Separator />
        </>
      )}
      {high90 !== null && (
        <>
          <TickerStat
            label="90-Day High"
            value={high90.toFixed(3) + '%'}
            change={high90Date}
            changeColor="text-slate-400"
          />
          <Separator />
        </>
      )}
      {fm30 && spread && (
        <TickerStat
          label="Nat'l Avg (Freddie Mac)"
          value={fm30.value.toFixed(2) + '%'}
          change={`+${spread} vs NetRate Mortgage`}
          changeColor="text-red-500"
        />
      )}
    </div>
  );
}
