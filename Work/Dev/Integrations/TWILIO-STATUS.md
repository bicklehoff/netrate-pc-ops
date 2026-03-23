# Twilio Integration — Status Tracker

**Last Updated:** 2026-03-23
**Status:** ACCOUNT REACTIVATED — Campaign needs resubmission

---

## Account Details

| Field | Value |
|-------|-------|
| **Login email** | david@cmglending.com (CMG account — NOT Locus) |
| **Account SID** | ACc65dbcde3c13ff402fcf2b68903921d0 |
| **Auth Token** | 32d4d0af844adc0a9923b885d51f4e9e |
| **Project Name** | "My New Learn & Explore Project" (default Twilio name, never renamed) |
| **Account Created** | January 4, 2019 |
| **Organization SID** | OR6a5f1ff00a284f95a0a760ce2a8f2fbc |
| **Phone Number** | +1 (720) 573-1236 — "NetRate Dialer Line" |
| **Verify Service SID** | VAb786cd9a62980a26c54c2e9a5469b2a0 |
| **API Key** | SKc21b... (for Voice/SMS dialer) |
| **TwiML App SID** | AP0916... (for voice) |

### CRITICAL: Login Info
- **USE THE CMG LOGIN** (david@cmglending.com) — this is the active account
- The Locus login (david@locusmortgage.com or similar) shows "No Accounts Yet" — it's empty
- The CMG account shows as "My New Learn & Explore Project" in the project dropdown — this IS correct
- Confirmed 2026-03-23: phone number, webhooks, messaging services all on this account

### Other Accounts (DO NOT USE)
- **Locus Twilio login** — empty, no accounts, no phone numbers
- **Legacy messaging service** MG3616763c3ac75396136fc3efe558ec34 "CMGLending" from 2022 — not A2P registered
- **Sole Proprietor service** MGe994627c4f75eea4a98ac541b9cccf9f — not A2P registered, unused

---

## Zoho Voice (Alternative SMS Provider)

David also has a **Zoho Voice** account with an approved A2P campaign. This was originally planned for borrower portal SMS verification before we switched to Twilio Verify.

| Field | Value |
|-------|-------|
| **Zoho Voice Refresh Token** | NOT CONFIGURED (empty in .env) |
| **Zoho Voice Sender Number** | NOT CONFIGURED (empty in .env) |
| **Status** | David has an approved campaign but env vars never set up on PC |

**TODO:** David needs to provide Zoho Voice credentials if we want a fallback SMS provider. The approved Zoho Voice campaign could serve as a reference for what language/format gets approved — useful when resubmitting Twilio A2P.

---

## Phone Numbers

| Number | Name | Purpose | Messaging Service |
|--------|------|---------|-------------------|
| +1 (720) 573-1236 | NetRate Dialer Line | Voice dialer + SMS | Low Volume Mixed A2P Messaging Service |

**Voice webhook:** POST https://www.netratemortgage.com/api/dialer/incoming
**Messaging:** Routed through "Low Volume Mixed A2P Messaging Service" (MG0eb6cca59bd54081d648905dbe9ce469)

Note: There was originally a SECOND phone number purchased during early campaign attempts. The first campaign was on the wrong number/service, so we started fresh with the current setup. Only one active number now.

---

## A2P 10DLC Campaign — Full Timeline

### Brand Registration
- **Brand SID:** BN833ac569c1da950777cb4f5eedf3cfc2
- **TCR ID:** BE8HMXR
- **Entity:** Locus Companies LLC (legal name — DBA NetRate Mortgage)
- **Status:** APPROVED, identity VERIFIED

### Campaign Submissions (5 attempts = $53.50 in registration fees @ $10.70 each)

#### Attempt 1 — ~March 2, 2026
- **Status:** FAILED
- **Error:** 30896 — MESSAGE_FLOW rejected
- **Cause:** Website was behind password wall. Twilio reviewer could not access /contact, /privacy, /terms pages to verify opt-in language.
- **Fix applied:** Opened /contact, /privacy, /terms through password wall middleware

#### Attempt 2 — March 13, 2026
- **Status:** FAILED (eventually)
- **Error:** 30896 — MESSAGE_FLOW still rejected
- **Cause:** Updated MESSAGE_FLOW to reference https://www.netratemortgage.com/contact as publicly accessible opt-in page. Added OptInKeywords (START, YES) and OptInMessage. But may have still been insufficient.
- **Fix applied:** Added visible SMS consent checkbox to /contact form

#### Attempt 3 — March 18, 2026
- **Status:** FAILED
- **Error:** 30908 — Privacy policy cannot be verified
- **Cause:** Account was SUSPENDED for lack of funds during review period. Twilio reviewer could not verify privacy policy because API auth was failing.
- **Note:** The privacy policy at /privacy DOES have a compliant Text Messaging section with opt-in, opt-out (STOP), frequency, data rates disclosures.

