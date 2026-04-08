import Link from 'next/link';

export const metadata = {
  title: 'Mortgage Tools & Calculators | NetRate Mortgage',
  description: 'Free mortgage calculators and tools — rate alerts, purchase calculator, refinance analyzer, DSCR calculator, cost of waiting, and more.',
  alternates: { canonical: 'https://netratemortgage.com/tools' },
};

const tools = [
  {
    icon: '☰',
    iconClass: 'bg-brand/10 text-brand',
    title: 'Rate Tool',
    desc: 'Live mortgage rates across 11 lenders. See rate, points, payment, and lender credits side by side.',
    href: '/rates',
    cta: 'Search Rates',
  },
  {
    icon: '🔔',
    iconClass: 'bg-brand/10 text-brand',
    title: 'Rate Alerts',
    desc: 'Save a rate scenario and get periodic updates when rates change — reviewed by your loan officer before every email.',
    href: '/rates',
    cta: 'Set Up Alerts',
    badge: 'New',
  },
  {
    icon: '⌂',
    iconClass: 'bg-brand/10 text-brand',
    title: 'Purchase Calculator',
    desc: 'Estimate your monthly payment, cash to close, and how much home you can afford.',
    href: '/tools/purchase-calculator',
    cta: 'Calculate',
  },
  {
    icon: '↻',
    iconClass: 'bg-brand/10 text-brand',
    title: 'Refi Analyzer',
    desc: 'Is refinancing worth it? Enter your current loan and we\'ll show the break-even timeline and total savings.',
    href: '/tools/refi-analyzer',
    cta: 'Analyze',
  },
  {
    icon: '⏳',
    iconClass: 'bg-brand/10 text-brand',
    title: 'Cost of Waiting',
    desc: 'What does it cost you every month you don\'t refinance? See the real number with your loan details.',
    href: '/tools/cost-of-waiting',
    cta: 'See the Cost',
  },
  {
    icon: 'Ψ',
    iconClass: 'bg-brand/10 text-brand',
    title: 'DSCR Calculator',
    desc: 'Investment property? Enter rental income and expenses to see if your deal qualifies for a DSCR loan.',
    href: '/tools/dscr-calculator',
    cta: 'Calculate',
  },
  {
    icon: '↩',
    iconClass: 'bg-brand/10 text-brand',
    title: 'Reverse Mortgage Calculator',
    desc: 'See how much equity you could access with a reverse mortgage. Age, home value, and rate — that\'s all we need.',
    href: '/tools/reverse-mortgage-calculator',
    cta: 'Estimate',
  },
  {
    icon: '⇄',
    iconClass: 'bg-brand/10 text-brand',
    title: 'Second Lien Comparison',
    desc: 'Compare HELOC vs. home equity loan side by side to find the best option for your situation.',
    href: '/tools/second-lien-comparison',
    cta: 'Compare',
  },
];

export default function ToolsPage() {
  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
            Mortgage Tools &amp; Calculators
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            Free tools to help you make smarter mortgage decisions. No sign-up required — just real math with real numbers.
          </p>
        </div>

        {/* Tool Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool) => (
            <Link
              key={tool.title}
              href={tool.href}
              className="group bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md hover:border-brand/30 transition-all relative"
            >
              {tool.badge && (
                <span className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-wider bg-brand text-white px-2 py-0.5 rounded-full">
                  {tool.badge}
                </span>
              )}
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg mb-4 ${tool.iconClass}`}>
                {tool.icon}
              </div>
              <h2 className="text-base font-semibold text-gray-900 mb-1.5 group-hover:text-brand transition-colors">
                {tool.title}
              </h2>
              <p className="text-sm text-gray-500 leading-relaxed mb-4">
                {tool.desc}
              </p>
              <span className="text-sm font-medium text-brand">
                {tool.cta} &rarr;
              </span>
            </Link>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-12 text-center">
          <p className="text-sm text-gray-400">
            All tools are free and require no account. Built by{' '}
            <Link href="/" className="text-brand hover:text-brand-dark">NetRate Mortgage</Link>
            {' '}— a licensed broker that shops wholesale rates on your behalf.
          </p>
        </div>
      </div>
    </div>
  );
}
