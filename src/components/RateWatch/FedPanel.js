// Fed Meeting Prediction Panel — Shows next FOMC meeting probabilities
// Data from Polymarket prediction markets via /api/predictions/polymarket
// Displays: meeting date, hold/cut/hike probabilities, future meetings

'use client';

const TYPE_COLORS = {
  hold: { bar: 'bg-blue-400', text: 'text-blue-400', bg: 'bg-blue-400/10' },
  cut: { bar: 'bg-green-400', text: 'text-green-400', bg: 'bg-green-400/10' },
  hike: { bar: 'bg-red-400', text: 'text-red-400', bg: 'bg-red-400/10' },
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

// Main Fed decision for the next meeting
function NextMeetingPanel({ event }) {
  const days = daysUntil(event.endDate);
  const hold = event.outcomes.find(o => o.type === 'hold');
  const cuts = event.outcomes.filter(o => o.type === 'cut');
  const hikes = event.outcomes.filter(o => o.type === 'hike');

  // Aggregate cut and hike probabilities
  const cutPct = cuts.reduce((sum, o) => sum + o.probability, 0);
  const hikePct = hikes.reduce((sum, o) => sum + o.probability, 0);
  const holdPct = hold?.probability || 0;

  return (
    <div className="bg-white/5 rounded-xl border border-white/10 p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Next FOMC Meeting</div>
          <div className="text-white font-bold text-lg">{formatMeetingDate(event.endDate)}</div>
        </div>
        {days && (
          <div className="text-right">
            <div className="text-2xl font-black text-white tabular-nums">{days}</div>
            <div className="text-[10px] uppercase text-slate-500">days</div>
          </div>
        )}
      </div>

      {/* Big probability display */}
      <div className="grid grid-cols-3 gap-3 mb-4">
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
              <span className="text-[11px] text-slate-400 w-24 truncate">{o.label}</span>
              <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full ${colors.bar} transition-all duration-500`}
                  style={{ width: `${Math.max(1, o.probability * 100)}%` }}
                />
              </div>
              <span className={`text-[11px] font-bold tabular-nums w-12 text-right ${colors.text}`}>
                {pct}%
              </span>
            </div>
          );
        })}
      </div>

      {/* Volume */}
      {event.volume > 0 && (
        <div className="text-[10px] text-slate-600 mt-3">
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
    <div className={`rounded-lg p-3 text-center ${primary ? colors.bg + ' border border-white/10' : 'bg-white/5'}`}>
      <div className={`text-2xl font-black tabular-nums ${colors.text}`}>{display}%</div>
      <div className="text-[10px] uppercase tracking-wider text-slate-400 mt-0.5">{label}</div>
    </div>
  );
}

// Compact row for future meetings
function FutureMeetingRow({ event }) {
  const hold = event.outcomes.find(o => o.type === 'hold');
  const cuts = event.outcomes.filter(o => o.type === 'cut');
  const hikes = event.outcomes.filter(o => o.type === 'hike');
  const cutPct = cuts.reduce((sum, o) => sum + o.probability, 0);
  const hikePct = hikes.reduce((sum, o) => sum + o.probability, 0);
  const holdPct = hold?.probability || 0;

  return (
    <div className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
      <span className="text-sm text-slate-300 w-24 font-medium">{formatShortDate(event.endDate)}</span>
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
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${colors.bg} ${colors.text}`}>
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
        <div>
          <h2 className="text-white text-[22px] font-extrabold">Fed Rate Prediction</h2>
          <p className="text-slate-400 text-[13px] mt-0.5">
            What prediction markets expect at each FOMC meeting
          </p>
        </div>
        <a
          href="https://polymarket.com/predictions/fed"
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand text-xs hover:text-cyan-400 transition-colors"
        >
          Polymarket
        </a>
      </div>

      {/* Next meeting — big panel */}
      <NextMeetingPanel event={next} />

      {/* Future meetings — compact rows */}
      {future.length > 0 && (
        <div className="mt-4">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Future Meetings</div>
          {future.map(event => (
            <FutureMeetingRow key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
