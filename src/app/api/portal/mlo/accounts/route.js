// API: Accounts (Partner Directory)
// GET  /api/portal/mlo/accounts — List accounts with contacts
// POST /api/portal/mlo/accounts — Create account
// Auth: MLO session required

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import sql from '@/lib/db';

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.userType === 'mlo') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const industry = searchParams.get('industry');
    const pattern = q ? `%${q}%` : null;

    const accounts = await sql`
      SELECT a.*,
        COALESCE(
          (SELECT json_agg(ac ORDER BY ac.is_primary DESC NULLS LAST, ac.first_name ASC)
           FROM account_contacts ac WHERE ac.account_id = a.id),
          '[]'
        ) AS account_contacts,
        (SELECT COUNT(*)::int FROM account_contacts WHERE account_id = a.id) AS contact_count
      FROM accounts a
      WHERE (${pattern}::text IS NULL OR a.name ILIKE ${pattern})
        AND (${industry}::text IS NULL OR a.industry = ${industry})
      ORDER BY a.name ASC
    `;

    // Industry counts for filter badges
    const industryCounts = await sql`
      SELECT industry, COUNT(*)::int AS count FROM accounts GROUP BY industry
    `;

    return Response.json({
      accounts: accounts.map(a => ({
        ...a,
        _count: { accountContacts: a.contact_count },
      })),
      industryCounts: industryCounts.reduce((acc, i) => ({ ...acc, [i.industry || 'other']: i.count }), {}),
    });
  } catch (error) {
    console.error('Accounts list error:', error?.message);
    return Response.json({ error: 'Failed to load accounts' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.userType === 'mlo') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, phone, website, industry, address, city, state, zipCode, notes, contacts } = body;

    if (!name) {
      return Response.json({ error: 'Account name is required' }, { status: 400 });
    }

    // Create account
    const accountRows = await sql`
      INSERT INTO accounts (name, phone, website, industry, address, city, state, zip_code, notes, created_at, updated_at)
      VALUES (
        ${name}, ${phone || null}, ${website || null}, ${industry || 'other'},
        ${address || null}, ${city || null}, ${state || null}, ${zipCode || null},
        ${notes || null}, NOW(), NOW()
      )
      RETURNING *
    `;
    const account = accountRows[0];

    // Create contacts if provided
    let accountContacts = [];
    if (contacts?.length > 0) {
      for (let i = 0; i < contacts.length; i++) {
        const c = contacts[i];
        const acRows = await sql`
          INSERT INTO account_contacts (account_id, first_name, last_name, email, phone, role, title, is_primary, created_at, updated_at)
          VALUES (
            ${account.id}, ${c.firstName || 'Unknown'}, ${c.lastName || ''},
            ${c.email || null}, ${c.phone || null}, ${c.role || null}, ${c.title || null},
            ${i === 0}, NOW(), NOW()
          )
          RETURNING *
        `;
        accountContacts.push(acRows[0]);
      }
    }

    return Response.json({ success: true, account: { ...account, account_contacts: accountContacts } }, { status: 201 });
  } catch (error) {
    console.error('Account create error:', error?.message);
    return Response.json({ error: 'Failed to create account' }, { status: 500 });
  }
}
