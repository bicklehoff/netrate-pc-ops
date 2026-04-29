/**
 * Dynamic content page — renders markdown from the content_pages DB table.
 *
 * Catches any top-level slug that doesn't match an existing static route.
 * Hardcoded pages (e.g., /why-netrate/page.js) take precedence in Next.js App Router.
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import sql from '@/lib/db';
import MarkdownContent from '@/components/Portal/MarkdownContent';
import { OG_IMAGES, TWITTER_IMAGES } from '@/lib/og';

const BASE_URL = 'https://www.netratemortgage.com';

async function getPage(slug) {
  const rows = await sql`
    SELECT * FROM content_pages
    WHERE slug = ${slug} AND status = 'published'
    LIMIT 1
  `;
  return rows[0] || null;
}

/**
 * Up to 3 related articles for the widget at the bottom of the page.
 * Same category first (strongest signal — the only relatedness field we
 * have today); fills out from any other published article, most recent
 * first. Best-effort; returns [] on DB error so the main content still
 * renders.
 */
async function getRelatedArticles(currentSlug, currentCategory) {
  try {
    const rows = await sql`
      SELECT slug, title, category, published_at
        FROM content_pages
       WHERE status = 'published'
         AND slug <> ${currentSlug}
       ORDER BY (category = ${currentCategory ?? ''}) DESC,
                published_at DESC
       LIMIT 3
    `;
    return rows;
  } catch (err) {
    console.error('[content] related articles query failed:', err.message);
    return [];
  }
}

// Claw's /api/content payloads sometimes set meta_title already suffixed
// with " | NetRate Mortgage". We own the brand suffix here — strip any
// incoming copy of it so we don't double-brand the <title> tag.
const BRAND_SUFFIX_RE = /\s*[|\u2014\u2013-]\s*NetRate(\s+Mortgage)?\s*$/i;

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) return {};

  const rawTitle = (page.meta_title || page.title || '').trim();
  const titleNoBrand = rawTitle.replace(BRAND_SUFFIX_RE, '').trim();
  const title = `${titleNoBrand} | NetRate Mortgage`;
  const description = page.meta_description;

  return {
    title,
    description,
    alternates: {
      canonical: `${BASE_URL}/${slug}`,
    },
    openGraph: {
      title,
      description,
      type: 'article',
      publishedTime: page.published_at,
      url: `${BASE_URL}/${slug}`,
      images: OG_IMAGES,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: TWITTER_IMAGES,
    },
  };
}

export default async function ContentPage({ params }) {
  const { slug } = await params;
  const page = await getPage(slug);

  if (!page) notFound();

  const related = await getRelatedArticles(slug, page.category);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: page.title,
    datePublished: page.published_at,
    dateModified: page.updated_at,
    author: {
      '@type': page.author === 'NetRate Mortgage' ? 'Organization' : 'Person',
      name: page.author,
    },
    publisher: {
      '@type': 'Organization',
      name: 'NetRate Mortgage',
    },
    url: `${BASE_URL}/${slug}`,
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav className="text-sm text-gray-400 mb-8">
        <Link href="/" className="hover:text-brand">Home</Link>
        {page.category && (
          <>
            <span className="mx-2">/</span>
            <span className="text-gray-500 capitalize">{page.category}</span>
          </>
        )}
        <span className="mx-2">/</span>
        <span className="text-gray-600">{page.title}</span>
      </nav>

      <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8">
        {page.title}
      </h1>

      <div className="space-y-8 text-gray-700 leading-relaxed">
        <MarkdownContent content={page.body} headingOffset={1} />
      </div>

      <div className="mt-12">
        <Link
          href="/rates"
          className="inline-block bg-brand text-white px-6 py-3 rounded-lg font-semibold hover:bg-brand-dark transition-colors"
        >
          See Today&apos;s Rates &rarr;
        </Link>
      </div>

      {related.length > 0 && (
        <section className="mt-16 pt-10 border-t border-gray-200">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-5">
            Related reading
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {related.map((r) => (
              <li key={r.slug}>
                <Link
                  href={`/${r.slug}`}
                  className="block h-full p-4 rounded-lg border border-gray-200 bg-white hover:border-brand hover:shadow-sm transition"
                >
                  {r.category && (
                    <div className="text-xs text-brand uppercase tracking-wide mb-1.5">
                      {r.category.replace(/-/g, ' ')}
                    </div>
                  )}
                  <div className="text-sm font-semibold text-gray-900 leading-snug">
                    {r.title}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-xs text-gray-400 mt-8 pt-4 border-t border-gray-100">
        Licensed in California, Colorado, Oregon, and Texas. NMLS #1111861. Equal Housing Opportunity.
        Rates shown are approximate and subject to change. Not a commitment to lend.
      </p>
    </div>
  );
}
