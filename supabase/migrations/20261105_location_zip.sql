-- Location ZIP code (city/state are looked up from it in the form).
-- Run once in Supabase Dashboard > SQL Editor. Safe to run twice.

alter table listings
  add column if not exists location_zip text
  check (location_zip ~ '^\d{5}$');
