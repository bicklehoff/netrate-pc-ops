# REGISTRY — NetRate Mortgage Site

Component inventory for dev sessions. One line per item. Updated by dev sessions when features are added.

## API Routes

### Public
- `GET /api/rates` — rate table with LLPA adjustments
- `POST /api/lead` — lead capture (homepage, rate tool, contact form)
- `GET /api/site-access` — site access restrictions

### Auth
- `GET|POST /api/auth/[...nextauth]` — NextAuth (MLO credentials, borrower magic link)
- `POST /api/portal/auth/magic-link` — send borrower magic link
- `POST /api/portal/auth/verify` — verify magic link token
- `POST /api/portal/sms/send-code` — borrower SMS OTP
- `POST /api/portal/sms/verify-code` — verify SMS code

### Borrower Portal
- `GET /api/portal/loans` — borrower's loans
- `GET /api/portal/loans/[id]/docs` — loan documents
- `GET /api/portal/loans/[id]/checklist` — borrower-facing checklist (doc requests + conditions + submission status)
- `POST /api/portal/apply` — submit loan application

### MLO Portal — Pipeline & Loans
- `GET /api/portal/mlo/pipeline` — loan pipeline (filterable)
- `GET|POST /api/portal/mlo/loans/[id]` — loan detail CRUD
- `GET|POST /api/portal/mlo/loans/[id]/dates` — loan milestone dates
- `GET|POST /api/portal/mlo/loans/[id]/docs` — document requests/uploads
- `GET|POST /api/portal/mlo/loans/[id]/files` — WorkDrive file browser (list, upload, download, delete)
- `POST /api/portal/mlo/loans/[id]/files/create-folder` — create WorkDrive subfolders (FLOOR, SUBMITTED, EXTRA, CLOSING)
- `POST /api/portal/mlo/loans/[id]/files/move` — move files between folder tabs
- `GET|POST /api/portal/mlo/loans/[id]/conditions` — loan conditions CRUD (stage, status, blocking, borrower-facing)
- `GET|POST /api/portal/mlo/loans/[id]/payroll` — CD metadata + payroll snapshot
- `GET /api/portal/mlo/loans/[id]/ssn` — decrypt borrower SSN (audit logged)
- `GET /api/portal/mlo/loans/[id]/xml` — export MISMO XML
- `POST /api/portal/mlo/loans/import` — import from LDox

### MLO Portal — Leads
- `GET|POST /api/portal/mlo/leads` — lead list / create
- `GET|POST /api/portal/mlo/leads/[id]` — lead detail CRUD

### MLO Portal — Tickets (Backlog)
- `GET|POST /api/portal/mlo/tickets` — ticket list / create
- `GET|POST /api/portal/mlo/tickets/[id]` — ticket detail CRUD
- `POST /api/portal/mlo/tickets/[id]/entries` — add comment/status update

### MLO Portal — HECM
- `GET|POST /api/portal/mlo/hecm-scenarios` — scenario list / create
- `GET|POST /api/portal/mlo/hecm-scenarios/[id]` — scenario detail CRUD
- `GET /api/portal/mlo/treasury-rates` — treasury rate data

### Dialer (Twilio)
- `POST /api/dialer/token` — Twilio Voice access token
- `POST /api/dialer/incoming` — inbound call webhook
- `POST /api/dialer/voice` — TwiML call flow
- `POST /api/dialer/voicemail` — voicemail transcription webhook
- `POST /api/dialer/call-complete` — call completion webhook
- `POST /api/dialer/recording-status` — recording availability webhook
- `GET|POST /api/dialer/calls` — call history / create
- `POST /api/dialer/calls/[id]/notes` — call disposition
- `GET|POST /api/dialer/contacts` — contact list / create
- `GET|POST /api/dialer/contacts/[id]` — contact detail CRUD
- `POST /api/dialer/contacts/search` — search contacts
- `POST /api/dialer/sms/send` — send SMS
- `POST /api/dialer/sms/incoming` — inbound SMS webhook
- `POST /api/dialer/sms/status` — SMS delivery webhook

### Market Watch
- `GET /api/rates/history` — rate history data from rate_history table
- `POST /api/rates/snapshot` — take daily rate snapshot (cron job)

### CoreBot
- `POST /api/corebot/ingest` — receives loan data from Zoho Flow (LDox → Core)
- `POST /api/corebot/process` — batch doc processing (scan FLOOR, identify via Claude, rename, update conditions)
- `POST /api/corebot/identify` — single file identification (suggest doc type without auto-rename)
- `POST /api/corebot/rename` — single file rename per naming protocol
- `POST /api/corebot/order-out` — send branded vendor order emails (title, appraisal, HOI, flood cert)

## UI Pages

### Public
- `/` — homepage (rate table, market ticker, trust bar, lead capture)
- `/rates` — rate tool (scenario form → results → comparison)
- `/services` — services overview
- `/about` — about NetRate
- `/contact` — contact form (with SMS opt-in checkbox)
- `/terms` — terms of service
- `/privacy` — privacy policy (includes SMS sharing verbiage)
- `/do-not-sell` — CCPA opt-out
- `/licensing` — NMLS / state licensing
- `/accessibility` — accessibility statement
- `/tools/hecm-optimizer` — borrower-facing HECM calculator

### Borrower Portal
- `/portal/auth/login` — magic link + SMS login
- `/portal/auth/verify` — magic link verification
- `/portal/auth/verify-phone` — SMS OTP entry
- `/portal/dashboard` — borrower loan dashboard
- `/portal/apply` — multi-step loan application (6 steps)
- `/portal/apply/success` — application confirmation

