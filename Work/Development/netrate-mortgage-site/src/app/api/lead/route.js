import { NextResponse } from 'next/server';

const ZOHO_ACCOUNTS_URL = 'https://accounts.zoho.com/oauth/v2/token';
const ZOHO_CRM_URL = 'https://www.zohoapis.com/crm/v2/Leads';

async function getAccessToken() {
  const res = await fetch(ZOHO_ACCOUNTS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: process.env.ZOHO_REFRESH_TOKEN,
      client_id: process.env.ZOHO_CLIENT_ID,
      client_secret: process.env.ZOHO_CLIENT_SECRET,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    throw new Error(`Zoho token refresh failed: ${res.status}`);
  }

  const data = await res.json();
  if (!data.access_token) {
    throw new Error('No access token in Zoho response');
  }

  return data.access_token;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, email, phone, loanType, message, leadSource } = body;

    if (!name || !email) {
      return NextResponse.json(
        { error: 'Name and email are required' },
        { status: 400 }
      );
    }

    // Map loanType to a readable value
    const loanTypeMap = {
      refinance: 'Refinance',
      purchase: 'Purchase',
      not_sure: 'Not Sure',
    };

    const accessToken = await getAccessToken();

    const leadData = {
      data: [
        {
          Last_Name: name,
          Email: email,
          Phone: phone || undefined,
          Lead_Source: leadSource || 'Website',
          Description: [
            loanType ? `Loan Type: ${loanTypeMap[loanType] || loanType}` : '',
            message ? `Message: ${message}` : '',
          ]
            .filter(Boolean)
            .join('\n'),
        },
      ],
    };

    const crmRes = await fetch(ZOHO_CRM_URL, {
      method: 'POST',
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(leadData),
    });

    if (!crmRes.ok) {
      const errText = await crmRes.text();
      console.error('Zoho CRM error:', crmRes.status, errText);
      return NextResponse.json(
        { error: 'Failed to submit lead' },
        { status: 502 }
      );
    }

    const crmData = await crmRes.json();
    return NextResponse.json({ success: true, id: crmData.data?.[0]?.details?.id });
  } catch (err) {
    console.error('Lead API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
