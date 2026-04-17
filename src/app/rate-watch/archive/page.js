import { neon } from '@neondatabase/serverless';
import Link from 'next/link';

export const revalidate = 3600;

export const metadata = {
  title: 'Rate Watch Archive — Daily Mortgage Rate Updates | NetRate Mortgage',
  description: 'Archive of daily mortgage rate commentary and market analysis from NetRate Mortgage. Track how rates have moved over time.',
  alternates: {
    canonical: 'https://www.netratemortgage.com/rate-watch/archive',
  },
};

async function getAllCommentaries() {
  try {
    const sql = neon(process.env.PC_DATABASE_URL || process.env.DATABASE_URL);
    const rows = await sql`
      SELECT date, headline, sentiment, treasury_10yr, treasury_10yr_chg, author
      FROM rate_watch_commentaries
      ORDER BY date DESC
    `;
    return rows;
  } catch {
    return [];
  }
}

export default async function RateWatchArchivePage() {
  const commentaries = await getAllCommentaries();

  const sentimentColor = {
    bearish: 'text-red-400 bg-red-400/10',
    bullish: 'text-green-400 bg-green-400/10',
    neutral: 'text-brand bg-brand/10',
  };

  // Group by month
  const grouped = {};
  for (const c of commentaries) {
    const d = new Date(c.date + 'T12:00:00');
    const key = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(c);
  }

  return (
    <div className="bg-deep text-slate-200 min-h-screen">
      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-6">
          <Link href="/rate-watch" className="hover:text-brand">Rate Watch</Link>
          <span>/</span>
          <span className="text-slate-400">Archive</span>
        </div>

        <h1 className="text-white text-[32px] font-extrabold mb-2">Rate Watch Archive</h1>
        <p className="text-slate-400 mb-8">{commentaries.length} daily market updates</p>

        {Object.entries(grouped).map(([month, items]) => (
          <div key={month} className="mb-8">
            <h2 className="text-slate-400 text-xs font-bold uppercase tracking-wide mb-3">{month}</h2>
            <div className="space-y-2">
              {items.map((c) => {
                const dateStr = c.date instanceof Date ? c.date.toISOString().split('T')[0] : String(c.date).split('T')[0];
                const dayLabel = new Date(c.date + 'T12:00:00').toLocaleDateString('en-US', {
                  weekday: 'short', month: 'short', day: 'numeric',
                });
                return (
                  <Link
                    key={dateStr}
                    href={`/rate-watch/${dateStr}`}
                    className="flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-white/5 transition-colors group"
                  >
                    <span className="text-slate-500 text-xs w-24 flex-shrink-0">{dayLabel}</span>
                    <span className="text-white font-medium group-hover:text-brand transition-colors flex-1 truncate">
                      {c.headline}
                    </span>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${sentimentColor[c.sentiment] || 'text-slate-400 bg-white/5'}`}>
                      {c.sentiment}
                    </span>
                    {c.treasury_10yr && (
                      <span className="text-xs text-slate-500 tabular-nums w-16 text-right">
                        10yr: {Number(c.treasury_10yr).toFixed(2)}%
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {commentaries.length === 0 && (
          <div className="text-center py-12 text-slate-500">No commentaries yet.</div>
        )}

        <div className="mt-10 text-xs text-slate-500">
          Market commentary is for informational purposes only. NMLS #1111861.
        </div>
      </div>
    </div>
  );
}
