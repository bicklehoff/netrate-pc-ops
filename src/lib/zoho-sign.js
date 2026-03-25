// Zoho Sign API Client
// Creates signing requests for pre-qualification letters.
// Uses same Zoho OAuth Self Client as other integrations (shared client_id/client_secret).
//
// Env vars required:
//   ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET — shared across all Zoho integrations
//   ZOHO_SIGN_REFRESH_TOKEN — Sign-scoped refresh token (scope: ZohoSign.documents.ALL)

const ZOHO_ACCOUNTS_URL = 'https://accounts.zoho.com/oauth/v2/token';
const SIGN_BASE = 'https://sign.zoho.com/api/v1';

// ─── Token Management ─────────────────────────────────────────

let cachedToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const refreshToken = process.env.ZOHO_SIGN_REFRESH_TOKEN;
  if (!refreshToken) {
    throw new Error('ZOHO_SIGN_REFRESH_TOKEN not configured');
  }

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: process.env.ZOHO_CLIENT_ID,
    client_secret: process.env.ZOHO_CLIENT_SECRET,
    refresh_token: refreshToken,
  });

  const res = await fetch(ZOHO_ACCOUNTS_URL, {
    method: 'POST',
    body: params,
  });

  if (!res.ok) {
    throw new Error(`Zoho Sign token refresh failed: ${res.status}`);
  }

  const data = await res.json();
  if (data.error) {
    throw new Error(`Zoho Sign token error: ${data.error}`);
  }

  cachedToken = data.access_token;
  tokenExpiry = Date.now() + 50 * 60 * 1000; // Cache for 50 min (expires in 60)
  return cachedToken;
}

// ─── API Methods ──────────────────────────────────────────────

/**
 * Create a signing request from a PDF buffer.
 * Two-step process: (1) create draft with file, (2) submit with signature field.
 *
 * @param {Object} params
 * @param {Buffer} params.pdfBuffer — PDF file as Buffer
 * @param {string} params.fileName — e.g. "NetRate-PreQual-John-Smith.pdf"
 * @param {string} params.signerName — MLO name (the signer)
 * @param {string} params.signerEmail — MLO email (the signer)
 * @param {string} [params.description] — Optional description
 * @returns {Promise<Object>} — { requestId, requestStatus, signingUrl }
 */
export async function createSigningRequest({
  pdfBuffer,
  fileName,
  signerName,
  signerEmail,
  description,
}) {
  const token = await getAccessToken();

  // Step 1: Create draft with file upload
  const requestData = {
    requests: {
      request_name: fileName.replace('.pdf', ''),
      is_sequential: true,
      description: description || 'Pre-Qualification Letter for e-signature',
      expiration_days: 30,
      email_reminders: true,
      reminder_period: 5,
      actions: [
        {
          action_type: 'SIGN',
          recipient_email: signerEmail,
          recipient_name: signerName,
          signing_order: 0,
          verify_recipient: false,
        },
      ],
    },
  };

  // Build multipart form data
  const formData = new FormData();
  const fileBlob = new Blob([pdfBuffer], { type: 'application/pdf' });
  formData.append('file', fileBlob, fileName);
  formData.append('data', JSON.stringify(requestData));

  const createRes = await fetch(`${SIGN_BASE}/requests`, {
    method: 'POST',
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
    },
    body: formData,
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Zoho Sign create failed (${createRes.status}): ${errText}`);
  }

  const createData = await createRes.json();
  console.log('Zoho Sign create response:', JSON.stringify(createData, null, 2));
  const request = createData.requests;

  if (!request || !request.request_id) {
    throw new Error('Zoho Sign: no request_id in response');
  }

  const requestId = request.request_id;
  const documentId = request.document_ids?.[0]?.document_id;
  const actionId = request.actions?.[0]?.action_id;

  if (!documentId || !actionId) {
    throw new Error('Zoho Sign: missing document_id or action_id in draft response');
  }

  // Step 2: Submit with signature field
  // Zoho requires fields under "image_fields" (not "signature"), percentage coords
  const submitData = {
    requests: {
      actions: [
        {
          action_id: actionId,
          action_type: 'SIGN',
          recipient_name: signerName,
          recipient_email: signerEmail,
          signing_order: 0,
          fields: {
            image_fields: [
              {
                field_name: 'Signature',
                field_label: 'Signature',
                field_type_name: 'Signature',
                field_category: 'image',
                document_id: documentId,
                is_mandatory: true,
                page_no: 0,
                x_value: 10,
                y_value: 80,
                width: 20,
                height: 4,
              },
            ],
          },
        },
      ],
    },
  };

  const submitRes = await fetch(`${SIGN_BASE}/requests/${requestId}/submit`, {
    method: 'POST',
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(submitData),
  });

  const submitText = await submitRes.text();
  console.log('Zoho Sign submit response:', submitRes.status, submitText);

  if (!submitRes.ok) {
    throw new Error(`Zoho Sign submit failed (${submitRes.status}): ${submitText}`);
  }

  const submitResult = JSON.parse(submitText);

  // Get the embedded signing URL so the MLO can sign in-browser
  const signAction = submitResult.requests?.actions?.[0];
  let signUrl = null;
  if (signAction?.verify_recipient === false || signAction?.signing_url) {
    signUrl = signAction.signing_url;
  }

  // If no embedded URL, fetch it via the action endpoint
  if (!signUrl) {
    try {
      const actionRes = await fetch(
        `${SIGN_BASE}/requests/${requestId}/actions/${actionId}/embedtoken`,
        {
          method: 'POST',
          headers: {
            Authorization: `Zoho-oauthtoken ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ host: 'https://www.netratemortgage.com' }),
        }
      );
      if (actionRes.ok) {
        const actionData = await actionRes.json();
        signUrl = actionData.sign_url || actionData.signing_url || null;
      }
    } finally {
      // If embed fails, fall back to email-based signing
    }
  }

  return {
    requestId,
    requestStatus: submitResult.requests?.request_status || 'submitted',
    signerEmail,
    signUrl,
  };
}
