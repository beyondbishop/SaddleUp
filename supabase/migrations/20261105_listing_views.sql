-- Listing views: one row per (deduplicated) view of a listing page, for seller insights.
-- Privacy: no IP addresses or names are stored. visitor_hash is a one-way hash of
-- (IP + browser + date + secret), so it can count unique visitors per day but can't identify
-- anyone and changes every day. Region is state-level only.
-- Run once in Supabase Dashboard > SQL Editor. Safe to run twice.

create table if not exists listing_views (
  id bigserial primary key,
  listing_id uuid not null references listings(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  visitor_hash text not null,
  signed_in boolean not null default false,
  source text not null,          -- saddleup_search | saddleup_home | saddleup_other | google | facebook | instagram | other_site | direct
  referrer_host text,
  search_filters jsonb,          -- the SaddleUp search filters they used, when they came from search
  country text,
  region text                    -- e.g. state code from Vercel's geo headers
);

create index if not exists idx_listing_views_listing_time on listing_views(listing_id, viewed_at desc);

alter table listing_views enable row level security;

-- Views are written only by the server (service key). Sellers can read views of their own
-- listings; admins can read all.
drop policy if exists "sellers read views of own listings" on listing_views;
create policy "sellers read views of own listings" on listing_views
  for select using (
    exists (select 1 from listings l where l.id = listing_id and l.seller_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true)
  );
