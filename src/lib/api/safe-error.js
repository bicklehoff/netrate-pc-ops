// Safe API error response helper.
//
// Logs the full error server-side (message + stack) and returns a sanitized
// JSON response to the client with only the public-safe message. Prevents
// internal details (SQL errors, stack frames, file paths, schema names) from
// leaking into public API responses.
//
// Usage:
//   try { ... }
//   catch (err) { return apiError(err, 'Save failed', 500, { scope: 'rate-alert' }); }

import { NextResponse } from 'next/server';

export function apiError(err, publicMessage, status = 500, logContext = {}) {
  const scope = logContext.scope || 'api';
  console.error(`[${scope}] ${publicMessage}:`, err?.message, err?.stack);
  return NextResponse.json({ error: publicMessage }, { status });
}
