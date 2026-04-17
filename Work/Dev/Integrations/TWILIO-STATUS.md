# Twilio Integration — Status Tracker

**Last Updated:** 2026-04-17 (Dialer restored — Vercel AUTH_TOKEN space fixed)

---

## UPDATE 2026-04-17 — Dialer Restored + SMS Ticket Filed

### Dialer fix (config-only, no code change)

Site dialer was broken with `ConnectionError (31005): Error sent from gateway in HANGUP` when placing calls. Root cause: Vercel's `TWILIO_AUTH_TOKEN` env var had a stray whitespace character, causing `validateTwilioSignature` (added in PR #52 security hotfix) to return 403 on all Twilio-originated webhooks.

**Diagnostic steps used (replicable for next time):**
1. Tried dialer → saw 31005 in browser
2. Pulled Twilio call events: `POST /api/dialer/voice → 403`, `POST /api/dialer/status → 403`
3. Signed a test request with local `TWILIO_AUTH_TOKEN` (which I'd verified works against Twilio's REST API all session) and hit production endpoint directly → also 403 → confirmed Vercel's value differed from the real auth token
4. David re-pasted AUTH_TOKEN value in Vercel without the space, redeployed

**Also during session:** flipped `TWILIO_PHONE_NUMBER` env var from `+17205731236` → `+13034445251` so outbound dialer calls show David's ported business line as caller ID. This was intentional — not a fix, but aligning caller ID with the ported business number.

**Verified working 2026-04-17 13:59 UTC:** 11-second outbound call placed via dialer, caller ID showed +13034445251, both `/api/dialer/voice` and `/api/dialer/status` returning 200.

**LESSON:** always trim whitespace on pasted env var values, especially when revealing/copying from Vercel UI. The eye-icon decrypt display can include invisible whitespace that tab-key or trailing spaces insert.

### SMS outbound status

Twilio support ticket **#26369980** filed P2 for TCR reconciliation of ported numbers — outbound SMS still returns 30034. Initial agent confirmed hypothesis (TCR hasn't released ported numbers from Zoho's prior A2P campaign). Awaiting carrier ops response.

Inbound SMS port completed overnight — Twilio receives inbound SMS cleanly, but the auto-reply + forward-to-David's-cell in TwiML Bin #2 still fails due to 30034. Will resolve once TCR reconciles.

**Zoho Voice cancellation still deferred** until outbound SMS confirmed working.

---

## CURRENT STATE (2026-04-16) — Ported Numbers Live, SMS Pending Carrier

### Port status
Port request submitted 2026-04-09 (PortRequestOnBoard-ACc65dbcde3c13ff402fcf2b68903921d0-1775762155) for Zoho Voice → Twilio on two numbers.

- **Voice port: COMPLETE** — verified via Twilio call log (inbound call from +17204998384 landed on +13034445251 at 2026-04-16 17:29:34Z and executed the TwiML Bin).
- **SMS port: NOT COMPLETE** — Twilio never saw the test inbound SMS. Carrier SMS routing still at old provider. Normal 24-72h lag after voice cutover.

### Phone number inventory (2026-04-16)
| Number | PN SID | Role | Voice URL | SMS URL | Messaging Svc |
|---|---|---|---|---|---|
| +13034445251 | PNacee4b99c76daebb769cc04a54c326ff | David's business line (ported) | TwiML Bin #1 | TwiML Bin #2 | MG9a4cff... |
| +17205061311 | PN0f4058c84e1edb4bf1c9442fb0b5d6ce | Jamie's line (ported) | TwiML Bin #1 | TwiML Bin #2 | MG9a4cff... |
| +17205731236 | PN58ea6d5dc83f2722fcfb591a2feb9dba | NetRate Dialer Line | site dialer | site dialer | MG9a4cff... |

### TwiML Bins created 2026-04-16
| # | SID | Purpose | URL |
|---|---|---|---|
| 1 | EH0e940a80c4ba202f049dc03f83c3eabc | `Fwd-Voice-to-David-Cell` — voice forward | https://handler.twilio.com/twiml/EH0e940a80c4ba202f049dc03f83c3eabc |
| 2 | EH4079dfa7a980a097203413b2d89079ce | `SMS-AutoReply-Forward-to-David` — SMS auto-reply + forward to cell | https://handler.twilio.com/twiml/EH4079dfa7a980a097203413b2d89079ce |

**Forward destination:** David's cell `+17204998384` (hard-coded in both Bins).

**Why TwiML Bins instead of site webhooks:** Site dialer is under audit/restructure (Site Audit 2026 D9 + portal rebuild). We moved ported numbers off site code so changes to the dialer can't break David/Jamie call routing.

**Bin #1 TwiML:**
```xml
<Response>
  <Dial timeout="25" answerOnBridge="true">
    <Number>+17204998384</Number>
  </Dial>
</Response>
```

**Bin #2 TwiML:**
```xml
<Response>
  <Message to="+17204998384">From {{From}} to {{To}}: {{Body}}</Message>
  <Message>Thanks for texting NetRate Mortgage. We got your message and will respond shortly. For immediate help please call.</Message>
</Response>
```

