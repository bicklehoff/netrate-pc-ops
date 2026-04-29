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
    if (playing) {
      audio.pause();
    } else {
      audio.play();
      if (!heard) {
        setHeard(true);
        onHeard(vm.id);
      }
    }
  }

  return (
    <div className={`px-4 py-3 border-b border-gray-100 last:border-0 ${heard ? 'bg-white' : 'bg-blue-50/40'}`}>
      <div className="flex items-start gap-3">
        {/* Unread dot */}
        <div className="mt-1.5 flex-shrink-0">
          {!heard
            ? <div className="w-2 h-2 rounded-full bg-brand" />
            : <div className="w-2 h-2" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={`text-sm truncate ${heard ? 'text-gray-700' : 'font-semibold text-gray-900'}`}>
              {callerName}
            </span>
            <span className="text-[11px] text-gray-400 flex-shrink-0">{formatWhen(vm.started_at)}</span>
          </div>

          <div className="flex items-center gap-2 mt-1">
            {/* Play/pause button */}
            <button
              onClick={togglePlay}
              className="w-7 h-7 rounded-full bg-brand text-white flex items-center justify-center hover:bg-brand-dark flex-shrink-0"
            >
              {playing
                ? <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                : <svg className="w-3 h-3 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>}
            </button>

            {/* Hidden audio element — proxied through our server */}
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
              <Link
                href={`/portal/mlo/contacts/${vm.contact_id}`}
                className="text-xs text-brand hover:underline ml-auto"
              >
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

export default function VoicemailInbox() {
  const [voicemails, setVoicemails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState(null);

  useEffect(() => {
    fetch('/api/dialer/voicemails')
      .then((r) => r.json())
      .then((d) => setVoicemails(d.voicemails || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleMarkHeard(id) {
    await fetch(`/api/dialer/voicemails/${id}`, { method: 'PATCH' }).catch(() => {});
    setVoicemails((prev) =>
      prev.map((v) => v.id === id ? { ...v, voicemail_heard_at: new Date().toISOString() } : v)
    );
  }

  async function handleRecordGreeting() {
    setRecording(true);
    setRecordingStatus(null);
    try {
      const res = await fetch('/api/dialer/voicemail/record-greeting', { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to start call');
      }
      setRecordingStatus('calling');
    } catch (e) {
      setRecordingStatus(`Error: ${e.message}`);
    } finally {
      setRecording(false);
    }
  }

  const unheardCount = voicemails.filter((v) => !v.voicemail_heard_at).length;

  return (
    <div className="flex flex-col h-full">
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
        <button
          onClick={handleRecordGreeting}
          disabled={recording}
          title="Record voicemail greeting"
          className="text-xs text-brand hover:text-brand-dark disabled:text-gray-400 flex items-center gap-1"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
          {recording ? 'Calling…' : 'Record greeting'}
        </button>
      </div>

      {/* Recording status banner */}
      {recordingStatus && (
        <div className={`px-4 py-2 text-xs border-b ${recordingStatus.startsWith('Error') ? 'bg-red-50 text-red-600 border-red-100' : 'bg-green-50 text-green-700 border-green-100'}`}>
          {recordingStatus === 'calling'
            ? 'Calling your cell — answer and speak your greeting after the beep.'
            : recordingStatus}
          <button onClick={() => setRecordingStatus(null)} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {/* Voicemail list */}
      <div className="flex-1 overflow-y-auto">
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
