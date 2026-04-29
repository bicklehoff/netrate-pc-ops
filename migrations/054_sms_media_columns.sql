-- Migration 054 — SMS MMS image support
-- Adds media storage columns to sms_messages for inbound and outbound MMS.
-- All columns nullable — existing rows are unaffected.
--
-- media_url:          Vercel Blob public URL (null = no media or purged)
-- media_content_type: MIME type of the media (image/jpeg, image/png, etc.)
-- media_purged_at:    Stamped when the blob is deleted by the weekly purge cron
--                     (null = still live or no media ever attached)

ALTER TABLE sms_messages
  ADD COLUMN IF NOT EXISTS media_url          text,
  ADD COLUMN IF NOT EXISTS media_content_type text,
  ADD COLUMN IF NOT EXISTS media_purged_at    timestamptz;
