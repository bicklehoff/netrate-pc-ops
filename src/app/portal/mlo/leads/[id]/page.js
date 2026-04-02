'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

const PURPOSES = [
  { value: 'purchase', label: 'Purchase' },
  { value: 'refinance', label: 'Refinance' },
  { value: 'cashout', label: 'Cash-Out Refi' },
  { value: 'heloc', label: 'HELOC / 2nd' },
  { value: 'reverse', label: 'Reverse' },
];

const PROPERTY_TYPES = [
  { value: 'sfr', label: 'Single Family' },
  { value: 'condo', label: 'Condo' },
  { value: 'townhome', label: 'Townhome' },
  { value: '2-4unit', label: '2-4 Unit' },
  { value: 'manufactured', label: 'Manufactured' },
];

const OCCUPANCY = [
  { value: 'primary', label: 'Primary Residence' },
  { value: 'second_home', label: 'Second Home' },
  { value: 'investment', label: 'Investment' },
];

const STATES = [
  { value: 'CO', label: 'Colorado' },
  { value: 'CA', label: 'California' },
  { value: 'TX', label: 'Texas' },
  { value: 'OR', label: 'Oregon' },
];

export default function LeadDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Build quote generator URL with lead data pre-filled
  const quoteGeneratorUrl = useMemo(() => {
    if (!lead) return '/portal/mlo/tools/quote-generator';
    const params = new URLSearchParams();
    params.set('leadId', id);
    if (lead.name) params.set('name', lead.name);
    if (lead.email) params.set('email', lead.email);
    if (lead.phone) params.set('phone', lead.phone);
    if (lead.propertyState) params.set('state', lead.propertyState);
    if (lead.propertyCounty) params.set('county', lead.propertyCounty);
    if (lead.loanAmount) params.set('loanAmount', String(lead.loanAmount));
    if (lead.creditScore) params.set('fico', String(lead.creditScore));
    if (lead.loanPurpose) params.set('purpose', lead.loanPurpose);
    if (lead.propertyValue) params.set('propertyValue', String(lead.propertyValue));
    return `/portal/mlo/tools/quote-generator?${params.toString()}`;
  }, [lead, id]);

  const handleConvert = async () => {
    if (!confirm('Convert this lead to a draft loan? This will create a contact (if needed), borrower, and loan record.')) return;
    setConverting(true);
    setError('');
    try {
      const res = await fetch(`/api/portal/mlo/leads/${id}/convert`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Conversion failed'); return; }
      router.push(`/portal/mlo/loans/${data.loanId}`);
    } catch { setError('Failed to convert lead'); }
    finally { setConverting(false); }
  };

  useEffect(() => {
    fetch(`/api/portal/mlo/leads/${id}`)
      .then(r => r.json())
      .then(data => { setLead(data.lead); setLoading(false); })
      .catch(() => { setError('Failed to load lead'); setLoading(false); });
  }, [id]);

  const updateField = (field, value) => {
    setLead(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`/api/portal/mlo/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lead),
      });
      if (!res.ok) throw new Error('Save failed');
      setSuccess('Saved');
      setTimeout(() => setSuccess(''), 2000);
    } catch {
      setError('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleRunQuote = async () => {
    // Save first, then run quote
    setQuoting(true);
    setError('');
    try {
      // Save current fields
      await fetch(`/api/portal/mlo/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lead),
      });

      // Run quote
      const res = await fetch(`/api/portal/mlo/leads/${id}/quote`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Quote failed');
        return;
      }

      // Refresh lead to get new quote
      const refreshRes = await fetch(`/api/portal/mlo/leads/${id}`);
      const refreshData = await refreshRes.json();
      setLead(refreshData.lead);
      setSuccess(`Quote generated — ${data.resultCount} programs found`);
      setTimeout(() => setSuccess(''), 4000);
    } catch {
      setError('Failed to run quote');
    } finally {
      setQuoting(false);
    }
  };

  const runContactAction = async (action, payload = {}) => {
    const cid = lead?.contactId || lead?.contact?.id;
    if (!cid) { setError('No contact linked — convert lead or link a contact first'); return; }
    setActionLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/portal/mlo/contacts/${cid}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Action failed'); return; }
      setSuccess(action === 'send_portal_invite' ? 'Portal invite sent!' : 'Sent!');
      setTimeout(() => setSuccess(''), 3000);
    } catch {
      setError('Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div className="w-full py-12 text-center text-gray-400">Loading...</div>;
  if (!lead) return <div className="w-full py-12 text-center text-red-500">Lead not found</div>;

  const isPurchase = lead.loanPurpose === 'purchase';
  const isRefi = ['refinance', 'cashout'].includes(lead.loanPurpose);

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/portal/mlo/leads" className="text-xs text-gray-400 hover:text-brand mb-1 block">← Back to Leads</Link>
          <h1 className="text-xl font-bold text-gray-900">{lead.name}</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
            {lead.email && <span>{lead.email}</span>}
            {lead.phone && <span>{lead.phone}</span>}
            <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{lead.status}</span>
            {lead.contact && (
              <Link href={`/portal/mlo/contacts/${lead.contact?.id || lead.contactId}`} className="text-xs text-brand hover:underline">
                View Contact
              </Link>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={handleRunQuote}
            disabled={quoting}
            className="px-4 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand-dark transition-colors disabled:opacity-50"
          >
            {quoting ? 'Running...' : 'Run Quote'}
          </button>
          <Link
            href={quoteGeneratorUrl}
            className="px-4 py-2 text-sm font-medium bg-cyan-700 text-white rounded-lg hover:bg-cyan-800 transition-colors"
          >
            Generate Quote
          </Link>
          {lead.status !== 'converted' && lead.status !== 'closed' && (
            <button
              onClick={handleConvert}
              disabled={converting}
              className="px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              {converting ? 'Converting...' : 'Convert to Loan'}
            </button>
          )}
        </div>
      </div>

      {/* Actions Bar */}
      {lead.email && (lead.contactId || lead.contact?.id) && (
        <div className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-100">
          <button
            onClick={() => runContactAction('send_portal_invite')}
            disabled={actionLoading}
            className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <span>🔗</span> Send Portal Invite
          </button>
          <button
            onClick={() => {
              const docs = [
                { label: 'Completed & signed 1003 application' },
                { label: 'Most recent 2 months bank statements (all pages)' },
                { label: 'Most recent 30 days pay stubs' },
                { label: 'Most recent 2 years W-2s' },
                { label: 'Most recent 2 years federal tax returns (all pages)' },
                { label: 'Valid government-issued photo ID' },
              ];
              runContactAction('send_needs_list', { documents: docs });
            }}
            disabled={actionLoading}
            className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <span>📋</span> Send Needs List
          </button>
          {actionLoading && <span className="text-xs text-gray-400 ml-2">Sending...</span>}
        </div>
      )}

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 text-sm">{success}</div>}

      <div className="grid grid-cols-2 gap-6">
        {/* Left: Scenario Inputs */}
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Loan Scenario</h3>

            <div className="space-y-3">
              <Field label="Loan Purpose">
                <select value={lead.loanPurpose || ''} onChange={e => updateField('loanPurpose', e.target.value)} className="input-field">
                  <option value="">Select...</option>
                  {PURPOSES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </Field>

              {isPurchase && (
                <>
                  <Field label="Purchase Price">
                    <input type="number" value={lead.purchasePrice || ''} onChange={e => {
                      const price = parseFloat(e.target.value) || 0;
                      const dp = parseFloat(lead.downPayment) || 0;
                      updateField('purchasePrice', e.target.value);
                      updateField('propertyValue', e.target.value);
                      if (price && dp) updateField('loanAmount', String(price - dp));
                    }} className="input-field" placeholder="500000" />
                  </Field>
                  <Field label="Down Payment">
                    <input type="number" value={lead.downPayment || ''} onChange={e => {
                      const dp = parseFloat(e.target.value) || 0;
                      const price = parseFloat(lead.purchasePrice) || 0;
                      updateField('downPayment', e.target.value);
                      if (price && dp) updateField('loanAmount', String(price - dp));
                    }} className="input-field" placeholder="100000" />
                  </Field>
                </>
              )}

              {isRefi && (
                <>
                  <Field label="Current Rate">
                    <input type="number" step="0.125" value={lead.currentRate || ''} onChange={e => updateField('currentRate', e.target.value)} className="input-field" placeholder="6.875" />
                  </Field>
                  <Field label="Current Balance">
                    <input type="number" value={lead.currentBalance || ''} onChange={e => updateField('currentBalance', e.target.value)} className="input-field" placeholder="400000" />
                  </Field>
                  <Field label="Current Lender">
                    <input value={lead.currentLender || ''} onChange={e => updateField('currentLender', e.target.value)} className="input-field" placeholder="Wells Fargo" />
                  </Field>
                </>
              )}

              <Field label="Loan Amount">
                <input type="number" value={lead.loanAmount || ''} onChange={e => updateField('loanAmount', e.target.value)} className="input-field" placeholder="400000" />
              </Field>

              <Field label="Property Value">
                <input type="number" value={lead.propertyValue || ''} onChange={e => updateField('propertyValue', e.target.value)} className="input-field" placeholder="500000" />
              </Field>

              <Field label="Credit Score">
                <input type="number" value={lead.creditScore || ''} onChange={e => updateField('creditScore', parseInt(e.target.value) || '')} className="input-field" placeholder="780" />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="State">
                  <select value={lead.propertyState || ''} onChange={e => updateField('propertyState', e.target.value)} className="input-field">
                    <option value="">Select...</option>
                    {STATES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </Field>
                <Field label="Property Type">
                  <select value={lead.propertyType || ''} onChange={e => updateField('propertyType', e.target.value)} className="input-field">
                    <option value="">Select...</option>
                    {PROPERTY_TYPES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </Field>
              </div>

              <Field label="Occupancy">
                <select value={lead.occupancy || ''} onChange={e => updateField('occupancy', e.target.value)} className="input-field">
                  <option value="">Select...</option>
                  {OCCUPANCY.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>

              <Field label="Employment">
                <select value={lead.employmentType || ''} onChange={e => updateField('employmentType', e.target.value)} className="input-field">
                  <option value="">Select...</option>
                  <option value="w2">W-2 Employee</option>
                  <option value="self_employed">Self-Employed</option>
                  <option value="retired">Retired</option>
                </select>
              </Field>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Notes</h3>
            <textarea
              value={lead.notes || ''}
              onChange={e => updateField('notes', e.target.value)}
              rows={4}
              className="input-field"
              placeholder="Call notes, borrower situation, etc..."
            />
          </div>
        </div>

        {/* Right: Quotes */}
        <div className="space-y-4">
          {/* Full quote wizard quotes (BorrowerQuote) */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Quotes</h3>
              <Link
                href={quoteGeneratorUrl}
                className="text-xs font-medium bg-cyan-600 text-white px-3 py-1.5 rounded-lg hover:bg-cyan-700 transition-colors"
              >
                + New Quote
              </Link>
            </div>

            {(!lead.borrowerQuotes || lead.borrowerQuotes.length === 0) ? (
              <div className="text-center py-6 text-gray-400">
                <p className="text-sm">No quotes yet</p>
                <p className="text-xs mt-1">Click &ldquo;Generate Quote&rdquo; or &ldquo;+ New Quote&rdquo; to build a full quote with PDF</p>
              </div>
            ) : (
              <div className="space-y-2">
                {lead.borrowerQuotes.map((q) => (
                  <Link
                    key={q.id}
                    href={`/portal/mlo/quotes/${q.id}`}
                    className="flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:border-cyan-200 hover:bg-cyan-50/30 transition-colors"
                  >
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {q.purpose} · {q.loanType} · ${Number(q.loanAmount).toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {new Date(q.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        {q.sentAt && <span className="ml-2 text-green-600">Sent</span>}
                        {q.viewedAt && <span className="ml-1 text-blue-500">Viewed</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-mono text-gray-900">
                        {q.monthlyPayment ? `$${Number(q.monthlyPayment).toLocaleString()}/mo` : '—'}
                      </div>
                      <div className={`text-[10px] px-1.5 py-0.5 rounded mt-1 inline-block ${
                        q.status === 'sent' ? 'bg-green-100 text-green-700' :
                        q.status === 'viewed' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>{q.status}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Quick quotes (LeadQuote — legacy) */}
          {lead.quotes && lead.quotes.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="font-semibold text-gray-900 mb-3 text-sm">Quick Quotes</h3>
              <div className="space-y-2">
                {lead.quotes.map((quote) => (
                  <div key={quote.id} className="border border-gray-100 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-500">
                        {new Date(quote.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                      {quote.sentAt && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Sent</span>}
                    </div>
                    <div className="flex gap-4 mt-1 text-sm">
                      <span className="font-mono font-bold">{quote.bestRate ? `${Number(quote.bestRate).toFixed(3)}%` : '—'}</span>
                      <span className="text-gray-500">{quote.bestLender || '—'}</span>
                      <span className="text-gray-500">{quote.monthlyPayment ? `$${Number(quote.monthlyPayment).toLocaleString()}/mo` : ''}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .input-field {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          outline: none;
          transition: border-color 0.15s;
        }
        .input-field:focus {
          border-color: #0891b2;
          box-shadow: 0 0 0 2px rgba(8, 145, 178, 0.1);
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}
