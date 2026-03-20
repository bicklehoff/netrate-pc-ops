# Twilio Integration — Reference

## Account

- **Account:** cmglending (david@cmglending.com) — pay-as-you-go
- **Account SID:** ACc65dbcde3c13ff402fcf2b68903921d0
- **Phone Number:** (720) 573-1236 / +17205731236 (Denver, CO)

## Provisioned Resources

| Resource | SID |
|---|---|
| API Key | SKc21bc57a7a8fe1b510b15ccc33c29632 |
| TwiML App | AP0916cc46f898751b521cdd90d18e7d6f |
| Verify Service | VAb786cd9a62980a26c54c2e9a5469b2a0 |

## Webhook URLs

All must use `www.netratemortgage.com` (not bare domain — Vercel redirects bare → www, causing 405).

| Webhook | URL |
|---|---|
| TwiML App Voice | `https://www.netratemortgage.com/api/dialer/voice` |
| TwiML App Status | `https://www.netratemortgage.com/api/dialer/status` |
| Phone Voice | `https://www.netratemortgage.com/api/dialer/incoming` |
| Phone SMS | `https://www.netratemortgage.com/api/dialer/sms/incoming` |
| Phone SMS Status | `https://www.netratemortgage.com/api/dialer/sms/status` |

## Features

- **Voice:** Outbound calls from MLO portal dialer (working as of Mar 2)
- **SMS:** Send/receive (pending A2P 10DLC registration)
- **2FA:** Borrower phone verification via Verify Service (pending integration)

## Pending

- A2P 10DLC SMS registration ($15-50, 10-15 day approval) — required for SMS at scale
- `NEXT_PUBLIC_APP_URL` env var needed in Vercel for SMS status callbacks
- Inbound call testing
- Old locusmortgage phone (720) 292-2558 will expire (unpaid trial)

## Code

- `src/lib/twilio-voice.js` — Voice API, TwiML generation
- `src/lib/twilio-verify.js` — SMS 2FA via Verify
- `src/app/api/dialer/` — All webhook handlers
- `src/components/Portal/Dialer/` — Client-side dialer UI

## Environment Variables

`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_API_KEY`, `TWILIO_API_SECRET`, `TWILIO_TWIML_APP_SID`, `TWILIO_PHONE_NUMBER`, `TWILIO_VERIFY_SERVICE_SID`
