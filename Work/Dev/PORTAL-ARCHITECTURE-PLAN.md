# Borrower Portal — Architecture Plan

**Author:** WebDev (PC)
**Date:** February 23, 2026
**Status:** DRAFT — Awaiting David's approval
**References:** `netrate-governance/BORROWER-PORTAL-BRIEF.md`, LendingDox BPMN diagrams (3)

---

## Executive Summary

Build a borrower portal into `netrate-mortgage-site` as a new `/portal` route group. Borrowers apply, upload docs, and track loan status. MLOs manage their pipeline. The application form follows a multi-step wizard modeled after the LendingDox BPMN flows, adapted for NetRate's needs.

**Key simplification for v1:** No coborrower flow. Solo borrower only. Coborrower branching adds ~40% more screens and form fields — defer to v2 after the core pipeline works.

---

## What I Learned from the LendingDox Flows

Three BPMN workflows were provided. Here's what's relevant:

### Flow 1 & 2: Full Application (1003-lite)
Six-step wizard with coborrower branching at every stage:
1. **About You** — Name, contact info, SSN/DOB, purpose (purchase/refi), coborrower yes/no
2. **Purpose/Property** — Purchase path (occupancy, price, downpayment) vs Refi path (refi purpose, occupancy, existing liens). Then subject property address, property type, units, title manner.
3. **Address History** — Current address, mailing address, marital status, dependents. (Repeated for coborrower if applicable.)
4. **Your Finances** — Employers, income, other income, present housing expense, proposed housing expense, joint assets, REO, joint expenses. (CB branching for employers/income.)
5. **Declarations** — Property declarations, financial declarations, demographics. (CB versions of each.)
6. **Success** — Summary and thank you.

### Flow 3: Quick Pre-Qual (Rate Shopping)
Linear 10-step flow: Purpose → Occupancy → Property Type → Zip → Credit Quality → Employment → Late Payments → Declarations → Loan Amount → Offers.

**This is essentially our existing rate tool.** The rate tool already captures purpose, property type, and generates pricing. We can bridge from rate tool → full application by pre-filling known fields.

### Key Differences Between Flow 1 and Flow 2
| Aspect | Flow 1 (EZ) | Flow 2 (Standard) |
|--------|-------------|-------------------|
| SSN/DOB | Collected in Step 1 | NOT collected in intake |
| Purchase path | Price + "No Contract Date" | Price + Downpayment |
| Property details | Subject Property only | Subject Property + Property Type + Units + Title Manner |
| Assets | "Assets EZ" + "REO EZ" (per-borrower with 2-apps branching) | Joint Assets + REO + Joint Expenses (shared) |
| Housing expense | Not in flow | Present + Proposed Housing Expense |
| Employers | "Employers EZ" (simplified) | Employers + Income (separate screens) |

### My Recommendation
**Use Flow 2 (Standard) as the base, minus coborrower.** It's more complete — includes housing expenses, proper income breakdown, and property details that MLOs need to price and submit loans. SSN/DOB collected in Step 1 (matching Flow 1's pattern) — required for credit pulls and lender XML submissions. Protected via application-level encryption (see PII Encryption section).

---

## v1 Scope

