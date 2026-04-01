// LoanSidebar — Left navigation for loan detail sections
// Desktop: vertical sidebar (w-56), Mobile (<1024px): horizontal tab strip
// Uses query param routing (?section=overview)

'use client';

import { useRouter, useSearchParams } from 'next/navigation';

function getSections(loanStatus) {
  const sections = [
    {
      group: 'Loan',
      items: [
        { key: 'overview', label: 'Overview', icon: '📊' },
        { key: 'loan-info', label: 'Loan Info', icon: '📋' },
      ],
    },
    {
      group: 'People',
      items: [
        { key: 'borrower', label: 'Borrower', icon: '👤' },
        { key: 'application', label: '1003', icon: '📝' },
      ],
    },
    {
      group: 'Processing',
      items: [
        { key: 'processing', label: 'Processing', icon: '⚙️' },
        { key: 'conditions', label: 'Conditions', icon: '✅' },
        { key: 'documents', label: 'Documents', icon: '📁' },
      ],
    },
    {
      group: 'Activity',
      items: [
        { key: 'notes', label: 'Notes & Activity', icon: '💬' },
      ],
    },
  ];

  if (['funded', 'settled', 'archived'].includes(loanStatus)) {
    sections.push({
      group: 'Closing',
      items: [
        { key: 'payroll', label: 'Payroll / CD', icon: '💰' },
        { key: 'post-close', label: 'Post-Close', icon: '✅' },
      ],
    });
  }

  return sections;
}

export default function LoanSidebar({ loanId, loanStatus }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeSection = searchParams.get('section') || 'overview';
  const SECTIONS = getSections(loanStatus);

  const navigate = (sectionKey) => {
    router.push(`/portal/mlo/loans/${loanId}?section=${sectionKey}`, { scroll: false });
  };

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="hidden lg:flex flex-col w-56 bg-gray-50/50 border-r border-gray-200 h-full flex-shrink-0 overflow-y-auto">
        <div className="py-4 flex flex-col h-full">
          {SECTIONS.map((group) => (
            <div key={group.group} className="mb-2">
              <span className="px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                {group.group}
              </span>
              <div className="mt-1">
                {group.items.map((item) => {
                  const isActive = activeSection === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => navigate(item.key)}
                      className={`w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-colors ${
                        isActive
                          ? 'bg-white text-brand font-medium border-r-2 border-brand shadow-sm'
                          : 'text-gray-600 hover:bg-white/60 hover:text-gray-900'
                      }`}
                    >
                      <span className="text-base">{item.icon}</span>
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Bottom: Back to pipeline */}
          <div className="mt-auto pt-4 border-t border-gray-200">
            <button
              onClick={() => router.push('/portal/mlo')}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-white/60 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Pipeline
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile horizontal tab strip */}
      <nav className="lg:hidden flex overflow-x-auto border-b border-gray-200 bg-white px-2 flex-shrink-0">
        {getSections(loanStatus).flatMap((group) =>
          group.items.map((item) => {
            const isActive = activeSection === item.key;
            return (
              <button
                key={item.key}
                onClick={() => navigate(item.key)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-sm whitespace-nowrap border-b-2 transition-colors ${
                  isActive
                    ? 'border-brand text-brand font-medium'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="text-sm">{item.icon}</span>
                {item.label}
              </button>
            );
          })
        )}
      </nav>
    </>
  );
}
