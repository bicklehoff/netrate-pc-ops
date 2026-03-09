// Zoho WorkDrive API Client
// Manages loan document folders: create, upload, download, list.
// Uses same Zoho OAuth Self Client as other integrations (shared client_id/client_secret).
//
// Env vars required:
//   ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET — shared across all Zoho integrations
//   ZOHO_WORKDRIVE_REFRESH_TOKEN — WorkDrive-scoped refresh token
//   ZOHO_WORKDRIVE_TEAM_FOLDER_ID — ID of the "NetRate Loans" team folder

const ZOHO_ACCOUNTS_URL = 'https://accounts.zoho.com/oauth/v2/token';
const WORKDRIVE_BASE = 'https://www.zohoapis.com/workdrive/api/v1';

// Team folder where all loan folders are created
const TEAM_FOLDER_ID = process.env.ZOHO_WORKDRIVE_TEAM_FOLDER_ID || 'qzwf334512643936a44c68a99eef8fc61cb17';

// Standard loan folder subfolders
const LOAN_SUBFOLDERS = [
  'SUBMITTED',
  'EXTRA',
  'CLOSING',
];

// ─── Token Management ─────────────────────────────────────────

// In-memory token cache (serverless = short-lived, but avoids redundant refreshes within a request)
let cachedToken = null;
let tokenExpiry = 0;

/**
 * Get a fresh Zoho access token for WorkDrive API.
 * Caches token for ~50 minutes (Zoho tokens last 60 min).
 */
async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const refreshToken = process.env.ZOHO_WORKDRIVE_REFRESH_TOKEN;
  if (!refreshToken) {
    throw new Error('ZOHO_WORKDRIVE_REFRESH_TOKEN not configured');
  }

  const res = await fetch(ZOHO_ACCOUNTS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.ZOHO_CLIENT_ID,
      client_secret: process.env.ZOHO_CLIENT_SECRET,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WorkDrive token refresh failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  if (!data.access_token) {
    throw new Error('No access token in WorkDrive token response');
  }

  cachedToken = data.access_token;
  tokenExpiry = Date.now() + 50 * 60 * 1000; // Cache for 50 min
  return cachedToken;
}

// ─── API Helpers ──────────────────────────────────────────────

/**
 * Make an authenticated JSON:API request to WorkDrive.
 * WorkDrive uses JSON:API format — all requests need the vnd.api+json header.
 */
async function wdFetch(path, options = {}) {
  const token = await getAccessToken();
  const url = path.startsWith('http') ? path : `${WORKDRIVE_BASE}${path}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      Accept: 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WorkDrive API ${options.method || 'GET'} ${path}: ${res.status} ${text}`);
  }

  // Some endpoints return empty (204)
  if (res.status === 204) return null;

  return res.json();
}

// ─── Folder Operations ────────────────────────────────────────

/**
 * Create a subfolder inside a parent folder.
 * @param {string} name — Folder name
 * @param {string} parentId — Parent folder resource ID
 * @returns {Promise<{id: string, name: string, url: string}>}
 */
async function createFolder(name, parentId) {
  const data = await wdFetch('/files', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        attributes: {
          name,
          parent_id: parentId,
        },
        type: 'files',
      },
    }),
  });

  const resource = data?.data;
  return {
    id: resource?.id,
    name: resource?.attributes?.name,
    url: resource?.attributes?.permalink,
  };
}

/**
 * Find or create a folder inside a parent. Handles 409 "already exists" gracefully.
 * @param {string} name — Folder name
 * @param {string} parentId — Parent folder resource ID
 * @returns {Promise<{id: string, name: string, url: string}>}
 */
async function ensureFolder(name, parentId) {
  try {
    return await createFolder(name, parentId);
  } catch (err) {
    // If folder already exists, find it by listing the parent
    if (err.message.includes('409') || err.message.includes('already exists')) {
      const contents = await listFolder(parentId);
      const existing = contents.find((f) => f.name === name);
      if (!existing) throw new Error(`Folder "${name}" not found after 409`);
      return existing;
    }
    throw err;
  }
}

/**
 * Create the full loan folder structure for a new application.
 * Structure: {LO Name}/{Year}/{LastName-FirstName_Purpose_Date}/SUBMITTED, EXTRA, CLOSING
 *
 * @param {object} params
 * @param {string} params.borrowerFirstName
 * @param {string} params.borrowerLastName
 * @param {string} params.purpose — 'purchase' | 'refinance'
 * @param {string} [params.loName] — Loan officer name (default: 'David Burson')
 * @returns {Promise<{rootFolderId: string, rootFolderUrl: string, subfolders: object}>}
 */
export async function createLoanFolder({ borrowerFirstName, borrowerLastName, purpose, loName = 'David Burson' }) {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const purposeLabel = purpose === 'purchase' ? 'Purchase' : 'Refi';
  const folderName = `${borrowerLastName}-${borrowerFirstName}_${purposeLabel}_${year}-${month}`;

  // Ensure LO folder exists (e.g. "David Burson")
  const loFolder = await ensureFolder(loName, TEAM_FOLDER_ID);

  // Ensure year folder exists inside LO folder
  const yearFolder = await ensureFolder(year, loFolder.id);

  // Create loan folder inside year folder
  const loanFolder = await createFolder(folderName, yearFolder.id);

  // Create standard subfolders
  const subfolders = {};
  for (const sub of LOAN_SUBFOLDERS) {
    const sf = await createFolder(sub, loanFolder.id);
    subfolders[sub] = sf.id;
  }

  return {
    rootFolderId: loanFolder.id,
    rootFolderUrl: loanFolder.url,
    subfolders,
  };
}

