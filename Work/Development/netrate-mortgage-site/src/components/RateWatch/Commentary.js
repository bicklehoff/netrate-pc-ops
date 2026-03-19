export default function Commentary() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Denver',
  });

  return (
    <div className="bg-slate-800 rounded-xl px-6 py-5 border-l-4 border-l-brand">
      <div className="flex justify-between items-center mb-2.5">
        <span className="text-brand text-[13px] font-bold uppercase tracking-wide">
          Market Commentary
        </span>
        <span className="text-slate-400 text-[13px]">Updated {timeStr} MT</span>
      </div>
      <p className="text-slate-200 text-[15px] leading-[1.7]">
        Rates are holding in the middle of the recent 90-day range. Treasury yields continue to
        reflect uncertainty around inflation data and upcoming Fed decisions. If you&apos;ve been
        rate shopping, watch for movement around the next jobs report and CPI release — those are the
        two data points most likely to shift rates meaningfully in either direction.
      </p>
    </div>
  );
}
