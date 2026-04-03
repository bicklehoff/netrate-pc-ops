'use client';

import { useState } from 'react';

const PURPOSE_LABELS = { purchase: 'Purchase', refi: 'Refinance', cashout: 'Cash-Out' };

function fmtDollar(n) {
  return '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function RateChangeBadge({ rateChange }) {
  if (rateChange == null) return <span className="text-xs text-gray-400">—</span>;
  const val = Number(rateChange);
  if (Math.abs(val) < 0.001) {
    return <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">No change</span>;
  }
  if (val < 0) {
    return <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded">&#9660; {Math.abs(val).toFixed(3)}%</span>;
  }
  return <span className="text-xs font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded">&#9650; {val.toFixed(3)}%</span>;
}

function StatusBadge({ status }) {
  const styles = {
    pending: 'bg-amber-100 text-amber-800',
    sent: 'bg-green-100 text-green-800',
    declined: 'bg-red-100 text-red-800',
    error: 'bg-red-100 text-red-800',
    approved: 'bg-blue-100 text-blue-800',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

export default function ScenarioAlertTable({ items, selectedIds, onSelectionChange, onAction, actionLoading }) {
  const [expandedId, setExpandedId] = useState(null);

  const toggleSelect = (id) => {
    onSelectionChange(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    const pendingIds = items.filter(i => i.status === 'pending').map(i => i.id);
    if (pendingIds.every(id => selectedIds.includes(id))) {
      onSelectionChange([]);
    } else {
      onSelectionChange(pendingIds);
    }
  };

  if (!items || items.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center text-gray-500 text-sm">
        No alerts in this view.
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  onChange={toggleAll}
                  checked={items.filter(i => i.status === 'pending').length > 0 &&
                    items.filter(i => i.status === 'pending').every(i => selectedIds.includes(i.id))}
                  className="rounded border-gray-300"
                />
              </th>
              <th className="px-4 py-3 text-left">Borrower</th>
              <th className="px-4 py-3 text-left">Scenario</th>
              <th className="px-4 py-3 text-right">Best Rate</th>
              <th className="px-4 py-3 text-center">Change</th>
              <th className="px-4 py-3 text-center">Frequency</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((item) => {
              const lead = item.scenario?.lead;
              const sd = item.scenario?.scenarioData || {};
              const isExpanded = expandedId === item.id;
              const isPending = item.status === 'pending';

              return (
                <tr key={item.id} className="group">
                  {/* Main row */}
                  <td className="px-4 py-3">
                    {isPending && (
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(item.id)}
                        onChange={() => toggleSelect(item.id)}
                        className="rounded border-gray-300"
                      />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{lead?.name || '—'}</div>
                    <div className="text-xs text-gray-500">{lead?.email || '—'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs text-gray-600">
                      {PURPOSE_LABELS[sd.purpose] || sd.purpose || '—'} | {fmtDollar(sd.loanAmount)} | {sd.fico || '—'} FICO | {sd.state || '—'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">
                    {item.bestRate != null ? `${Number(item.bestRate).toFixed(3)}%` : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <RateChangeBadge rateChange={item.rateChange} />
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-gray-500">
                    {item.scenario?.alertFrequency?.replace('_', 'x/') || '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {fmtDate(item.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                        className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded transition-colors"
                      >
                        {isExpanded ? 'Hide' : 'Details'}
                      </button>
                      {isPending && (
                        <>
                          <button
                            onClick={() => onAction('approve', [item.id])}
                            disabled={actionLoading}
                            className="text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 px-2.5 py-1 rounded transition-colors disabled:opacity-50"
                          >
                            Send
                          </button>
                          <button
                            onClick={() => onAction('decline', [item.id])}
                            disabled={actionLoading}
                            className="text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded transition-colors disabled:opacity-50"
                          >
                            Decline
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Expanded Detail Panel */}
      {expandedId && (() => {
        const item = items.find(i => i.id === expandedId);
        if (!item) return null;
        const current = Array.isArray(item.pricingData) ? item.pricingData : [];
        const previous = Array.isArray(item.previousData) ? item.previousData : [];
        const sd = item.scenario?.scenarioData || {};

        return (
          <div className="border-t border-gray-200 bg-gray-50 px-6 py-4">
            <div className="grid grid-cols-2 gap-6">
              {/* Scenario Details */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Scenario Details</h4>
                <div className="grid grid-cols-2 gap-y-1 text-sm">
                  <span className="text-gray-500">Purpose:</span>
                  <span className="text-gray-900">{PURPOSE_LABELS[sd.purpose] || sd.purpose}</span>
                  <span className="text-gray-500">Loan Amount:</span>
                  <span className="text-gray-900">{fmtDollar(sd.loanAmount)}</span>
                  <span className="text-gray-500">Property Value:</span>
                  <span className="text-gray-900">{sd.propertyValue ? fmtDollar(sd.propertyValue) : '—'}</span>
                  <span className="text-gray-500">FICO:</span>
                  <span className="text-gray-900">{sd.fico || '—'}</span>
                  <span className="text-gray-500">LTV:</span>
                  <span className="text-gray-900">{sd.ltv ? `${Math.round(sd.ltv)}%` : '—'}</span>
                  <span className="text-gray-500">State:</span>
                  <span className="text-gray-900">{sd.state || '—'}{sd.county ? ` / ${sd.county}` : ''}</span>
                  <span className="text-gray-500">Loan Type:</span>
                  <span className="text-gray-900">{sd.loanType || '—'}</span>
                  <span className="text-gray-500">Term:</span>
                  <span className="text-gray-900">{sd.term ? `${sd.term}yr` : '—'}</span>
                </div>
              </div>

              {/* Rate Comparison */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Rate Comparison</h4>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500">
                      <th className="text-left pb-1">Rate</th>
                      <th className="text-right pb-1">Monthly P&I</th>
                      <th className="text-right pb-1">Previous</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {current.map((r, i) => (
                      <tr key={i}>
                        <td className="py-1.5 font-mono font-semibold">{Number(r.rate).toFixed(3)}%</td>
                        <td className="py-1.5 text-right font-mono">{fmtDollar(r.monthlyPI)}/mo</td>
                        <td className="py-1.5 text-right font-mono text-gray-400">
                          {previous[i] ? `${Number(previous[i].rate).toFixed(3)}%` : '—'}
                        </td>
                      </tr>
                    ))}
                    {current.length === 0 && (
                      <tr><td colSpan={3} className="py-2 text-gray-400 text-center">No pricing data</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Alert History */}
            <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
              <span>Created: {fmtDate(item.scenario?.createdAt)}</span>
              <span>Last Sent: {fmtDate(item.scenario?.lastSentAt) || 'Never'}</span>
              <span>Sends: {item.scenario?.sendCount || 0}</span>
              <span>Alert Status: {item.scenario?.alertStatus}</span>
              {item.scenario?.alertStatus === 'active' && (
                <button
                  onClick={() => onAction('pause', [item.scenario.id])}
                  className="text-amber-600 hover:text-amber-800 font-medium"
                >
                  Pause Alerts
                </button>
              )}
              {item.scenario?.alertStatus === 'paused' && (
                <button
                  onClick={() => onAction('resume', [item.scenario.id])}
                  className="text-green-600 hover:text-green-800 font-medium"
                >
                  Resume Alerts
                </button>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
