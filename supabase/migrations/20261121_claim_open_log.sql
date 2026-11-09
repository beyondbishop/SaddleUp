-- One row per claim-link open, so importers can tell a seller's visit from their own check.
--   * device / app: from the browser's user agent, e.g. "iPhone" + "Messenger app".
--   * country: Vercel's two-letter guess from the IP. The IP itself is never stored.
--   * likely_team: the open came from a browser or network an importer/admin uses (see
--     team_networks and the su_team cookie). Those opens don't count as the seller opening it.
--   * minutes_after_message: how long after the importer marked the seller messaged.
-- team_networks: one-way hashes of networks importers have used My imports from (no raw IPs).
-- Written only by the server (service key); no policies, so nobody else can read or write.
-- Run once in Supabase Dashboard > SQL Editor. Safe to run twice.

create table if not exists listing_import_opens (
  id bigserial primary key,
  listing_id uuid not null references listings(id) on delete cascade,
  opened_at timestamptz not null default now(),
  device text,
  app text,
  country text,
  likely_team boolean not null default false,
  team_reason text,
  minutes_after_message int
);
create index if not exists listing_import_opens_listing_idx on listing_import_opens (listing_id, opened_at desc);
alter table listing_import_opens enable row level security;

create table if not exists team_networks (
  network_hash text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  last_seen_at timestamptz not null default now()
);
alter table team_networks enable row level security;
