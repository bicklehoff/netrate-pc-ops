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

      {/* Volume */}
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

function PendingPanel({ date }) {
  const days = daysUntil(date + 'T00:00:00Z');
  return (
    <div>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-0.5">Next FOMC Meeting</div>
          <div className="text-slate-900 font-bold text-sm">{formatMeetingDate(date + 'T00:00:00Z')}</div>
        </div>
        {days && (
          <div className="text-right">
            <div className="text-xl font-black text-primary tabular-nums">{days}</div>
            <div className="text-[9px] uppercase text-slate-400 font-bold">days</div>
          </div>
        )}
      </div>
      <div className="rounded-xl bg-slate-50 p-3 text-center">
        <div className="text-xs text-slate-500">Prediction markets open closer to the meeting</div>
      </div>
    </div>
  );
}

function formatAsOf(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function FedPanel({ fedEvents = [], nextMeeting = null, asOf = null }) {
  if (!fedEvents.length && !nextMeeting) return null;

  const [next] = fedEvents;
  const asOfFormatted = formatAsOf(asOf);

  return (
    <div>
      <div className="mb-3">
        <h3 className="text-base font-bold text-slate-900">Fed Rate Prediction</h3>
        <a
          href="https://polymarket.com/predictions/fed"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-slate-400 hover:text-primary transition-colors"
        >
          Powered by <span className="font-bold text-slate-500">Polymarket</span> prediction markets
        </a>
      </div>

      {next ? <NextMeetingPanel event={next} /> : <PendingPanel date={nextMeeting.date} />}

      {asOfFormatted && (
        <div className="text-[9px] text-slate-400 mt-2 text-right">
          As of {asOfFormatted}
        </div>
      )}
    </div>
  );
}
