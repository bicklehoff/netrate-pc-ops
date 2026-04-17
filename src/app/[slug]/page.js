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

const BASE_URL = 'https://www.netratemortgage.com';

async function getPage(slug) {
  const rows = await sql`
    SELECT * FROM content_pages
    WHERE slug = ${slug} AND status = 'published'
    LIMIT 1
  `;
  return rows[0] || null;
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
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function ContentPage({ params }) {
  const { slug } = await params;
  const page = await getPage(slug);

  if (!page) notFound();

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
        <MarkdownContent content={page.body} />
      </div>

      <div className="mt-12">
        <Link
          href="/rates"
          className="inline-block bg-brand text-white px-6 py-3 rounded-lg font-semibold hover:bg-brand-dark transition-colors"
        >
          See Today&apos;s Rates &rarr;
        </Link>
      </div>

      <p className="text-xs text-gray-400 mt-8 pt-4 border-t border-gray-100">
        Licensed in California, Colorado, Oregon, and Texas. NMLS #1111861. Equal Housing Opportunity.
        Rates shown are approximate and subject to change. Not a commitment to lend.
      </p>
    </div>
  );
}
