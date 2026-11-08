-- =========================================================
-- SaddleUp core schema
-- Run this in Supabase SQL editor (Project > SQL Editor > New query)
-- =========================================================

-- ---------- PROFILES (extends Supabase auth.users) ----------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  is_seller boolean default false,
  is_admin boolean default false,
  stripe_connect_account_id text,          -- Stripe Connect account for payouts
  stripe_connect_onboarded boolean default false,
  created_at timestamptz default now()
);

alter table profiles enable row level security;
create policy "profiles are viewable by owner" on profiles
  for select using (auth.uid() = id);
create policy "profiles are editable by owner" on profiles
  for update using (auth.uid() = id);
create policy "profiles insertable by owner" on profiles
  for insert with check (auth.uid() = id);

-- Auto-create a profile row whenever someone signs up
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------- REFERENCE DATA (drives filters + SEO pages) ----------
create table brands (
  id serial primary key,
  name text unique not null,
  slug text unique not null
);

insert into brands (name, slug) values
  ('Antares','antares'),('CWD','cwd'),('Devoucoux','devoucoux'),('Voltaire Design','voltaire-design'),
  ('Hermes','hermes'),('Stubben','stubben'),('Prestige','prestige'),('Black Country','black-country'),
  ('County Saddlery','county-saddlery'),('Bruno Delgrange','bruno-delgrange'),('Albion','albion'),
  ('Amerigo','amerigo'),('Equipe','equipe'),('Equiline','equiline'),('Schleese','schleese'),
  ('Tad Coffin','tad-coffin'),('Wintec','wintec'),('Pessoa','pessoa'),('Other','other');

create type discipline as enum ('hunter_jumper','dressage','all_purpose','western','pony_child','endurance','eventing');
create type tree_width as enum ('x_narrow','narrow','medium_narrow','medium','medium_wide','wide','x_wide','adjustable');
create type listing_status as enum ('draft','unclaimed','active','pending_sale','sold','removed');

-- ---------- LISTINGS ----------
create table listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references profiles(id) on delete set null,

  brand_id int references brands(id),
  model text not null,
  discipline discipline not null,
  seat_size numeric(3,1) not null,           -- e.g. 17.5
  tree_width tree_width not null,
  panel_type text,                            -- regular / long / monoflap / short
  flap_length text,                           -- forward / standard / long
  year_manufactured int,
  condition text,                             -- new / excellent / good / fair
  color text,
  price_cents int not null,
  description text,

  -- physical dimensions used for horse-matching
  tree_width_cm numeric(4,1),                 -- actual channel/gullet width if known
  seat_to_pommel_cm numeric(4,1),
  panel_length_cm numeric(4,1),

  images text[] default '{}',                 -- Supabase Storage public URLs
  slug text unique not null,
  status listing_status default 'draft',

  -- SEO/GEO fields
  meta_title text,
  meta_description text,
  location_city text,
  location_state text,

  -- claim flow: seeded listings before a seller has claimed them
  claim_token uuid default gen_random_uuid(),
  claimed_at timestamptz,
  source text default 'seller',               -- 'seller' | 'seeded'

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_listings_status on listings(status);
create index idx_listings_discipline on listings(discipline);
create index idx_listings_brand on listings(brand_id);
create index idx_listings_seat on listings(seat_size);
create index idx_listings_tree on listings(tree_width);
create index idx_listings_price on listings(price_cents);

alter table listings enable row level security;
create policy "active listings are public" on listings
  for select using (status = 'active' or seller_id = auth.uid());
create policy "sellers manage own listings" on listings
  for all using (seller_id = auth.uid()) with check (seller_id = auth.uid());

