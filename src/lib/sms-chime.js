// SMS chime — short two-note Web-Audio synthesized "ding".
// Why synthesize instead of ship an MP3? Zero asset weight, no caching
// concerns, instant playback (no fetch). Routes through AudioContext.setSinkId
// when supported so the chime plays on the user's "Ring on" device.

let sharedCtx = null;

function getCtx() {
  if (sharedCtx && sharedCtx.state !== 'closed') return sharedCtx;
  const Ctor = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!Ctor) return null;
  sharedCtx = new Ctor();
  return sharedCtx;
}

/**
 * Play the SMS chime. Returns a Promise that resolves when the tone finishes,
 * or immediately if Web Audio isn't available.
 *
 * @param {string|null} sinkDeviceId - Output device for routing. Null = default.
 */
export async function playSmsChime(sinkDeviceId = null) {
  const ctx = getCtx();
  if (!ctx) return;

  // Some browsers leave new contexts in 'suspended' state until a user gesture.
  // Polling kicks the context after the user's first interaction; if it ever
  // gets called from a non-gesture path, this resume() is a no-op.
  if (ctx.state === 'suspended') {
    try { await ctx.resume(); } catch { /* ignore */ }
  }

  // Route to the user's chosen output device when available. setSinkId on
  // AudioContext is Chrome 110+; fail open to default if unsupported.
  if (sinkDeviceId && typeof ctx.setSinkId === 'function') {
    try { await ctx.setSinkId(sinkDeviceId); } catch { /* fall back to default */ }
  }

  const t = ctx.currentTime;
  const gain = ctx.createGain();
  gain.connect(ctx.destination);

  // Two-note ascending chime: A5 (880 Hz) → E6 (1320 Hz). Short, clean,
  // doesn't conflict with Twilio call ringtone. ~380ms total.
  const o1 = ctx.createOscillator();
  o1.type = 'sine';
  o1.frequency.setValueAtTime(880, t);
  o1.connect(gain);

  const o2 = ctx.createOscillator();
  o2.type = 'sine';
  o2.frequency.setValueAtTime(1320, t + 0.16);
  o2.connect(gain);

  // Envelope: quick attack, slight sustain, exponential decay. Total ~380ms.
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.06, t + 0.16);
  gain.gain.linearRampToValueAtTime(0.18, t + 0.18);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);

  o1.start(t);
  o1.stop(t + 0.18);
  o2.start(t + 0.16);
  o2.stop(t + 0.4);

  return new Promise((resolve) => {
    o2.onended = () => resolve();
  });
}
