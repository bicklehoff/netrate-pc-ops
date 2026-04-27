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

    // Actions
    dial,
    acceptCall,
    rejectCall,
    hangup,
    toggleMute,
    sendDigits,
    dismissRecentInboundCall,
  };

  return (
    <DialerContext.Provider value={value}>
      {children}
    </DialerContext.Provider>
  );
}
