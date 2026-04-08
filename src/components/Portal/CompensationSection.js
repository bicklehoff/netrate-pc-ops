// Compensation Section — Shows MLO their comp breakdown from CD + payroll response
// Visible once CD is approved on funded loans

'use client';

import { useState, useEffect } from 'react';

function fmt$(val) {
  if (val == null) return '—';
  return '$' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function CompensationSection({ loan }) {
  const [payrollDetails, setPayrollDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  const isFunded = loan?.status === 'funded';
  const isApproved = !!loan?.cdApprovedAt;
  const isSent = !!loan?.payrollSentAt;

  useEffect(() => {
    if (!isFunded || !loan?.id) { setLoading(false); return; }
    fetch(`/api/portal/mlo/loans/${loan.id}/payroll`)
      .then(r => r.json())
      .then(data => {
        if (data.payrollDetails) setPayrollDetails(data.payrollDetails);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isFunded, loan?.id]);

  // Only show once CD is approved (we have comp data)
  if (!isFunded || !isApproved) return null;

  const cd = loan.cdExtractedData?.data || {};
  const tracker = payrollDetails?.trackerResult || {};
  const payload = payrollDetails?.trackerPayload || {};

  const HOUSE_FEE_RATE = 0.12948857;

  const grossComp = cd.brokerCompensation || payload.grossComp;
  const reimbSelections = cd._reimbursementSelections || [];
  const totalReimb = reimbSelections.reduce((sum, r) => sum + (r.editedAmount || 0), 0);
  const wireTotal = cd.totalDueToBroker || payload.wireTotal;
  // Calculate comp split locally — no TrackerPortal dependency
  const houseFee = grossComp ? Number(grossComp) * HOUSE_FEE_RATE : null;
  const loComp = grossComp && houseFee != null ? Number(grossComp) - houseFee : null;
  const cdNumber = tracker.cdNumber;
  const status = tracker.status;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="bg-emerald-50 px-6 py-4 border-b border-emerald-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">💵</span>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Compensation</h2>
              <p className="text-xs text-gray-500">
                {isSent ? `Sent to payroll${cdNumber ? ` — ${cdNumber}` : ''}` : 'From approved CD'}
              </p>
            </div>
          </div>
          {status && (
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
              status === 'confirmed' ? 'bg-green-100 text-green-700'
              : status === 'matched' ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-600'
            }`}>
              {status === 'confirmed' ? 'Confirmed' : status === 'matched' ? 'Wire Matched' : status}
            </span>
          )}
        </div>
      </div>

      <div className="px-6 py-4">
        {loading ? (
          <div className="text-center py-4">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Wire Info */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Wire Info</p>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Broker Compensation</span>
                  <span className="font-medium text-gray-900">{fmt$(grossComp)}</span>
                </div>
                {reimbSelections.map((r, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-500">{r.label}</span>
                    <span className="text-gray-700">{fmt$(r.editedAmount)}</span>
                  </div>
                ))}
                {wireTotal && (
                  <>
                    <div className="border-t border-gray-200 my-1.5" />
                    <div className="flex justify-between text-sm font-semibold">
                      <span className="text-gray-700">Expected Wire</span>
                      <span className="text-gray-900">{fmt$(wireTotal)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Payment Info */}
            {loComp && (() => {
              const anticipatedPayment = loComp + totalReimb;
              return (
                <div className="bg-emerald-50 rounded-lg px-4 py-3">
                  <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-2">Payment Info</p>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-emerald-700">Broker Compensation</span>
                      <span className="text-emerald-900 font-medium">{fmt$(grossComp)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-emerald-600">House Fee (12.95%)</span>
                      <span className="text-red-500 font-medium">-{fmt$(houseFee)}</span>
                    </div>
                    {totalReimb > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-emerald-600">Reimbursements</span>
                        <span className="text-emerald-700 font-medium">+{fmt$(totalReimb)}</span>
                      </div>
                    )}
                    <div className="border-t border-emerald-300 my-1.5" />
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold text-emerald-900">Anticipated Payment</span>
                      <span className="text-lg font-bold text-emerald-800">{fmt$(anticipatedPayment)}</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Status message */}
            {tracker.message && (
              <p className="text-xs text-gray-500 italic text-center mt-2">{tracker.message}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
