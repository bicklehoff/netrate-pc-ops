# Zoho CRM Integration — Reference

## Connection

- **API:** Zoho CRM REST API v2
- **Auth:** OAuth 2.0 (Self Client grant type)
- **Scope:** `ZohoCRM.modules.leads.CREATE,ZohoCRM.modules.leads.READ`

## How It Works

Website contact form (`/contact`) → POST to `/api/lead` → server-side route refreshes OAuth token → creates Lead in Zoho CRM.

Lead fields mapped:
- First Name, Last Name, Email, Phone
- Lead Source: "Website"
- Description: loan type + message from form

## Token Notes

- **Client ID / Client Secret:** Same Self Client used for all Zoho scopes
- **Refresh token:** CRM-scoped (not Creator-scoped — a Feb 23 fix)
- Previous Creator-scoped token returned 502 — wrong scope
- Token refreshes automatically on each API call

## Code

- `src/app/api/lead/route.js` — Lead creation endpoint
- Environment variables: `ZOHO_REFRESH_TOKEN`, `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`

## Status

Working end-to-end as of Feb 23, 2026. Tested with live form submission on netratemortgage.com.
