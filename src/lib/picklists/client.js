'use client';

/**
 * Client-side picklist loader. Module-level promise cache — one fetch per
 * browser session; subsequent consumers receive the same resolved object
 * without re-hitting /api/picklists.
 *
 * Usage:
 *   import { usePicklists } from '@/lib/picklists/client';
 *   const { states, loan_types, purposes, ... } = usePicklists();
 *
 * While the fetch is in flight the hook returns the FALLBACK shape (empty
 * arrays for DB-driven lists, constants-driven lists returned immediately
 * from the constants module). This lets the form render without waiting,
 * and the dropdowns fill once the fetch resolves.
 */

import { useEffect, useState } from 'react';
import {
  LOAN_PURPOSES,
  PROPERTY_TYPES,
  OCCUPANCY,
  TERMS,
  LOCK_DAYS,
} from '@/lib/constants/picklists';

const EMPTY_PICKLISTS = {
  states: [],
  loan_types: [],
  purposes: LOAN_PURPOSES,
  property_types: PROPERTY_TYPES,
  occupancy: OCCUPANCY,
  terms: TERMS,
  lock_days: LOCK_DAYS,
};

let cache = null;
let inflight = null;

function fetchPicklists(scope) {
  const url = scope === 'licensed' ? '/api/picklists?scope=licensed' : '/api/picklists';
  return fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error(`picklists fetch ${r.status}`);
      return r.json();
    })
    .then((data) => {
      cache = data;
      return data;
    });
}

export function usePicklists({ scope = 'licensed' } = {}) {
  const [data, setData] = useState(cache || EMPTY_PICKLISTS);

  useEffect(() => {
    if (cache) return;
    if (!inflight) inflight = fetchPicklists(scope).finally(() => { inflight = null; });
    inflight.then((d) => setData(d)).catch(() => { /* keep fallback */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return data;
}
