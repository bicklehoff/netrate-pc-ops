// Phone Pop-out — Standalone page for the phone panel in a separate window.
// Opens via window.open() from PhonePanel. Communicates state back to
// the main window via BroadcastChannel.

'use client';

import { useEffect, useState } from 'react';
import { DialerProvider } from '@/components/Portal/Dialer';
import DialPad from '@/components/Portal/Dialer/DialPad';
import ActiveCall from '@/components/Portal/Dialer/ActiveCall';
import CallHistory from '@/components/Portal/Dialer/CallHistory';
import SmsThread from '@/components/Portal/Dialer/SmsThread';
import ContactSearch from '@/components/Portal/Dialer/ContactSearch';
import ContactCard from '@/components/Portal/Dialer/ContactCard';
import { useDialer } from '@/components/Portal/Dialer/DialerProvider';

const TABS = [
  { id: 'dial', label: 'Dial' },
  { id: 'sms', label: 'SMS' },
  { id: 'contact', label: 'Contact' },
  { id: 'history', label: 'History' },
];

function PhonePopoutInner() {
  const { dial, callState, IDLE, deviceReady, error } = useDialer();
  const [activeTab, setActiveTab] = useState('dial');
  const [selectedContact, setSelectedContact] = useState(null);

  const isInCall = callState !== IDLE;

  const handleContactSelect = (contact) => {
    setSelectedContact(contact);
    if (contact.phone) setActiveTab('dial');
  };

  // Set window title
  useEffect(() => {
    document.title = 'NetRate Mortgage — Phone';
  }, []);

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/80 flex items-center gap-3">
        <svg className="w-[18px] h-[18px] text-brand flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>
        <h3 className="text-sm font-bold flex-1">Phone</h3>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${deviceReady ? 'bg-green-500' : 'bg-gray-300'}`} />
          <span className="text-[10px] text-gray-400">{deviceReady ? 'Online' : 'Connecting...'}</span>
        </div>
      </div>

      {/* Search bar */}
      <div className="px-4 py-2 border-b border-gray-100">
        <ContactSearch onSelect={handleContactSelect} />
      </div>

      {/* Selected contact bar */}
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
      )}

      {/* Active call */}
      {isInCall && (
        <div className="border-b border-gray-200">
          <ActiveCall />
        </div>
      )}

      {/* Error */}
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
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'dial' && (
          <div className="p-4">
            <DialPad onDial={(phoneNumber) => {
              dial(phoneNumber, selectedContact ? {
                name: `${selectedContact.first_name} ${selectedContact.last_name}`,
                phone: phoneNumber,
                contact_id: selectedContact.id,
              } : { phone: phoneNumber });
            }} />
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
              <div className="flex flex-col items-center justify-center h-64 text-center px-4">
                <svg className="w-10 h-10 text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="text-xs text-gray-400">Select a contact to start texting</p>
              </div>
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

        {activeTab === 'history' && (
          <div className="p-2">
            <CallHistory onSelectContact={handleContactSelect} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function PhonePopoutPage() {
  return (
    <DialerProvider>
      <PhonePopoutInner />
    </DialerProvider>
  );
}
