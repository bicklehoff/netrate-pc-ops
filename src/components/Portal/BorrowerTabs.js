// Borrower Tab Bar — switches between primary and co-borrower forms
// Shows "You" tab + one tab per co-borrower with their name.
// Displays a green checkmark badge when a tab's data is complete.

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
    <div className="flex gap-1 border-b border-gray-200 mb-6">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const complete = isTabComplete?.(tab.id);

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`
              relative px-4 py-2.5 text-sm font-medium transition-colors rounded-t-lg
              ${isActive
                ? 'text-brand border-b-2 border-brand bg-white'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }
            `}
          >
            <span className="flex items-center gap-1.5">
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
  );
}
