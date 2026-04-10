// PostCloseSection — Post-funding checklist for loan wrap-up
// Shows when loan status = funded or archived.
// Uses LoanTask model for tracking checklist items.

'use client';

import { useState, useEffect, useCallback } from 'react';
import SectionCard from '../SectionCard';

const POST_CLOSE_TASKS = [
  { key: 'congrats_email', label: 'Send closing congratulations email', category: 'communication', auto: true },
  { key: 'survey_30d', label: 'Send post-close survey (30 days)', category: 'communication' },
  { key: 'google_review', label: 'Request Google review', category: 'communication' },
  { key: 'compliance_audit', label: 'Audit file for compliance', category: 'compliance' },
  { key: 'payroll', label: 'Send to payroll', category: 'finance' },
  { key: 'update_contact', label: 'Update contact to past client', category: 'crm', auto: true },
  { key: 'mailing_list', label: 'Add to mailing list', category: 'crm', auto: true },
];

const CATEGORY_LABELS = {
  communication: 'Communication',
  compliance: 'Compliance & Audit',
  finance: 'Finance',
  crm: 'CRM',
};

const CATEGORY_COLORS = {
  communication: 'text-blue-600',
  compliance: 'text-amber-600',
  finance: 'text-green-600',
  crm: 'text-purple-600',
};

