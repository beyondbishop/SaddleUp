-- One short video per listing (walk-around, flaps, panels). Stored in the saddle-images bucket under
-- the seller's folder; this is its public URL.
-- Run once in Supabase Dashboard > SQL Editor. Safe to run twice.

alter table listings add column if not exists video_url text;
