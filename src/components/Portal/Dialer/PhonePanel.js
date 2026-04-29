// PhonePanel — Floating phone panel with tabs
// Replaces the old fixed-width DialerPanel sidebar.
// Modes: FAB (idle), floating panel (open), popped-out window.

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDialer } from './DialerProvider';
import ContactSearch from './ContactSearch';
import DialPad from './DialPad';
import ActiveCall from './ActiveCall';
import CallHistory from './CallHistory';
import CallNotes from './CallNotes';
import SmsThread from './SmsThread';
import ContactCard from './ContactCard';
import AudioSettings from './AudioSettings';
import VoicemailInbox from './VoicemailInbox';
import PhoneSettings from './PhoneSettings';

const TABS = [
  { id: 'dial', label: 'Dial' },
  { id: 'sms', label: 'SMS' },
  { id: 'voicemail', label: 'Voicemail' },
  { id: 'contact', label: 'Contact' },
  { id: 'history', label: 'History' },
  { id: 'settings', label: 'Settings' },
];

// Drag threshold (px) — movement below this is treated as a click
const DRAG_THRESHOLD = 5;

function loadPos(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch {}
  return fallback;
}

function savePos(key, pos) {
  try { localStorage.setItem(key, JSON.stringify(pos)); } catch {}
}

// Clamp position so the element stays on screen
function clamp(pos, elW, elH) {
  const maxX = window.innerWidth - elW;
  const maxY = window.innerHeight - elH;
  return {
    x: Math.max(0, Math.min(pos.x, maxX)),
    y: Math.max(0, Math.min(pos.y, maxY)),
  };
}

