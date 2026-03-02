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
        const device = new Device(token, {
          edge: 'ashburn',    // US East — closest to Neon DB
          logLevel: 'warn',
        });

        device.on('registered', () => {
          if (mounted) {
            setDeviceReady(true);
            setError(null);
            console.log('Twilio Device registered');
          }
        });

        device.on('error', (err) => {
          console.error('Twilio Device error:', err);
          if (mounted) setError(err.message);
        });

        // Handle incoming calls
        device.on('incoming', (call) => {
          if (mounted) {
            setIncomingCall(call);
            setCallState(INCOMING);

            // Try to extract caller info from custom parameters
            const callerName = call.customParameters?.get('callerName');
            setCallerInfo({
              name: callerName || null,
              phone: call.parameters?.From || 'Unknown',
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
      setCallState(IDLE);
      setActiveCall(null);
      setCallerInfo(null);
      setIsMuted(false);
      stopTimer();
    });

    call.on('cancel', () => {
      setCallState(IDLE);
      setActiveCall(null);
      setIncomingCall(null);
      setCallerInfo(null);
      stopTimer();
    });

    call.on('reject', () => {
      setCallState(IDLE);
      setIncomingCall(null);
      setCallerInfo(null);
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

  const value = {
    // State
    deviceReady,
    callState,
    activeCall,
    incomingCall,
    isMuted,
    callDuration,
    callerInfo,
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
  };

  return (
    <DialerContext.Provider value={value}>
      {children}
    </DialerContext.Provider>
  );
}
