'use client';

import { usePathname } from 'next/navigation';

function trackClick(action) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', action, { event_category: 'contact_bar' });
  }
}

export default function ContactBar() {
  const pathname = usePathname();
  if (pathname?.startsWith('/portal')) return null;

  return (
    <div className="bg-brand text-sm">
      <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between">
        {/* Contact methods */}
        <div className="flex items-center gap-1 sm:gap-5">
          {/* Call */}
          <a
            href="tel:+13034445251"
            onClick={() => trackClick('click_call')}
            className="flex items-center gap-2 text-white hover:text-white/80 transition-colors px-2 py-0.5 font-medium"
          >
            <svg className="w-4 h-4 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            <span className="hidden sm:inline">303-444-5251</span>
          </a>

          <span className="w-px h-4 bg-white/20 hidden sm:block" />

          {/* Email */}
          <a
            href="mailto:david@netratemortgage.com"
            onClick={() => trackClick('click_email')}
            className="flex items-center gap-2 text-white hover:text-white/80 transition-colors px-2 py-0.5 font-medium"
          >
            <svg className="w-4 h-4 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="hidden sm:inline">Email Us</span>
          </a>

          <span className="w-px h-4 bg-white/20 hidden sm:block" />

          {/* Text */}
          <a
            href="sms:+13034445251"
            onClick={() => trackClick('click_text')}
            className="flex items-center gap-2 text-white hover:text-white/80 transition-colors px-2 py-0.5 font-medium"
          >
            <svg className="w-4 h-4 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span className="hidden sm:inline">Text Us</span>
          </a>

          <span className="w-px h-4 bg-white/20 hidden sm:block" />

          {/* Schedule */}
          <a
            href="https://book.netratemortgage.com"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackClick('click_schedule')}
            className="flex items-center gap-2 text-white hover:text-white/80 transition-colors px-2 py-0.5 font-medium"
          >
            <svg className="w-4 h-4 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="hidden sm:inline">Schedule a Call</span>
          </a>
        </div>

        {/* NMLS — desktop only */}
        <a
          href="https://www.nmlsconsumeraccess.org/EntityDetails.aspx/COMPANY/1111861"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden md:block text-xs text-white hover:underline"
        >
          NMLS #641790 | #1111861
        </a>
      </div>
    </div>
  );
}
