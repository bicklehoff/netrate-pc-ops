// Fed Meeting Prediction Panel — Shows next FOMC meeting probabilities
// Data from Polymarket prediction markets via /api/predictions/polymarket

'use client';

const TYPE_COLORS = {
  hold: { bar: 'bg-blue-500', text: 'text-blue-600', bg: 'bg-blue-50' },
  cut: { bar: 'bg-emerald-500', text: 'text-emerald-600', bg: 'bg-emerald-50' },
  hike: { bar: 'bg-red-500', text: 'text-red-600', bg: 'bg-red-50' },
};

function formatMeetingDate(dateStr) {
  if (!dateStr) return 'TBD';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatShortDate(dateStr) {
  if (!dateStr) return 'TBD';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const days = Math.ceil((new Date(dateStr) - new Date()) / 86400000);
  return days > 0 ? days : null;
}

function NextMeetingPanel({ event }) {
  const days = daysUntil(event.endDate);
  const hold = event.outcomes.find(o => o.type === 'hold');
  const cuts = event.outcomes.filter(o => o.type === 'cut');
  const hikes = event.outcomes.filter(o => o.type === 'hike');
  const cutPct = cuts.reduce((sum, o) => sum + o.probability, 0);
  const hikePct = hikes.reduce((sum, o) => sum + o.probability, 0);
  const holdPct = hold?.probability || 0;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-0.5">Next FOMC Meeting</div>
          <div className="text-slate-900 font-bold text-sm">{formatMeetingDate(event.endDate)}</div>
        </div>
        {days && (
          <div className="text-right">
            <div className="text-xl font-black text-primary tabular-nums">{days}</div>
            <div className="text-[9px] uppercase text-slate-400 font-bold">days</div>
          </div>
        )}
      </div>

      {/* Probability boxes */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <ProbBox label="Cut" pct={cutPct} type="cut" />
        <ProbBox label="Hold" pct={holdPct} type="hold" primary />
        <ProbBox label="Hike" pct={hikePct} type="hike" />
      </div>

      {/* Detailed breakdown */}
      <div className="space-y-1.5">
        {event.outcomes.map((o, i) => {
          const colors = TYPE_COLORS[o.type] || TYPE_COLORS.hold;
          const pct = (o.probability * 100).toFixed(1);
          return (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500 w-20 truncate">{o.label}</span>
              <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full ${colors.bar} transition-all duration-500`}
                  style={{ width: `${Math.max(1, o.probability * 100)}%` }}
                />
              </div>
              <span className={`text-[10px] font-bold tabular-nums w-10 text-right ${colors.text}`}>
                {pct}%
              </span>
            </div>
          );
        })}
      </div>

      {event.volume > 0 && (
        <div className="text-[9px] text-slate-400 mt-2">
          ${event.volume >= 1e6 ? `${(event.volume / 1e6).toFixed(1)}M` : `${(event.volume / 1e3).toFixed(0)}k`} trading volume
        </div>
      )}
    </div>
  );
}

function ProbBox({ label, pct, type, primary = false }) {
  const colors = TYPE_COLORS[type] || TYPE_COLORS.hold;
  const display = (pct * 100).toFixed(0);
  return (
    <div className={`rounded-xl p-2.5 text-center ${colors.bg} ${primary ? 'ring-1 ring-inset ring-slate-200' : ''}`}>
      <div className={`text-xl font-black tabular-nums ${colors.text}`}>{display}%</div>
      <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold mt-0.5">{label}</div>
    </div>
  );
}

function FutureMeetingRow({ event }) {
  const hold = event.outcomes.find(o => o.type === 'hold');
  const cuts = event.outcomes.filter(o => o.type === 'cut');
  const hikes = event.outcomes.filter(o => o.type === 'hike');
  const cutPct = cuts.reduce((sum, o) => sum + o.probability, 0);
  const hikePct = hikes.reduce((sum, o) => sum + o.probability, 0);
  const holdPct = hold?.probability || 0;

  return (
    <div className="flex items-center gap-3 py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-700 w-20 font-medium">{formatShortDate(event.endDate)}</span>
      <div className="flex-1 flex gap-1.5 items-center">
        <PctPill pct={cutPct} type="cut" label="Cut" />
        <PctPill pct={holdPct} type="hold" label="Hold" />
        <PctPill pct={hikePct} type="hike" label="Hike" />
      </div>
    </div>
  );
}

function PctPill({ pct, type, label }) {
  const colors = TYPE_COLORS[type];
  const display = (pct * 100).toFixed(0);
  if (pct < 0.005) return null;
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
      {display}% {label}
    </span>
  );
}

export default function FedPanel({ fedEvents = [] }) {
  if (!fedEvents.length) return null;

  const [next, ...future] = fedEvents;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-bold text-slate-900">Fed Rate Prediction</h3>
        <a
          href="https://polymarket.com/predictions/fed"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary text-[10px] font-medium hover:text-cyan-700 transition-colors"
        >
          Polymarket
        </a>
      </div>

      <NextMeetingPanel event={next} />

      {future.length > 0 && (
        <div className="mt-3">
          <div className="text-[9px] uppercase tracking-widest text-slate-400 font-bold mb-1.5">Future Meetings</div>
          {future.map(event => (
            <FutureMeetingRow key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