// Inline panel shown on the SMS tab when no contact is selected.
// Lets the user search contacts or type a phone number to start a thread.
function SmsStartPanel({ onSelectContact }) {
  const [smsTo, setSmsTo] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (smsTo.length < 2) { setSearchResults([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/dialer/contacts/search?q=${encodeURIComponent(smsTo)}`);
        const data = await res.json();
        setSearchResults(data.contacts || []);
      } catch {} finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [smsTo]);

  // Check if input looks like a phone number (digits, spaces, dashes, parens, +)
  const isPhone = /^[\d\s\-\(\)\+]{7,}$/.test(smsTo.replace(/\s/g, ''));

  const handleStartWithNumber = () => {
    // Normalize to E.164-ish
    const digits = smsTo.replace(/\D/g, '');
    const phone = digits.length === 10 ? `+1${digits}` : `+${digits}`;
    onSelectContact({ phone, first_name: phone, last_name: '', id: null, smsMessages: [] });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 space-y-3">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={smsTo}
            onChange={(e) => setSmsTo(e.target.value)}
            placeholder="Search contact or type a number..."
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand bg-gray-50"
            autoFocus
          />
          {searching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-brand rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Direct number option */}
        {isPhone && (
          <button
            onClick={handleStartWithNumber}
            className="w-full flex items-center gap-3 px-3 py-2.5 bg-brand/5 rounded-xl hover:bg-brand/10 transition-colors text-left"
          >
            <div className="w-8 h-8 bg-brand/10 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-brand" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Text {smsTo}</p>
              <p className="text-[10px] text-gray-500">Send to this number directly</p>
            </div>
          </button>
        )}

        {/* Contact results */}
        {searchResults.length > 0 && (
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            {searchResults.slice(0, 5).map((contact) => (
              <button
                key={contact.id}
                onClick={() => onSelectContact(contact)}
                className="w-full px-3 py-2.5 text-left hover:bg-gray-50 flex items-center gap-3 border-b border-gray-100 last:border-0"
              >
                <div className="w-8 h-8 bg-brand/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-semibold text-brand">
                    {contact.first_name?.[0]}{contact.last_name?.[0]}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {contact.first_name} {contact.last_name}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{contact.phone || ''}</p>
                </div>
                <svg className="w-4 h-4 text-brand flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
                </svg>
              </button>
            ))}
          </div>
        )}

        {smsTo.length >= 2 && searchResults.length === 0 && !searching && !isPhone && (
          <p className="text-xs text-gray-400 text-center py-4">No contacts found</p>
        )}
      </div>

      {!smsTo && (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <svg className="w-10 h-10 text-gray-200 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p className="text-xs text-gray-400">Search a contact or type a number</p>
        </div>
      )}
    </div>
  );
}

export default function PhonePanel() {
  const { dial, callState, IDLE, INCOMING, deviceReady, error } = useDialer();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('dial');
  const [selectedContact, setSelectedContact] = useState(null);
  const [lastCallId, setLastCallId] = useState(null);
  const [isPoppedOut, setIsPoppedOut] = useState(false);
  const [showAudioSettings, setShowAudioSettings] = useState(false);
  const popupRef = useRef(null);
  const panelRef = useRef(null);

  // ─── Drag state ───
  const [fabPos, setFabPos] = useState(() => loadPos('phone-fab-pos', null));
  const [panelPos, setPanelPos] = useState(() => loadPos('phone-panel-pos', null));
  const dragRef = useRef({ active: false, startX: 0, startY: 0, startPosX: 0, startPosY: 0, didDrag: false, target: null });

  // Set sensible defaults once we know window size
  useEffect(() => {
    if (!fabPos) {
      setFabPos({ x: window.innerWidth - 80, y: window.innerHeight - 80 });
    }
    if (!panelPos) {
      setPanelPos({ x: window.innerWidth - 444, y: window.innerHeight - 620 });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-clamp on window resize
  useEffect(() => {
    function handleResize() {
      setFabPos(p => p ? clamp(p, 56, 56) : p);
      setPanelPos(p => p ? clamp(p, 420, 580) : p);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleDragStart = useCallback((e, target) => {
    if (e.button !== 0) return;
    const pos = target === 'fab' ? fabPos : panelPos;
    if (!pos) return;
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      startPosX: pos.x,
      startPosY: pos.y,
      didDrag: false,
      target,
    };
    e.preventDefault();
  }, [fabPos, panelPos]);

  useEffect(() => {
    function handleMouseMove(e) {
      const d = dragRef.current;
      if (!d.active) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (!d.didDrag && Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
      d.didDrag = true;
      const elW = d.target === 'fab' ? 56 : 420;
      const elH = d.target === 'fab' ? 56 : 580;
      const newPos = clamp({ x: d.startPosX + dx, y: d.startPosY + dy }, elW, elH);
      if (d.target === 'fab') setFabPos(newPos);
      else setPanelPos(newPos);
    }
    function handleMouseUp() {
      const d = dragRef.current;
      if (!d.active) return;
      d.active = false;
      if (d.didDrag) {
        const pos = d.target === 'fab' ? fabPos : panelPos;
        if (pos) savePos(d.target === 'fab' ? 'phone-fab-pos' : 'phone-panel-pos', pos);
      }
    }
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [fabPos, panelPos]);

  // Auto-open when a call starts (not incoming — that uses the toast)
  useEffect(() => {
    if (callState !== IDLE && callState !== INCOMING) {
      setIsOpen(true);
    }
  }, [callState, IDLE, INCOMING]);

  // Keyboard shortcut: Ctrl+Shift+P toggles panel
  useEffect(() => {
    function handleKey(e) {
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Close on Escape
  useEffect(() => {
    function handleEsc(e) {
      if (e.key === 'Escape' && isOpen && callState === IDLE) {
        setIsOpen(false);
      }
    }
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, callState, IDLE]);

  // Click outside to close (only when idle)
  useEffect(() => {
    if (!isOpen || callState !== IDLE) return;
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        // Don't close if clicking the FAB
        if (e.target.closest('[data-phone-fab]')) return;
        setIsOpen(false);
      }
    }
    // Delay to avoid closing immediately on the click that opened it
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [isOpen, callState, IDLE]);

  const handleContactSelect = useCallback((contact) => {
    setSelectedContact(contact);
    if (contact.phone) setActiveTab('dial');
  }, []);

  const handlePopOut = useCallback(() => {
    if (isPoppedOut) {
      // Snap back
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close();
      }
      popupRef.current = null;
      setIsPoppedOut(false);
      setIsOpen(true);
      return;
    }

    const w = 440, h = 680;
    const left = window.screenX + window.outerWidth + 10;
    const top = window.screenY + 60;

    const popup = window.open(
      '/portal/mlo/phone-popout',
      'netrate-phone',
      `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=no,toolbar=no,menubar=no,location=no,status=no`
    );

    if (!popup) {
      // Popup blocked — fall back to inline
      return;
    }

    popupRef.current = popup;
    setIsPoppedOut(true);
    setIsOpen(false);

    // Listen for popup close
    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        popupRef.current = null;
        setIsPoppedOut(false);
        setIsOpen(true);
      }
    }, 500);
  }, [isPoppedOut]);

  // Sync state to popup via BroadcastChannel
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel('netrate-phone');

    // Send state updates to popup
    channel.postMessage({
      type: 'state-sync',
      callState,
      selectedContact,
      deviceReady,
    });

    return () => channel.close();
  }, [callState, selectedContact, deviceReady]);

  // ─── FAB (idle / popped out) ───
  if (!isOpen && !isPoppedOut) {
    return (
      <button
        data-phone-fab
        onMouseDown={(e) => handleDragStart(e, 'fab')}
        onClick={() => { if (!dragRef.current.didDrag) setIsOpen(true); }}
        className="fixed z-[60] w-14 h-14 bg-brand text-white rounded-2xl shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center group cursor-grab active:cursor-grabbing"
        style={fabPos ? { left: fabPos.x, top: fabPos.y } : { right: 24, bottom: 24 }}
        title="Phone (Ctrl+Shift+P) — drag to move"
      >
        <svg className="w-6 h-6 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>
        {/* Online indicator */}
        <span className={`absolute top-1 right-1 w-3 h-3 rounded-full border-2 border-white ${deviceReady ? 'bg-green-500' : 'bg-gray-300'} pointer-events-none`} />
      </button>
    );
  }

  if (isPoppedOut) {
    return (
      <div className="fixed z-[60]" style={fabPos ? { left: fabPos.x, top: fabPos.y } : { right: 24, bottom: 24 }}>
        <button
          onClick={handlePopOut}
          className="px-4 py-3 bg-violet-100 text-violet-700 border-2 border-dashed border-violet-300 rounded-2xl shadow-md hover:shadow-lg transition-all flex items-center gap-3 group"
          title="Click to snap phone back"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          <div className="text-left">
            <div className="text-xs font-semibold">Phone on other window</div>
            <div className="text-[10px] text-violet-500">Click to snap back</div>
          </div>
        </button>
      </div>
    );
  }

  // ─── Floating Panel ───
  const isInCall = callState !== IDLE;

  return (
    <div
      ref={panelRef}
      className="fixed z-[60] w-[420px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200"
      style={{
        maxHeight: 'calc(100vh - 40px)',
        ...(panelPos ? { left: panelPos.x, top: panelPos.y } : { right: 24, bottom: 24 }),
      }}
    >
      {/* Header — drag handle */}
      <div
        onMouseDown={(e) => { if (!e.target.closest('button')) handleDragStart(e, 'panel'); }}
        className="px-4 py-3 border-b border-gray-100 bg-gray-50/80 flex items-center gap-3 cursor-grab active:cursor-grabbing select-none"
      >
        <svg className="w-[18px] h-[18px] text-brand flex-shrink-0 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>
        <h3 className="text-sm font-bold flex-1 pointer-events-none">Phone</h3>
        <div className="flex items-center gap-1.5 mr-2">
          <span className={`w-2 h-2 rounded-full ${deviceReady ? 'bg-green-500' : 'bg-gray-300'}`} />
          <span className="text-[10px] text-gray-400">{deviceReady ? 'Online' : 'Connecting...'}</span>
        </div>
        {/* Audio settings button */}
        <button
          onClick={() => setShowAudioSettings((v) => !v)}
          className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${showAudioSettings ? 'text-brand bg-brand/10' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
          title="Audio settings"
          aria-label="Audio settings"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
        {/* Pop out button */}
        <button
          onClick={handlePopOut}
          className="w-7 h-7 rounded-md flex items-center justify-center text-violet-500 hover:bg-violet-50 transition-colors"
          title="Pop out to separate window"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </button>
        {/* Close button (only when not in call) */}
        {!isInCall && (
          <button
            onClick={() => setIsOpen(false)}
            className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Search bar */}
      <div className="px-4 py-2 border-b border-gray-100">
        <ContactSearch onSelect={handleContactSelect} />
      </div>

      {showAudioSettings && (
        <AudioSettings onClose={() => setShowAudioSettings(false)} />
      )}

      {/* Selected contact quick bar */}
      {selectedContact && !isInCall && (
        <div className="px-4 py-2 bg-brand/5 border-b border-brand/10 flex items-center gap-2">
          <div className="w-8 h-8 bg-brand/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-[11px] font-bold text-brand">
              {selectedContact.first_name?.[0]}{selectedContact.last_name?.[0]}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-900 truncate">
              {selectedContact.first_name} {selectedContact.last_name}
            </p>
            <p className="text-[10px] text-gray-500 truncate">{selectedContact.phone}</p>
          </div>
          <div className="flex gap-1">
            {selectedContact.phone && (
              <button
                onClick={() => dial(selectedContact.phone, {
                  name: `${selectedContact.first_name} ${selectedContact.last_name}`,
                  phone: selectedContact.phone,
                  contact_id: selectedContact.id,
                })}
                className="p-1.5 rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors"
                title="Call"
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                </svg>
              </button>
            )}
            <button
              onClick={() => setActiveTab('sms')}
              className="p-1.5 rounded-lg bg-brand text-white hover:bg-brand/90 transition-colors"
              title="SMS"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
              </svg>
            </button>
            <button
              onClick={() => setActiveTab('contact')}
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
              title="View contact"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </button>
            <button
              onClick={() => setSelectedContact(null)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              title="Clear"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Active call display */}
      {isInCall && (
        <div className="border-b border-gray-200">
          <ActiveCall />
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-100">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex border-b border-gray-200 px-4">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2.5 text-xs font-medium text-center transition-colors border-b-2 ${
              activeTab === tab.id
                ? 'text-brand border-brand'
                : 'text-gray-400 border-transparent hover:text-gray-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto" style={{ maxHeight: '400px' }}>
        {activeTab === 'dial' && (
          <div className="p-4">
            <DialPad onDial={(phoneNumber) => {
              dial(phoneNumber, selectedContact ? {
                name: `${selectedContact.first_name} ${selectedContact.last_name}`,
                phone: phoneNumber,
                contact_id: selectedContact.id,
              } : { phone: phoneNumber });
            }} />
            {lastCallId && callState === IDLE && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-xs font-medium text-gray-500 mb-2">Call Notes</p>
                <CallNotes callLogId={lastCallId} onSaved={() => setLastCallId(null)} />
              </div>
            )}
          </div>
        )}

        {activeTab === 'sms' && (
          <div className="h-[400px]">
            {selectedContact ? (
              <SmsThread
                contactId={selectedContact.id}
                contactPhone={selectedContact.phone}
                messages={selectedContact.smsMessages || []}
              />
            ) : (
              <SmsStartPanel
                onSelectContact={(contact) => {
                  setSelectedContact(contact);
                  // Stay on SMS tab — don't jump to dial
                }}
              />
            )}
          </div>
        )}

        {activeTab === 'contact' && (
          <div>
            {selectedContact ? (
              <ContactCard contact={selectedContact} onUpdate={setSelectedContact} />
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-center px-4">
                <svg className="w-10 h-10 text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <p className="text-xs text-gray-400">Search and select a contact</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'voicemail' && (
          <div className="h-[400px]">
            <VoicemailInbox />
          </div>
        )}

        {activeTab === 'history' && (
          <div className="p-2">
            <CallHistory onSelectContact={handleContactSelect} />
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="h-[400px]">
            <PhoneSettings />
          </div>
        )}
      </div>
    </div>
  );
}
