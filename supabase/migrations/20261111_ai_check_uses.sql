-- Counts AI saddle checks by visitors who aren't signed in ("What's your saddle worth?" on the
-- home page), so one visitor can't run up the AI bill. No IP address is stored: ip_hash is a
-- daily-changing hash, like listing_views.visitor_hash. Written only by the server.
-- Run once in Supabase Dashboard > SQL Editor. Safe to run twice.

create table if not exists ai_check_uses (
  id bigserial primary key,
  ip_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_ai_check_uses_ip_time on ai_check_uses(ip_hash, created_at desc);

alter table ai_check_uses enable row level security;
revoke all on ai_check_uses from anon, authenticated;
