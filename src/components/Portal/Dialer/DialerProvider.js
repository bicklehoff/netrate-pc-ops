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

export default function DialerProvider({ children }) {
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

  const deviceRef = useRef(null);
  const timerRef = useRef(null);
  const identityRef = useRef(null);

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

  // Initialize Twilio Device
  useEffect(() => {
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
  }, [stopTimer]);

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

  /** Make an outbound call */
  const dial = useCallback(async (phoneNumber, contactInfo = null) => {
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
  }, [callState, wireCallEvents]);

  /** Accept an incoming call */
  const acceptCall = useCallback(() => {
    if (!incomingCall) return;

    incomingCall.accept();
    wireCallEvents(incomingCall);
    setActiveCall(incomingCall);
    setIncomingCall(null);
  }, [incomingCall, wireCallEvents]);

  /** Reject an incoming call */
  const rejectCall = useCallback(() => {
    if (!incomingCall) return;

    incomingCall.reject();
    setIncomingCall(null);
    setCallState(IDLE);
    setCallerInfo(null);
  }, [incomingCall]);

  /** Hang up the active call */
  const hangup = useCallback(() => {
    if (activeCall) {
      activeCall.disconnect();
    }
  }, [activeCall]);

  /** Toggle mute */
  const toggleMute = useCallback(() => {
    if (!activeCall) return;
    const newMuted = !isMuted;
    activeCall.mute(newMuted);
    setIsMuted(newMuted);
  }, [activeCall, isMuted]);

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
  };

  return (
    <DialerContext.Provider value={value}>
      {children}
    </DialerContext.Provider>
  );
}
