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

## Zoho Voice 10DLC — APPROVED (Reference for Twilio Resubmission)

David got a Zoho Voice 10DLC campaign approved in January 2026 after a lengthy back-and-forth with Zoho support (ticket #150515754). This is the template for what works.

| Field | Value |
|-------|-------|
| **Zoho Voice Refresh Token** | NOT CONFIGURED (empty in .env) |
| **Zoho Voice Sender Number** | NOT CONFIGURED (empty in .env) |
| **Support contact** | Sujin + Naveen Kumar, Technical Support Engineers, support@zohovoice.com |
| **Ticket #** | 150515754 |
| **Status** | APPROVED — SMS enabled Jan 12, 2026 |
| **Fees** | Brand creation $4 + Campaign registration $30 = $34 one-time |

### Zoho Voice Approval Timeline (Dec 2025 — Jan 2026)

1. **Dec 4, 2025** — David submitted initial request. Described opt-in flow: BankingBridge embedded form on landing page, SMS consent language below form, Privacy Policy with dedicated "Text Messaging (SMS)" section.
2. **Dec 5, 2025** — Zoho reviewer (DineshKumar) said opt-in form link was broken ("page can't be found"). Also requested specific privacy policy verbiage (see below).
3. **Dec 15, 2025** — David followed up.
4. **Dec 16, 2025** — Naveen Kumar said "Contact Us page is still not live" — locusmortgage.com/rate-quote was down.
5. **Dec 18, 2025** — David sent new link. Naveen asked "where can we find the SMS opt-in consent?"
6. **Dec 19, 2025** — David pointed to privacy policy at locusmortgage.com/privacy-policy-2/ with full Text Messaging section.
7. **Dec 22, 2025** — Naveen said "we do not see the SMS opt-in on your website. We need an option where clients can view the SMS opt-in and check a box."
8. **Dec 23, 2025** — David explained the BankingBridge form is the only place phone numbers are collected, and it has the opt-in built in.
9. **Dec 30, 2025** — Naveen provided screenshot template showing required checkbox format and exact wording (see below).
10. **Dec 31, 2025** — David added the required language and links to locusmortgage.com/stay-in-touch/. Confirmed: checkbox is optional, unchecked by default, phone field is optional, disclosure includes STOP/HELP/frequency/rates + Privacy Policy + Terms links.
11. **Jan 4, 2026** — Zoho requested specific privacy policy verbiage about SMS data sharing (see below). Also confirmed fees: $4 brand + $30 campaign.
12. **Jan 5, 2026** — David confirmed charges, added privacy policy verbiage. Sent link to updated privacy policy at locusmortgage.com/privacy-policy-2/.
13. **Jan 6, 2026** — Zoho initiated 10DLC process. "Takes 3-4 weeks, submitted to local carriers."
14. **Jan 9, 2026** — Zoho asked David to open Zoho Voice > call config > initiate SMS request. David had trouble with dropdown showing no numbers.
15. **Jan 11, 2026** — Sujin confirmed SMS request was initiated, said she'd process and enable it.
16. **Jan 12, 2026** — David confirmed. SMS enabled.

### EXACT Privacy Policy Verbiage That Got Approved (MUST INCLUDE)

Zoho explicitly required this language in the privacy policy (red text in their email):

> "We will not share your opt-in to an SMS campaign with any third party for purposes unrelated to providing you with the services of that campaign. We may share your Personal Data, including your SMS opt-in or consent status, with third parties that help us provide our messaging services, including but not limited to platform providers, phone companies, and any other vendors who assist us in the delivery of text messages.
>
> All the above categories exclude text messaging originator opt-in data and consent; this information will not be shared with any third parties."

### EXACT Checkbox Language That Got Approved

From Zoho's template (Dec 30 email):

> "(with an optional check box) By clicking here you consent to receive SMS Customer care and Marketing SMS from [Brand name]. Message frequency may vary. Standard Message and Data Rates may apply. Reply STOP to opt out. Reply Help for help. [privacy policy URL as a hyperlink] [terms URL as a hyperlink]."

Requirements:
- Checkbox must be **optional** and **unchecked by default**
- Phone number field must be **optional**
- Disclosure must include: STOP/HELP, frequency, data rates
- Must link to Privacy Policy and Terms as hyperlinks

### David's Approved Opt-In Page Description

From David's Dec 4, 2025 email to Zoho:

> "Users come to our mortgage quote landing page and submit the embedded BankingBridge form, which collects their name, email, and mobile number. Directly below this form on our site we display the required SMS consent language, including brand name, message type, frequency, STOP/HELP instructions, and a link to our Privacy Policy."

### What the Privacy Policy Needed (that got approved)

The approved privacy policy at locusmortgage.com/privacy-policy-2/ included:
- **TEXT MESSAGING (SMS) AND PHONE COMMUNICATIONS** section header
- When we collect phone numbers (form submission, partner forms, explicit opt-in)
- What messages we send (inquiry, rate quotes, status updates, service notifications, marketing)
- **Message Frequency and Charges** — frequency varies, msg & data rates may apply
- **How to Opt Out** — reply STOP, or call/email to remove
- **Consent Not Required for Credit** — explicit statement
- **How We Share SMS Data** — third-party providers for delivery only, NOT for their own marketing
- The specific Zoho-required verbiage about not sharing opt-in with third parties

### Key Lessons from Zoho Approval Process

1. **The opt-in page must be LIVE and accessible** — reviewers actually visit the URL
2. **A visible checkbox is required** — even if the form is from a third party (BankingBridge), there must be a checkbox ON YOUR SITE
3. **Privacy policy must have a dedicated SMS section** — not just a general data collection clause
4. **Specific verbiage about SMS data sharing is REQUIRED** — the red text above is mandatory
5. **The reviewer will go back and forth 5+ times** — it took David 6 weeks and 16 exchanges
6. **Broken links = immediate rejection** — every URL must resolve

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
