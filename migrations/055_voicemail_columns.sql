-- Migration 055 — Voicemail support
-- Adds greeting URL to staff and heard/transcription columns to call_logs.
-- All columns nullable — existing rows unaffected.

ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS voicemail_greeting_url text;

ALTER TABLE call_logs
  ADD COLUMN IF NOT EXISTS voicemail_heard_at  timestamptz,
  ADD COLUMN IF NOT EXISTS transcription_text  text;
