'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import QuoteWizard from '@/components/Portal/QuoteGenerator/QuoteWizard';

export default function QuoteDetailPage() {
  const { id } = useParams();
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/portal/mlo/quotes/${id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setQuote(data.quote);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) return <div className="p-6 text-ink-subtle">Loading quote...</div>;
  if (error) return <div className="p-6 text-red-600">Error: {error}</div>;
  if (!quote) return <div className="p-6 text-ink-subtle">Quote not found</div>;

  // Re-open the wizard with quote data as prefill
  const prefill = {
    contact_id: quote.contact_id,
    leadId: quote.leadId,
    loan_id: quote.loan_id,
    borrower_name: quote.borrower_name,
    borrower_email: quote.borrower_email,
    borrower_phone: quote.borrower_phone,
    purpose: quote.purpose,
    loan_type: quote.loan_type,
    property_value: Number(quote.property_value),
    loan_amount: Number(quote.loan_amount),
    ltv: Number(quote.ltv),
    fico: quote.fico,
    state: quote.state,
    county: quote.county,
    term: quote.term,
    current_rate: quote.current_rate ? Number(quote.current_rate) : '',
    current_balance: quote.current_balance ? Number(quote.current_balance) : '',
    currentPayment: quote.currentPayment ? Number(quote.currentPayment) : '',
    currentLender: quote.currentLender || '',
  };

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/portal/mlo/quotes" className="text-sm text-ink-subtle hover:text-ink-mid">&larr; Quotes</Link>
        <span className="text-gray-300">|</span>
        <h1 className="text-lg font-bold text-ink">
          {quote.borrower_name || 'Unnamed Quote'}
        </h1>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
          quote.status === 'sent' ? 'bg-blue-100 text-blue-700' :
          quote.status === 'viewed' ? 'bg-green-100 text-green-700' :
          'bg-gray-100 text-ink-mid'
        }`}>
          {quote.status}
        </span>
      </div>
      <QuoteWizard prefill={prefill} />
    </div>
  );
}