#### Attempts 4 & 5 — Dates unknown
- **Status:** FAILED
- **Details:** Two additional submission attempts were charged ($10.70 each) but details not recorded. These may have been duplicate submissions or earlier attempts before Attempt 1.

#### Current State (as of 2026-03-23)
- **Campaign SID:** QE2c6890da8086d771620e9b13fadeba0b
- **Status:** FAILED (last rejection: Error 30908)
- **Account Status:** REACTIVATED (funds added 2026-03-23)
- **Next Step:** Resubmit campaign (will cost another $10.70)

### Campaign Configuration (current submission)
```
Use case: LOW_VOLUME
Message flow: "End users opt in via an optional checkbox on our Contact form at https://www.netratemortgage.com/contact..."
Has embedded links: false
Has embedded phone: true
Help keywords: HELP, INFO
Opt-in keywords: START, YES
Opt-out keywords: OPTOUT, CANCEL, END, QUIT, UNSUBSCRIBE, REVOKE, STOP, STOPALL
```

### Message Samples (current submission)
1. "Hi, this is David from NetRate Mortgage. Your loan documents have been received and are now in underwriting review."
2. "Thanks for requesting a rate quote from NetRate Mortgage! Based on your info, we are seeing some great options. Reply YES or call 303-444-5251."
3. "Reminder: Your closing is scheduled for tomorrow at 2pm. Please bring your ID and certified funds. Questions? Call 303-444-5251."
4. "Your NetRate Mortgage verification code is: 123456. This code expires in 10 minutes."
5. "Rates moved this week. Your personalized dashboard has been updated with new options. Reply STOP to opt out."

---

## What We Use Twilio For

1. **Borrower Portal SMS Verification (2FA)** — Twilio Verify service sends OTP codes for borrower login. Route: POST /api/portal/sms/send-code and /api/portal/sms/verify-code. Uses TWILIO_VERIFY_SERVICE_SID.

2. **Voice Dialer** — MLO portal has a browser-based dialer for calling borrowers. Uses Twilio Voice SDK, TwiML App, API Key/Secret. Routes: /api/dialer/token, /api/dialer/voice, /api/dialer/incoming, /api/dialer/call-complete, /api/dialer/recording-status, /api/dialer/voicemail.

3. **SMS Sending** — Outbound SMS from dialer. Route: /api/dialer/sms/send. Uses messaging service for A2P compliance.

4. **A2P Campaign** — Required for sending any SMS to US numbers. Without approved campaign, SMS is blocked or throttled.

---

## Billing

- **Monthly recurring:** ~$10.70/mo A2P registration fee + $1.15/mo phone number = ~$11.85/mo
- **Account suspended 2026-03-23** due to $0 balance. Funds added to reactivate.
- **Total spent on failed campaign submissions:** $53.50 (5 × $10.70)
- **Auto-recharge:** CHECK IF ENABLED — set up auto-recharge to prevent future suspension

---

## Before Resubmitting Campaign — Checklist

DO NOT resubmit until ALL of these are verified:

- [ ] Account is active and funded (check balance)
- [ ] Auto-recharge enabled (prevent future suspension)
- [ ] /contact page is publicly accessible (not behind password wall) — test: `curl -s -o /dev/null -w "%{http_code}" https://www.netratemortgage.com/contact`
- [ ] /privacy page is publicly accessible — test: `curl -s -o /dev/null -w "%{http_code}" https://www.netratemortgage.com/privacy`
- [ ] /terms page is publicly accessible — test: `curl -s -o /dev/null -w "%{http_code}" https://www.netratemortgage.com/terms`
- [ ] Privacy policy has Text Messaging section with: opt-in language, STOP opt-out, frequency disclosure, data rates
- [ ] Contact form has visible SMS consent checkbox (unchecked by default)
- [ ] Review David's Zoho Voice approved campaign for comparison language
- [ ] MESSAGE_FLOW description matches what's actually on the website

---

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/twilio-verify.js` | Verify API (OTP send/check) |
| `src/lib/twilio-voice.js` | Voice SDK integration |
| `src/app/api/portal/sms/send-code/route.js` | Send verification code |
| `src/app/api/portal/sms/verify-code/route.js` | Check verification code |
| `src/app/api/dialer/` | All voice/SMS dialer routes |
| `src/middleware.js` | Password wall — must allow /contact, /privacy, /terms through |
| `.env` | Local credentials |

---

## Lessons Learned

1. **Always check account balance before submitting campaigns** — suspension during review = automatic failure + wasted $10.70
2. **Set up auto-recharge** — $10.70/mo A2P fee will drain prepaid balance
3. **Verify all URLs are accessible** before submission — curl test each one
4. **Save everything to this file** — don't scatter Twilio info across MCP thoughts
5. **The CMG login is the right one** — "My New Learn & Explore Project" is misleading but correct
6. **Each failed submission costs $10.70** — don't resubmit without verifying all checklist items
