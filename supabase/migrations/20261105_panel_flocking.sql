-- Panels: what the saddle's panels are stuffed with (wool flocked, foam, or CAIR air panels).
-- Run once in Supabase Dashboard > SQL Editor. Safe to run twice.

alter table listings
  add column if not exists panel_flocking text
  check (panel_flocking in ('wool', 'foam', 'cair'));

create index if not exists idx_listings_panel_flocking on listings(panel_flocking);
