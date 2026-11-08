-- Notification preferences: members choose which updates they get by email and by text.
-- Stored as flat on/off flags; a missing key means "on" (see src/lib/notification-prefs.ts).
-- Order emails are always on (money and deadlines), so they have no flag.
-- Run once in Supabase Dashboard > SQL Editor. Safe to run twice.

alter table profiles
  add column if not exists notification_prefs jsonb not null default '{}'::jsonb;
-- Members change these through /api/account/notification-prefs (server-side), not directly.