-- ---------- HORSE PROFILES (for matching) ----------
create table horses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id) on delete cascade,
  name text not null,
  breed text,
  height_hh numeric(3,1),                     -- hands high
  back_length_cm numeric(4,1),
  back_width_cm numeric(4,1),                 -- widest point behind shoulder blade
  withers_shape text,                         -- 'mutton' | 'average' | 'prominent'
  created_at timestamptz default now()
);
alter table horses enable row level security;
create policy "owners manage own horses" on horses
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ---------- RIDER PROFILES (for seat size matching) ----------
create table riders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id) on delete cascade,
  name text not null,
  height_cm numeric(4,1),
  inseam_cm numeric(4,1),
  hip_width_cm numeric(4,1),
  created_at timestamptz default now()
);
alter table riders enable row level security;
create policy "owners manage own riders" on riders
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ---------- FAVORITES ----------
create table favorites (
  user_id uuid references profiles(id) on delete cascade,
  listing_id uuid references listings(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, listing_id)
);
alter table favorites enable row level security;
create policy "users manage own favorites" on favorites
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- WATCHLIST (saved search criteria + alerts) ----------
create table saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  label text not null,                        -- e.g. "17in Medium Hunter/Jumper under $3k"
  discipline discipline,
  brand_id int references brands(id),
  seat_size_min numeric(3,1),
  seat_size_max numeric(3,1),
  tree_widths tree_width[],
  price_max_cents int,
  horse_id uuid references horses(id),         -- optional: match against a specific horse
  rider_id uuid references riders(id),
  last_notified_at timestamptz,
  created_at timestamptz default now()
);
alter table saved_searches enable row level security;
create policy "users manage own saved searches" on saved_searches
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- track which listings we've already alerted a user about, so we don't spam
create table saved_search_matches_sent (
  saved_search_id uuid references saved_searches(id) on delete cascade,
  listing_id uuid references listings(id) on delete cascade,
  sent_at timestamptz default now(),
  primary key (saved_search_id, listing_id)
);
alter table saved_search_matches_sent enable row level security;
create policy "system only" on saved_search_matches_sent for all using (false);

-- ---------- ORDERS / COMMISSION ----------
create table orders (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references listings(id),
  buyer_id uuid references profiles(id),
  seller_id uuid references profiles(id),
  sale_price_cents int not null,
  commission_cents int not null,
  seller_payout_cents int not null,
  stripe_payment_intent_id text,
  stripe_transfer_id text,
  status text default 'pending',               -- pending | paid | refunded
  payout_status text default 'held',           -- held | released | transferred
  confirmed_at timestamptz,                    -- buyer clicked "confirm receipt"
  release_at timestamptz,                      -- auto-release date if buyer does nothing (trial window)
  created_at timestamptz default now()
);
alter table orders enable row level security;
create policy "buyers and sellers view own orders" on orders
  for select using (buyer_id = auth.uid() or seller_id = auth.uid());
create policy "buyers can confirm receipt on own orders" on orders
  for update using (buyer_id = auth.uid()) with check (buyer_id = auth.uid());

-- =========================================================
-- COMMISSION CALCULATION (kept server-side too, but mirrored here
-- as a SQL function so it can be reused in triggers/reports)
-- 20% commission, capped at $500 (50000 cents)
-- =========================================================
create function calc_commission_cents(sale_price_cents int)
returns int as $$
  select least(round(sale_price_cents * 0.20)::int, 50000);
$$ language sql immutable;

-- =========================================================
-- HORSE <-> SADDLE MATCHING FUNCTION
-- Maps a horse's back width (cm) to compatible tree_width enum values.
-- These thresholds are the industry-standard rule-of-thumb ranges used by
-- saddle fitters; treat as a *starting filter*, not a substitute for a fit.
-- =========================================================
create function tree_widths_for_horse(p_back_width_cm numeric)
returns tree_width[] as $$
begin
  return case
    when p_back_width_cm < 28 then array['x_narrow','narrow']::tree_width[]
    when p_back_width_cm < 30 then array['narrow','medium_narrow']::tree_width[]
    when p_back_width_cm < 32 then array['medium_narrow','medium']::tree_width[]
    when p_back_width_cm < 34 then array['medium','medium_wide']::tree_width[]
    when p_back_width_cm < 36 then array['medium_wide','wide']::tree_width[]
    else array['wide','x_wide','adjustable']::tree_width[]
  end;
end;
$$ language plpgsql immutable;

-- Admins can moderate any listing (approve/reject pending submissions)
create policy "admins manage all listings" on listings
  for all using (exists (select 1 from profiles where id = auth.uid() and is_admin = true));

-- ---------- MESSAGING (buyer <-> seller inquiry threads) ----------
create table conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references listings(id) on delete cascade,
  buyer_id uuid references profiles(id) on delete cascade,
  seller_id uuid references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique (listing_id, buyer_id)
);
alter table conversations enable row level security;
create policy "participants view own conversations" on conversations
  for select using (buyer_id = auth.uid() or seller_id = auth.uid());