### MLO Portal
- `/portal/mlo/login` — MLO login (credentials)
- `/portal/mlo` — MLO dashboard (pipeline overview, dialer)
- `/portal/mlo/pipeline` — full pipeline table
- `/portal/mlo/loans/[id]` — loan detail (unified view with sections)
- `/portal/mlo/leads` — leads table
- `/portal/mlo/backlog` — dev backlog (tickets for Website/Portal/CoreBot)
- `/portal/mlo/backlog/[id]` — ticket detail
- `/portal/mlo/marketing` — marketing assets
- `/portal/mlo/gbp-checklist` — processing checklist
- `/portal/mlo/tools/hecm-optimizer` — MLO HECM calculator

## Database Models (Prisma)

### Users
- `Borrower` — borrower profile, encrypted PII (SSN/DOB), magic link auth
- `Mlo` — loan officer, email/password auth, LDox integration, NMLS
- `Contact` — dialer CRM record (name, phone, company, tags)

### Loans
- `Loan` — primary loan record (status, property, employment, LDox/WorkDrive links)
- `LoanBorrower` — co-borrower junction (per-borrower address/employment/declarations)
- `LoanDates` — milestone dates (lock, appraisal, title, closing, funding)
- `LoanEvent` — audit trail (status changes, doc uploads, SSN reveals)
- `LoanNote` — operational notes (by MLO/borrower/system, pinnable)
- `LoanTask` — per-loan tasks (priority: today/tomorrow/later)
- `Condition` — underwriting conditions (stage, blocking, borrower-facing)
- `Document` — document request/upload (WorkDrive + Blob URLs)

### Communications
- `CallLog` — call record (Twilio SID, recording, duration)
- `CallNote` — post-call disposition
- `SmsMessage` — SMS record (inbound/outbound, delivery status)

### Rates
- `Lender` — wholesale lender master (fees, lock extensions)
- `RateSheet` — rate sheet per lender/type/date (LLPA as JSONB)
- `RateRow` — individual rate option (rate, 30-day price, 45-day price)
- `RateHistory` — daily rate snapshots (raw SQL table, not Prisma-managed)

### CRM & Leads
- `Lead` — website lead (source, UTM, Zoho sync)
- `HecmScenario` — saved HECM optimizer scenario

### Backlog
- `Ticket` — dev ticket (product: Website/Portal/CoreBot, type: bug/feature/improvement)
- `TicketEntry` — ticket comment/status update (author: david/pc-dev/mlo)

## Key Integrations
- **Twilio** — Voice SDK + Verify (dialer, SMS OTP) → `src/lib/twilio-voice.js`, `src/lib/twilio-verify.js`
- **Zoho WorkDrive** — loan document storage (OAuth) → `src/lib/zoho-workdrive.js`
- **Zoho CRM** — lead sync → `src/app/api/lead/route.js`
- **Google Cloud Storage** — rate sheet storage → `src/lib/gcs.js`
- **LendingDocs (LDox)** — loan processing, MISMO XML → `src/lib/mismo-parser.js`
- **CoreBot** — doc processing engine (Claude API + WorkDrive) → `src/lib/corebot/processor.js`, `src/lib/corebot/prompts.js`
- **Resend** — outbound email (order-outs, borrower notifications) → `src/lib/email-templates/order-outs.js`
- **Claude API** — document identification brain for CoreBot → `@anthropic-ai/sdk`
- **NextAuth** — auth (magic link + credentials) → `src/lib/auth.js`
- **PII Encryption** — AES-256-GCM for SSN/DOB → `src/lib/encryption.js`
- **Microsoft Clarity** — session recordings + heatmaps → layout.js (ID: vv85vtrn77)

## Key Components

### CoreBot
- `DocWorkspace` — intelligent doc workspace for MLOs (submission checklist, FLOOR identify/rename, folder tabs, file move)
- `WorkDrivePanel` — file browser with FLOOR/SUBMITTED/EXTRA/CLOSING tabs (upload, download, delete per folder)
- `BorrowerChecklist` — borrower-facing checklist (needed items with upload, received items with green check)

### Constants
- `src/lib/constants/doc-types.js` — 3-letter prefix naming protocol (APP, AST, CRD, DOC, HOI, INC, INV, LND, LOE, PUR, TTL)
- `src/lib/constants/submission-checklists.js` — submission checklists by loan type and purpose
- `src/lib/constants/loan-types.js` — loan type picklist
- `src/lib/constants/lenders.js` — lender picklist

## Scripts
- `scripts/parse-amwest-xlsx.js` — parse AmWest rate sheet XLSX into rate rows
- `scripts/parse-sunwest-xlsx.js` — parse Sunwest rate sheet XLSX (current default lender)
- `scripts/upload-to-gcs.js` — upload rate JSON to GCS
- `scripts/backlog.js` — CLI backlog viewer (reads tickets from Neon)
- `scripts/create-rate-history.js` — create rate_history table (raw SQL, bypasses Prisma)

## Recent Additions (last 5)
1. **Market Watch Phase A** — rate_history table, daily snapshot job, /api/rates/history endpoint
2. **GCS Market Data** — homepage market ticker/trends wired to GCS market.json with static fallback
3. **Sunwest Rate Parser** — replaced AmWest with Sunwest as default lender, 25bps March promo
4. **Clarity + GA4 Events** — Microsoft Clarity tracking + GA4 custom conversion events
5. **CoreBot Phases 4-6** — order-outs, doc workspace (DocWorkspace replacing WorkDrivePanel), borrower checklist
