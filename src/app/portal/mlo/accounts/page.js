// MLO Accounts — Partner Directory
// Full-width, filterable by industry, expandable to show contacts

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

const INDUSTRY_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'lender', label: 'Lenders' },
  { value: 'title', label: 'Title' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'realtor', label: 'Realtors' },
  { value: 'other', label: 'Other' },
];

const INDUSTRY_COLORS = {
  lender: 'bg-blue-100 text-blue-800',
  title: 'bg-purple-100 text-purple-800',
  insurance: 'bg-amber-100 text-amber-800',
  realtor: 'bg-green-100 text-green-800',
  other: 'bg-gray-100 text-gray-700',
};

export default function AccountsPage() {
  const { status: authStatus } = useSession();
  const router = useRouter();
  const [accounts, setAccounts] = useState([]);
  const [industryCounts, setIndustryCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [industryFilter, setIndustryFilter] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authStatus === 'unauthenticated') router.push('/portal/mlo/login');
  }, [authStatus, router]);

  const fetchAccounts = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('q', search);
      if (industryFilter) params.set('industry', industryFilter);
      const res = await fetch(`/api/portal/mlo/accounts?${params}`);
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setAccounts(data.accounts || []);
      if (data.industryCounts) setIndustryCounts(data.industryCounts);
    } catch {
      setError('Failed to load accounts');
    } finally {
      setLoading(false);
    }
  }, [search, industryFilter]);

  useEffect(() => {
    if (authStatus !== 'authenticated') return;
    setLoading(true);
    const timer = setTimeout(() => fetchAccounts(), 300);
    return () => clearTimeout(timer);
  }, [authStatus, fetchAccounts]);

  const totalAll = Object.values(industryCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Accounts</h1>
          <p className="text-gray-500 text-sm">Partner directory — lenders, title, insurance, realtors</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex gap-1 flex-wrap">
          {INDUSTRY_OPTIONS.map(opt => {
            const count = opt.value ? (industryCounts[opt.value] || 0) : totalAll;
            return (
              <button
                key={opt.value}
                onClick={() => setIndustryFilter(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  industryFilter === opt.value
                    ? 'bg-brand text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {opt.label} {count > 0 && <span className="ml-1 opacity-75">{count}</span>}
              </button>
            );
          })}
        </div>
        <div className="flex-1 max-w-sm ml-auto">
          <input
            type="text"
            placeholder="Search accounts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>
      )}

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading accounts...</div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No accounts found</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wider">
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Industry</th>
                <th className="text-left px-4 py-3">Phone</th>
                <th className="text-left px-4 py-3">Website</th>
                <th className="text-left px-4 py-3">Location</th>
                <th className="text-right px-4 py-3">Contacts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {accounts.map(account => (
                <tr key={account.id}>
                  <td
                    className="px-4 py-3 cursor-pointer"
                    onClick={() => setExpandedId(expandedId === account.id ? null : account.id)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{account.name}</span>
                      {account._count.accountContacts > 0 && (
                        <svg className={`w-3 h-3 text-gray-400 transition-transform ${expandedId === account.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </div>
                    {/* Expanded contacts */}
                    {expandedId === account.id && account.accountContacts?.length > 0 && (
                      <div className="mt-2 space-y-1.5 pl-2 border-l-2 border-brand/20">
                        {account.accountContacts.map(c => (
                          <div key={c.id} className="text-xs text-gray-600">
                            <span className="font-medium">{c.first_name} {c.last_name}</span>
                            {c.role && <span className="text-gray-400 ml-1">({c.role})</span>}
                            {c.isPrimary && <span className="ml-1 text-brand text-[10px]">PRIMARY</span>}
                            <div className="flex gap-3 mt-0.5">
                              {c.email && <a href={`mailto:${c.email}`} className="text-brand hover:underline">{c.email}</a>}
                              {c.phone && <a href={`tel:${c.phone}`} className="hover:underline">{c.phone}</a>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${INDUSTRY_COLORS[account.industry] || INDUSTRY_COLORS.other}`}>
                      {account.industry || 'other'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {account.phone ? <a href={`tel:${account.phone}`} className="hover:text-brand">{account.phone}</a> : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {account.website ? (
                      <a href={account.website.startsWith('http') ? account.website : `https://${account.website}`}
                        target="_blank" rel="noopener noreferrer" className="text-brand hover:underline truncate max-w-[200px] block">
                        {account.website.replace(/^https?:\/\/(www\.)?/, '')}
                      </a>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {[account.city, account.state].filter(Boolean).join(', ') || '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500">
                    {account._count.accountContacts || '—'}
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
