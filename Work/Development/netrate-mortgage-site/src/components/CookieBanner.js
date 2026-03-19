'use client';

import { useState, useEffect } from 'react';

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('cookie_consent')) {
      setVisible(true);
    }
  }, []);

  const accept = () => {
    localStorage.setItem('cookie_consent', 'accepted');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-white/10 px-6 py-4 shadow-lg">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6">
        <p className="text-sm text-gray-300 flex-1">
          We use cookies and analytics tools (Google Analytics, Microsoft Clarity) to improve your experience.{' '}
          <a href="/privacy" className="text-brand underline hover:text-brand-light">Privacy Policy</a>
        </p>
        <button
          onClick={accept}
          className="bg-brand text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-brand-dark transition-colors whitespace-nowrap"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
