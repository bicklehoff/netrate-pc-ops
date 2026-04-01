'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import QuoteWizard from '@/components/Portal/QuoteGenerator/QuoteWizard';

function QuoteGeneratorContent() {
  const params = useSearchParams();

  // Pre-fill from URL params (e.g., linked from contact or loan page)
  const prefill = {
    contactId: params.get('contactId'),
    leadId: params.get('leadId'),
    loanId: params.get('loanId'),
    borrowerName: params.get('name'),
    borrowerEmail: params.get('email'),
    borrowerPhone: params.get('phone'),
    state: params.get('state'),
    county: params.get('county'),
    loanAmount: params.get('loanAmount') ? Number(params.get('loanAmount')) : null,
    fico: params.get('fico') ? Number(params.get('fico')) : null,
    loanType: params.get('loanType'),
    purpose: params.get('purpose'),
  };

  // Strip null values
  Object.keys(prefill).forEach(k => { if (prefill[k] == null) delete prefill[k]; });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Quote Generator</h1>
        <p className="text-sm text-gray-500 mt-1">
          Price a scenario against all lenders, select rates, and build a quote for the borrower.
        </p>
      </div>
      <QuoteWizard prefill={prefill} />
    </div>
  );
}

export default function QuoteGeneratorPage() {
  return (
    <Suspense fallback={<div className="p-6 text-gray-400">Loading...</div>}>
      <QuoteGeneratorContent />
    </Suspense>
  );
}
