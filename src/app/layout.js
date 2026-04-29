import './globals.css';
import { Inter, JetBrains_Mono } from 'next/font/google';
import Script from 'next/script';
import CookieBanner from '@/components/CookieBanner';
import GlassNav from '@/components/GlassNav';
import ContactBar from '@/components/ContactBar';
import {
  COMPANY_NAME,
  COMPANY_URL,
  PRINCIPAL_OFFICER,
  OFFICE_ADDRESS,
  COMPANY_NMLS,
  INDIVIDUAL_NMLS,
  GBP_REVIEW_RATING,
  GBP_REVIEW_COUNT,
  GBP_REVIEW_URL,
} from '@/lib/constants/company';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-mono',
});

export const metadata = {
  title: `${COMPANY_NAME} | Today\'s Rates, Zero Pitch`,
  description: `See today\'s real mortgage rates with transparent pricing. No sales pitch, no commitment. ${COMPANY_NAME} — ${OFFICE_ADDRESS.city}, ${OFFICE_ADDRESS.state}.`,
  keywords: `mortgage rates, refinance, home loan, Colorado mortgage, ${COMPANY_NAME}`,
  manifest: '/manifest.webmanifest',
  icons: {
    // SVG favicon listed first — browsers that support SVG (Chrome, Edge,
    // Firefox, Safari 16+) will pick it for the tab favicon. Adds a
    // brand-blue rounded frame around the existing white-and-bars logo
    // so the icon pops against varied browser tab backgrounds
    // (Zoho-mail style). PNG entries remain for older browsers and as
    // PWA install fallbacks; manifest icons are unchanged.
    icon: [
      { url: '/icons/favicon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/icon-180.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'NetRate',
  },
  openGraph: {
    type: 'website',
    siteName: COMPANY_NAME,
    title: `${COMPANY_NAME} | Today\'s Rates, Zero Pitch`,
    description: `See today\'s real mortgage rates with transparent pricing. No sales pitch, no commitment. ${COMPANY_NAME} — ${OFFICE_ADDRESS.city}, ${OFFICE_ADDRESS.state}.`,
    url: COMPANY_URL,
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: `${COMPANY_NAME} — See real mortgage rates before you apply` }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${COMPANY_NAME} | Today\'s Rates, Zero Pitch`,
    description: `See today\'s real mortgage rates with transparent pricing. No sales pitch, no commitment. ${COMPANY_NAME} — ${OFFICE_ADDRESS.city}, ${OFFICE_ADDRESS.state}.`,
    images: ['/og-image.png'],
  },
};

export const viewport = {
  themeColor: '#2E6BA8',
};

// areaServed list for Organization + FinancialService. Names must match
// LICENSED_STATES in src/lib/constants/company.js (those are the states
// we can legally claim to serve).
const AREA_SERVED = [
  { '@type': 'State', name: 'Colorado' },
  { '@type': 'State', name: 'California' },
  { '@type': 'State', name: 'Texas' },
  { '@type': 'State', name: 'Oregon' },
];

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${COMPANY_URL}/#organization`,
      name: COMPANY_NAME,
      url: COMPANY_URL,
      description:
        'Independent mortgage broker shopping across 11 wholesale lenders to find borrowers the best rate. Direct-to-consumer — no realtor referral fees, no bank markup.',
      telephone: PRINCIPAL_OFFICER.phone,
      email: PRINCIPAL_OFFICER.email,
      address: {
        '@type': 'PostalAddress',
        streetAddress: OFFICE_ADDRESS.street,
        addressLocality: OFFICE_ADDRESS.city,
        addressRegion: OFFICE_ADDRESS.state,
        postalCode: OFFICE_ADDRESS.zip,
        addressCountry: OFFICE_ADDRESS.country,
      },
      areaServed: AREA_SERVED,
      founder: {
        '@type': 'Person',
        name: PRINCIPAL_OFFICER.name,
        jobTitle: 'Mortgage Broker',
      },
      foundingDate: '2013',
      numberOfEmployees: { '@type': 'QuantitativeValue', value: 2 },
      // Google Business Profile reviews — see src/lib/constants/company.js.
      // Values are stubbed today; GBP API sync is a planned follow-up.
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: GBP_REVIEW_RATING,
        reviewCount: GBP_REVIEW_COUNT,
        bestRating: 5,
        worstRating: 1,
      },
    },
    {
      '@type': 'FinancialService',
      '@id': `${COMPANY_URL}/#financialservice`,
      name: COMPANY_NAME,
      url: COMPANY_URL,
      description:
        `Mortgage brokerage offering refinance and purchase loans. Conventional, FHA, VA, and jumbo. NMLS #${INDIVIDUAL_NMLS} (individual) | #${COMPANY_NMLS} (company). Live rate tool with real wholesale pricing — no application required.`,
      areaServed: AREA_SERVED,
      hasOfferCatalog: {
        '@type': 'OfferCatalog',
        name: 'Loan Programs',
        itemListElement: [
          { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Conventional Loans' } },
          { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'FHA Loans' } },
          { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'VA Loans' } },
          { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Jumbo Loans' } },
        ],
      },
    },
    {
      '@type': 'WebSite',
      '@id': `${COMPANY_URL}/#website`,
      url: COMPANY_URL,
      name: COMPANY_NAME,
      publisher: { '@id': `${COMPANY_URL}/#organization` },
    },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${inter.className} ${jetbrainsMono.variable} min-h-screen flex flex-col`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-QPEE5ZSZ79"
          strategy="afterInteractive"
        />
        <Script id="ga4-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('consent', 'default', {
              analytics_storage: 'granted',
              ad_storage: 'denied',
            });
            gtag('config', 'G-QPEE5ZSZ79');
          `}
        </Script>
        {/* Microsoft Clarity — heatmaps & session recordings */}
        <Script id="clarity-init" strategy="afterInteractive">
          {`
            (function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i+"?ref=bwt";
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "vv85vtrn77");
          `}
        </Script>
        {process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && (
          <Script
            src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`}
            strategy="afterInteractive"
          />
        )}
        {/* Contact utility bar — above nav */}
        <ContactBar />
        {/* Navigation — glassmorphism on scroll */}
        <GlassNav>
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <a href="/" className="flex items-center gap-3 no-underline" aria-label="NetRate Mortgage">
              <svg width="38" height="38" viewBox="0 0 44 44" aria-hidden="true">
                <rect width="44" height="44" rx="8" fill="#FFFFFF" stroke="rgba(26,31,46,0.12)"/>
                <rect x="9"  y="24" width="5" height="11" rx="1" fill="#FFC220"/>
                <rect x="17" y="21" width="5" height="14" rx="1" fill="#FFC220"/>
                <rect x="25" y="12" width="5" height="23" rx="1" fill="#2E6BA8"/>
                <rect x="33" y="26" width="5" height="9"  rx="1" fill="#FFC220"/>
              </svg>
              <div className="flex items-baseline" style={{ fontWeight: 600, letterSpacing: '-0.01em' }}>
                <span className="text-[24px] text-ink">Net</span>
                <span className="text-[24px] text-brand">Rate</span>
                <span className="text-[24px] text-ink-mid ml-1.5">Mortgage</span>
              </div>
            </a>
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
              <div className="relative group">
                <a href="/rates" className="text-ink-mid hover:text-brand transition-colors flex items-center gap-1">
                  Rates
                  <svg className="w-3.5 h-3.5 transition-transform group-hover:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </a>
                <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  <div className="bg-white rounded-lg shadow-nr-md border border-gray-200 py-2 w-48">
                    <a href="/rates" className="block px-4 py-2 text-brand font-medium hover:bg-surface-alt transition-colors">All Rates &rarr;</a>
                    <div className="border-t border-gray-100 my-1"></div>
                    <a href="/refinance" className="block px-4 py-2 text-ink-mid hover:bg-surface-alt hover:text-brand transition-colors">Refinance</a>
                    <a href="/rates/heloc" className="block px-4 py-2 text-ink-mid hover:bg-surface-alt hover:text-brand transition-colors">HELOC Rates</a>
                    <a href="/rates/non-qm" className="block px-4 py-2 text-ink-mid hover:bg-surface-alt hover:text-brand transition-colors">Non-QM Rates</a>
                    <a href="/rates/dscr" className="block px-4 py-2 text-ink-mid hover:bg-surface-alt hover:text-brand transition-colors">DSCR Rates</a>
                  </div>
                </div>
              </div>
              <a href="/tools" className="text-ink-mid hover:text-brand transition-colors">Tools</a>
              <a href="/rate-watch" className="text-ink-mid hover:text-brand transition-colors">Market</a>
              <div className="relative group">
                <button className="text-ink-mid hover:text-brand transition-colors flex items-center gap-1">
                  Resources
                  <svg className="w-3.5 h-3.5 transition-transform group-hover:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  <div className="bg-white rounded-lg shadow-nr-md border border-gray-200 py-2 w-56">
                    <a href="/resources" className="block px-4 py-2 text-brand font-medium hover:bg-surface-alt transition-colors">All Resources &rarr;</a>
                    <div className="border-t border-gray-100 my-1"></div>
                    <a href="/how-pricing-works" className="block px-4 py-2 text-ink-mid hover:bg-surface-alt hover:text-brand transition-colors">How Pricing Works</a>
                    <a href="/points-and-credits" className="block px-4 py-2 text-ink-mid hover:bg-surface-alt hover:text-brand transition-colors">Points &amp; Credits</a>
                    <a href="/closing-costs" className="block px-4 py-2 text-ink-mid hover:bg-surface-alt hover:text-brand transition-colors">Closing Costs</a>
                    <a href="/breakeven" className="block px-4 py-2 text-ink-mid hover:bg-surface-alt hover:text-brand transition-colors">Breakeven Math</a>
                    <a href="/refinance-playbook" className="block px-4 py-2 text-ink-mid hover:bg-surface-alt hover:text-brand transition-colors">Refinance Playbook</a>
                    <a href="/reverse-mortgage" className="block px-4 py-2 text-ink-mid hover:bg-surface-alt hover:text-brand transition-colors">Reverse Mortgages</a>
                    <a href="/condo-rules-changed" className="block px-4 py-2 text-ink-mid hover:bg-surface-alt hover:text-brand transition-colors">Condo Rules Changed</a>
                    <a href="/equity-without-losing-rate" className="block px-4 py-2 text-ink-mid hover:bg-surface-alt hover:text-brand transition-colors">Home Equity Options</a>
                    <div className="border-t border-gray-100 my-1"></div>
                    <a href="/why-netrate" className="block px-4 py-2 text-ink-mid hover:bg-surface-alt hover:text-brand transition-colors">Why NetRate</a>
                    <a href="/good-deal" className="block px-4 py-2 text-ink-mid hover:bg-surface-alt hover:text-brand transition-colors">Is It a Good Deal?</a>
                  </div>
                </div>
              </div>
              <a href="/about" className="text-ink-mid hover:text-brand transition-colors">About</a>
              <a href="/contact" className="text-ink-mid hover:text-brand transition-colors">Contact</a>
              <a href="/portal/my-rates/access" className="text-ink-mid hover:text-brand transition-colors">My Rates</a>
              <a href="/portal/apply" className="bg-go text-white px-5 py-2 rounded-nr-md font-bold hover:bg-go-dark transition-all">
                Apply Now
              </a>
            </nav>
          </div>
        </GlassNav>

        {/* Main content */}
        <main className="flex-1">
          {children}
        </main>

        {/* Google Reviews Banner — site-wide */}
        <div className="bg-surface-alt border-t border-gray-200">
          <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-center gap-3">
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <svg className="w-4 h-4 flex-shrink-0" fill="#FFC220" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span className="text-ink text-sm font-semibold">4.9</span>
            <a
              href={GBP_REVIEW_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand text-sm font-medium hover:text-brand-dark transition-colors underline underline-offset-2"
            >
              35 reviews
            </a>
          </div>
        </div>

        {/* Footer */}
        <footer className="bg-ink text-gray-400 mt-auto">
          <div className="max-w-6xl mx-auto px-6 py-12">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-8">
              {/* Company */}
              <div className="col-span-2 md:col-span-1">
                <div className="flex items-center gap-2.5 mb-3">
                  <svg width="30" height="30" viewBox="0 0 44 44" aria-hidden="true">
                    <rect width="44" height="44" rx="8" fill="rgba(255,255,255,0.06)"/>
                    <rect x="9"  y="24" width="5" height="11" rx="1" fill="#FFC220"/>
                    <rect x="17" y="21" width="5" height="14" rx="1" fill="#FFC220"/>
                    <rect x="25" y="12" width="5" height="23" rx="1" fill="#2E6BA8"/>
                    <rect x="33" y="26" width="5" height="9"  rx="1" fill="#FFC220"/>
                  </svg>
                  <div className="flex items-baseline" style={{ fontWeight: 500, letterSpacing: '-0.01em' }}>
                    <span className="text-lg text-white">Net</span>
                    <span className="text-lg text-brand">Rate</span>
                    <span className="text-lg text-white/70 ml-1.5">Mortgage</span>
                  </div>
                </div>
                <p className="text-sm leading-relaxed">
                  David Burson — Mortgage Broker<br />
                  NMLS #641790 | Company NMLS #1111861<br />
                  303-444-5251 | david@netratemortgage.com
                </p>
              </div>

              {/* Services */}
              <div>
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">Services</h3>
                <ul className="space-y-2 text-sm">
                  <li><a href="/rates" className="hover:text-white transition-colors">Today&apos;s Rates</a></li>
                  <li><a href="/refinance" className="hover:text-white transition-colors">Refinance</a></li>
                  <li><a href="/rates/heloc" className="hover:text-white transition-colors">HELOC Rates</a></li>
                  <li><a href="/services" className="hover:text-white transition-colors">Home Purchase</a></li>
                  <li><a href="/contact" className="hover:text-white transition-colors">See My Rate</a></li>
                  <li><a href="/portal/apply" className="hover:text-white transition-colors">Apply Now</a></li>
                </ul>
              </div>

              {/* Resources */}
              <div>
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">Resources</h3>
                <ul className="space-y-2 text-sm">
                  <li><a href="/how-pricing-works" className="hover:text-white transition-colors">How Pricing Works</a></li>
                  <li><a href="/points-and-credits" className="hover:text-white transition-colors">Points &amp; Credits</a></li>
                  <li><a href="/closing-costs" className="hover:text-white transition-colors">Closing Costs</a></li>
                  <li><a href="/breakeven" className="hover:text-white transition-colors">Breakeven Math</a></li>
                  <li><a href="/refinance-playbook" className="hover:text-white transition-colors">Refinance Playbook</a></li>
                  <li><a href="/reverse-mortgage" className="hover:text-white transition-colors">Reverse Mortgages</a></li>
                  <li><a href="/condo-rules-changed" className="hover:text-white transition-colors">Condo Rules Changed</a></li>
                  <li><a href="/equity-without-losing-rate" className="hover:text-white transition-colors">Home Equity Options</a></li>
                  <li><a href="/why-netrate" className="hover:text-white transition-colors">Why NetRate</a></li>
                  <li><a href="/good-deal" className="hover:text-white transition-colors">Is It a Good Deal?</a></li>
                </ul>
              </div>

              {/* States */}
              <div>
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">States</h3>
                <ul className="space-y-2 text-sm">
                  <li><a href="/colorado" className="hover:text-white transition-colors">Colorado</a></li>
                  <li><a href="/california" className="hover:text-white transition-colors">California</a></li>
                  <li><a href="/texas" className="hover:text-white transition-colors">Texas</a></li>
                  <li><a href="/oregon" className="hover:text-white transition-colors">Oregon</a></li>
                </ul>
              </div>

              {/* Legal */}
              <div>
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">Legal</h3>
                <ul className="space-y-2 text-sm">
                  <li><a href="/privacy" className="hover:text-white transition-colors">Privacy Policy</a></li>
                  <li><a href="/terms" className="hover:text-white transition-colors">Terms &amp; Conditions</a></li>
                  <li><a href="/licensing" className="hover:text-white transition-colors">Licensing</a></li>
                  <li><a href="/accessibility" className="hover:text-white transition-colors">Accessibility</a></li>
                  <li><a href="/do-not-sell" className="hover:text-white transition-colors">Do Not Sell My Info</a></li>
                </ul>
              </div>
            </div>

            <div className="border-t border-gray-800 pt-6 text-xs leading-relaxed space-y-3">
              <p>
                NetRate Mortgage | NMLS #1111861 | 357 South McCaslin Blvd., #200, Louisville, CO 80027.
                Rates shown are approximate based on wholesale pricing and standard loan-level adjustments.
                Actual rates depend on full credit review, property appraisal, and underwriting.
                Not a commitment to lend. Equal Housing Opportunity.
              </p>
              <p>
                NetRate Mortgage LLC is an Equal Housing Opportunity company. In
                accordance with the Equal Housing Opportunity Act, NetRate Mortgage does not discriminate
                against any applicant on the basis of race, color, religion, creed, national origin,
                ancestry, sex, marital status, familial status (number and age of children), sexual
                orientation, age (provided that the applicant has the capacity to enter into a binding
                agreement), medical history, disability, physical condition, military status; because
                the applicant has in good faith exercised any right under the Consumer Credit Protection
                Act or the Service Members Civil Relief Act (SCRA); that all or part of a consumer&apos;s
                income derives from a public assistance program, or any other basis prohibited by law.
              </p>
            </div>
          </div>
        </footer>
        <CookieBanner />
      </body>
    </html>
  );
}
