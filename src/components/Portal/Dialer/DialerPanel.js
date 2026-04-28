// DialerPanel — Main dialer sidebar component
// Lives on the right side of the MLO portal.
// Tabs: Dial Pad | Recent | SMS
// Includes contact search, active call display, and notes.

'use client';

import { useState, useCallback } from 'react';
import { useDialer } from './DialerProvider';
import ContactSearch from './ContactSearch';
import DialPad from './DialPad';
import ActiveCall from './ActiveCall';
import CallHistory from './CallHistory';
import CallNotes from './CallNotes';
import SmsThread from './SmsThread';
import AudioSettings from './AudioSettings';

const TABS = [
  { id: 'dialpad', label: 'Dial', icon: 'phone' },
  { id: 'recent', label: 'Recent', icon: 'clock' },
  { id: 'sms', label: 'SMS', icon: 'chat' },
];

export default function DialerPanel() {
  const { dial, callState, IDLE, deviceReady, error } = useDialer();
  const [activeTab, setActiveTab] = useState('dialpad');
  const [selectedContact, setSelectedContact] = useState(null);
  const [lastCallId, setLastCallId] = useState(null);
  const [showAudioSettings, setShowAudioSettings] = useState(false);

  const handleContactSelect = useCallback((contact) => {
    setSelectedContact(contact);
    // If contact has a phone, auto-switch to dial pad ready to call
    if (contact.phone) {
      setActiveTab('dialpad');
    }
  }, []);

  const handleDial = useCallback((phoneNumber) => {
    dial(phoneNumber, selectedContact ? {
      name: `${selectedContact.first_name} ${selectedContact.last_name}`,
      phone: phoneNumber,
      contact_id: selectedContact.id,
    } : { phone: phoneNumber });
  }, [dial, selectedContact]);

  const handleQuickDial = useCallback(() => {
    if (selectedContact?.phone) {
      handleDial(selectedContact.phone);
    }
  }, [selectedContact, handleDial]);

  const isInCall = callState !== IDLE;

  return (
    <div className="w-72 border-l border-gray-200 bg-white flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-900">Dialer</h3>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${deviceReady ? 'bg-green-500' : 'bg-gray-300'}`} />
            <span className="text-[10px] text-gray-400">{deviceReady ? 'Online' : 'Connecting...'}</span>
            <button
              onClick={() => setShowAudioSettings((v) => !v)}
              className={`p-1 rounded transition-colors ${showAudioSettings ? 'text-brand bg-brand/10' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
              title="Audio settings"
              aria-label="Audio settings"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
        <ContactSearch onSelect={handleContactSelect} />
      </div>

      {showAudioSettings && (
        <AudioSettings onClose={() => setShowAudioSettings(false)} />
      )}

      {/* Selected contact quick bar */}
      {selectedContact && !isInCall && (
        <div className="px-3 py-2 bg-brand/5 border-b border-brand/10 flex items-center gap-2">
          <div className="w-7 h-7 bg-brand/10 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-[10px] font-semibold text-brand">
              {selectedContact.first_name?.[0]}{selectedContact.last_name?.[0]}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-900 truncate">
              {selectedContact.first_name} {selectedContact.last_name}
            </p>
            <p className="text-[10px] text-gray-500 truncate">{selectedContact.phone}</p>
          </div>
          <div className="flex gap-1">
            {selectedContact.phone && (
              <button
                onClick={handleQuickDial}
                className="p-1.5 rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors"
                title="Call"
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                </svg>
              </button>
            )}
            <button
              onClick={() => {
                setActiveTab('sms');
              }}
              className="p-1.5 rounded-lg bg-brand text-white hover:bg-brand/90 transition-colors"
              title="SMS"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
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
        <div className="px-3 py-3 border-b border-gray-200">
          <ActiveCall />
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="px-3 py-2 bg-red-50 border-b border-red-100">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 text-xs font-medium text-center transition-colors ${
              activeTab === tab.id
                ? 'text-brand border-b-2 border-brand'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'dialpad' && (
          <div className="p-3">
            <DialPad onDial={handleDial} />
            {/* Show notes input after a call ends */}
            {lastCallId && callState === IDLE && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-xs font-medium text-gray-500 mb-2">Call Notes</p>
                <CallNotes
                  callLogId={lastCallId}
                  onSaved={() => setLastCallId(null)}
                />
              </div>
            )}
          </div>
        )}

        {activeTab === 'recent' && (
          <div className="p-2">
            <CallHistory onSelectContact={handleContactSelect} />
          </div>
        )}

        {activeTab === 'sms' && (
          <div className="h-full">
            {selectedContact ? (
              <SmsThread
                contactId={selectedContact.id}
                contactPhone={selectedContact.phone}
                messages={selectedContact.smsMessages || []}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <svg className="w-10 h-10 text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="text-xs text-gray-400">Select a contact to view SMS</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
