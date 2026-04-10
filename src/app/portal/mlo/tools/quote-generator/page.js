'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, Component } from 'react';
import QuoteWizard from '@/components/Portal/QuoteGenerator/QuoteWizard';

class QuoteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('QuoteGenerator crash:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <h2 className="text-lg font-bold text-red-800 mb-2">Quote Generator Error</h2>
            <p className="text-red-700 mb-4">{this.state.error?.message || 'Unknown error'}</p>
            <details className="text-xs text-red-600">
              <summary className="cursor-pointer font-medium mb-2">Stack trace</summary>
              <pre className="whitespace-pre-wrap bg-red-100 p-3 rounded overflow-auto max-h-64">
                {this.state.error?.stack}
              </pre>
              {this.state.errorInfo?.componentStack && (
                <pre className="whitespace-pre-wrap bg-red-100 p-3 rounded mt-2 overflow-auto max-h-64">
                  {this.state.errorInfo.componentStack}
                </pre>
              )}
            </details>
            <button
              onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function QuoteGeneratorContent() {
  const params = useSearchParams();

  // Pre-fill from URL params (e.g., linked from contact or loan page)
  const prefill = {
    contact_id: params.get('contact_id'),
    leadId: params.get('leadId'),
    loan_id: params.get('loan_id'),
    borrower_name: params.get('name'),
    borrower_email: params.get('email'),
    borrower_phone: params.get('phone'),
    state: params.get('state'),
    county: params.get('county'),
    loan_amount: params.get('loan_amount') ? Number(params.get('loan_amount')) : null,
    fico: params.get('fico') ? Number(params.get('fico')) : null,
    loan_type: params.get('loan_type'),
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
      <QuoteErrorBoundary>
        <QuoteWizard prefill={prefill} />
      </QuoteErrorBoundary>
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
