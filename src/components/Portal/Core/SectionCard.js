// SectionCard — Collapsible card wrapper for loan detail sections
// Used by all section components for consistent styling and expand/collapse behavior.

'use client';

import { useState } from 'react';

export default function SectionCard({
  title,
  icon,
  children,
  defaultOpen = true,
  actions,
  badge,
  className = '',
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`bg-white rounded-nr-xl border border-gray-200 shadow-nr-sm ${className}`}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 text-left"
      >
        <div className="flex items-center gap-2">
          {icon && <span className="text-ink-subtle">{icon}</span>}
          <h3 className="text-sm font-semibold text-ink uppercase tracking-wider">
            {title}
          </h3>
          {badge && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-brand/10 text-brand">
              {badge}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {actions && open && (
            <div onClick={(e) => e.stopPropagation()}>
              {actions}
            </div>
          )}
          <svg
            className={`w-4 h-4 text-ink-subtle transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Content */}
      {open && (
        <div className="px-6 pb-6 border-t border-gray-100 pt-4">
          {children}
        </div>
      )}
    </div>
  );
}