create policy "buyers start conversations" on conversations
  for insert with check (buyer_id = auth.uid());

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade,
  sender_id uuid references profiles(id),
  body text not null,
  created_at timestamptz default now(),
  read_at timestamptz
);
alter table messages enable row level security;
create policy "participants view messages" on messages
  for select using (
    exists (
      select 1 from conversations c
      where c.id = conversation_id and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
    )
  );
create policy "participants send messages" on messages
  for insert with check (
    sender_id = auth.uid() and exists (
      select 1 from conversations c
      where c.id = conversation_id and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
    )
  );

-- ---------- REVIEWS (builds buyer trust in sellers) ----------
create table reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade unique,
  reviewer_id uuid references profiles(id),
  reviewee_id uuid references profiles(id),   -- the seller being reviewed
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz default now()
);
alter table reviews enable row level security;
create policy "reviews are public" on reviews for select using (true);
create policy "buyers review their own completed orders" on reviews
  for insert with check (
    reviewer_id = auth.uid() and exists (
      select 1 from orders o where o.id = order_id and o.buyer_id = auth.uid()
    )
  );

-- Rider inseam (cm) -> recommended seat size range (inches), rule-of-thumb.
create function seat_size_for_rider(p_inseam_cm numeric)
returns numeric[] as $$
begin
  return case
    when p_inseam_cm < 68 then array[16.0, 16.5]
    when p_inseam_cm < 73 then array[16.5, 17.0]
    when p_inseam_cm < 78 then array[17.0, 17.5]
    when p_inseam_cm < 83 then array[17.5, 18.0]
    else array[18.0, 19.0]
  end;
end;
$$ language plpgsql immutable;

-- =========================================================
-- STORAGE: saddle photos
-- Run this AFTER creating a public bucket named "saddle-images" in
-- Supabase Dashboard > Storage (or the insert below will error — the
-- bucket must exist first, or just let this statement create it).
-- =========================================================
insert into storage.buckets (id, name, public) values ('saddle-images', 'saddle-images', true)
  on conflict (id) do nothing;

create policy "anyone can view saddle images" on storage.objects
  for select using (bucket_id = 'saddle-images');
create policy "authenticated users can upload saddle images" on storage.objects
  for insert with check (bucket_id = 'saddle-images' and auth.role() = 'authenticated');
create policy "users can delete their own uploaded images" on storage.objects
  for delete using (bucket_id = 'saddle-images' and owner = auth.uid());

-- ---------- EBAY IMPORT (also in migrations/20261104_ebay_import.sql) ----------
alter table listings
  add column if not exists ebay_item_id text,
  add column if not exists ebay_item_url text,
  add column if not exists ebay_seller_username text,
  add column if not exists ebay_imported_at timestamptz;

-- One SaddleUp listing per eBay listing (ignores removed listings so a seller can re-import).
create unique index if not exists idx_listings_ebay_item
  on listings(ebay_item_id)
  where ebay_item_id is not null and status <> 'removed';

-- Lets the import route check for duplicates across all sellers without exposing other
-- sellers' draft listings through row-level security.
create or replace function ebay_item_already_imported(p_item_id text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from listings
    where ebay_item_id = p_item_id and status <> 'removed'
  );
$$;

revoke all on function ebay_item_already_imported(text) from public;
revoke all on function ebay_item_already_imported(text) from anon;
grant execute on function ebay_item_already_imported(text) to authenticated;

-- ---------- CLAIM FUNCTIONS (also in migrations/20261104_claim_functions.sql) ----------

-- Read the listing behind a claim link (limited fields; never returns the token itself).
create or replace function get_claimable_listing(p_token uuid)
returns table (id uuid, seat_size numeric, model text, brand_name text, tree_width tree_width, price_cents int)
language sql
security definer
set search_path = public
stable
as $$
  select l.id, l.seat_size, l.model, b.name, l.tree_width, l.price_cents
  from listings l
  left join brands b on b.id = l.brand_id
  where l.claim_token = p_token
    and l.status = 'unclaimed'
    and l.seller_id is null;
$$;