/**
 * List contents of a folder.
 * @param {string} folderId — Folder resource ID
 * @returns {Promise<Array<{id: string, name: string, isFolder: boolean}>>}
 */
export async function listFolder(folderId) {
  const data = await wdFetch(`/files/${folderId}/files`);

  return (data?.data || []).map((item) => ({
    id: item.id,
    name: item.attributes?.name,
    isFolder: item.attributes?.is_folder,
    size: item.attributes?.storage_info?.size,
    modifiedTime: item.attributes?.modified_time,
    url: item.attributes?.permalink,
  }));
}

// ─── File Operations ──────────────────────────────────────────

/**
 * Upload a file to a WorkDrive folder.
 * Uses multipart/form-data (different from JSON:API for file uploads).
 *
 * @param {File|Blob|Buffer} file — File data
 * @param {string} fileName — File name with extension
 * @param {string} folderId — Target folder ID
 * @param {boolean} override — Replace if file with same name exists
 * @returns {Promise<{id: string, name: string, url: string, size: number}>}
 */
export async function uploadFile(file, fileName, folderId, override = false) {
  const token = await getAccessToken();

  // WorkDrive upload uses a different endpoint and multipart format
  const uploadUrl = `${WORKDRIVE_BASE}/upload`;

  const formData = new FormData();
  formData.append('content', file, fileName);
  formData.append('parent_id', folderId);
  formData.append('override-name-exist', String(override));

  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      // Don't set Content-Type — let fetch set it with boundary for multipart
    },
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WorkDrive upload failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  const uploaded = data?.data?.[0] || data?.data;

  return {
    id: uploaded?.attributes?.resource_id || uploaded?.id,
    name: uploaded?.attributes?.name || fileName,
    url: uploaded?.attributes?.permalink,
    size: uploaded?.attributes?.storage_info?.size,
  };
}

/**
 * Get a download URL for a file.
 * @param {string} fileId — File resource ID
 * @returns {Promise<string>} Download URL
 */
export async function getDownloadUrl(fileId) {
  const token = await getAccessToken();
  // WorkDrive download endpoint returns the file directly
  // We return the authenticated URL for the client to use
  return `${WORKDRIVE_BASE}/download/${fileId}?access_token=${token}`;
}

/**
 * Get file metadata.
 * @param {string} fileId — File resource ID
 * @returns {Promise<object>}
 */
export async function getFileInfo(fileId) {
  const data = await wdFetch(`/files/${fileId}`);
  const attrs = data?.data?.attributes || {};

  return {
    id: data?.data?.id,
    name: attrs.name,
    size: attrs.storage_info?.size,
    type: attrs.type,
    modifiedTime: attrs.modified_time,
    createdTime: attrs.created_time,
    url: attrs.permalink,
  };
}

/**
 * Delete a file or folder.
 * @param {string} resourceId — File or folder ID
 */
export async function deleteResource(resourceId) {
  await wdFetch(`/files/${resourceId}`, { method: 'DELETE' });
}

// ─── URL Helpers ──────────────────────────────────────────────

/**
 * Build a web URL to open a WorkDrive folder in the browser.
 * @param {string} folderId — Folder resource ID
 * @returns {string} Web URL
 */
export function getWebUrl(folderId) {
  const teamId = 'awioudbfe1bb1979e468b8459887358c14e4f';
  const wsId = TEAM_FOLDER_ID;
  return `https://workdrive.zoho.com/${teamId}/teams/${teamId}/ws/${wsId}/folders/${folderId}`;
}

/**
 * Determine which subfolder a document type should be uploaded to.
 * Maps doc types from the portal to WorkDrive subfolder names.
 *
 * Subfolders: SUBMITTED (lender-ready docs), EXTRA (supporting), CLOSING (closing docs)
 *
 * @param {string} docType — Document type from the portal
 * @returns {string} Subfolder name
 */
export function getSubfolderForDocType(docType) {
  const mapping = {
    // Closing docs → CLOSING
    cd: 'CLOSING',
    closing_disclosure: 'CLOSING',
    closing: 'CLOSING',
    wire: 'CLOSING',

    // Supporting / extra docs → EXTRA
    other: 'EXTRA',
    authorization: 'EXTRA',

    // Everything else → SUBMITTED (lender-ready)
    application: 'SUBMITTED',
    id: 'SUBMITTED',
    paystub: 'SUBMITTED',
    pay_stub: 'SUBMITTED',
    w2: 'SUBMITTED',
    tax_return: 'SUBMITTED',
    income: 'SUBMITTED',
    employment: 'SUBMITTED',
    bank_statement: 'SUBMITTED',
    investment: 'SUBMITTED',
    asset: 'SUBMITTED',
    gift_letter: 'SUBMITTED',
    purchase_contract: 'SUBMITTED',
    appraisal: 'SUBMITTED',
    insurance: 'SUBMITTED',
    hoa: 'SUBMITTED',
    property: 'SUBMITTED',
    title: 'SUBMITTED',
    survey: 'SUBMITTED',
    deed: 'SUBMITTED',
  };

  return mapping[docType] || 'SUBMITTED'; // Default to SUBMITTED
}
