'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

function formatDuration(secs) {
  const s = parseInt(secs || 0, 10);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function formatWhen(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function GreetingPlayer({ url, label }) {
  const ref = useRef(null);
  const [playing, setPlaying] = useState(false);
  if (!url) return null;
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => {
          const a = ref.current;
          if (!a) return;
          if (playing) { a.pause(); } else { a.play(); }
        }}
        className="w-6 h-6 rounded-full bg-brand text-white flex items-center justify-center hover:bg-brand-dark flex-shrink-0"
        title={`Play ${label}`}
      >
        {playing
          ? <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
          : <svg className="w-2.5 h-2.5 ml-px" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>}
      </button>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={ref} src={url} preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  );
}

function VoicemailRow({ vm, onHeard }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [heard, setHeard] = useState(!!vm.voicemail_heard_at);

  const callerName = vm.first_name
    ? `${vm.first_name} ${vm.last_name}`.trim()
    : vm.from_number || 'Unknown';

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.pause(); }
    else {
      audio.play();
      if (!heard) { setHeard(true); onHeard(vm.id); }
    }
  }

  return (
    <div className={`px-4 py-3 border-b border-gray-100 last:border-0 ${heard ? 'bg-white' : 'bg-blue-50/40'}`}>
      <div className="flex items-start gap-3">
        <div className="mt-1.5 flex-shrink-0">
          {!heard ? <div className="w-2 h-2 rounded-full bg-brand" /> : <div className="w-2 h-2" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={`text-sm truncate ${heard ? 'text-gray-700' : 'font-semibold text-gray-900'}`}>
              {callerName}
            </span>
            <span className="text-[11px] text-gray-400 flex-shrink-0">{formatWhen(vm.started_at)}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={togglePlay}
              className="w-7 h-7 rounded-full bg-brand text-white flex items-center justify-center hover:bg-brand-dark flex-shrink-0"
            >
              {playing
                ? <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                : <svg className="w-3 h-3 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>}
            </button>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio
              ref={audioRef}
              src={`/api/dialer/voicemails/${vm.id}`}
              preload="none"
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
            />
            <span className="text-xs text-gray-400">{formatDuration(vm.duration)}</span>
            {vm.contact_id && (
              <Link href={`/portal/mlo/contacts/${vm.contact_id}`} className="text-xs text-brand hover:underline ml-auto">
                Open contact
              </Link>
            )}
          </div>
          {vm.transcription_text && (
            <p className="mt-1.5 text-xs text-gray-500 italic leading-relaxed line-clamp-2">
              &ldquo;{vm.transcription_text}&rdquo;
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

const MODES = [
  { id: 'auto',      label: 'Auto',      desc: 'Alice TTS default' },
  { id: 'standard',  label: 'Standard',  desc: 'Your recorded greeting' },
  { id: 'exception', label: 'Exception', desc: 'Out-of-office greeting' },
];

export default function VoicemailInbox() {
  const [voicemails, setVoicemails] = useState([]);
  const [loading, setLoading] = useState(true);

  // Greeting management state
  const [greetingStatus, setGreetingStatus] = useState(null); // { standard_url, exception_url, mode }
  const [recording, setRecording] = useState(null);   // null | 'standard' | 'exception'
  const [recordingStatus, setRecordingStatus] = useState(null); // null | 'calling' | 'saved' | 'error:...'
  const pollRef = useRef(null);

  useEffect(() => {
    fetch('/api/dialer/voicemails')
      .then((r) => r.json())
      .then((d) => setVoicemails(d.voicemails || []))
      .catch(() => {})
      .finally(() => setLoading(false));

    fetch('/api/dialer/voicemail/greeting-status')
      .then((r) => r.json())
      .then((d) => setGreetingStatus(d))
      .catch(() => {});

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  async function handleMarkHeard(id) {
    await fetch(`/api/dialer/voicemails/${id}`, { method: 'PATCH' }).catch(() => {});
    setVoicemails((prev) =>
      prev.map((v) => v.id === id ? { ...v, voicemail_heard_at: new Date().toISOString() } : v)
    );
  }

  async function handleRecordGreeting(type) {
    setRecording(type);
    setRecordingStatus('calling');
    const snapshotUrl = type === 'exception'
      ? greetingStatus?.exception_url
      : greetingStatus?.standard_url;

    try {
      const res = await fetch('/api/dialer/voicemail/record-greeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to start call');
      }

      // Poll until the URL changes (Twilio save-greeting webhook fires async)
      pollRef.current = setInterval(async () => {
        try {
          const r = await fetch('/api/dialer/voicemail/greeting-status');
          const data = await r.json();
          const newUrl = type === 'exception' ? data.exception_url : data.standard_url;
          if (newUrl && newUrl !== snapshotUrl) {
            setGreetingStatus(data);
            setRecordingStatus('saved');
            setRecording(null);
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        } catch {}
      }, 3000);

      // Stop polling after 3 minutes regardless
      setTimeout(() => {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setRecording(null);
          if (recordingStatus === 'calling') setRecordingStatus(null);
        }
      }, 180_000);
    } catch (e) {
      setRecordingStatus(`error:${e.message}`);
      setRecording(null);
    }
  }

  async function handleModeChange(mode) {
    setGreetingStatus((p) => ({ ...p, mode }));
    await fetch('/api/dialer/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voicemail_mode: mode }),
    }).catch(() => {});
  }

  const unheardCount = voicemails.filter((v) => !v.voicemail_heard_at).length;
  const currentMode = greetingStatus?.mode || 'standard';

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-800">Voicemail</h3>
          {unheardCount > 0 && (
            <span className="text-[10px] font-semibold bg-brand text-white rounded-full px-1.5 py-0.5">
              {unheardCount}
            </span>
          )}
        </div>
      </div>

      {/* Greeting management panel */}
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Greeting</p>

        {/* Mode selector */}
        <div className="flex gap-1 mb-3">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => handleModeChange(m.id)}
              className={`flex-1 py-1 text-[11px] rounded-md transition-colors ${
                currentMode === m.id
                  ? 'bg-brand text-white font-semibold'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-brand/40'
              }`}
              title={m.desc}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Standard greeting */}
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <GreetingPlayer url={greetingStatus?.standard_url} label="Standard greeting" />
            {!greetingStatus?.standard_url && (
              <span className="text-xs text-gray-400">No standard greeting recorded</span>
            )}
          </div>
          <button
            onClick={() => handleRecordGreeting('standard')}
            disabled={!!recording}
            className="text-[11px] text-brand hover:text-brand-dark disabled:text-gray-400 flex items-center gap-1 flex-shrink-0"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            {recording === 'standard' ? 'Calling…' : greetingStatus?.standard_url ? 'Re-record' : 'Record'}
          </button>
        </div>

        {/* Exception greeting */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GreetingPlayer url={greetingStatus?.exception_url} label="Exception greeting" />
            {!greetingStatus?.exception_url && (
              <span className="text-xs text-gray-400">No exception greeting recorded</span>
            )}
          </div>
          <button
            onClick={() => handleRecordGreeting('exception')}
            disabled={!!recording}
            className="text-[11px] text-brand hover:text-brand-dark disabled:text-gray-400 flex items-center gap-1 flex-shrink-0"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            {recording === 'exception' ? 'Calling…' : greetingStatus?.exception_url ? 'Re-record' : 'Record'}
          </button>
        </div>

        {/* Recording status banner */}
        {recordingStatus && (
          <div className={`mt-2 px-3 py-1.5 text-xs rounded-lg flex items-center justify-between ${
            recordingStatus === 'saved'
              ? 'bg-green-50 text-green-700'
              : recordingStatus === 'calling'
              ? 'bg-blue-50 text-blue-700'
              : 'bg-red-50 text-red-600'
          }`}>
            <span>
              {recordingStatus === 'calling' && 'Calling your cell — answer and speak after the beep.'}
              {recordingStatus === 'saved' && 'Greeting saved ✓'}
              {recordingStatus.startsWith('error:') && recordingStatus.replace('error:', '')}
            </span>
            <button onClick={() => setRecordingStatus(null)} className="ml-2 underline">×</button>
          </div>
        )}
      </div>

      {/* Voicemail list */}
      <div className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-5 h-5 border-2 border-gray-300 border-t-brand rounded-full animate-spin" />
          </div>
        ) : voicemails.length === 0 ? (
          <div className="text-center py-10">
            <svg className="w-8 h-8 mx-auto text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            <p className="text-xs text-gray-400">No voicemails</p>
          </div>
        ) : (
          voicemails.map((vm) => (
            <VoicemailRow key={vm.id} vm={vm} onHeard={handleMarkHeard} />
          ))
        )}
      </div>
    </div>
  );
}
