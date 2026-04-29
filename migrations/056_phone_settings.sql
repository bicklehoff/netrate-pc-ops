-- Migration 056: Full phone app settings
-- Adds voicemail modes, call routing, SMS auto-reply to staff table
-- Adds auto-reply flag to sms_messages

-- Voicemail mode: auto (Alice TTS) | standard (recorded) | exception (OOO recording)
ALTER TABLE staff ADD COLUMN IF NOT EXISTS voicemail_mode text NOT NULL DEFAULT 'standard';

-- Exception/OOO voicemail greeting (separate slot from standard)
ALTER TABLE staff ADD COLUMN IF NOT EXISTS voicemail_exception_url text;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS voicemail_exception_until date;

-- SMS auto-reply
ALTER TABLE staff ADD COLUMN IF NOT EXISTS sms_auto_reply_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS sms_auto_reply_message text;

-- Call forwarding (unconditional — all calls forwarded to this number)
ALTER TABLE staff ADD COLUMN IF NOT EXISTS call_forward_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS call_forward_number text;

-- Do Not Disturb — skip browser ring + cell, go straight to voicemail
ALTER TABLE staff ADD COLUMN IF NOT EXISTS dnd_enabled boolean NOT NULL DEFAULT false;

-- Auto-reply flag on sms_messages to prevent reply loops
ALTER TABLE sms_messages ADD COLUMN IF NOT EXISTS is_auto_reply boolean NOT NULL DEFAULT false;
