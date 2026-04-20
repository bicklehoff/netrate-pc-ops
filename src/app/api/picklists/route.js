import { NextResponse } from 'next/server';
import { getLicensedStates, getLoanTypes } from '@/lib/picklists/db-loader';
import {
  LOAN_PURPOSES,
  PROPERTY_TYPES,
  OCCUPANCY,
  TERMS,
  LOCK_DAYS,
} from '@/lib/constants/picklists';

export const runtime = 'nodejs';
export const revalidate = 600;

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const scope = searchParams.get('scope'); // 'licensed' | 'all' (states)
  const includeInactive = searchParams.get('includeInactive') === '1';

  try {
    const [states, loanTypes] = await Promise.all([
      getLicensedStates({ activeOnly: scope === 'licensed' }),
      getLoanTypes({ includeInactive }),
    ]);

    return NextResponse.json({
      states,
      loan_types: loanTypes,
      purposes: LOAN_PURPOSES,
      property_types: PROPERTY_TYPES,
      occupancy: OCCUPANCY,
      terms: TERMS,
      lock_days: LOCK_DAYS,
    }, {
      headers: {
        'Cache-Control': 'public, max-age=0, s-maxage=600, stale-while-revalidate=3600',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'picklist_fetch_failed', detail: err.message },
      { status: 500 }
    );
  }
}