### A2P 10DLC — ported numbers reassigned
Port auto-assigned both ported numbers to the **dead** messaging service `MG0eb6cca59bd54081d648905dbe9ce469` (old Locus brand — brand + campaign were deleted 2026-04-02). Outbound SMS returned **error 30034 "message from unregistered number"**.

**Fix applied 2026-04-16:**
1. DELETE `/Services/MG0eb6cca.../PhoneNumbers/{pn}` on both ported numbers
2. POST `/Services/MG9a4cff.../PhoneNumbers` with PhoneNumberSid for both

After move, outbound SMS still returned 30034 — this is **A2P propagation lag at the carrier level**. Expected to clear within minutes to hours per Twilio support docs. If it still returns 30034 after 24h, escalate to Twilio support.

**Current A2P state (verified 2026-04-16):**
- Active messaging service: `MG9a4cff84c48e6540c709ff5e59f12e39` ("Low Volume Mixed A2P Messaging Service")
  - `use_inbound_webhook_on_number: true` — service defers inbound to each number's own SmsUrl → our TwiML Bin handles inbound when port completes
  - Phones: +17205731236, +13034445251, +17205061311
- Campaign: `QE2c6890da8086d771620e9b13fadeba0b` — status **VERIFIED** ✓
- Brand: `BN9b673f9a4e57fd7fd349d5edc2418e84` — NetRate Mortgage LLC, VERIFIED
- Use case: LOW_VOLUME (2000 msg/day cap — plenty of headroom)

> Note: `TWILIO_STATUS.md` line 7-8 called the campaign SID `CM7a8462a7c33e59df8a3ea3b610e0ff4a` but the actual A2P campaign SID on this messaging service per REST API is `QE2c6890da8086d771620e9b13fadeba0b`. The `QE` prefix is the Twilio Compliance Usa2p resource SID (internal); `CM` is the TCR campaign ID reference. Both refer to the same campaign.

### What to test next session (2026-04-17+)
Run these to confirm carrier-side changes landed:

```bash
# 1. Retest outbound SMS from Twilio (A2P propagation check)
#    Expected once propagation completes: status=delivered, no error 30034
cd /d/PROJECTS/netrate-pc-ops && set -a && . ./.env && set +a && node -e "
const sid = process.env.TWILIO_ACCOUNT_SID, token = process.env.TWILIO_AUTH_TOKEN;
const auth = 'Basic ' + Buffer.from(sid + ':' + token).toString('base64');
fetch('https://api.twilio.com/2010-04-01/Accounts/' + sid + '/Messages.json', {
  method: 'POST',
  headers: { Authorization: auth, 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ From: '+13034445251', To: '+17204998384', Body: 'Retest after A2P propagation' }).toString()
}).then(r=>r.json()).then(d=>console.log(JSON.stringify(d,null,2)));
"

# 2. David texts 303-444-5251 from his cell — check Twilio message log
#    Expected: inbound appears in log, auto-reply + forward fire
```

If both pass → SMS is fully live on Twilio → safe to cancel Zoho Voice.

### Zoho Voice cancellation — DEFERRED
Do NOT cancel Zoho Voice yet. Until SMS port completes, inbound texts to 303-444-5251 / 720-506-1311 are still landing at Zoho. Cancelling early would lose client SMS. Re-evaluate after SMS port is confirmed on Twilio.

**Zoho Voice account (for reference):** 17205061311, passcode 0000. Login `david@netratemortgage.com` per recent memory (was david@cmglending.com earlier).

---

## HISTORICAL: NEW BRAND + NEW CAMPAIGN UNDER REVIEW (Attempt 9)
- Old brand "Locus Companies, LLC" (BN833ac569c1da950777cb4f5eedf3cfc2) deleted. Old campaign (CMd3230a74143a2db28fcf459a27de0604) deleted.
- New brand: **NetRate Mortgage LLC** — Brand SID: BN9b673f9a4e57fd7fd349d5edc2418e84 | TCR ID: B9DIMGN | Status: Registered
- New campaign: Campaign SID: CM7a8462a7c33e59df8a3ea3b610e0ff4a | Status: VERIFIED (as of 2026-04-16)
- New messaging service: MG9a4cff84c48e6540c709ff5e59f12e39
- Trust Hub A2P Bundle SID: BUfb70ed0b042c6d1117a4bf33f7003dff
- Customer Profile SID: BUdcf0050723a1627790403f09f5aec130 (unchanged)
- Cost: $4.50 brand + $15 campaign vetting = $19.50

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
**Messaging:** Routed through "Low Volume Mixed A2P Messaging Service" (MG9a4cff84c48e6540c709ff5e59f12e39)
**Old messaging service:** MG0eb6cca59bd54081d648905dbe9ce469 (deleted with old brand)

Note: There was originally a SECOND phone number purchased during early campaign attempts. The first campaign was on the wrong number/service, so we started fresh with the current setup. Only one active number now.

---

## A2P 10DLC Campaign — Full Timeline

