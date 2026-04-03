'use client';

// ── Index definition ─────────────────────────────────────────────────────────
// Groups: ARM Indexes | HELOC / Fed | Treasury Curve | Mortgage Survey
const TICKER_ITEMS = [
  // ARM Indexes — what variable-rate loans are priced off
  { key: 'SOFR',        label: 'SOFR',      decimals: 3, group: 'arm' },
  { key: 'SOFR30DAYAVG',label: '30D SOFR',  decimals: 3, group: 'arm' },
  { key: 'DGS1',        label: '1yr CMT',   decimals: 3, group: 'arm' },
  // HELOC & Fed — prime-based products + policy backdrop
  { key: 'DPRIME',      label: 'Prime',     decimals: 2, group: 'fed' },
  { key: 'FEDFUNDS',    label: 'Fed Funds', decimals: 2, group: 'fed' },
  // Treasury curve — yield context for fixed pricing
  { key: 'DGS2',        label: '2yr T',     decimals: 3, group: 'tsy' },
  { key: 'DGS5',        label: '5yr T',     decimals: 3, group: 'tsy' },
  { key: 'DGS10',       label: '10yr T',    decimals: 3, group: 'tsy' },
  { key: 'DGS30',       label: '30yr T',    decimals: 3, group: 'tsy' },
  // Mortgage benchmarks — Freddie Mac weekly survey
  { key: 'MORTGAGE15US',label: '15yr Fixed',decimals: 2, group: 'mbs' },
];

// Group separator colors — thin colored rule between groups
const GROUP_DOT = {
  arm: 'bg-violet-300',
  fed: 'bg-amber-300',
  tsy: 'bg-sky-300',
  mbs: 'bg-emerald-300',
};

function TickerStat({ label, value, change, changeColor }) {
  return (
    <div className="flex flex-col shrink-0">
      <span className="text-slate-400 text-[10px] uppercase tracking-wider font-bold whitespace-nowrap">{label}</span>
      <span className="text-slate-900 text-sm font-bold tabular-nums whitespace-nowrap">
        {value}
        {change && (
          <span className={`text-xs ml-1 font-medium ${changeColor || 'text-slate-400'}`}>{change}</span>
        )}
      </span>
    </div>
  );
}

function Separator({ group, nextGroup }) {
  // Colored dot when the group changes, plain line otherwise
  const isGroupBreak = group && nextGroup && group !== nextGroup;
  if (isGroupBreak) {
    return (
      <div className="flex items-center shrink-0">
        <div className={`w-1 h-1 rounded-full ${GROUP_DOT[nextGroup] || 'bg-slate-300'}`} />
      </div>
    );
  }
  return <div className="w-px h-6 bg-slate-200 shrink-0" />;
}

export default function TickerBar({ fredLatest, todayRate }) {
  const chgColor = (val) =>
    val > 0 ? 'text-red-500' : val < 0 ? 'text-emerald-600' : 'text-slate-400';

  const fmtChg = (val, decimals) => {
    if (val == null || val === 0) return null;
    return (val > 0 ? '+' : '') + val.toFixed(decimals);
  };

  // Build item elements
  const elements = [];
  for (let i = 0; i < TICKER_ITEMS.length; i++) {
    const item = TICKER_ITEMS[i];
    const d = fredLatest?.[item.key];
    if (!d) continue;

    if (elements.length > 0) {
      const prevGroup = TICKER_ITEMS[i - 1]?.group;
      elements.push(
        <Separator key={`sep-${item.key}`} group={prevGroup} nextGroup={item.group} />
      );
    }

    elements.push(
      <TickerStat
        key={item.key}
        label={item.label}
        value={d.value.toFixed(item.decimals) + '%'}
        change={fmtChg(d.change, item.decimals)}
        changeColor={chgColor(d.change)}
      />
    );
  }

  // Nat'l Avg with spread vs NetRate Mortgage
  const fm30 = fredLatest?.MORTGAGE30US;
  if (fm30) {
    if (elements.length > 0) {
      elements.push(<Separator key="sep-natl" group="mbs" nextGroup="mbs" />);
    }
    const spread = todayRate ? (fm30.value - todayRate).toFixed(3) : null;
    elements.push(
      <TickerStat
        key="natl-avg"
        label="Nat'l Avg"
        value={fm30.value.toFixed(2) + '%'}
        change={spread ? `+${spread} vs NRM` : null}
        changeColor="text-emerald-600"
      />
    );
  }

  if (elements.length === 0) return null;

  return (
    <div className="flex items-center gap-4 px-4 py-2.5 bg-white/60 backdrop-blur-sm rounded-xl border border-slate-100 overflow-x-auto scrollbar-hide">
      {elements}
    </div>
  );
}
