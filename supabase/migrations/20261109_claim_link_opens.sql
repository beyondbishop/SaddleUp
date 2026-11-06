-- Track when a seller opens the claim link an importer sent them, so importers can see who
-- looked but hasn't claimed yet (and follow up). Written only by the server.
-- Run once in Supabase Dashboard > SQL Editor. Safe to run twice.

alter table listing_imports add column if not exists link_first_opened_at timestamptz;
alter table listing_imports add column if not exists link_last_opened_at timestamptz;
alter table listing_imports add column if not exists link_open_count int not null default 0;