### In Scope
1. **Multi-step application form** (borrower-facing, no auth required to start)
2. **Loan state machine** with status transitions
3. **Borrower dashboard** (auth required — view status, upload docs)
4. **MLO processing dashboard** (auth required — manage pipeline)
5. **Admin view** (David sees all MLOs' pipelines)
6. **Document request/upload flow**
7. **Email notifications** via Zoho Mail API on status changes
8. **Ball tracking** — whose court is it (borrower or MLO)?
9. **Audit trail** — every status change logged
10. **XML export** — Export loan data for submission to wholesale lenders (simplified MISMO-compatible format)

### Deferred to v2
- Coborrower flow (adds ~15 additional form screens)
- Zoho CRM ↔ portal sync (leads auto-create applications)
- Rate tool → application pre-fill bridge
- Full 1003 field set (v1 is 1003-lite)

---

## Application Form — Step-by-Step Design

Based on Flow 2, adapted for solo borrower, organized as a wizard with progress indicator.

### Step 1: About You
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| First Name | text | ✅ | |
| Last Name | text | ✅ | |
| Email | email | ✅ | Becomes their login |
| Phone | tel | ✅ | Inline notice below field: "This number will be used to verify your identity when accessing your loan portal." Used for SMS verification codes via Zoho Voice. |
| Date of Birth | date | ✅ | Encrypted at rest (see PII Encryption) |
| SSN | ssn (masked input) | ✅ | Encrypted at rest, masked on all displays as `***-**-1234`. Required for credit pulls and lender XML export. |
| Loan Purpose | select | ✅ | Purchase / Refinance |

### Step 2: Property
**If Purchase:**
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Occupancy | select | ✅ | Primary / Secondary / Investment |
| Estimated Purchase Price | currency | ✅ | |
| Estimated Down Payment | currency | ✅ | |
| Property Address | address | ❌ | May not have one yet |
| Property Type | select | ✅ | SFR / Condo / Townhome / Multi-unit / Manufactured |
| Number of Units | select | Conditional | Only if Multi-unit |

**If Refinance:**
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Refi Purpose | select | ✅ | Rate/Term / Cash-out / Streamline |
| Occupancy | select | ✅ | Primary / Secondary / Investment |
| Estimated Property Value | currency | ✅ | |
| Current Mortgage Balance | currency | ✅ | |
| Cash Out Amount | currency | Conditional | Only if Cash-out |
| Property Address | address | ✅ | They own it already |
| Property Type | select | ✅ | Same options as purchase |

### Step 3: Address History
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Current Street Address | address | ✅ | |
| How Long at Address | duration | ✅ | Years/months |
| Mailing Address | address | ❌ | "Same as current" checkbox |
| Marital Status | select | ✅ | Married / Unmarried / Separated |
| Number of Dependents | number | ✅ | |
| Ages of Dependents | text | Conditional | If > 0 dependents |

### Step 4: Employment & Income
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Employment Status | select | ✅ | Employed / Self-employed / Retired / Other |
| Employer Name | text | Conditional | If employed |
| Position/Title | text | Conditional | If employed |
| Years in Position | number | Conditional | If employed |
| Monthly Base Income | currency | ✅ | |
| Other Monthly Income | currency | ❌ | |
| Other Income Source | text | Conditional | If other income > 0 |
| Present Monthly Housing Expense | currency | ✅ | Rent or current mortgage payment |

### Step 5: Declarations
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Outstanding judgments? | yes/no | ✅ | |
| Declared bankruptcy (7 yrs)? | yes/no | ✅ | |
| Foreclosure (7 yrs)? | yes/no | ✅ | |
| Lawsuit party? | yes/no | ✅ | |
| Delinquent federal debt? | yes/no | ✅ | |
| Obligated on any loan that resulted in foreclosure? | yes/no | ✅ | |
| U.S. citizen? | select | ✅ | Citizen / Permanent Resident / Non-Permanent Resident |
| Primary residence? | yes/no | ✅ | Will you occupy as primary? |

### Step 6: Review & Submit
- Summary of all entered data (read-only)
- Edit buttons per section to go back
- Consent checkbox: "I authorize NetRate Mortgage to verify the information provided"
- Submit button → creates loan application in database

**Total: ~32 fields across 6 steps.** Manageable for a borrower, enough for an MLO to start processing and submit to lenders.

---

## Database Schema

Using Vercel Postgres (via `@vercel/postgres` or Prisma). Four core tables.

### `borrowers`
```
id              UUID        PK, auto-generated
email           TEXT        UNIQUE, NOT NULL
first_name      TEXT        NOT NULL
last_name       TEXT        NOT NULL
phone           TEXT
dob_encrypted   TEXT        NOT NULL    -- AES-256-GCM encrypted, base64-encoded
ssn_encrypted   TEXT        NOT NULL    -- AES-256-GCM encrypted, base64-encoded
ssn_last_four   TEXT        NOT NULL    -- Last 4 digits, plaintext (for display masking)
phone_verified  BOOLEAN     DEFAULT FALSE
password_hash   TEXT        NULL (magic link auth — no password initially)
magic_token     TEXT        NULL (for passwordless login)
magic_expires   TIMESTAMP   NULL
sms_code        TEXT        NULL    -- 6-digit verification code (hashed)
sms_code_expires TIMESTAMP  NULL
sms_attempts    INT         DEFAULT 0   -- Reset after successful verify, lockout after 3
sms_locked_until TIMESTAMP  NULL    -- 15-min lockout after 3 failed attempts
created_at      TIMESTAMP   DEFAULT NOW()
updated_at      TIMESTAMP   DEFAULT NOW()
```

### `loans`
```
id              UUID        PK, auto-generated
borrower_id     UUID        FK → borrowers.id, NOT NULL
mlo_id          UUID        FK → mlos.id, NULL (assigned after submission)
status          TEXT        NOT NULL, DEFAULT 'draft'
ball_in_court   TEXT        NOT NULL, DEFAULT 'borrower'  -- 'borrower' | 'mlo' | 'lender'
purpose         TEXT        -- 'purchase' | 'refinance'
occupancy       TEXT        -- 'primary' | 'secondary' | 'investment'

-- Property
property_address    JSONB   -- { street, city, state, zip }
property_type       TEXT    -- 'sfr' | 'condo' | 'townhome' | 'multi_unit' | 'manufactured'
num_units           INT
purchase_price      DECIMAL(12,2)
down_payment        DECIMAL(12,2)
estimated_value     DECIMAL(12,2)
current_balance     DECIMAL(12,2)
refi_purpose        TEXT    -- 'rate_term' | 'cash_out' | 'streamline'
cash_out_amount     DECIMAL(12,2)

-- Address
current_address     JSONB   -- { street, city, state, zip }
address_years       INT
address_months      INT
mailing_address     JSONB   -- NULL if same as current
marital_status      TEXT
num_dependents      INT
dependent_ages      TEXT

-- Employment & Income
employment_status   TEXT    -- 'employed' | 'self_employed' | 'retired' | 'other'
employer_name       TEXT
position_title      TEXT
years_in_position   INT
monthly_base_income DECIMAL(12,2)
other_monthly_income DECIMAL(12,2)
other_income_source TEXT
present_housing_expense DECIMAL(12,2)

-- Declarations (stored as JSONB for flexibility)
declarations        JSONB   -- { judgments: bool, bankruptcy: bool, ... }

-- Metadata
application_step    INT     DEFAULT 1   -- Last completed step (for resume)
submitted_at        TIMESTAMP   NULL
created_at          TIMESTAMP   DEFAULT NOW()
updated_at          TIMESTAMP   DEFAULT NOW()
```

### `mlos`
```
id              UUID        PK
email           TEXT        UNIQUE, NOT NULL
first_name      TEXT        NOT NULL
last_name       TEXT        NOT NULL
password_hash   TEXT        NOT NULL
role            TEXT        NOT NULL    -- 'mlo' | 'admin'
created_at      TIMESTAMP   DEFAULT NOW()
```

### `loan_events` (Audit Trail)
```
id              UUID        PK
loan_id         UUID        FK → loans.id, NOT NULL
event_type      TEXT        NOT NULL    -- 'status_change' | 'doc_requested' | 'doc_uploaded' | 'field_updated' | 'note_added'
actor_type      TEXT        NOT NULL    -- 'borrower' | 'mlo' | 'system'
actor_id        UUID        NULL        -- borrower or MLO id
old_value       TEXT        NULL
new_value       TEXT        NULL
details         JSONB       NULL        -- Additional context
created_at      TIMESTAMP   DEFAULT NOW()
```

### `documents`
```
id              UUID        PK
loan_id         UUID        FK → loans.id, NOT NULL
doc_type        TEXT        NOT NULL    -- 'pay_stub' | 'w2' | 'bank_statement' | 'tax_return' | 'id' | 'other'
label           TEXT        NOT NULL    -- Display name, e.g. "Most Recent Pay Stub"
status          TEXT        NOT NULL    -- 'requested' | 'uploaded' | 'reviewed' | 'accepted' | 'rejected'
requested_by    UUID        NULL        -- FK → mlos.id
file_url        TEXT        NULL        -- Vercel Blob URL or S3 URL
file_name       TEXT        NULL
file_size       INT         NULL
uploaded_at     TIMESTAMP   NULL
reviewed_at     TIMESTAMP   NULL
notes           TEXT        NULL        -- MLO notes on rejection, etc.
created_at      TIMESTAMP   DEFAULT NOW()
```

---

## Loan State Machine

```
                            ┌──────────────┐
                            │    draft      │  ← Borrower filling out form
                            └──────┬───────┘
                                   │ submit
                            ┌──────▼───────┐
                            │   applied     │  ← MLO reviews new app
                            └──────┬───────┘
                                   │ accept into pipeline
                            ┌──────▼───────┐
                            │  processing   │  ← MLO working the file
                            └──────┬───────┘
                                   │ submit to underwriting
                            ┌──────▼───────┐
                            │ submitted_uw  │  ← At the wholesale lender
                            └──────┬───────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │               │
             ┌──────▼───────┐ ┌───▼────────┐ ┌───▼──────┐
             │  cond_approved│ │  suspended  │ │  denied   │
             └──────┬───────┘ └────────────┘ └──────────┘
                    │ conditions cleared
             ┌──────▼───────┐
             │     ctc       │  ← Clear to Close
             └──────┬───────┘
                    │ closing docs sent
             ┌──────▼───────┐
             │   docs_out    │  ← Docs to title/escrow
             └──────┬───────┘
                    │ funded
             ┌──────▼───────┐
             │    funded     │  ← DONE
             └──────────────┘
```

### Valid Transitions
```javascript
const TRANSITIONS = {
  draft:          ['applied'],
  applied:        ['processing', 'denied'],
  processing:     ['submitted_uw', 'suspended', 'denied'],
  submitted_uw:   ['cond_approved', 'suspended', 'denied'],
  cond_approved:  ['ctc', 'suspended', 'denied'],
  suspended:      ['processing', 'submitted_uw', 'denied'],  // Can be re-activated
  ctc:            ['docs_out'],
  docs_out:       ['funded'],
  funded:         [],  // Terminal
  denied:         [],  // Terminal
};
```

### Ball-in-Court Rules
| Status | Ball | Why |
|--------|------|-----|
| draft | borrower | Filling out application |
| applied | mlo | New app needs review |
| processing | mlo | Working the file |
| submitted_uw | lender | Waiting on UW decision |
| cond_approved | mlo | Need to clear conditions |
| suspended | mlo | Need to resolve issues |
| ctc | mlo | Prep closing docs |
| docs_out | lender | At title/escrow |
| funded | — | Complete |
| denied | — | Complete |

*Ball shifts to `borrower` anytime docs are requested and pending upload.*

### Email Triggers
| Transition | Email to Borrower? | Subject |
|------------|-------------------|---------|
| draft → applied | ✅ | "Your application has been received" |
| applied → processing | ✅ | "Your loan is being processed" |
| processing → submitted_uw | ✅ | "Your loan has been submitted to underwriting" |
| submitted_uw → cond_approved | ✅ | "Conditional approval — we're almost there" |
| cond_approved → ctc | ✅ | "Clear to close — your loan is approved!" |
| ctc → docs_out | ✅ | "Closing documents have been sent" |
| docs_out → funded | ✅ | "Congratulations — your loan has funded!" |
| → denied | ✅ | "Update on your application" |
| → suspended | ✅ | "We need to discuss your application" |
| Doc requested | ✅ | "Document needed: {doc_label}" |

---

## Auth Model

### Borrowers: Magic Link + SMS Verification (Two-Factor)

**Pre-submission (filling out the form):** No auth required. Borrower is entering their own data — low risk.

**On first submission:**
1. Borrower fills out 6-step form (no login required)
2. Before saving: SMS verification code sent to their phone via Zoho Voice API
3. Borrower enters 6-digit code → phone verified → application saved → account created
4. Magic link sent to email: "Access your loan dashboard"

**Return visits (checking status, uploading docs):**
1. Borrower enters email at `/portal/auth/login`
2. Magic link sent to email → borrower clicks link
3. SMS verification code sent to phone on file
4. Borrower enters code → fully authenticated → dashboard

**Why two-factor:** The portal holds SSN, DOB, income, and financial declarations. Email-only auth means a compromised inbox exposes everything. Adding SMS verification (something they have) alongside email (something they access) provides real security. Every bank and lender portal does this.

**Why magic link + SMS (not password + SMS):** Borrowers interact with the portal maybe 5-10 times over 30 days. Password creation adds friction. They already trust email for lender communication. Magic link handles the "something you access" factor; SMS handles "something you have."

**SMS delivery:** Zoho Voice API (`POST /rest/json/v1/sms/send`, scope `ZohoVoice.sms.CREATE`). Uses David's existing Zoho Voice number — no new vendor, no Twilio.

**Token/code rules:**
- Magic link token: expires after 15 minutes, single-use
- SMS verification code: 6 digits, expires after 10 minutes, 3 attempts max then locked for 15 minutes
- Session: expires after 30 minutes of inactivity

### MLOs: Email + Password
- Traditional login at `/portal/mlo/login`
- Password hashed with bcrypt
- Session-based auth (httpOnly cookie)
- Session timeout: 60 minutes idle
- v1: David (admin) and Jamie (MLO) seeded via Prisma seed script. Password reset via CLI script.

### Admin
- Same as MLO but with `role: 'admin'`
- Admin sees all MLO pipelines. MLOs see only their own.
- Admin can reassign loans between MLOs.

### Implementation
- **NextAuth.js** with two providers:
  - `EmailProvider` for borrowers (magic link — first factor)
  - `CredentialsProvider` for MLOs
- **Custom SMS verification layer** on top of NextAuth (second factor for borrowers):
  - After magic link verification, session is marked `sms_pending`
  - Redirect to `/portal/auth/verify-phone` → sends SMS code via Zoho Voice
  - Code validated → session upgraded to `fully_authenticated`
  - Dashboard middleware blocks `sms_pending` sessions
- Session stored in database (not JWT — need server-side invalidation)
- Role field in session determines access level

---

## Route Structure

All portal routes live under `/portal` route group:

```
src/app/
├── (public)/              # Existing public pages (no change)
│   ├── page.js            # Homepage
│   ├── about/page.js
│   ├── services/page.js
│   ├── contact/page.js
│   └── rates/page.js
│
├── portal/
│   ├── layout.js          # Portal shell (auth check, nav)
│   ├── apply/
│   │   ├── page.js        # Step 1 (public — no auth to start)
│   │   ├── [step]/page.js # Steps 2-6 (dynamic route)
│   │   └── success/page.js
│   │
│   ├── dashboard/         # Borrower dashboard (auth required)
│   │   ├── page.js        # Status overview, doc uploads
│   │   └── documents/page.js
│   │
│   ├── mlo/               # MLO dashboard (auth required, role: mlo|admin)
│   │   ├── login/page.js
│   │   ├── page.js        # Pipeline view
│   │   ├── [loanId]/page.js  # Individual loan detail
│   │   └── admin/page.js  # Admin-only: all pipelines, metrics
│   │
│   └── auth/
│       ├── login/page.js  # Borrower magic link request
│       ├── verify/page.js       # Magic link callback
│       ├── verify-phone/page.js # SMS code entry (second factor)
│       └── signout/page.js
│
├── api/
│   ├── lead/route.js      # Existing Zoho CRM lead API
│   ├── auth/[...nextauth]/route.js  # NextAuth
│   ├── portal/
│   │   ├── apply/route.js         # Save/submit application
│   │   ├── loans/route.js         # GET loans (scoped by role)
│   │   ├── loans/[id]/route.js    # GET/PATCH individual loan
│   │   ├── loans/[id]/status/route.js  # PATCH status transition
│   │   ├── loans/[id]/docs/route.js    # GET/POST documents
│   │   ├── loans/[id]/pii/route.js     # GET decrypted SSN/DOB (MLO only, audit logged)
│   │   ├── loans/[id]/export/route.js  # GET XML export (MLO only, decrypts PII, audit logged)
│   │   ├── sms/send-code/route.js      # POST send SMS verification code via Zoho Voice
│   │   ├── sms/verify-code/route.js   # POST verify SMS code, upgrade session
│   │   └── notifications/route.js      # Send emails via Zoho Mail
```

---

## Tech Stack Additions

| What | Choice | Why |
|------|--------|-----|
| Database | **Vercel Postgres** | Already on Vercel, zero-config, Prisma compatible |
| ORM | **Prisma** | Type-safe queries, migration system, works great with Vercel Postgres |
| Auth | **NextAuth.js v4** | Mature, supports magic link + credentials, session management |
| File Storage | **Vercel Blob** | Stays in Vercel ecosystem, simple API, encrypted at rest |
| Email | **Zoho Mail API** | Already integrated on Mac, reuse OAuth flow |
| Forms | **React Hook Form** | Lightweight, great for multi-step wizards, validation |
| Validation | **Zod** | Schema validation for both client and API |

### New npm Dependencies
```
next-auth           # Auth framework
@prisma/client      # Database ORM
prisma              # Dev: migration CLI
@vercel/postgres    # Postgres driver
@vercel/blob        # File storage
react-hook-form     # Form management
zod                 # Schema validation
@hookform/resolvers # Zod ↔ React Hook Form bridge
bcrypt              # MLO password hashing
```

### New Vercel Environment Variables (David will need to set)
```
DATABASE_URL            # Vercel Postgres connection string (auto-set if using Vercel Postgres integration)
PII_ENCRYPTION_KEY      # 256-bit hex key for SSN/DOB encryption (generate with: openssl rand -hex 32)
NEXTAUTH_SECRET         # NextAuth session encryption key (generate with: openssl rand -hex 32)
NEXTAUTH_URL            # https://netratemortgage.com
ZOHO_MAIL_REFRESH_TOKEN # For sending notification emails (scope: ZohoMail.messages.CREATE)
ZOHO_VOICE_REFRESH_TOKEN # For SMS verification codes (scope: ZohoVoice.sms.CREATE)
ZOHO_VOICE_SENDER_NUMBER # David's existing Zoho Voice phone number (e.g. +13035551234)
```

---

## PII Encryption — SSN & DOB

SSN and DOB are collected in the application form and must be available for XML export to wholesale lenders. They require application-level encryption beyond the database's at-rest encryption.

### Approach: AES-256-GCM (Envelope Encryption)

```
Borrower types SSN → HTTPS (in transit) → API route encrypts → stores ciphertext in Postgres
MLO requests SSN → API route decrypts → returns to authenticated MLO session
XML export → API route decrypts → includes plaintext in XML payload → MLO downloads
```

**Encryption key:** A 256-bit key stored as `PII_ENCRYPTION_KEY` in Vercel environment variables. Never in code, never in git.

**Algorithm:** AES-256-GCM (authenticated encryption — tamper-proof). Each value gets a unique IV (initialization vector) stored alongside the ciphertext.

**Storage format:** `base64(iv):base64(ciphertext):base64(authTag)` — single TEXT column per encrypted field.

**What gets encrypted at the application level:**
| Field | Column | Plaintext Stored? |
|-------|--------|-------------------|
| SSN | `borrowers.ssn_encrypted` | NO — only last 4 digits in `ssn_last_four` for display masking |
| DOB | `borrowers.dob_encrypted` | NO |

**Decryption access rules:**
- **Borrower dashboard:** Shows `***-**-{last4}` for SSN, does NOT decrypt. Shows DOB normally (decrypted).
- **MLO loan detail:** Shows `***-**-{last4}` by default. "Reveal SSN" button triggers decryption + audit log entry.
- **XML export:** Decrypts SSN and DOB to include in the lender submission file. Logs the export event in `loan_events`.
- **API responses:** SSN is NEVER returned in standard loan GET responses. Requires a separate `GET /api/portal/loans/[id]/pii` endpoint with explicit auth + audit logging.

**Key rotation:** If `PII_ENCRYPTION_KEY` ever needs to rotate, a migration script re-encrypts all values with the new key. Old key kept in `PII_ENCRYPTION_KEY_OLD` during transition.

### Implementation (Node.js)
```javascript
// lib/encryption.js
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.PII_ENCRYPTION_KEY, 'hex'); // 32 bytes

export function encrypt(plaintext) {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag().toString('base64');
  return `${iv.toString('base64')}:${encrypted}:${authTag}`;
}

export function decrypt(stored) {
  const [ivB64, ciphertext, authTagB64] = stored.split(':');
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const decipher = createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

---

## Security Checklist (from Brief)

| Requirement | How |
|-------------|-----|
| PII encrypted at rest | Vercel Postgres encrypts at rest by default. SSN and DOB additionally encrypted at the application level with AES-256-GCM before storage. |
| No PII in URL params | All sensitive data in POST bodies, never query strings. SSN never in any GET response by default. |
| Auth required | NextAuth middleware on `/portal/dashboard/*` and `/portal/mlo/*` |
| Role-based access | MLO sees own loans via `WHERE mlo_id = session.user.id`. Admin has no filter. |
| Audit trail | `loan_events` table logs every mutation with who/when. SSN reveal and XML export explicitly logged. |
| Two-factor auth | Borrowers: magic link (email) + SMS verification code (phone) via Zoho Voice. Both required for dashboard access. |
| Session timeouts | NextAuth session maxAge: 30min (borrower), 60min (MLO) |
| SMS brute-force protection | 3 attempts max, then 15-minute lockout. Codes expire after 10 minutes. |
| HTTPS only | Vercel enforces HTTPS. `secure` flag on auth cookies. |
| SSN masking | Displayed as `***-**-1234` everywhere. MLO can reveal with explicit click (logged). |
| XML export security | Export decrypts PII server-side, generates file, delivers to authenticated MLO. Export event logged in audit trail. |

---

## XML Export

MLOs need to export loan application data as XML files for submission to wholesale lenders. The export must include decrypted PII (SSN, DOB) since lenders require it.

### Format
Start with a simplified MISMO-compatible structure. MISMO (Mortgage Industry Standards Maintenance Organization) is the industry standard, but the full spec is enormous. v1 targets a practical subset:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<LOAN_APPLICATION>
  <BORROWER>
    <FIRST_NAME>John</FIRST_NAME>
    <LAST_NAME>Doe</LAST_NAME>
    <SSN>123-45-6789</SSN>
    <DOB>1985-03-15</DOB>
    <EMAIL>john@example.com</EMAIL>
    <PHONE>303-555-1234</PHONE>
    <MARITAL_STATUS>Married</MARITAL_STATUS>
    <DEPENDENTS>2</DEPENDENTS>
    <CURRENT_ADDRESS>
      <STREET>123 Main St</STREET>
      <CITY>Denver</CITY>
      <STATE>CO</STATE>
      <ZIP>80202</ZIP>
      <YEARS>5</YEARS>
    </CURRENT_ADDRESS>
  </BORROWER>
  <PROPERTY>
    <PURPOSE>Purchase</PURPOSE>
    <OCCUPANCY>PrimaryResidence</OCCUPANCY>
    <TYPE>SingleFamily</TYPE>
    <ADDRESS>...</ADDRESS>
    <PURCHASE_PRICE>450000.00</PURCHASE_PRICE>
    <DOWN_PAYMENT>90000.00</DOWN_PAYMENT>
  </PROPERTY>
  <EMPLOYMENT>
    <STATUS>Employed</STATUS>
    <EMPLOYER_NAME>Acme Corp</EMPLOYER_NAME>
    <POSITION>Engineer</POSITION>
    <YEARS_IN_POSITION>3</YEARS_IN_POSITION>
    <MONTHLY_BASE_INCOME>8500.00</MONTHLY_BASE_INCOME>
    <OTHER_MONTHLY_INCOME>500.00</OTHER_MONTHLY_INCOME>
    <PRESENT_HOUSING_EXPENSE>2100.00</PRESENT_HOUSING_EXPENSE>
  </EMPLOYMENT>
  <DECLARATIONS>
    <OUTSTANDING_JUDGMENTS>false</OUTSTANDING_JUDGMENTS>
    <BANKRUPTCY>false</BANKRUPTCY>
    <FORECLOSURE>false</FORECLOSURE>
    <!-- ... -->
  </DECLARATIONS>
  <METADATA>
    <LOAN_ID>uuid</LOAN_ID>
    <APPLICATION_DATE>2026-02-23</APPLICATION_DATE>
    <MLO_NAME>David Burson</MLO_NAME>
    <MLO_NMLS>2531189</MLO_NMLS>
    <COMPANY_NMLS>2531165</COMPANY_NMLS>
  </METADATA>
</LOAN_APPLICATION>
```

### Access
- **Route:** `GET /api/portal/loans/[id]/export` (MLO/admin auth required)
- **Process:** Fetches loan + borrower → decrypts SSN/DOB → builds XML → returns as file download
- **Audit:** Every export logged in `loan_events` with `event_type: 'xml_export'`
- **Future:** If specific lenders need exact MISMO 3.x format, we adjust the XML template per lender

---

## Build Order (Suggested)

Phase 2a — Foundation (this sprint):
1. Install dependencies (Prisma, NextAuth, etc.)
2. Set up Prisma schema + Vercel Postgres connection
3. Run initial migration
4. Set up NextAuth with magic link + credentials providers
5. Create `/portal` route group with layout

Phase 2b — Application Form:
6. Build multi-step wizard component
7. Build all 6 form steps
8. Create `/api/portal/apply` endpoint (save draft + submit)
9. Create borrower account on submission + send magic link

Phase 2c — Borrower Dashboard:
10. Build borrower dashboard (status view)
11. Build document upload flow
12. Integrate Zoho Mail API for notifications

Phase 2d — MLO Dashboard:
13. Build MLO login + dashboard
14. Build loan detail view with status transitions (including SSN reveal with audit)
15. Build document request flow
16. Build XML export endpoint (decrypts PII, generates lender XML)
17. Build admin view (all pipelines)

---

## Decisions Log (Resolved)

| # | Question | Decision | Date |
|---|----------|----------|------|
| 1 | Database | Vercel Postgres + Prisma | Feb 23 |
| 2 | Email sender | New alias (e.g. `portal@netratemortgage.com`) via Zoho Mail API. David to create alias + grant token with `ZohoMail.messages.CREATE` scope. | Feb 23 |
| 3 | MLO accounts | Hard-coded seed (David = admin, Jamie = MLO). Admin user management deferred to v2. | Feb 23 |
| 4 | File storage | Vercel Blob | Feb 23 |
| 5 | Domain routing | `netratemortgage.com/portal/*` (path-based, same domain) | Feb 23 |
| 6 | Borrower auth | Magic link (email) + SMS verification (phone) — two-factor. SMS via Zoho Voice API using David's existing Zoho Voice number. | Feb 23 |
| 7 | SMS provider | Zoho Voice (existing) — no Twilio. Scope: `ZohoVoice.sms.CREATE`. | Feb 23 |

## Pre-Build Setup (David needs to do before Phase 2a)

1. **Vercel Postgres** — Add Postgres integration in Vercel dashboard (creates DATABASE_URL automatically)
2. **PII Encryption Key** — Generate with `openssl rand -hex 32`, set as `PII_ENCRYPTION_KEY` in Vercel env vars
3. **NextAuth Secret** — Generate with `openssl rand -hex 32`, set as `NEXTAUTH_SECRET` in Vercel env vars
4. **Zoho Mail alias** — Create `portal@netratemortgage.com` (or similar) in Zoho Mail admin
5. **Zoho Mail grant token** — Self Client, scope `ZohoMail.messages.CREATE,ZohoMail.accounts.READ` → exchange for refresh token → set as `ZOHO_MAIL_REFRESH_TOKEN`
6. **Zoho Voice grant token** — Self Client, scope `ZohoVoice.sms.CREATE` → exchange for refresh token → set as `ZOHO_VOICE_REFRESH_TOKEN`
7. **Zoho Voice sender number** — Set as `ZOHO_VOICE_SENDER_NUMBER` in Vercel env vars

*Items 4-7 can be done when we reach Phase 2b/2c. Only items 1-3 are needed for Phase 2a.*

---

*Plan approved in principle. All architecture questions resolved. Ready for Phase 2a when David gives the go-ahead.*
