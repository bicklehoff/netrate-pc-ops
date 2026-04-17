import { neon } from '@neondatabase/serverless';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export const revalidate = 3600; // ISR: 1 hour

async function getCommentary(dateStr) {
  try {
    const sql = neon(process.env.PC_DATABASE_URL || process.env.DATABASE_URL);
    const rows = await sql`
      SELECT date, headline, commentary, sentiment, treasury_10yr, treasury_10yr_chg,
             mbs_6_coupon, mbs_6_change, author, published_at
      FROM rate_watch_commentaries
      WHERE date = ${dateStr}
      LIMIT 1
    `;
    return rows[0] || null;
  } catch {
    return null;
  }
}

async function getAdjacentDates(dateStr) {
  try {
    const sql = neon(process.env.PC_DATABASE_URL || process.env.DATABASE_URL);
    const prev = await sql`
      SELECT date FROM rate_watch_commentaries WHERE date < ${dateStr} ORDER BY date DESC LIMIT 1
    `;
    const next = await sql`
      SELECT date FROM rate_watch_commentaries WHERE date > ${dateStr} ORDER BY date ASC LIMIT 1
    `;
    return {
      prev: prev[0] ? String(prev[0].date).split('T')[0] : null,
      next: next[0] ? String(next[0].date).split('T')[0] : null,
    };
  } catch {
    return { prev: null, next: null };
  }
}

export async function generateMetadata({ params }) {
  const { date } = await params;
  const commentary = await getCommentary(date);
  if (!commentary) return { title: 'Rate Watch | NetRate Mortgage' };

  const dateLabel = new Date(commentary.date + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  return {
    title: `${commentary.headline} — ${dateLabel} | NetRate Mortgage`,
    description: commentary.commentary?.substring(0, 160),
    openGraph: {
      title: commentary.headline,
      description: commentary.commentary?.substring(0, 160),
      type: 'article',
    },
  };
}

export default async function RateWatchDatePage({ params }) {
  const { date } = await params;

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  const [commentary, adjacent] = await Promise.all([
    getCommentary(date),
    getAdjacentDates(date),
  ]);

  if (!commentary) notFound();

  const dateLabel = new Date(commentary.date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  const sentimentColor = {
    bearish: 'text-red-400',
    bullish: 'text-green-400',
    neutral: 'text-brand',
  };

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: commentary.headline,
    datePublished: commentary.published_at || commentary.date,
    dateModified: commentary.published_at || commentary.date,
    author: { '@type': 'Person', name: commentary.author || 'David Burson' },
    publisher: { '@type': 'Organization', name: 'NetRate Mortgage', url: 'https://www.netratemortgage.com' },
    description: commentary.commentary?.substring(0, 160),
  };

  return (
    <div className="bg-deep text-slate-200 min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-6">
          <Link href="/rate-watch" className="hover:text-brand">Rate Watch</Link>
          <span>/</span>
          <Link href="/rate-watch/archive" className="hover:text-brand">Archive</Link>
          <span>/</span>
          <span className="text-slate-400">{date}</span>
        </div>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <span className={`text-xs font-bold uppercase tracking-wide ${sentimentColor[commentary.sentiment] || 'text-brand'}`}>
              {commentary.sentiment}
            </span>
            <span className="text-slate-500 text-xs">{dateLabel}</span>
          </div>

          <h1 className="text-white text-[32px] font-extrabold leading-tight mb-4">
            {commentary.headline}
          </h1>

          {/* Market data strip */}
          <div className="flex items-center gap-5 text-sm text-slate-300 border-b border-white/10 pb-4 mb-6">
            {commentary.treasury_10yr && (
              <span>
                10yr Treasury: <strong className="text-white">{Number(commentary.treasury_10yr).toFixed(2)}%</strong>
                {commentary.treasury_10yr_chg != null && (
                  <span className={Number(commentary.treasury_10yr_chg) > 0 ? 'text-red-400 ml-1' : 'text-green-400 ml-1'}>
                    ({Number(commentary.treasury_10yr_chg) > 0 ? '+' : ''}{Number(commentary.treasury_10yr_chg).toFixed(2)})
                  </span>
                )}
              </span>
            )}
            <span className="text-slate-500">By {commentary.author || 'David Burson'}</span>
          </div>
        </div>

        {/* Commentary body */}
        <div className="text-slate-200 text-[16px] leading-[1.85] space-y-5">
          {commentary.commentary?.split('\n\n').map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center mt-12 pt-6 border-t border-white/10">
          {adjacent.prev ? (
            <Link href={`/rate-watch/${adjacent.prev}`} className="text-sm text-brand hover:text-brand-light">
              &larr; {adjacent.prev}
            </Link>
          ) : <span />}
          <Link href="/rate-watch/archive" className="text-sm text-slate-400 hover:text-white">
            All Updates
          </Link>
          {adjacent.next ? (
            <Link href={`/rate-watch/${adjacent.next}`} className="text-sm text-brand hover:text-brand-light">
              {adjacent.next} &rarr;
            </Link>
          ) : <span />}
        </div>

        {/* Disclaimer */}
        <div className="mt-10 text-xs text-slate-500 leading-relaxed">
          Market commentary is for informational purposes only and does not constitute financial
          advice. Rates shown are wholesale par rates and are subject to change. NMLS #1111861.
        </div>
      </div>
    </div>
  );
}
