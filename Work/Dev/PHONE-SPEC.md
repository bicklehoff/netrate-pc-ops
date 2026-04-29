# Phone App — Full Feature Spec
**Model:** RingCentral  
**Status:** Phase 1 complete (PR #281)

---

## Feature Map

### ✅ Built (Phase 1 — PRs #273, #276, #280, #281)

| Feature | Where |
|---|---|
| Outbound calls | DialerProvider → /api/dialer/voice |
| Inbound calls (browser + cell parallel ring) | /api/dialer/incoming + buildIncomingTwiml |
| Hold / Mute | ActiveCall.js (SDK-level) |
| Blind transfer | ActiveCall.js → /api/dialer/transfer → Twilio REST |
| Conference / Add Call | ActiveCall.js → /api/dialer/conference → Twilio REST |
| Dual-channel call recording | buildOutboundTwiml (record-from-answer-dual) |
| Call history | /api/dialer/calls + CallHistory.js |
| Call notes | /api/dialer/calls/[id]/notes |
| Token 3-layer refresh | DialerProvider (interval + tokenWillExpire + 31205) |
| **Voicemail inbox** | VoicemailInbox.js → /api/dialer/voicemails |
| **Voicemail transcription** | /api/dialer/voicemail/transcription |
| **3 voicemail modes** | staff.voicemail_mode (auto / standard / exception) |
| **Standard greeting recording** | VoicemailInbox → /api/dialer/voicemail/record-greeting |
| **Exception greeting recording** | Same route, type=exception param |
| **Greeting playback in portal** | GreetingPlayer component |
| **Greeting confirmation polling** | VoicemailInbox polls /api/dialer/voicemail/greeting-status |
| **DND (Do Not Disturb)** | PhoneSettings → staff.dnd_enabled → incoming route skips ring |
| **Unconditional call forwarding** | PhoneSettings → staff.call_forward_number |
| **SMS auto-reply** | PhoneSettings → staff.sms_auto_reply_* → sms/incoming |
| **Phone Settings tab** | PhoneSettings.js → /api/dialer/settings |
| SMS threads (send/receive) | SmsThread.js + /api/dialer/sms/* |
| MMS (inbound + outbound) | Vercel Blob re-hosting |

---

## Voicemail Modes

| Mode | Behavior |
|---|---|
| `auto` | Alice TTS fallback — "You've reached NetRate Mortgage…" |
| `standard` | MLO's recorded greeting (`staff.voicemail_greeting_url`) |
| `exception` | OOO/extended absence greeting (`staff.voicemail_exception_url`) |

Mode is set per-MLO on `staff.voicemail_mode`. Changed in the Voicemail tab mode selector.

---

## Call Routing — Incoming Call Priority

1. Self-loop protection (From == MLO's cell → hangup)
2. DND enabled → skip ring, go straight to voicemail
3. Call forwarding enabled → `<Dial callerId=...>forward_number</Dial>`
4. Normal routing → `<Dial><Client>mlo-id</Client><Number>cell</Number></Dial>`
5. No answer after 30s → voicemail TwiML (greeting + `<Record>`)

---

## Transfer Flow

**Blind transfer (implemented):**
1. MLO clicks "Transfer" in ActiveCall → enters destination number
2. Browser calls `POST /api/dialer/transfer { callSid, to }`
3. Server POSTs to Twilio REST `Calls/{callSid}` with redirect URL
4. Twilio fetches `/api/dialer/twiml/transfer?to={number}` → `<Dial>{number}</Dial>`
5. Original caller bridges to destination; browser leg disconnects

**Warm transfer (future):** Same as conference + MLO drops themselves after introduction.

---

## Conference Flow

**Add Call / Merge (implemented):**
1. MLO clicks "Add Call" → enters third-party number
2. Browser calls `POST /api/dialer/conference { callSid, to }`
3. Server redirects original call into a named conference room
4. Server initiates outbound call to third party → also joins conference room
5. Browser's original leg disconnects (parent <Dial> ends)
6. Browser reconnects via `device.connect({ To: 'conference:{room}' })`
7. All three parties are in the conference

Note: conference reconnect uses the `/api/dialer/voice` TwiML route which detects the `conference:` prefix.

---

## SMS Auto-Reply

- Toggle per-MLO: `staff.sms_auto_reply_enabled`
- Custom message: `staff.sms_auto_reply_message`
- Rate limit: one auto-reply per sender phone number per 24 hours
- Tracked via `sms_messages.is_auto_reply = true`
- Does NOT send auto-reply to auto-replies (from_number check)

---

## DB Schema (migration 056)

```sql
-- staff table additions
voicemail_mode text DEFAULT 'standard'        -- auto | standard | exception
voicemail_exception_url text                  -- OOO greeting recording URL
voicemail_exception_until date                -- optional return date (UI future)
sms_auto_reply_enabled boolean DEFAULT false
sms_auto_reply_message text
call_forward_enabled boolean DEFAULT false
call_forward_number text
dnd_enabled boolean DEFAULT false

-- sms_messages addition
is_auto_reply boolean DEFAULT false
```

---

## Phase 2 (Future)

- **Warm transfer** — dial out, introduce, drop self (uses conference internally)
- **Real hold with music** — Twilio REST call redirect to hold TwiML; resume reconnects to conference
- **Exception until date** — date picker in UI, `voicemail_exception_until` already in DB
- **DND schedule** — time-based DND (e.g., after 5 PM weekdays)
- **Voicemail delete** — PATCH call_logs to remove
- **Bulk mark all heard** — single PATCH request
- **Call flip** — move in-progress call from browser to cell
