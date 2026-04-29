import Link from 'next/link';
import sql from '@/lib/db';
import { OG_IMAGES } from '@/lib/og';

export const metadata = {
  title: 'Mortgage Resources — Guides, Explainers, and Updates | NetRate Mortgage',
  description: 'Mortgage guides, explainers, and industry updates. How pricing works, points vs credits, closing costs, refinance strategies, reverse mortgages, condo rules, and more.',
  openGraph: {
    title: 'Mortgage Resources — Guides, Explainers, and Updates',
    description: 'Educational mortgage content: how pricing works, points vs credits, closing costs, refinance strategies, and more.',
    url: 'https://www.netratemortgage.com/resources',
    siteName: 'NetRate Mortgage',
    type: 'website',
    images: OG_IMAGES,
  },
  alternates: {
    canonical: 'https://www.netratemortgage.com/resources',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: 'Mortgage Resources',
  description: 'Educational mortgage guides, explainers, and industry updates from NetRate Mortgage.',
  url: 'https://www.netratemortgage.com/resources',
  publisher: {
    '@type': 'Organization',
    name: 'NetRate Mortgage',
    url: 'https://www.netratemortgage.com',
  },
};

// ISR: regenerate this page every 10 minutes so newly-published content
// from /api/content appears without a redeploy.
export const revalidate = 600;

const CATEGORY_LABELS = {
  article: 'Article',
  'state-update': 'State Update',
  education: 'Explainer',
  'rate-watch': 'Rate Watch',
};

function formatPubDate(d) {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const updates = [
  {
    href: '/condo-rules-changed',
    title: 'A Rule That Was Blocking Your Condo Loan Just Changed',
    description: 'Fannie Mae retired the 50% investor concentration limit. Buildings that were blocked from conventional financing are back on the table.',
    tag: 'Fannie Mae LL-2026-03',
    date: 'March 2026',
  },
  {
    href: '/equity-without-losing-rate',
    title: 'How to Access Your Home Equity Without Losing Your Low Rate',
    description: 'A HELOC or second lien lets you tap equity without touching your 3% first mortgage. The blended math usually wins.',
    tag: 'HELOC & Second Liens',
    date: 'March 2026',
  },
  {
    href: '/adu-rental-income',
    title: 'Have an ADU? You Can Now Use That Rental Income to Qualify',
    description: 'Fannie Mae now allows rental income from your ADU to count toward mortgage qualifying. New rule effective March 2026.',
    tag: 'Fannie Mae DU 12.1',
    date: 'March 2026',
  },
  {
    href: '/california-housing-update',
    title: 'California: More Housing Near Transit, Easier Condo Financing',
    description: 'SB 79 opens transit-oriented development. Fannie Mae relaxes condo rules. Two shifts working in the same direction.',
    tag: 'California',
    date: 'March 2026',
  },
];

const guides = [
  {
    href: '/how-pricing-works',
    title: 'How Mortgage Pricing Works',
    description: 'What drives your rate, how points and credits work, and how to tell if you\u2019re getting a good deal.',
  },
  {
    href: '/points-and-credits',
    title: 'Points vs. Lender Credits',
    description: 'Should you pay points for a lower rate or take lender credits for lower closing costs? Here\u2019s how to decide.',
  },
  {
    href: '/closing-costs',
    title: 'What Are Closing Costs?',
    description: 'Three different categories lumped together. Learn the difference between loan costs, third-party fees, and prepaids.',
  },
  {
    href: '/breakeven',
    title: 'The Breakeven Math on Points',
    description: 'Most borrowers never recoup the cost of paying points. Here\u2019s the simple math that shows when it\u2019s worth it.',
  },
  {
    href: '/good-deal',
    title: 'How to Tell If Your Rate Is a Good Deal',
    description: 'The mortgage industry makes it hard to comparison shop on purpose. Here\u2019s why and what to watch for.',
  },
  {
    href: '/refinance-playbook',
    title: 'How to Structure a Refinance',
    description: 'Four strategies \u2014 from no-cost to buying the rate down \u2014 and how the cash flow actually works.',
  },
  {
    href: '/reverse-mortgage',
    title: 'Reverse Mortgages Explained',
    description: 'Not a last resort. A financial tool with use cases most people never hear about. Income qualifying, interest-only, five use cases.',
  },
  {
    href: '/why-netrate',
    title: 'How NetRate Charges Less',
    description: 'No TV ads. No cold calls. No haggling. How the direct mortgage model keeps overhead low and passes savings to you.',
  },
  {
    href: '/heloc-vs-cashout',
    title: 'HELOC vs Cash-Out Refinance',
    description: 'Two ways to access equity. One keeps your rate. One replaces it. How to figure out which is right.',
  },
  {
    href: '/when-to-refinance',
    title: 'When Does a Refinance Make Sense?',
    description: 'The breakeven math, the cost of waiting, and how long you\u2019ll keep the loan. Three questions that decide it.',
  },
  {
    href: '/crypto-mortgage',
    title: 'Can You Use Crypto to Qualify for a Mortgage?',
    description: 'Down payment, reserves, asset depletion \u2014 how cryptocurrency works across conventional, government, and non-QM loans.',
  },
  {
    href: '/airbnb-financing',
    title: 'Can You Finance an Airbnb?',
    description: 'DSCR loans qualify on rental income \u2014 no W-2s, no tax returns. How it works for short-term rental properties.',
  },
];

async function getLatestArticles() {
  try {
    return await sql`
      SELECT slug, title, meta_description, category, published_at
      FROM content_pages
      WHERE status = 'published'
      ORDER BY published_at DESC NULLS LAST, created_at DESC
      LIMIT 24
    `;
  } catch (err) {
    console.error('[resources] content_pages query failed:', err.message);
    return [];
  }
}

function LatestCard({ slug, title, description, category, date }) {
  return (
    <Link href={`/${slug}`} className="block bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md hover:border-brand/30 transition-all">
      <div className="flex items-center gap-2 mb-3">
        <span className="inline-block text-xs font-medium text-brand bg-brand/10 px-2.5 py-1 rounded-full">{category}</span>
        {date ? <span className="text-xs text-gray-400">{date}</span> : null}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      {description ? <p className="text-sm text-gray-600 leading-relaxed">{description}</p> : null}
    </Link>
  );
}

function UpdateCard({ href, title, description, tag, date }) {
  return (
    <Link href={href} className="block bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md hover:border-brand/30 transition-all">
      <div className="flex items-center gap-2 mb-3">
        <span className="inline-block text-xs font-medium text-brand bg-brand/10 px-2.5 py-1 rounded-full">{tag}</span>
        <span className="text-xs text-gray-400">{date}</span>
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
    </Link>
  );
}

function GuideCard({ href, title, description }) {
  return (
    <Link href={href} className="block bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md hover:border-brand/30 transition-all">
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
    </Link>
  );
}

export default async function Resources() {
  const latest = await getLatestArticles();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="max-w-4xl mx-auto px-6 py-16">
        <nav className="text-sm text-gray-400 mb-8">
          <Link href="/" className="hover:text-brand">Home</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-600">Resources</span>
        </nav>

        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
          Resources
        </h1>
        <p className="text-lg text-gray-600 mb-12">
          Mortgage guides, explainers, and industry updates.
        </p>

        {/* Latest — DB-driven, auto-includes new articles */}
        {latest.length > 0 && (
          <section className="mb-12">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Latest</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {latest.map((item) => (
                <LatestCard
                  key={item.slug}
                  slug={item.slug}
                  title={item.title}
                  description={item.meta_description}
                  category={CATEGORY_LABELS[item.category] || 'Article'}
                  date={formatPubDate(item.published_at)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Essentials — hand-curated evergreen guides */}
        <section className="mb-12">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Essentials</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {guides.map((item) => (
              <GuideCard key={item.href} {...item} />
            ))}
          </div>
        </section>

        {/* Industry Updates — hand-curated dated items */}
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Industry Updates</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {updates.map((item) => (
              <UpdateCard key={item.href} {...item} />
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
