-- Unclaimed saddles on the site: saddles added for a seller (quick add) show publicly before the
-- seller claims them, and shoppers' messages about them go to the SaddleUp admin, who passes the
-- inquiry on to the seller. When the seller claims, those conversations move to them.
--
-- Only saddles added from now on show (show_before_claim). Sellers messaged before this were
-- told their saddle stays hidden until they claim it, so theirs stay hidden.
--
-- Claim links move to their own private table: unclaimed listings are now readable by anyone,
-- and the claim token must never be.
--
-- Run once in Supabase Dashboard > SQL Editor. Safe to run twice.

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
