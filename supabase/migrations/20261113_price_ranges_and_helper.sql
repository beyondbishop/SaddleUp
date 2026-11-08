-- Fair price ranges and the listing helper.
-- 1. price_range_cache: one AI price check per saddle description, shared by the import check,
--    the form's price box and the saddle page, so the same saddle isn't priced (and paid for) twice.
-- 2. listings.price_range_*: the range shown publicly on each saddle page. Written only by the
--    server (sellers can't set their own "fair range").
-- 3. ai_helper_uses: one row per listing-helper message, for the per-person daily limit.
-- Run once in Supabase Dashboard > SQL Editor. Safe to run twice.

create table if not exists price_range_cache (
  key text primary key,
  low int not null,
  typical int not null,
  high int not null,
  confidence text,
  reasoning text,
  sources text[],
  searched boolean default false,
  created_at timestamptz not null default now()
);
alter table price_range_cache enable row level security;
revoke all on price_range_cache from anon, authenticated;

alter table listings add column if not exists price_range_low int;
alter table listings add column if not exists price_range_typical int;
alter table listings add column if not exists price_range_high int;
alter table listings add column if not exists price_range_key text;
alter table listings add column if not exists price_range_at timestamptz;

-- Sellers write their own listings through row-level security; keep the range server-only.
-- (Signed-in and anonymous requests run as 'authenticated'/'anon'; the server uses the service role.)
create or replace function public.protect_price_range()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.price_range_low := null; new.price_range_typical := null; new.price_range_high := null;
      new.price_range_key := null; new.price_range_at := null;
    else
      new.price_range_low := old.price_range_low; new.price_range_typical := old.price_range_typical;
      new.price_range_high := old.price_range_high; new.price_range_key := old.price_range_key;
      new.price_range_at := old.price_range_at;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists listings_protect_price_range on listings;
create trigger listings_protect_price_range
  before insert or update on listings
  for each row execute procedure public.protect_price_range();

create table if not exists ai_helper_uses (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists idx_ai_helper_uses_user_time on ai_helper_uses(user_id, created_at desc);
alter table ai_helper_uses enable row level security;
revoke all on ai_helper_uses from anon, authenticated;