-- Attach the listing to the signed-in user. It becomes a draft (goes to admin review once the
-- seller has checked details and added photos), and the claim link stops working.
create or replace function claim_listing(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  update listings
     set seller_id = auth.uid(),
         status = 'draft',
         claimed_at = now(),
         claim_token = null
   where claim_token = p_token
     and status = 'unclaimed'
     and seller_id is null
  returning id into v_id;

  if v_id is null then
    raise exception 'claim link is invalid or already used';
  end if;
  return v_id;
end;
$$;

revoke all on function get_claimable_listing(uuid) from public;
revoke all on function claim_listing(uuid) from public;
revoke all on function claim_listing(uuid) from anon;
grant execute on function get_claimable_listing(uuid) to anon, authenticated;
grant execute on function claim_listing(uuid) to authenticated;

-- ---------- BRANDS READABLE + MORE BRANDS (also in migrations/20261104_brands_public.sql) ----------
alter table brands enable row level security;

drop policy if exists "brands are public" on brands;
create policy "brands are public" on brands
  for select using (true);

-- Keep in sync with src/lib/saddle-catalog.ts
insert into brands (name, slug) values
  ('Bates','bates'),
  ('Butet','butet'),
  ('Childeric','childeric'),
  ('Kent & Masters','kent-and-masters'),
  ('Kieffer','kieffer'),
  ('Passier','passier'),
  ('Thorowgood','thorowgood'),
  ('Big Horn','big-horn'),
  ('Billy Cook','billy-cook'),
  ('Circle Y','circle-y'),
  ('Crates','crates'),
  ('Dale Chavez','dale-chavez'),
  ('Martin Saddlery','martin-saddlery'),
  ('Reinsman','reinsman'),
  ('Tucker','tucker')
on conflict do nothing;

-- ---------- TRIALS (also in migrations/20261105_trial_policy.sql) ----------
alter table listings
  add column if not exists trial_policy text
  check (trial_policy in ('local_trial', 'trial', 'no_trial'));

-- ---------- LOCATION ZIP (also in migrations/20261105_location_zip.sql) ----------
alter table listings
  add column if not exists location_zip text
  check (location_zip ~ '^\d{5}$');

-- ---------- PANEL FLOCKING (also in migrations/20261105_panel_flocking.sql) ----------
alter table listings
  add column if not exists panel_flocking text
  check (panel_flocking in ('wool', 'foam', 'cair'));

create index if not exists idx_listings_panel_flocking on listings(panel_flocking);

-- ---------- LISTING VIEWS (also in migrations/20261105_listing_views.sql) ----------

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

-- ---------- TRANSACTION SAFETY ----------
-- Lives in migrations/20261105_transaction_safety.sql (RLS lockdown, checkout reservations,
-- idempotent fulfillment, claim-then-transfer payouts, delivery-based inspection clock).

-- ---------- BUYERS SEE PURCHASED (also in migrations/20261105_buyers_see_purchased.sql) ----------
drop policy if exists "buyers see listings they ordered" on listings;
create policy "buyers see listings they ordered" on listings
  for select using (
    exists (select 1 from orders o where o.listing_id = listings.id and o.buyer_id = auth.uid())
  );

-- ---------- UNCLAIMED SADDLES FOR SALE (also in migrations/20261113_unclaimed_for_sale.sql) ----------
-- 1. Private claim tokens -------------------------------------------------------------------
create table if not exists public.listing_claim_tokens (
  listing_id uuid primary key references public.listings(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  created_at timestamptz default now()
);
alter table public.listing_claim_tokens enable row level security;
-- No policies: only the service key and the security-definer functions below can read it.

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'listings' and column_name = 'claim_token') then
    insert into public.listing_claim_tokens (listing_id, token)
      select id, claim_token from public.listings
      where claim_token is not null and status = 'unclaimed' and seller_id is null
    on conflict (listing_id) do nothing;
  end if;
end $$;

-- 2. Which unclaimed saddles are public ---------------------------------------------------------
alter table public.listings add column if not exists show_before_claim boolean not null default false;

drop policy if exists "active listings are public" on public.listings;
create policy "active listings are public" on public.listings
  for select using (
    status in ('active', 'pending_sale')
    or (status = 'unclaimed' and show_before_claim)
    or seller_id = auth.uid()
  );

-- 3. Seller guard no longer mentions claim_token -------------------------------------------------
create or replace function public.listings_guard_seller_changes()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if exists (select 1 from profiles where id = auth.uid() and is_admin) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status is distinct from 'draft' then
      raise exception 'New listings start as drafts and go live after review.' using errcode = '42501';
    end if;
    return new;
  end if;

  if old.status in ('pending_sale', 'sold') then
    raise exception 'This saddle is being sold and can''t be changed.' using errcode = '42501';
  end if;
  if new.status is distinct from old.status and new.status <> 'removed' then
    raise exception 'Only SaddleUp can change a listing''s status.' using errcode = '42501';
  end if;
  if new.seller_id is distinct from old.seller_id
     or new.claimed_at is distinct from old.claimed_at
     or new.show_before_claim is distinct from old.show_before_claim
     or new.source is distinct from old.source then
    raise exception 'That field can''t be changed.' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- 4. Claim functions use the private table ------------------------------------------------------
create or replace function public.get_claimable_listing(p_token uuid)
returns table (id uuid, seat_size numeric, model text, brand_name text, tree_width tree_width, price_cents int)
language sql
security definer
set search_path = public
stable
as $$
  select l.id, l.seat_size, l.model, b.name, l.tree_width, l.price_cents
  from listing_claim_tokens t
  join listings l on l.id = t.listing_id
  left join brands b on b.id = l.brand_id
  where t.token = p_token
    and l.status = 'unclaimed'
    and l.seller_id is null;
$$;

-- Attach the listing to the signed-in user. It becomes a draft (goes to admin review), the claim
-- link stops working, and shoppers' conversations about it move to the seller.
create or replace function public.claim_listing(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  update listings l
     set seller_id = auth.uid(),
         status = 'draft',
         claimed_at = now()
    from listing_claim_tokens t
   where t.token = p_token
     and l.id = t.listing_id
     and l.status = 'unclaimed'
     and l.seller_id is null
  returning l.id into v_id;

  if v_id is null then
    raise exception 'claim link is invalid or already used';
  end if;

  delete from listing_claim_tokens where listing_id = v_id;
  update conversations set seller_id = auth.uid() where listing_id = v_id and buyer_id <> auth.uid();
  return v_id;
end;
$$;

revoke all on function public.get_claimable_listing(uuid) from public;
revoke all on function public.claim_listing(uuid) from public;
revoke all on function public.claim_listing(uuid) from anon;
grant execute on function public.get_claimable_listing(uuid) to anon, authenticated;
grant execute on function public.claim_listing(uuid) to authenticated;

-- 5. Conversations go to the right person ---------------------------------------------------------
-- The seller on a conversation always comes from the listing (a shopper can't pick it). For an
-- unclaimed saddle with no seller yet, it goes to the SaddleUp admin.
create or replace function public.conversations_set_seller()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_seller uuid;
  v_status listing_status;
begin
  select seller_id, status into v_seller, v_status from listings where id = new.listing_id;
  if v_seller is null and v_status = 'unclaimed' then
    select id into v_seller from profiles where is_admin order by created_at limit 1;
  end if;
  if v_seller is null then
    raise exception 'This saddle can''t be messaged right now.' using errcode = '42501';
  end if;
  if v_seller = new.buyer_id then
    raise exception 'This is your own listing.' using errcode = '42501';
  end if;
  new.seller_id := v_seller;
  return new;
end;
$$;
drop trigger if exists trg_conversations_set_seller on public.conversations;
create trigger trg_conversations_set_seller
  before insert on public.conversations
  for each row execute function public.conversations_set_seller();

-- 6. Drop the old public column ------------------------------------------------------------------
alter table public.listings drop column if exists claim_token;

-- ---------- BRANDS PEOPLE ADD (also in migrations/20261116_brand_suggestions.sql) ----------
alter table brands
  add column if not exists approved boolean not null default true,
  add column if not exists suggested_by uuid references profiles(id) on delete set null,
  add column if not exists created_at timestamptz not null default now();
create index if not exists idx_brands_pending on brands(approved) where not approved;
insert into brands (name, slug) values ('Henri de Rivel', 'henri-de-rivel') on conflict do nothing;

-- ---------- LISTING VIDEO (also in migrations/20261117_listing_video.sql) ----------
alter table listings add column if not exists video_url text;
