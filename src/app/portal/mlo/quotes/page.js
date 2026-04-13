'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

const STATUS_BADGES = {
  draft: 'bg-gray-100 text-ink-mid',
  sent: 'bg-blue-100 text-blue-700',
  viewed: 'bg-green-100 text-green-700',
  expired: 'bg-red-100 text-red-600',
};

export default function QuotesListPage() {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  const loadQuotes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter) params.set('status', filter);
      const res = await fetch(`/api/portal/mlo/quotes?${params}`);
      const data = await res.json();
      setQuotes(data.quotes || []);
    } catch (err) {
      console.error('Failed to load quotes:', err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { loadQuotes(); }, [loadQuotes]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-ink">Quotes</h1>
          <p className="text-sm text-ink-subtle mt-1">{quotes.length} quote{quotes.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="text-sm rounded-lg border-gray-300 focus:ring-cyan-500 focus:border-cyan-500"
          >
            <option value="">All</option>
            <option value="draft">Drafts</option>
            <option value="sent">Sent</option>
            <option value="viewed">Viewed</option>
          </select>
          <Link
            href="/portal/mlo/tools/quote-generator"
            className="px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm font-medium hover:bg-cyan-700 transition-colors"
          >
            New Quote
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="text-ink-subtle text-sm py-8 text-center">Loading quotes...</div>
      ) : quotes.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-ink-subtle mb-4">No quotes yet</p>
          <Link
            href="/portal/mlo/tools/quote-generator"
            className="text-cyan-600 hover:underline text-sm font-medium"
          >
            Create your first quote
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-nr-xl border border-gray-200 shadow-nr-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-alt text-ink-subtle text-xs">
              <tr>
                <th className="px-4 py-3 text-left">Borrower</th>
                <th className="px-4 py-3 text-left">Scenario</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {quotes.map(q => (
                <tr key={q.id} className="hover:bg-surface-alt transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/portal/mlo/quotes/${q.id}`} className="text-cyan-600 hover:underline font-medium">
                      {q.borrower_name || 'Unnamed'}
                    </Link>
                    {q.borrower_email && <div className="text-xs text-ink-subtle">{q.borrower_email}</div>}
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-mid">
                    {q.loan_type?.toUpperCase()} | {q.purpose} | {q.state} | {q.fico} FICO | {q.term}yr
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    ${Number(q.loan_amount)?.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGES[q.status] || STATUS_BADGES.draft}`}>
                      {q.status}
                    </span>
                    {q.version > 1 && <span className="ml-1 text-xs text-ink-subtle">v{q.version}</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-ink-subtle">
                    {new Date(q.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
