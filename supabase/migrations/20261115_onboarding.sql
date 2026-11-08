-- Onboarding after sign-up: why someone joined (looking / selling / both), what they ride, and
-- when they finished (or skipped) the welcome steps. Photo, ZIP and phone already have homes.
-- Run once in Supabase Dashboard > SQL Editor. Safe to run twice.

alter table profiles
  add column if not exists member_intent text check (member_intent in ('buying', 'selling', 'both')),
  add column if not exists disciplines discipline[] not null default '{}',
  add column if not exists onboarded_at timestamptz;   -- null = hasn't been through /welcome yet

-- Everyone who joined before onboarding existed counts as done, so they aren't stopped on next sign-in.
update profiles set onboarded_at = now() where onboarded_at is null and created_at < now();