### Brand Registration (CURRENT — April 2, 2026)
- **Brand SID:** BN9b673f9a4e57fd7fd349d5edc2418e84
- **TCR ID:** B9DIMGN
- **Entity:** NetRate Mortgage LLC
- **Trust Hub A2P Bundle SID:** BUfb70ed0b042c6d1117a4bf33f7003dff
- **Customer Profile SID:** BUdcf0050723a1627790403f09f5aec130
- **Status:** REGISTERED
- **Cost:** $4.50

### Brand Registration (OLD — DELETED)
- **Brand SID:** BN833ac569c1da950777cb4f5eedf3cfc2
- **TCR ID:** BE8HMXR
- **Entity:** Locus Companies LLC (legal name — DBA NetRate Mortgage)
- **Status:** DELETED 2026-04-02

### Campaign Submissions (9 attempts = $100.60 total — 8 × $10.70 + 1 × $15.00)

#### Attempt 9 — April 2, 2026 (CURRENT — UNDER REVIEW)
- **Status:** UNDER REVIEW — new brand "NetRate Mortgage LLC", fresh campaign
- **Campaign SID:** CM7a8462a7c33e59df8a3ea3b610e0ff4a
- **Messaging Service:** MG9a4cff84c48e6540c709ff5e59f12e39
- **Brand:** NetRate Mortgage LLC (BN9b673f9a4e57fd7fd349d5edc2418e84)
- **Submitted:** 2026-04-02
- **What changed from attempt 8:**
  - Registered NEW brand as "NetRate Mortgage LLC" (LLC name changed from Locus Companies LLC)
  - Deleted old brand + old campaign + old messaging service entirely
  - Fresh campaign under new brand — all config identical to attempt 8
  - Phone number (+17205731236) re-linked to new messaging service
  - 5 samples submitted (was 4 in attempt 8)
- **Cost:** $4.50 (brand) + $15.00 (campaign vetting) = $19.50

#### Attempt 8 — April 1, 2026 (DELETED — replaced by attempt 9)
- **Status:** DELETED — old brand "Locus Companies, LLC" couldn't be renamed
- **Campaign SID:** QE2c6890da8086d771620e9b13fadeba0b (deleted)
- **Submitted:** 2026-04-01
- **Fixes applied:**
  - Checked "Direct Lending or Loan Arrangement" content attribute (cause of attempt 7 instant rejection)
  - Set Privacy Policy URL to `https://www.netratemortgage.com/privacy` (was placeholder `example.com`)
  - Set Terms URL to `https://www.netratemortgage.com/terms` (was placeholder `example.com`)
  - Phone numbers removed from samples (attempts 6-7 fix carried forward)
  - Sample 5 slot left empty (4 samples submitted)
- **Cost:** $10.70

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

#### Attempt 7 — March 26, 2026 (FAILED — confirmed 2026-03-31)
- **Status:** FAILED (same-day rejection)
- **Campaign SID:** QE2c6890da8086d771620e9b13fadeba0b
- **Submitted:** 2026-03-26T21:25:25Z | **Rejected:** 2026-03-26T21:25:25Z (instant)
- **Error:** 30895 — "The campaign submission cannot be verified because direct lending or loan arrangement campaign and content attribute was not selected."
- **Field flagged:** USE_CASE_DESCRIPTION
- **Root cause:** Campaign does not have the TCR "direct lending" content attribute set. NetRate is a direct lender/mortgage arranger — TCR requires this be explicitly declared in the campaign.
- **Fix needed:** UPDATE the existing campaign via Twilio Console — do NOT delete and resubmit (wastes $10.70). Go to Messaging → A2P 10DLC → Campaigns → QE2c6890... → Edit. Check the "Direct Lending or Loan Arrangement" content attribute checkbox. Also remove phone numbers from message samples (303-444-5251 in samples 2 & 3 sets `has_embedded_phone: true`).
- **Cost:** $10.70 wasted (instant rejection counted as submission)

#### Attempt 6 — March 23, 2026 (FAILED)
- **Status:** FAILED
- **Campaign SID:** QE2c6890da8086d771620e9b13fadeba0b
- **Submitted:** 2026-03-23T20:36:14Z — rejected same day
- **Error:** 30896 — opt-in information rejected
- **Field flagged:** USE_CASE_DESCRIPTION (new — previous attempts failed on MESSAGE_FLOW)
- **Root cause:** USE_CASE_DESCRIPTION did not mention opt-in method. Text said only what messages are sent, not how users consent. Twilio reviewers need opt-in language in the description itself.
- **Fix needed:** Rewrite USE_CASE_DESCRIPTION to explicitly mention: explicit opt-in via unchecked checkbox on Contact form, URL, and consent mechanism. Remove embedded phone number from message samples (303-444-5251 in sample 2 triggers has_embedded_phone:true flag).
- **Suggested description:** "NetRate Mortgage LLC (NMLS #1111861) sends SMS to mortgage borrowers and leads who have explicitly opted in via an unchecked checkbox on the Contact form at netratemortgage.com/contact. Use cases: loan status updates, document requests, closing reminders, 2FA verification codes, rate alerts, and customer service. All recipients provide explicit written consent prior to receiving messages."

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
- **Total spent on failed campaign submissions:** $74.90 (7 × $10.70)
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
