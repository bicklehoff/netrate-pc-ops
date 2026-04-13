// Borrower Tab Bar — switches between primary and co-borrower forms
// Shows "You" tab + one tab per co-borrower with their name.
// Displays a green checkmark badge when a tab's data is complete.
// Prominent styling makes it clear this is the way to switch between borrowers.

'use client';

export default function BorrowerTabs({ coBorrowers, activeTab, onTabChange, isTabComplete }) {
  const tabs = [
    { id: 'primary', label: 'You' },
    ...coBorrowers.map((cb, i) => ({
      id: cb.id,
      label: cb.firstName ? `${cb.firstName} ${cb.lastName?.[0] || ''}`.trim() : `Co-Borrower ${i + 1}`,
    })),
  ];

  return (
    <div className="bg-surface-alt border border-gray-200 rounded-lg p-1 mb-6">
      <p className="text-[11px] text-ink-subtle px-2 pt-1 pb-2">
        Switch between borrowers to fill in each person&apos;s details:
      </p>
      <div className="flex gap-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const complete = isTabComplete?.(tab.id);

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`
                flex-1 px-4 py-2.5 text-sm font-medium transition-colors rounded-lg
                ${isActive
                  ? 'bg-white text-brand shadow-nr-sm border border-brand/30'
                  : 'text-ink-subtle hover:text-ink-mid hover:bg-white/50'
                }
              `}
            >
              <span className="flex items-center justify-center gap-1.5">
                <svg className={`w-4 h-4 ${isActive ? 'text-brand' : 'text-ink-subtle'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                {tab.label}
                {complete && (
                  <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
