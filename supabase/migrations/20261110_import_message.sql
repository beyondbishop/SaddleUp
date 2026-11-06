-- The message an importer sends the seller, saved so they can edit it and come back to it
-- (it includes tips found at import time, like a misspelled brand or a price suggestion).
-- Run once in Supabase Dashboard > SQL Editor. Safe to run twice.

alter table listing_imports add column if not exists message text;
