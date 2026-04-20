// Contact Detail Page — Full CRM view of a single contact
// Shows: info, actions, active lead, loan history, timeline, property, marketing

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import SectionCard from '@/components/Portal/Core/SectionCard';
import { STATUS_COLORS_SOFT as LOAN_STATUS_COLORS } from '@/lib/constants/loan-statuses';

// Contact status palette (contacts.status values: past_client, subscriber,
// lead, applicant, in_process, funded, partner, archived). Separate from
// loan status — contacts and loans are different entities with different
// lifecycles.
const STATUS_COLORS = {
  past_client: 'bg-green-100 text-green-800',
  subscriber: 'bg-gray-100 text-gray-700',
  lead: 'bg-blue-100 text-blue-800',
  applicant: 'bg-amber-100 text-amber-800',
  in_process: 'bg-brand-light text-brand',
  funded: 'bg-go-light text-go-dark',
  partner: 'bg-accent/15 text-ink',
  archived: 'bg-red-100 text-red-700',
};

function timeAgo(date) {
  if (!date) return '';
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function formatCurrency(val) {
  if (!val) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
}

function formatDate(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ContactDetailPage() {
  const { status: authStatus } = useSession();
  const router = useRouter();
  const { id } = useParams();
  const [contact, setContact] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  // Lead creation modal
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [leadForm, setLeadForm] = useState({ loan_purpose: '', property_state: '', notes: '' });
  const [creatingLead, setCreatingLead] = useState(false);

  // Action modals
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailForm, setEmailForm] = useState({ subject: '', emailBody: '' });
  const [showNeedsModal, setShowNeedsModal] = useState(false);
  const [needsPurpose, setNeedsPurpose] = useState('default');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');

  useEffect(() => {
    if (authStatus === 'unauthenticated') router.push('/portal/mlo/login');
  }, [authStatus, router]);

  const fetchContact = useCallback(async () => {
    try {
      const res = await fetch(`/api/portal/mlo/contacts/${id}`);
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setContact(data.contact);
    } catch {
      setError('Failed to load contact');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (authStatus === 'authenticated') fetchContact();
  }, [authStatus, fetchContact]);

  const updateField = async (field, value) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/portal/mlo/contacts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) throw new Error('Failed to update');
      const data = await res.json();
      setContact(prev => ({ ...prev, ...data.contact }));
    } catch {
      setError('Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const addNote = async () => {
    if (!noteText.trim()) return;
    setAddingNote(true);
    try {
      // Use PATCH with a note append approach — add to contactNotes via direct API
      const res = await fetch(`/api/portal/mlo/contacts/${id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: noteText }),
      });
      if (res.ok) {
        setNoteText('');
        fetchContact(); // Refresh to show new note
      }
    } catch {
      setError('Failed to add note');
    } finally {
      setAddingNote(false);
    }
  };

  const createLead = async () => {
    setCreatingLead(true);
    try {
      const res = await fetch(`/api/portal/mlo/contacts/${id}/create-lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leadForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create lead');
        return;
      }
      setShowLeadModal(false);
      fetchContact(); // Refresh
    } catch {
      setError('Failed to create lead');
    } finally {
      setCreatingLead(false);
    }
  };

  const runAction = async (action, payload = {}) => {
    setActionLoading(true);
    setError('');
    setActionSuccess('');
    try {
      const res = await fetch(`/api/portal/mlo/contacts/${id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Action failed'); return; }
      setActionSuccess(
        action === 'send_portal_invite' ? 'Portal invite sent!' :
        action === 'send_needs_list' ? 'Needs list sent!' :
        action === 'send_email' ? 'Email sent!' : 'Done!'
      );
      setTimeout(() => setActionSuccess(''), 3000);
      fetchContact(); // Refresh timeline
    } catch {
      setError('Action failed');
    } finally {
      setActionLoading(false);
      setShowEmailModal(false);
      setShowNeedsModal(false);
      setEmailForm({ subject: '', emailBody: '' });
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Loading contact...</div>;
  }

  if (!contact) {
    return <div className="flex items-center justify-center h-64 text-red-500">{error || 'Contact not found'}</div>;
  }

  const activeLead = contact.leads?.find(l => ['new', 'contacted', 'qualified', 'quoted'].includes(l.status));
  const loans = contact.borrower?.loans || [];


  // Build merged timeline
  const timeline = [
    ...(contact.contactNotes || []).map(n => ({
      type: n.source === 'email' ? 'email' : n.source === 'zoho_import' ? 'import' : 'note',
      content: n.content,
      title: n.title,
      date: n.created_at,
      actor: n.authorType,
    })),
    ...(contact.callLogs || []).map(c => ({
      type: 'call',
      content: `${c.direction === 'inbound' ? 'Inbound' : 'Outbound'} call — ${c.status}${c.duration ? ` (${Math.ceil(c.duration / 60)}min)` : ''}${c.notes?.[0]?.content ? `: ${c.callNotes[0].content}` : ''}`,
      date: c.started_at,
      actor: 'mlo',
    })),
    ...(contact.smsMessages || []).map(s => ({
      type: 'sms',
      content: s.body,
      date: s.sent_at,
      actor: s.direction === 'inbound' ? 'borrower' : 'mlo',
    })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  const typeIcons = {
    note: '📝', call: '📞', sms: '💬', email: '✉️', import: '📥',
  };

  return (
    <div className="max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="w-12 h-12 bg-brand/10 text-brand rounded-full flex items-center justify-center text-lg font-semibold">
            {contact.first_name?.[0]}{contact.last_name?.[0]}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {contact.first_name} {contact.last_name}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[contact.status] || STATUS_COLORS.subscriber}`}>
                {contact.status?.replace('_', ' ')}
              </span>
              {contact.assignedMlo && (
                <span className="text-xs text-gray-500">
                  MLO: {contact.assignedMlo.first_name} {contact.assignedMlo.last_name}
                </span>
              )}
              {saving && <span className="text-xs text-gray-400">Saving...</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(contact.status === 'past_client' || contact.status === 'subscriber') && (
            <button
              onClick={() => setShowLeadModal(true)}
              className="bg-go text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-go-dark transition-colors"
            >
              + New Lead
            </button>
          )}
          {activeLead && (
            <Link
              href={`/portal/mlo/leads/${activeLead.id}`}
              className="bg-blue-50 text-blue-700 border border-blue-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
            >
              View Active Lead
            </Link>
          )}
        </div>
      </div>

      {/* Actions Bar */}
      {contact.email && (
        <div className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-100">
          <button
            onClick={() => runAction('send_portal_invite')}
            disabled={actionLoading}
            className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <span>🔗</span> Send Portal Invite
          </button>
          <button
            onClick={() => setShowNeedsModal(true)}
            disabled={actionLoading}
            className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <span>📋</span> Send Needs List
          </button>
          <button
            onClick={() => setShowEmailModal(true)}
            disabled={actionLoading}
            className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <span>✉️</span> Send Email
          </button>
          {actionLoading && <span className="text-xs text-gray-400 ml-2">Sending...</span>}
          {actionSuccess && <span className="text-xs text-green-600 ml-2">{actionSuccess}</span>}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
          {error}
          <button onClick={() => setError('')} className="ml-2 font-medium">×</button>
        </div>
      )}

      {/* Two-column layout: Info left, Timeline right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left column — 2/3 */}
        <div className="lg:col-span-2 space-y-4">
          {/* Contact Info */}
          <SectionCard title="Contact Info">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-500 text-xs">Email</span>
                <div className="font-medium">{contact.email ? <a href={`mailto:${contact.email}`} className="text-brand hover:underline">{contact.email}</a> : '—'}</div>
              </div>
              <div>
                <span className="text-gray-500 text-xs">Phone</span>
                <div className="font-medium">{contact.phone ? <a href={`tel:${contact.phone}`} className="text-brand hover:underline">{contact.phone}</a> : '—'}</div>
              </div>
              <div>
                <span className="text-gray-500 text-xs">Source</span>
                <div className="font-medium">{contact.originalSource || contact.source || '—'}</div>
              </div>
              {contact.mailingAddress && (
                <div className="col-span-2">
                  <span className="text-gray-500 text-xs">Address</span>
                  <div className="font-medium">
                    {[contact.mailingAddress, contact.city, contact.state, contact.zipCode].filter(Boolean).join(', ')}
                  </div>
                </div>
              )}
              {contact.date_of_birth && (
                <div>
                  <span className="text-gray-500 text-xs">DOB</span>
                  <div className="font-medium">{formatDate(contact.date_of_birth)}</div>
                </div>
              )}
              {contact.co_borrower_name && (
                <>
                  <div>
                    <span className="text-gray-500 text-xs">Co-Borrower</span>
                    <div className="font-medium">{contact.co_borrower_name}</div>
                  </div>
                  {contact.co_borrower_email && (
                    <div>
                      <span className="text-gray-500 text-xs">Co-Borrower Email</span>
                      <div className="font-medium">{contact.co_borrower_email}</div>
                    </div>
                  )}
                </>
              )}
              {contact.tags?.length > 0 && (
                <div className="col-span-full">
                  <span className="text-gray-500 text-xs">Tags</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {contact.tags.map(tag => (
                      <span key={tag} className="inline-flex px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </SectionCard>

          {/* Active Lead */}
          {activeLead && (
            <SectionCard title="Active Lead" badge={activeLead.status}>
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <span className="text-gray-500">Purpose:</span> {activeLead.loan_purpose || '—'}
                  {activeLead.loan_amount && <> · <span className="text-gray-500">Amount:</span> {formatCurrency(activeLead.loan_amount)}</>}
                  {activeLead.property_state && <> · <span className="text-gray-500">State:</span> {activeLead.property_state}</>}
                  {activeLead.credit_score && <> · <span className="text-gray-500">FICO:</span> {activeLead.credit_score}</>}
                </div>
                <Link
                  href={`/portal/mlo/leads/${activeLead.id}`}
                  className="text-brand text-sm font-medium hover:underline"
                >
                  Open Lead →
                </Link>
              </div>
            </SectionCard>
          )}

          {/* Loan History */}
          {loans.length > 0 && (
            <SectionCard title="Loan History" badge={loans.length}>
              <div className="space-y-2">
                {loans.map(loan => (
                  <Link
                    key={loan.id}
                    href={`/portal/mlo/loans/${loan.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${LOAN_STATUS_COLORS[loan.status] || 'bg-gray-100'}`}>
                        {loan.status?.replace('_', ' ')}
                      </span>
                      <div className="text-sm">
                        <span className="font-medium">{loan.purpose || 'Loan'}</span>
                        {loan.lender_name && <span className="text-gray-500"> · {loan.lender_name}</span>}
                        {loan.loan_number && <span className="text-gray-400"> #{loan.loan_number}</span>}
                      </div>
                    </div>
                    <div className="text-sm text-right">
                      <div className="font-medium">{formatCurrency(loan.loan_amount)}</div>
                      <div className="text-xs text-gray-400">{formatDate(loan.submitted_at || loan.created_at)}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Property Info */}
          {(contact.property_address || contact.current_loan_amount) && (
            <SectionCard title="Property" defaultOpen={false}>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                {contact.property_address && (
                  <div className="col-span-full">
                    <span className="text-gray-500 text-xs">Property Address</span>
                    <div className="font-medium">{contact.property_address}</div>
                  </div>
                )}
                <div>
                  <span className="text-gray-500 text-xs">Current Loan</span>
                  <div className="font-medium">{formatCurrency(contact.current_loan_amount)}</div>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">Rate</span>
                  <div className="font-medium">{contact.current_rate ? `${contact.current_rate}%` : '—'}</div>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">Home Value</span>
                  <div className="font-medium">{formatCurrency(contact.home_value)}</div>
                </div>
                {contact.funded_date && (
                  <div>
                    <span className="text-gray-500 text-xs">Last Funded</span>
                    <div className="font-medium">{formatDate(contact.funded_date)}</div>
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          {/* Marketing */}
          <SectionCard title="Marketing" defaultOpen={false}>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={contact.newsletterOptIn || false}
                  onChange={(e) => updateField('newsletterOptIn', e.target.checked)}
                  className="rounded border-gray-300 text-brand focus:ring-brand"
                />
                <span>Newsletter</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={contact.strikeRateOptIn || false}
                  onChange={(e) => updateField('strikeRateOptIn', e.target.checked)}
                  className="rounded border-gray-300 text-brand focus:ring-brand"
                />
                <span>Strike Rate Alerts</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={contact.email_opt_out || false}
                  onChange={(e) => updateField('email_opt_out', e.target.checked)}
                  className="rounded border-gray-300 text-red-500 focus:ring-red-300"
                />
                <span className="text-red-600">Email Opt-Out</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={contact.smsOptOut || false}
                  onChange={(e) => updateField('smsOptOut', e.target.checked)}
                  className="rounded border-gray-300 text-red-500 focus:ring-red-300"
                />
                <span className="text-red-600">SMS Opt-Out</span>
              </label>
            </div>
          </SectionCard>
        </div>

        {/* Right column — 1/3: Timeline */}
        <div className="space-y-4">
          {/* Add Note */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addNote()}
                placeholder="Add a note..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
              />
              <button
                onClick={addNote}
                disabled={addingNote || !noteText.trim()}
                className="bg-go text-white px-3 py-2 rounded-lg text-sm font-bold hover:bg-go-dark transition-colors disabled:opacity-50"
              >
                {addingNote ? '...' : 'Add'}
              </button>
            </div>
          </div>

          {/* Timeline */}
          <SectionCard title="Activity" badge={timeline.length}>
            {timeline.length === 0 ? (
              <p className="text-sm text-gray-400">No activity yet</p>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {timeline.map((item, i) => (
                  <div key={i} className="flex gap-2 text-sm">
                    <span className="text-base flex-shrink-0 mt-0.5">{typeIcons[item.type] || '•'}</span>
                    <div className="flex-1 min-w-0">
                      {item.title && <div className="font-medium text-gray-700 text-xs">{item.title}</div>}
                      <div className="text-gray-600 break-words">{item.content}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{timeAgo(item.date)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      {/* Create Lead Modal */}
      {showLeadModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowLeadModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Create Lead for {contact.first_name} {contact.last_name}</h3>
            {contact.status === 'past_client' && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-lg text-sm mb-4">
                Returning client — this will be a warm lead
              </div>
            )}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Loan Purpose</label>
                <select
                  value={leadForm.loan_purpose}
                  onChange={(e) => setLeadForm(f => ({ ...f, loan_purpose: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
                >
                  <option value="">Select...</option>
                  <option value="purchase">Purchase</option>
                  <option value="refinance">Refinance</option>
                  <option value="cashout">Cash-Out Refinance</option>
                  <option value="heloc">HELOC</option>
                  <option value="reverse">Reverse Mortgage</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">State</label>
                <select
                  value={leadForm.property_state}
                  onChange={(e) => setLeadForm(f => ({ ...f, property_state: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
                >
                  <option value="">Select...</option>
                  <option value="CO">Colorado</option>
                  <option value="CA">California</option>
                  <option value="TX">Texas</option>
                  <option value="OR">Oregon</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <textarea
                  value={leadForm.notes}
                  onChange={(e) => setLeadForm(f => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
                  placeholder="Any context about this lead..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowLeadModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm">
                Cancel
              </button>
              <button
                onClick={createLead}
                disabled={creatingLead}
                className="bg-go text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-go-dark transition-colors disabled:opacity-50"
              >
                {creatingLead ? 'Creating...' : 'Create Lead'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowEmailModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Send Email to {contact.first_name}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
                <div className="text-sm text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">{contact.email}</div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Subject</label>
                <input
                  value={emailForm.subject}
                  onChange={(e) => setEmailForm(f => ({ ...f, subject: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
                  placeholder="Email subject..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Message</label>
                <textarea
                  value={emailForm.emailBody}
                  onChange={(e) => setEmailForm(f => ({ ...f, emailBody: e.target.value }))}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
                  placeholder="Type your message..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowEmailModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm">Cancel</button>
              <button
                onClick={() => runAction('send_email', emailForm)}
                disabled={actionLoading || !emailForm.subject || !emailForm.emailBody}
                className="bg-go text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-go-dark transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Sending...' : 'Send Email'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Needs List Modal */}
      {showNeedsModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowNeedsModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Send Needs List to {contact.first_name}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Loan Type</label>
                <select
                  value={needsPurpose}
                  onChange={(e) => setNeedsPurpose(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
                >
                  <option value="default">General</option>
                  <option value="purchase">Purchase</option>
                  <option value="refinance">Refinance</option>
                </select>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs font-medium text-gray-500 mb-2">Documents included:</p>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>• 1003 application</li>
                  <li>• Bank statements (2 months)</li>
                  <li>• Pay stubs (30 days)</li>
                  <li>• W-2s (2 years)</li>
                  <li>• Tax returns (2 years)</li>
                  <li>• Photo ID</li>
                  {needsPurpose === 'purchase' && <>
                    <li>• Purchase contract</li>
                    <li>• Earnest money verification</li>
                    <li>• Homeowners insurance quote</li>
                  </>}
                  {needsPurpose === 'refinance' && <>
                    <li>• Current mortgage statement</li>
                    <li>• HOI declaration page</li>
                    <li>• HOA statement (if applicable)</li>
                  </>}
                </ul>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowNeedsModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm">Cancel</button>
              <button
                onClick={() => {
                  const docs = [
                    { label: 'Completed & signed 1003 application' },
                    { label: 'Most recent 2 months bank statements (all pages)' },
                    { label: 'Most recent 30 days pay stubs' },
                    { label: 'Most recent 2 years W-2s' },
                    { label: 'Most recent 2 years federal tax returns (all pages)' },
                    { label: 'Valid government-issued photo ID' },
                    ...(needsPurpose === 'purchase' ? [
                      { label: 'Purchase contract (when available)' },
                      { label: 'Earnest money deposit verification' },
                      { label: 'Homeowners insurance quote' },
                    ] : []),
                    ...(needsPurpose === 'refinance' ? [
                      { label: 'Current mortgage statement' },
                      { label: 'Homeowners insurance declaration page' },
                      { label: 'HOA statement (if applicable)' },
                    ] : []),
                  ];
                  runAction('send_needs_list', { documents: docs });
                }}
                disabled={actionLoading}
                className="bg-go text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-go-dark transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Sending...' : 'Send Needs List'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