function formatDate(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export default function PostCloseSection({ loan }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch(`/api/portal/mlo/loans/${loan.id}/tasks`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } catch {
      // Tasks may not exist yet
    } finally {
      setLoading(false);
    }
  }, [loan.id]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // Check if a post-close task exists in DB
  const getTaskStatus = (taskKey) => {
    const task = tasks.find(t => t.title === `post-close:${taskKey}`);
    if (!task) return 'pending';
    if (task.completed_at) return 'done';
    return 'in_progress';
  };

  const getTaskDate = (taskKey) => {
    const task = tasks.find(t => t.title === `post-close:${taskKey}`);
    return task?.completed_at;
  };

  const toggleTask = async (taskKey) => {
    setActionLoading(taskKey);
    setError('');
    try {
      const existing = tasks.find(t => t.title === `post-close:${taskKey}`);

      if (existing?.completed_at) {
        // Uncheck — clear completedAt
        await fetch(`/api/portal/mlo/loans/${loan.id}/tasks/${existing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ completed_at: null }),
        });
      } else if (existing) {
        // Mark complete
        await fetch(`/api/portal/mlo/loans/${loan.id}/tasks/${existing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ completed_at: new Date().toISOString() }),
        });
      } else {
        // Create as completed
        await fetch(`/api/portal/mlo/loans/${loan.id}/tasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: `post-close:${taskKey}`,
            category: 'post-close',
            priority: 'normal',
            completed_at: new Date().toISOString(),
          }),
        });
      }

      fetchTasks();
    } catch {
      setError('Failed to update task');
    } finally {
      setActionLoading('');
    }
  };

  const runAction = async (taskKey) => {
    setActionLoading(taskKey);
    setError('');
    setSuccess('');
    try {
      // Find borrower contact for this loan
      const contactRes = await fetch(`/api/portal/mlo/loans/${loan.id}/contact`);
      let contactId = null;
      if (contactRes.ok) {
        const contactData = await contactRes.json();
        contactId = contactData.contact_id;
      }

      if (taskKey === 'congrats_email' && contactId) {
        await fetch(`/api/portal/mlo/contacts/${contactId}/actions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'send_email',
            subject: 'Congratulations on your new loan!',
            emailBody: `Congratulations on closing your loan! It has been a pleasure working with you.\n\nIf you have any questions about your new mortgage or need anything in the future, please don't hesitate to reach out.\n\nThank you for choosing NetRate Mortgage.`,
          }),
        });
        setSuccess('Congratulations email sent!');
      } else if (taskKey === 'google_review' && contactId) {
        await fetch(`/api/portal/mlo/contacts/${contactId}/actions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'send_email',
            subject: 'How was your experience with NetRate Mortgage?',
            emailBody: `Thank you again for choosing NetRate Mortgage! If you had a great experience, we'd love for you to leave us a Google review. It helps other homebuyers find us.\n\nLeave a review: https://g.page/r/NetRateMortgage/review\n\nThank you for your time!`,
          }),
        });
        setSuccess('Review request sent!');
      } else if (taskKey === 'update_contact' && contactId) {
        await fetch(`/api/portal/mlo/contacts/${contactId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'past_client',
            funded_date: loan.dates?.funding_date || new Date().toISOString(),
          }),
        });
        setSuccess('Contact updated to past client');
      } else if (taskKey === 'mailing_list' && contactId) {
        const contactRes2 = await fetch(`/api/portal/mlo/contacts/${contactId}`);
        if (contactRes2.ok) {
          const cData = await contactRes2.json();
          const currentTags = cData.contact?.tags || [];
          if (!currentTags.includes('mailing-list')) {
            await fetch(`/api/portal/mlo/contacts/${contactId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tags: [...currentTags, 'mailing-list'] }),
            });
          }
        }
        setSuccess('Added to mailing list');
      } else if (!contactId) {
        setError('No linked contact found for this loan');
        setActionLoading('');
        return;
      }

      setTimeout(() => setSuccess(''), 3000);

      // Auto-check the task
      await toggleTask(taskKey);
    } catch {
      setError('Action failed');
    } finally {
      setActionLoading('');
    }
  };

  // Group tasks by category
  const grouped = {};
  for (const task of POST_CLOSE_TASKS) {
    if (!grouped[task.category]) grouped[task.category] = [];
    grouped[task.category].push(task);
  }

  const completedCount = POST_CLOSE_TASKS.filter(t => getTaskStatus(t.key) === 'done').length;

  return (
    <div className="space-y-4">
      <SectionCard
        title="Post-Close Checklist"
        badge={`${completedCount}/${POST_CLOSE_TASKS.length}`}
      >
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm mb-4">
            {error}
            <button onClick={() => setError('')} className="ml-2 font-medium">×</button>
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-lg text-sm mb-4">
            {success}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-gray-400">Loading...</p>
        ) : (
          <div className="space-y-5">
            {Object.entries(grouped).map(([category, categoryTasks]) => (
              <div key={category}>
                <h4 className={`text-xs font-bold uppercase tracking-wider mb-2 ${CATEGORY_COLORS[category] || 'text-gray-500'}`}>
                  {CATEGORY_LABELS[category]}
                </h4>
                <div className="space-y-1">
                  {categoryTasks.map((task) => {
                    const status = getTaskStatus(task.key);
                    const completedDate = getTaskDate(task.key);
                    const isLoading = actionLoading === task.key;
                    const hasAction = ['congrats_email', 'google_review', 'update_contact', 'mailing_list'].includes(task.key);

                    return (
                      <div
                        key={task.key}
                        className={`flex items-center gap-3 py-2 px-3 rounded-lg transition-colors ${
                          status === 'done' ? 'bg-green-50/50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <button
                          onClick={() => toggleTask(task.key)}
                          disabled={isLoading}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                            status === 'done'
                              ? 'bg-green-500 border-green-500 text-white'
                              : 'border-gray-300 hover:border-brand'
                          }`}
                        >
                          {status === 'done' && (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                        <span className={`flex-1 text-sm ${status === 'done' ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                          {task.label}
                          {task.auto && <span className="text-xs text-gray-400 ml-1">(auto)</span>}
                        </span>
                        {completedDate && (
                          <span className="text-xs text-gray-400">{formatDate(completedDate)}</span>
                        )}
                        {hasAction && status !== 'done' && (
                          <button
                            onClick={() => runAction(task.key)}
                            disabled={isLoading}
                            className="text-xs bg-brand/10 text-brand px-2 py-1 rounded hover:bg-brand/20 transition-colors disabled:opacity-50"
                          >
                            {isLoading ? '...' : 'Run'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Loan Summary for funded loans */}
      <SectionCard title="Funded Loan Summary">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500 text-xs">Borrower</span>
            <div className="font-medium">{loan.borrower?.first_name} {loan.borrower?.last_name}</div>
          </div>
          <div>
            <span className="text-gray-500 text-xs">Loan Amount</span>
            <div className="font-medium">{loan.loan_amount ? `$${Number(loan.loan_amount).toLocaleString()}` : '—'}</div>
          </div>
          <div>
            <span className="text-gray-500 text-xs">Rate</span>
            <div className="font-medium">{loan.interest_rate ? `${loan.interest_rate}%` : '—'}</div>
          </div>
          <div>
            <span className="text-gray-500 text-xs">Lender</span>
            <div className="font-medium">{loan.lender_name || '—'}</div>
          </div>
          <div>
            <span className="text-gray-500 text-xs">Loan Type</span>
            <div className="font-medium capitalize">{loan.loan_type || '—'}</div>
          </div>
          <div>
            <span className="text-gray-500 text-xs">Funding Date</span>
            <div className="font-medium">{formatDate(loan.dates?.funding_date) || '—'}</div>
          </div>
          {loan.loan_number && (
            <div>
              <span className="text-gray-500 text-xs">Loan #</span>
              <div className="font-medium">{loan.loan_number}</div>
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
