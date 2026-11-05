-- Trials: whether the seller offers a trial ride before purchase.
-- Run once in Supabase Dashboard > SQL Editor. Safe to run twice.

alter table listings
  add column if not exists trial_policy text
  check (trial_policy in ('local_trial', 'trial', 'no_trial'));
