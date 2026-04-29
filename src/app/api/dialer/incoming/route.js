import { validateTwilioSignature, twilioForbiddenResponse } from '@/lib/twilio-validate';
import { buildIncomingTwiml } from '@/lib/twilio-voice';
import sql from '@/lib/db';
import { normalizePhone } from '@/lib/normalize-phone';
import { DEFAULT_ORG_ID } from '@/lib/constants/org';
import { sendPushToStaff } from '@/lib/push';

export async function POST(req) {
  const formData = await req.formData();
  const params = Object.fromEntries(formData.entries());
  const { valid } = validateTwilioSignature(req, params);
  if (!valid) return twilioForbiddenResponse();
  const from = formData.get('From');       // Caller's phone number
  const to = formData.get('To');           // Your Twilio number
  const callSid = formData.get('CallSid');

  const normalizedFrom = normalizePhone(from);
  const normalizedTo = normalizePhone(to);

  // Look up the caller in contacts
  let callerName = null;
  let contactId = null;
  if (normalizedFrom) {
    try {
      const rows = await sql`SELECT id, first_name, last_name FROM contacts WHERE phone = ${normalizedFrom} LIMIT 1`;
      if (rows.length) {
        callerName = `${rows[0].first_name} ${rows[0].last_name}`.trim() || null;
        contactId = rows[0].id;
      }
    } catch (e) {
      console.error('Incoming contact lookup failed:', e);
    }
  }

  // Route to the MLO who owns this Twilio number. Falls back to any active
  // staff member if the number isn't mapped (shouldn't happen in prod).
  let targetIdentity = 'mlo-default';
  let fallbackNumber = null;
  let greetingUrl = null;
  let mloId = null;
  try {
    let mlos = normalizedTo
      ? await sql`SELECT id, phone, voicemail_greeting_url, voicemail_exception_url, voicemail_mode, dnd_enabled, call_forward_enabled, call_forward_number FROM staff WHERE twilio_phone_number = ${normalizedTo} AND is_active = true LIMIT 1`
      : [];
    if (!mlos.length) {
      mlos = await sql`SELECT id, phone, voicemail_greeting_url, voicemail_exception_url, voicemail_mode, dnd_enabled, call_forward_enabled, call_forward_number FROM staff WHERE is_active = true ORDER BY created_at LIMIT 1`;
    }
    if (mlos.length > 0) {
      mloId = mlos[0].id;
      targetIdentity = `mlo-${mloId}`;
      fallbackNumber = mlos[0].phone || null;

      // Resolve greeting URL from voicemail mode
      const mode = mlos[0].voicemail_mode || 'standard';
      if (mode === 'exception' && mlos[0].voicemail_exception_url) {
        greetingUrl = mlos[0].voicemail_exception_url;
      } else if (mode === 'auto') {
        greetingUrl = null; // forces Alice TTS fallback
      } else {
        greetingUrl = mlos[0].voicemail_greeting_url || null;
      }

      // ─── Self-cell short-circuit ────────────────────────────
      // If the inbound From is the MLO's own cell, this is a forwarding
      // loop — the MLO dialed their cell from the dialer, the cell
      // carrier forwarded the unanswered ring back to their Twilio DID,
      // and routing it normally would re-ring the browser Client (busy
      // with the outbound) AND re-ring the cell via the parallel-dial
      // Number leg (independent call, no parent linkage to the outbound),
      // making the phone ring forever after MLO hangs up the dock leg.
      //
      // Hang up immediately. Don't ring anyone.
      //
      // Trade-off: this also blocks the "MLO calls own DID from own cell
      // to test inbound" workflow. Replacement: AudioSettings gear has a
      // "Test inbound call" button that uses the Twilio API to place a
      // test call directly to the MLO's Voice Client identity — fully
      // scriptable, no cell carrier involvement, tests browser-side
      // pipeline + Accept/Decline buttons end-to-end. Use that instead.
      if (fallbackNumber && normalizedFrom === fallbackNumber) {
        try {
          await sql`
            INSERT INTO call_logs (organization_id, mlo_id, contact_id, direction, from_number, to_number, status, twilio_call_sid)
            VALUES (${DEFAULT_ORG_ID}, ${mloId}, ${contactId}, 'inbound', ${normalizedFrom || from || ''}, ${normalizedTo || to || ''}, 'self-loop-dropped', ${callSid})
          `;
        } catch (e) {
          console.error('Failed to log self-loop drop:', e);
        }
        const loopTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Hangup />
</Response>`;
        return new Response(loopTwiml, { headers: { 'Content-Type': 'text/xml' } });
      }

      // ─── DND — skip ring, go straight to voicemail ─────────
      if (mlos[0].dnd_enabled) {
        await sql`
          INSERT INTO call_logs (organization_id, mlo_id, contact_id, direction, from_number, to_number, status, twilio_call_sid)
          VALUES (${DEFAULT_ORG_ID}, ${mloId}, ${contactId}, 'inbound', ${normalizedFrom || from || ''}, ${normalizedTo || to || ''}, 'voicemail', ${callSid})
        `;
        const dndTwiml = buildIncomingTwiml(null, callerName, null, contactId, greetingUrl, true);
        return new Response(dndTwiml, { headers: { 'Content-Type': 'text/xml' } });
      }

      // ─── Unconditional call forwarding ──────────────────────
      if (mlos[0].call_forward_enabled && mlos[0].call_forward_number) {
        await sql`
          INSERT INTO call_logs (organization_id, mlo_id, contact_id, direction, from_number, to_number, status, twilio_call_sid)
          VALUES (${DEFAULT_ORG_ID}, ${mloId}, ${contactId}, 'inbound', ${normalizedFrom || from || ''}, ${normalizedTo || to || ''}, 'forwarded', ${callSid})
        `;
        const fwdTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${normalizedTo || to}">${mlos[0].call_forward_number}</Dial>
</Response>`;
        return new Response(fwdTwiml, { headers: { 'Content-Type': 'text/xml' } });
      }

      await sql`
        INSERT INTO call_logs (organization_id, mlo_id, contact_id, direction, from_number, to_number, status, twilio_call_sid)
        VALUES (${DEFAULT_ORG_ID}, ${mloId}, ${contactId}, 'inbound', ${normalizedFrom || from || ''}, ${normalizedTo || to || ''}, 'ringing', ${callSid})
      `;
    }
  } catch (e) {
    console.error('MLO lookup failed:', e);
  }

  // Fire push notification to the MLO's installed PWA devices (iPhone, Mac).
  // Awaited so the serverless function doesn't terminate before the HTTP request
  // to the push service completes. sendPushToStaff never throws — worst case
  // returns {sent:0, failed:N, pruned:0}. Typical latency <500ms; does not
  // meaningfully delay call routing.
  if (mloId) {
    const pushPayload = {
      title: callerName ? `Call from ${callerName}` : 'Incoming call',
      body: normalizedFrom || from || 'Unknown number',
      url: contactId ? `/portal/mlo/contacts/${contactId}` : '/portal/mlo',
      tag: callSid, // coalesces with any later updates for the same call
    };
    await sendPushToStaff(mloId, pushPayload);
  }

  const twiml = buildIncomingTwiml(targetIdentity, callerName, fallbackNumber, contactId, greetingUrl);
  return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
}
