const UPCOMING_EVENTS = [
  {
    date: 'Fri Apr 3',
    name: 'March Jobs Report',
    impact:
      'Strong jobs = higher rates. Weak jobs = lower rates. February was 151K — if March comes in under 150K, expect improvement.',
    big: true,
  },
  {
    date: 'Thu Apr 10',
    name: 'CPI (March)',
    impact:
      "The last CPI was 2.8% year-over-year. If March drops below 2.7%, rates could test February lows again. If it stays above 3%, rates go higher.",
  },
  {
    date: 'Wed May 6',
    name: 'FOMC Rate Decision',
    impact:
      "The next Fed meeting. Markets are watching the dot plot — if the Fed signals fewer rate cuts in 2026, expect rates to stay elevated.",
  },
];

export default function BelowFold() {
  return (
    <div className="max-w-[1200px] mx-auto px-7">
      {/* What Happened Today */}
      <div className="bg-slate-800 rounded-xl px-9 py-8 mt-8 border-l-4 border-l-red-500">
        <h2 className="text-white text-[26px] font-extrabold leading-tight mb-4">
          What Happened Today
        </h2>
        <div className="space-y-3 text-slate-300 text-[15px] leading-[1.8]">
          <p>
            Markets are digesting the latest economic data and Fed commentary. Treasury yields have
            been volatile as investors weigh inflation concerns against signs of economic cooling.{' '}
            <strong className="text-white">
              The path forward depends on upcoming data releases.
            </strong>
          </p>
          <p>
            Mortgage rates track the 10-year Treasury closely, and both have been range-bound over
            the past few weeks. The next major catalyst will be the April jobs report — a weaker
            number could push rates back toward February lows, while a strong print would keep them
            elevated.
          </p>
          <p>
            <strong className="text-white">Bottom line:</strong> Rates are in a holding pattern.
            The next few weeks of economic data will determine whether we break lower or push higher.
            If you&apos;re in the market, this is a reasonable time to lock — but there&apos;s no
            urgency unless you have a closing deadline.
          </p>
        </div>
      </div>

      {/* What Could Move Rates Next */}
      <div className="mt-6">
        <h3 className="text-white text-lg font-bold mb-4">What Could Move Rates Next</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {UPCOMING_EVENTS.map((ev, i) => (
            <div
              key={i}
              className={`bg-slate-800 rounded-xl px-6 py-5 ${
                ev.big ? 'border-l-[3px] border-l-amber-500' : ''
              }`}
            >
              <div className="text-amber-500 text-xs font-bold uppercase tracking-wide mb-1.5">
                {ev.date}
              </div>
              <div className="text-white text-base font-bold mb-2">{ev.name}</div>
              <div className="text-slate-400 text-[13px] leading-relaxed">{ev.impact}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA Banner */}
      <div className="bg-gradient-to-br from-brand to-cyan-700 rounded-xl px-8 py-7 mt-8 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div>
          <h3 className="text-white text-xl font-bold mb-1.5">
            Ready to see your actual rate?
          </h3>
          <p className="text-white/80 text-sm max-w-[600px]">
            These are standard scenario rates. Your rate depends on your credit, loan amount, and
            property. Get a personalized quote in 30 seconds.
          </p>
        </div>
        <a
          href="/rates"
          className="bg-white text-cyan-700 px-8 py-3.5 rounded-lg text-base font-bold whitespace-nowrap hover:bg-cyan-50 transition-all hover:-translate-y-0.5"
        >
          Get Your Rate
        </a>
      </div>

      {/* SEO Text */}
      <div className="mt-12 pt-8 border-t border-slate-800">
        <h2 className="text-slate-500 text-base font-semibold mb-4">
          About NetRate&apos;s Rate Watch
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3 text-slate-600 text-[13px] leading-[1.7]">
            <p>
              NetRate tracks daily wholesale mortgage rates sourced directly from our lending
              partners. Unlike survey-based averages from Freddie Mac or Bankrate, our data reflects
              actual wholesale pricing available to mortgage brokers — updated every business day.
            </p>
            <p>
              The national average rate shown on this page comes from Freddie Mac&apos;s Primary
              Mortgage Market Survey (PMMS), published weekly. This survey-based rate includes
              approximately 0.7 discount points and reflects retail pricing offered directly to
              consumers by banks and lenders.
            </p>
          </div>
          <div className="space-y-3 text-slate-600 text-[13px] leading-[1.7]">
            <p>
              The spread between wholesale and retail rates exists because retail lenders build their
              margin, overhead, and profit into the rate they quote you. When you work with a
              mortgage broker like NetRate, you access wholesale pricing and pay a transparent broker
              fee instead — typically resulting in a lower overall cost.
            </p>
            <p>
              Our rate history data begins in December 2025 and grows every day. This proprietary
              dataset tracks rates by credit score tier (760+, 740-759, 700-719) for a standard
              purchase scenario: $400,000 loan amount, 75% LTV, single-family residence.
            </p>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="mt-8 pt-5 pb-10 border-t border-slate-800">
        <p className="text-slate-600 text-[11px] leading-relaxed max-w-[900px]">
          Market commentary is for informational purposes only and does not constitute financial
          advice. Rates shown are wholesale par rates (zero discount points) and are subject to
          change without notice. Actual rates depend on individual borrower qualifications including
          credit score, loan amount, property type, and occupancy. National average data sourced from
          Freddie Mac Primary Mortgage Market Survey via FRED (Federal Reserve Economic Data). This
          product uses the FRED API but is not endorsed or certified by the Federal Reserve Bank of
          St. Louis. NetRate Mortgage LLC NMLS #1111861. Equal Housing Lender.
        </p>
      </div>
    </div>
  );
}
