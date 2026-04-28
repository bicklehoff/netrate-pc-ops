// DialerProvider — React Context for Twilio Voice Device management
// Wraps the MLO portal to provide calling state everywhere.
//
// Responsibilities:
// - Fetches Twilio access token on mount
// - Initializes Twilio Voice Device (WebRTC)
// - Manages active call state (connected, muted, on hold, etc.)
// - Handles incoming call events
// - Provides dial/hangup/mute/hold actions to child components

'use client';

import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { playSmsChime } from '@/lib/sms-chime';

const DialerContext = createContext(null);

export function useDialer() {
  const ctx = useContext(DialerContext);
  if (!ctx) throw new Error('useDialer must be used within DialerProvider');
  return ctx;
}

// Call states
const IDLE = 'idle';
const CONNECTING = 'connecting';
const RINGING = 'ringing';
const IN_PROGRESS = 'in-progress';
const INCOMING = 'incoming';

// localStorage keys for per-device audio routing prefs (persist across reloads)
const LS_RINGTONE = 'dialer.audio.ringtoneDeviceId';
const LS_SPEAKER = 'dialer.audio.speakerDeviceId';
const LS_INPUT = 'dialer.audio.inputDeviceId';

// localStorage keys for SMS notification prefs
const LS_SMS_POPUP = 'dialer.sms.popupEnabled';
const LS_SMS_SOUND = 'dialer.sms.soundEnabled';
const LS_SMS_BADGE = 'dialer.sms.badgeEnabled';

// SMS poll cadence — 10s matches the existing per-thread poll in SmsThread.
// Tighter cadences trade CPU/network for latency; the OS push (path B)
// covers the case where the tab is closed entirely.
const SMS_POLL_INTERVAL_MS = 10_000;

// Auto-dismiss the in-tab SMS popup after this long. Long enough to read,
// short enough to clear on its own when the user is away from the desk.
const SMS_POPUP_TTL_MS = 10_000;

// BroadcastChannel name shared across all DialerProvider instances on the
// same origin (main portal + dock + any other windows). Primary broadcasts
// state changes; passive instances listen + send actions back.
const BC_CHANNEL_NAME = 'netrate-dialer';

// BroadcastChannel message types
const BC_STATE_UPDATE = 'state';        // primary → passive
const BC_ACTION_ANSWER = 'answer';      // passive → primary
const BC_ACTION_DECLINE = 'decline';    // passive → primary
const BC_ACTION_HANGUP = 'hangup';      // passive → primary
const BC_ACTION_DIAL = 'dial';          // passive → primary
const BC_ACTION_TOGGLE_MUTE = 'toggleMute';  // passive → primary
const BC_REQUEST_STATE = 'requestState';     // passive → primary (on connect)

const readLS = (key) => {
  if (typeof window === 'undefined') return null;
  try { return window.localStorage.getItem(key); } catch { return null; }
};
const writeLS = (key, value) => {
  if (typeof window === 'undefined') return;
  try {
    if (value == null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch { /* ignore quota / privacy mode */ }
};

export default function DialerProvider({ children, mode = 'primary' }) {
  // Passive surfaces (dock, future read-only views) skip Device registration
  // and SMS polling. They mirror state from the primary instance via
  // BroadcastChannel and dispatch user actions back to primary.
  const isPrimary = mode !== 'passive';
  const isPassive = !isPrimary;
  const [deviceReady, setDeviceReady] = useState(false);
  const [callState, setCallState] = useState(IDLE);
  const [activeCall, setActiveCall] = useState(null);     // Twilio Call object
  const [incomingCall, setIncomingCall] = useState(null);  // Incoming Call object
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [callerInfo, setCallerInfo] = useState(null);      // { name, phone, contactId }
  const [recentInboundCall, setRecentInboundCall] = useState(null); // sticky context after cell pickup / caller hangup
  const [error, setError] = useState(null);

  // Audio device routing — lets MLO send the ringer to desk speakers while
  // the call audio stays on the headset. Persisted per-browser via localStorage.
  const [audioDevices, setAudioDevices] = useState({ inputs: [], outputs: [] });
  const [ringtoneDeviceId, setRingtoneDeviceIdState] = useState(null);
  const [speakerDeviceId, setSpeakerDeviceIdState] = useState(null);
  const [inputDeviceId, setInputDeviceIdState] = useState(null);
  const [outputSelectionSupported, setOutputSelectionSupported] = useState(false);

  // SMS notification state — populated when the polling loop detects a new
  // inbound message and the user's settings allow surfacing it.
  const [incomingSms, setIncomingSms] = useState(null);   // { contactId, contactName, phone, body, at }
  const [smsUnreadCount, setSmsUnreadCount] = useState(0);
  const [smsPopupEnabled, setSmsPopupEnabledState] = useState(true);
  const [smsSoundEnabled, setSmsSoundEnabledState] = useState(true);
  const [smsBadgeEnabled, setSmsBadgeEnabledState] = useState(true);

  const deviceRef = useRef(null);
  const timerRef = useRef(null);
  const identityRef = useRef(null);
  const smsLastSeenAtRef = useRef(null); // ISO ts of newest inbound seen so far
  const smsPopupTimerRef = useRef(null);
  const ringtoneDeviceIdRef = useRef(null); // mirrors state for use inside polling closure
  const smsPopupEnabledRef = useRef(true);
  const smsSoundEnabledRef = useRef(true);
  const smsBadgeEnabledRef = useRef(true);
  const bcRef = useRef(null); // BroadcastChannel for cross-window sync

  // ─── BroadcastChannel — cross-window state sync ───────────
  // Primary broadcasts state changes; passive instances listen and mirror.
  // Both modes also listen for action messages from the other side
  // (passive → primary: "answer this call"; primary → passive: state delta).
  useEffect(() => {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel(BC_CHANNEL_NAME);
    bcRef.current = ch;
    return () => {
      ch.close();
      bcRef.current = null;
    };
  }, []);

  // Duration timer
  const startTimer = useCallback(() => {
    setCallDuration(0);
    timerRef.current = setInterval(() => {
      setCallDuration((d) => d + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Initialize Twilio Device — primary only. Passive surfaces (dock) skip
  // this so they don't collide with the main portal's registration.
  // Twilio's rule: most-recent registration with the same identity wins;
  // older ones get unregistered. With this guard, only ONE Device per
  // browser per identity is alive at a time — owned by the main portal.
  useEffect(() => {
    if (isPassive) return; // dock + read-only surfaces don't touch Twilio
    let mounted = true;

    async function initDevice() {
      try {
        // Dynamically import Twilio Voice SDK (client-side only)
        const { Device } = await import('@twilio/voice-sdk');

        // Fetch access token from our API
        const res = await fetch('/api/dialer/token', { method: 'POST' });
        if (!res.ok) throw new Error('Failed to get token');
        const { token, identity } = await res.json();
        identityRef.current = identity;

        // Create and register the Device
        // - allowIncomingWhileBusy: critical for the parallel-dial pattern. The
        //   SDK's default rejects new incoming calls with "600 Busy Everywhere"
        //   if it thinks the Device has any active call (including phantom calls
        //   from previously-orphaned outbound attempts). Setting true tells the
        //   SDK to deliver incoming events even when busy, so the IncomingCallPopup
        //   can decide what to do. Was the root cause of the never-rings bug.
        // - logLevel: 'debug' temporarily so the SDK exposes registration / call
        //   delivery details in the browser console while we shake out remaining
        //   edge cases. Revert to 'warn' once incoming is solid.
        const device = new Device(token, {
          edge: 'ashburn',    // US East — closest to Neon DB
          logLevel: 'debug',
          allowIncomingWhileBusy: true,
        });

        device.on('registered', () => {
          if (mounted) {
            setDeviceReady(true);
            setError(null);
            console.log('[Dialer] Twilio Device registered, identity:', identityRef.current);
          }
        });

        device.on('unregistered', () => {
          // Fires when the WSS drops or registration is invalidated. Without
          // this, the UI shows "Online" forever even after the Device goes deaf.
          console.warn('[Dialer] Twilio Device UNREGISTERED — incoming calls will fail until re-registered');
          if (mounted) setDeviceReady(false);
        });

        device.on('error', (err) => {
          console.error('[Dialer] Twilio Device error:', err);
          if (mounted) setError(err.message);
        });

        device.on('incoming', (call) => {
          console.log('[Dialer] Incoming call received from SDK:', call?.parameters?.From, 'CallSid:', call?.parameters?.CallSid);
        });

        // Handle incoming calls
        device.on('incoming', (call) => {
          if (mounted) {
            setIncomingCall(call);
            setCallState(INCOMING);

            // Extract caller info from TwiML <Parameter>s emitted by
            // /api/dialer/incoming → buildIncomingTwiml
            const callerName = call.customParameters?.get('callerName');
            const contactId = call.customParameters?.get('contactId');
            const info = {
              name: callerName || null,
              phone: call.parameters?.From || 'Unknown',
              contactId: contactId || null,
            };
            setCallerInfo(info);
            // Populate sticky record immediately — persists through 'cancel'
            // (cell answered or caller hung up) so the MLO still has context
            setRecentInboundCall({ ...info, at: Date.now() });

            // CRITICAL: wire lifecycle listeners on the Call NOW, not on accept.
            // If the user doesn't accept, the Call still emits cancel/reject when
            // the caller hangs up or times out. Without these listeners, our React
            // state never clears AND the SDK keeps the Call in its internal busy
            // state, causing the next incoming to be rejected with "600 Busy
            // Everywhere". This was the secondary cause of the never-rings bug —
            // first call worked after refresh, all subsequent calls busy.
            call.on('cancel', () => {
              console.log('[Dialer] Incoming call cancelled (caller hung up or timed out)');
              if (mounted) {
                setIncomingCall(null);
                setCallState(IDLE);
                setCallerInfo(null);
              }
            });
            call.on('reject', () => {
              console.log('[Dialer] Incoming call rejected');
              if (mounted) {
                setIncomingCall(null);
                setCallState(IDLE);
                setCallerInfo(null);
              }
            });
            call.on('disconnect', () => {
              console.log('[Dialer] Incoming call disconnected');
              if (mounted) {
                setIncomingCall(null);
                setActiveCall(null);
                setCallState(IDLE);
                setCallerInfo(null);
              }
            });
          }
        });

        // Token refresh before expiry
        device.on('tokenWillExpire', async () => {
          try {
            const res = await fetch('/api/dialer/token', { method: 'POST' });
            const { token: newToken } = await res.json();
            device.updateToken(newToken);
          } catch (e) {
            console.error('Token refresh failed:', e);
          }
        });

        // Wire audio routing — split ringtone (e.g. desk speakers) from
        // call speaker (e.g. headset). Twilio Voice SDK exposes this on
        // device.audio; the browser must support setSinkId for output
        // selection to work (Chrome/Edge yes, Safari no as of writing).
        if (device.audio) {
          const supported = !!device.audio.isOutputSelectionSupported;
          if (mounted) setOutputSelectionSupported(supported);

          const refreshDevices = () => {
            const inputs = [];
            const outputs = [];
            try {
              device.audio.availableInputDevices.forEach((d, id) => {
                inputs.push({ deviceId: id, label: d.label || 'Microphone' });
              });
              device.audio.availableOutputDevices.forEach((d, id) => {
                outputs.push({ deviceId: id, label: d.label || 'Speaker' });
              });
            } catch (e) {
              console.warn('[Dialer] Failed to enumerate audio devices:', e);
            }
            if (mounted) setAudioDevices({ inputs, outputs });
          };

          // Apply persisted prefs. If a saved deviceId is no longer present
          // (headset unplugged since last session), fall back to default.
          const applySaved = () => {
            const savedRing = readLS(LS_RINGTONE);
            const savedSpeaker = readLS(LS_SPEAKER);
            const savedInput = readLS(LS_INPUT);

            const outputIds = new Set();
            try { device.audio.availableOutputDevices.forEach((_, id) => outputIds.add(id)); } catch {}
            const inputIds = new Set();
            try { device.audio.availableInputDevices.forEach((_, id) => inputIds.add(id)); } catch {}

            if (supported && savedRing && outputIds.has(savedRing)) {
              try { device.audio.ringtoneDevices.set(savedRing); } catch (e) { console.warn('[Dialer] ringtone set failed:', e); }
              if (mounted) setRingtoneDeviceIdState(savedRing);
            }
            if (supported && savedSpeaker && outputIds.has(savedSpeaker)) {
              try { device.audio.speakerDevices.set(savedSpeaker); } catch (e) { console.warn('[Dialer] speaker set failed:', e); }
              if (mounted) setSpeakerDeviceIdState(savedSpeaker);
            }
            if (savedInput && inputIds.has(savedInput)) {
              try { device.audio.setInputDevice(savedInput); } catch (e) { console.warn('[Dialer] input set failed:', e); }
              if (mounted) setInputDeviceIdState(savedInput);
            }
          };

          refreshDevices();
          applySaved();

          // Re-enumerate when devices are plugged/unplugged.
          device.audio.on('deviceChange', () => {
            refreshDevices();
            applySaved();
          });
        }

        await device.register();
        deviceRef.current = device;
      } catch (e) {
        console.error('Device init failed:', e);
        if (mounted) setError(e.message);
      }
    }

    initDevice();

    return () => {
      mounted = false;
      stopTimer();
      if (deviceRef.current) {
        deviceRef.current.destroy();
        deviceRef.current = null;
      }
    };
  }, [isPassive, stopTimer]);

  // Wire up call events helper
  const wireCallEvents = useCallback((call) => {
    call.on('accept', () => {
      setCallState(IN_PROGRESS);
      startTimer();
    });

    call.on('disconnect', () => {
      // Call was active on the browser and ended — clear sticky record too
      setCallState(IDLE);
      setActiveCall(null);
      setCallerInfo(null);
      setRecentInboundCall(null);
      setIsMuted(false);
      stopTimer();
    });

    call.on('cancel', () => {
      // Caller hung up OR the call was answered elsewhere (cell). Preserve
      // recentInboundCall so the sticky popup still shows caller context.
      setCallState(IDLE);
      setActiveCall(null);
      setIncomingCall(null);
      setCallerInfo(null);
      stopTimer();
    });

    call.on('reject', () => {
      // MLO explicitly declined — clear everything, they don't want context.
      setCallState(IDLE);
      setIncomingCall(null);
      setCallerInfo(null);
      setRecentInboundCall(null);
    });

    call.on('error', (err) => {
      console.error('Call error:', err);
      setError(err.message);
      setCallState(IDLE);
      setActiveCall(null);
      stopTimer();
    });
  }, [startTimer, stopTimer]);

  // ─── Actions ─────────────────────────────────────────────

  /** Make an outbound call. Passive: dispatch via BC to primary. */
  const dial = useCallback(async (phoneNumber, contactInfo = null) => {
    if (isPassive) {
      bcRef.current?.postMessage({ type: BC_ACTION_DIAL, payload: { number: phoneNumber, contactInfo } });
      return;
    }
    if (!deviceRef.current || callState !== IDLE) return;

    try {
      setCallState(CONNECTING);
      setCallerInfo(contactInfo || { phone: phoneNumber });

      const call = await deviceRef.current.connect({
        params: { To: phoneNumber },
      });

      wireCallEvents(call);
      setActiveCall(call);
      setCallState(RINGING);
    } catch (e) {
      console.error('Dial failed:', e);
      setError(e.message);
      setCallState(IDLE);
    }
  }, [isPassive, callState, wireCallEvents]);

  /** Accept an incoming call. Passive: dispatch via BC to primary. */
  const acceptCall = useCallback(() => {
    if (isPassive) {
      bcRef.current?.postMessage({ type: BC_ACTION_ANSWER });
      return;
    }
    if (!incomingCall) return;

    incomingCall.accept();
    wireCallEvents(incomingCall);
    setActiveCall(incomingCall);
    setIncomingCall(null);
  }, [isPassive, incomingCall, wireCallEvents]);

  /** Reject an incoming call. Passive: dispatch via BC to primary. */
  const rejectCall = useCallback(() => {
    if (isPassive) {
      bcRef.current?.postMessage({ type: BC_ACTION_DECLINE });
      return;
    }
    if (!incomingCall) return;

    incomingCall.reject();
    setIncomingCall(null);
    setCallState(IDLE);
    setCallerInfo(null);
  }, [isPassive, incomingCall]);

  /** Hang up the active call. Passive: dispatch via BC to primary. */
  const hangup = useCallback(() => {
    if (isPassive) {
      bcRef.current?.postMessage({ type: BC_ACTION_HANGUP });
      return;
    }
    if (activeCall) {
      activeCall.disconnect();
    }
  }, [isPassive, activeCall]);

  /** Toggle mute. Passive: dispatch via BC to primary. */
  const toggleMute = useCallback(() => {
    if (isPassive) {
      bcRef.current?.postMessage({ type: BC_ACTION_TOGGLE_MUTE });
      return;
    }
    if (!activeCall) return;
    const newMuted = !isMuted;
    activeCall.mute(newMuted);
    setIsMuted(newMuted);
  }, [isPassive, activeCall, isMuted]);

  /** Send DTMF digits (dial pad during call) */
  const sendDigits = useCallback((digits) => {
    if (activeCall) {
      activeCall.sendDigits(digits);
    }
  }, [activeCall]);

  /** Manually dismiss the sticky recent-call popup */
  const dismissRecentInboundCall = useCallback(() => {
    setRecentInboundCall(null);
  }, []);

  // Mirror audio + SMS prefs into refs so the polling closure (which captures
  // a stale snapshot at mount) reads the latest values.
  useEffect(() => { ringtoneDeviceIdRef.current = ringtoneDeviceId; }, [ringtoneDeviceId]);
  useEffect(() => { smsPopupEnabledRef.current = smsPopupEnabled; }, [smsPopupEnabled]);
  useEffect(() => { smsSoundEnabledRef.current = smsSoundEnabled; }, [smsSoundEnabled]);
  useEffect(() => { smsBadgeEnabledRef.current = smsBadgeEnabled; }, [smsBadgeEnabled]);

  // Load SMS prefs from localStorage on mount.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const popup = readLS(LS_SMS_POPUP);
    const sound = readLS(LS_SMS_SOUND);
    const badge = readLS(LS_SMS_BADGE);
    if (popup === 'false') setSmsPopupEnabledState(false);
    if (sound === 'false') setSmsSoundEnabledState(false);
    if (badge === 'false') setSmsBadgeEnabledState(false);
  }, []);

  // ─── PWA taskbar unread badge ────────────────────────────
  // navigator.setAppBadge() updates the badge on the installed PWA's
  // taskbar / Start menu icon. No-op in regular Chrome tabs (the API
  // exists but only renders for installed PWAs).
  const updateAppBadge = useCallback((count) => {
    if (typeof navigator === 'undefined') return;
    if (!smsBadgeEnabledRef.current || count <= 0) {
      if (typeof navigator.clearAppBadge === 'function') {
        navigator.clearAppBadge().catch(() => {});
      }
      return;
    }
    if (typeof navigator.setAppBadge === 'function') {
      navigator.setAppBadge(count).catch(() => {});
    }
  }, []);

  // ─── SMS polling loop ────────────────────────────────────
  // Runs every SMS_POLL_INTERVAL_MS while the provider is mounted.
  // Compares the newest inbound message timestamp against the last seen,
  // surfaces a popup + chime + updates the unread count + taskbar badge.
  // PRIMARY ONLY — passive instances mirror this state from BroadcastChannel.
  useEffect(() => {
    if (isPassive) return; // dock listens via BC, no duplicate polling
    let cancelled = false;

    const isThreadCurrentlyOpen = (contactId, phone) => {
      // Suppress popup if the user is staring at this thread already.
      if (typeof window === 'undefined') return false;
      const params = new URLSearchParams(window.location.search);
      const isOnMessages = window.location.pathname.startsWith('/portal/mlo/messages');
      if (!isOnMessages) return false;
      const openContact = params.get('contact');
      const openPhone = params.get('phone');
      if (contactId && openContact === String(contactId)) return true;
      if (phone && openPhone === phone) return true;
      return false;
    };

    const poll = async () => {
      try {
        const res = await fetch('/api/dialer/sms/threads', { cache: 'no-store' });
        if (!res.ok) return; // 401 during logout etc — silent retry
        const { threads = [] } = await res.json();

        // Aggregate unread inbound messages across all threads.
        const totalUnread = threads.reduce((sum, t) => sum + (t.unread || 0), 0);
        if (!cancelled) {
          setSmsUnreadCount(totalUnread);
          updateAppBadge(totalUnread);
        }

        // Find the newest inbound message across all threads.
        const newest = threads
          .filter((t) => t.last_direction === 'inbound')
          .sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at))[0];
        if (!newest) return;

        const newestAt = newest.last_message_at;

        // First poll: just baseline. Don't surface anything that arrived
        // before the user logged in.
        if (smsLastSeenAtRef.current === null) {
          smsLastSeenAtRef.current = newestAt;
          return;
        }

        // No change.
        if (new Date(newestAt) <= new Date(smsLastSeenAtRef.current)) return;

        // New message detected.
        smsLastSeenAtRef.current = newestAt;

        // Suppression rules.
        const tabHidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
        const onThread = isThreadCurrentlyOpen(newest.contact_id, newest.phone);

        if (!cancelled && smsPopupEnabledRef.current && !onThread && !tabHidden) {
          const popupInfo = {
            contactId: newest.contact_id || null,
            contactName: newest.contact_name || null,
            phone: newest.phone,
            body: newest.last_message || '',
            at: newestAt,
          };
          setIncomingSms(popupInfo);

          // Reset auto-dismiss timer.
          if (smsPopupTimerRef.current) clearTimeout(smsPopupTimerRef.current);
          smsPopupTimerRef.current = setTimeout(() => {
            setIncomingSms(null);
          }, SMS_POPUP_TTL_MS);
        }

        if (!cancelled && smsSoundEnabledRef.current && !onThread && !tabHidden) {
          playSmsChime(ringtoneDeviceIdRef.current).catch(() => { /* ignore */ });
        }
      } catch {
        // Network blip / fetch abort — silent. Next tick will retry.
      }
    };

    // Kick once immediately, then on interval.
    poll();
    const id = setInterval(poll, SMS_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(id);
      if (smsPopupTimerRef.current) clearTimeout(smsPopupTimerRef.current);
    };
  }, [isPassive, updateAppBadge]);

  // ─── Primary: broadcast state changes ────────────────────
  // Whenever the slice of state we want passive surfaces to mirror changes,
  // post a snapshot on the channel. Passive instances (dock) update local
  // React state from these snapshots.
  useEffect(() => {
    if (!isPrimary) return;
    const ch = bcRef.current;
    if (!ch) return;
    ch.postMessage({
      type: BC_STATE_UPDATE,
      payload: {
        deviceReady,
        callState,
        callerInfo,
        recentInboundCall,
        isMuted,
        callDuration,
        incomingSms,
        smsUnreadCount,
      },
    });
  }, [
    isPrimary,
    deviceReady,
    callState,
    callerInfo,
    recentInboundCall,
    isMuted,
    callDuration,
    incomingSms,
    smsUnreadCount,
  ]);

  // ─── Passive: listen for state updates + initial sync ────
  useEffect(() => {
    if (!isPassive) return;
    const ch = bcRef.current;
    if (!ch) return;

    const handleMessage = (event) => {
      const msg = event.data;
      if (!msg || msg.type !== BC_STATE_UPDATE) return;
      const p = msg.payload || {};
      // Mirror primary's state into our local React state. Each setter is
      // a no-op when the value matches, so this doesn't cause render churn.
      if (p.deviceReady !== undefined) setDeviceReady(p.deviceReady);
      if (p.callState !== undefined) setCallState(p.callState);
      if (p.callerInfo !== undefined) setCallerInfo(p.callerInfo);
      if (p.recentInboundCall !== undefined) setRecentInboundCall(p.recentInboundCall);
      if (p.isMuted !== undefined) setIsMuted(p.isMuted);
      if (p.callDuration !== undefined) setCallDuration(p.callDuration);
      if (p.incomingSms !== undefined) setIncomingSms(p.incomingSms);
      if (p.smsUnreadCount !== undefined) setSmsUnreadCount(p.smsUnreadCount);
    };

    ch.addEventListener('message', handleMessage);
    // Ask primary for current state on connect (handles dock-opened-after-call case).
    ch.postMessage({ type: BC_REQUEST_STATE });
    return () => ch.removeEventListener('message', handleMessage);
  }, [isPassive]);

  // ─── Primary: respond to action messages from passive surfaces ──
  // The dock can dispatch "answer this call" / "decline" / "hangup" / "dial"
  // back to the primary, which then performs the actual Device action.
  useEffect(() => {
    if (!isPrimary) return;
    const ch = bcRef.current;
    if (!ch) return;

    const handleMessage = async (event) => {
      const msg = event.data;
      if (!msg) return;
      switch (msg.type) {
        case BC_REQUEST_STATE:
          // Re-broadcast current state so the new passive instance syncs up.
          // The state-broadcast effect above already triggers, but BC events
          // don't arrive at the sender — we need an explicit reply.
          ch.postMessage({
            type: BC_STATE_UPDATE,
            payload: {
              deviceReady,
              callState,
              callerInfo,
              recentInboundCall,
              isMuted,
              callDuration,
              incomingSms,
              smsUnreadCount,
            },
          });
          break;
        case BC_ACTION_ANSWER:
          if (incomingCall) {
            incomingCall.accept();
            wireCallEvents(incomingCall);
            setActiveCall(incomingCall);
            setIncomingCall(null);
          }
          break;
        case BC_ACTION_DECLINE:
          if (incomingCall) {
            incomingCall.reject();
            setIncomingCall(null);
            setCallState(IDLE);
            setCallerInfo(null);
          }
          break;
        case BC_ACTION_HANGUP:
          if (activeCall) activeCall.disconnect();
          break;
        case BC_ACTION_DIAL:
          // Defer to the primary's local dial(); avoids duplicating the
          // Device.connect() logic.
          if (deviceRef.current && callState === IDLE && msg.payload?.number) {
            try {
              const call = await deviceRef.current.connect({ params: { To: msg.payload.number } });
              wireCallEvents(call);
              setActiveCall(call);
              setCallState(RINGING);
              setCallerInfo(msg.payload.contactInfo || { phone: msg.payload.number });
            } catch (e) {
              console.error('[Dialer] BC dial failed:', e);
            }
          }
          break;
        case BC_ACTION_TOGGLE_MUTE:
          if (activeCall) {
            const newMuted = !isMuted;
            activeCall.mute(newMuted);
            setIsMuted(newMuted);
          }
          break;
        default:
          break;
      }
    };

    ch.addEventListener('message', handleMessage);
    return () => ch.removeEventListener('message', handleMessage);
  }, [
    isPrimary,
    incomingCall,
    activeCall,
    callState,
    isMuted,
    deviceReady,
    callerInfo,
    recentInboundCall,
    callDuration,
    incomingSms,
    smsUnreadCount,
    wireCallEvents,
  ]);

  // ─── SMS notification setters ────────────────────────────
  const dismissIncomingSms = useCallback(() => {
    setIncomingSms(null);
    if (smsPopupTimerRef.current) {
      clearTimeout(smsPopupTimerRef.current);
      smsPopupTimerRef.current = null;
    }
  }, []);

  const setSmsPopupEnabled = useCallback((on) => {
    setSmsPopupEnabledState(on);
    writeLS(LS_SMS_POPUP, on ? null : 'false');
  }, []);

  const setSmsSoundEnabled = useCallback((on) => {
    setSmsSoundEnabledState(on);
    writeLS(LS_SMS_SOUND, on ? null : 'false');
  }, []);

  const setSmsBadgeEnabled = useCallback((on) => {
    setSmsBadgeEnabledState(on);
    writeLS(LS_SMS_BADGE, on ? null : 'false');
    if (!on && typeof navigator?.clearAppBadge === 'function') {
      navigator.clearAppBadge().catch(() => {});
    } else if (on) {
      updateAppBadge(smsUnreadCount);
    }
  }, [smsUnreadCount, updateAppBadge]);

  /** Test the SMS chime — used by the "Test" button in AudioSettings. */
  const testSmsChime = useCallback(() => {
    playSmsChime(ringtoneDeviceIdRef.current).catch(() => {});
  }, []);

  // ─── Audio device actions ────────────────────────────────

  const setRingtoneDevice = useCallback((deviceId) => {
    const dev = deviceRef.current;
    if (!dev?.audio) return;
    try {
      dev.audio.ringtoneDevices.set(deviceId);
      setRingtoneDeviceIdState(deviceId);
      writeLS(LS_RINGTONE, deviceId);
    } catch (e) {
      console.error('[Dialer] setRingtoneDevice failed:', e);
      setError(e.message);
    }
  }, []);

  const setSpeakerDevice = useCallback((deviceId) => {
    const dev = deviceRef.current;
    if (!dev?.audio) return;
    try {
      dev.audio.speakerDevices.set(deviceId);
      setSpeakerDeviceIdState(deviceId);
      writeLS(LS_SPEAKER, deviceId);
    } catch (e) {
      console.error('[Dialer] setSpeakerDevice failed:', e);
      setError(e.message);
    }
  }, []);

  const setInputDevice = useCallback(async (deviceId) => {
    const dev = deviceRef.current;
    if (!dev?.audio) return;
    try {
      await dev.audio.setInputDevice(deviceId);
      setInputDeviceIdState(deviceId);
      writeLS(LS_INPUT, deviceId);
    } catch (e) {
      console.error('[Dialer] setInputDevice failed:', e);
      setError(e.message);
    }
  }, []);

  /** Play a sample ring on the configured ringtone device — used to test routing. */
  const testRingtone = useCallback(() => {
    const dev = deviceRef.current;
    if (!dev?.audio) return;
    try { dev.audio.ringtoneDevices.test(); } catch (e) { console.error('[Dialer] testRingtone failed:', e); }
  }, []);

  /** Play a sample tone on the configured speaker device — used to test routing. */
  const testSpeaker = useCallback(() => {
    const dev = deviceRef.current;
    if (!dev?.audio) return;
    try { dev.audio.speakerDevices.test(); } catch (e) { console.error('[Dialer] testSpeaker failed:', e); }
  }, []);

  // Auto-clear recentInboundCall after 2 minutes so it doesn't linger forever.
  useEffect(() => {
    if (!recentInboundCall) return;
    const t = setTimeout(() => setRecentInboundCall(null), 120_000);
    return () => clearTimeout(t);
  }, [recentInboundCall]);

  const value = {
    // State
    deviceReady,
    callState,
    activeCall,
    incomingCall,
    isMuted,
    callDuration,
    callerInfo,
    recentInboundCall,
    error,

    // Constants
    IDLE,
    CONNECTING,
    RINGING,
    IN_PROGRESS,
    INCOMING,

    // Audio routing
    audioDevices,
    ringtoneDeviceId,
    speakerDeviceId,
    inputDeviceId,
    outputSelectionSupported,

    // SMS notifications
    incomingSms,
    smsUnreadCount,
    smsPopupEnabled,
    smsSoundEnabled,
    smsBadgeEnabled,

    // Actions
    dial,
    acceptCall,
    rejectCall,
    hangup,
    toggleMute,
    sendDigits,
    dismissRecentInboundCall,
    setRingtoneDevice,
    setSpeakerDevice,
    setInputDevice,
    testRingtone,
    testSpeaker,
    dismissIncomingSms,
    setSmsPopupEnabled,
    setSmsSoundEnabled,
    setSmsBadgeEnabled,
    testSmsChime,
  };

  return (
    <DialerContext.Provider value={value}>
      {children}
    </DialerContext.Provider>
  );
}
