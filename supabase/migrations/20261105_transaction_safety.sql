-- Transaction safety: locks down what signed-in users can change, makes Stripe fulfillment
-- idempotent, reserves a saddle during checkout, and makes payouts claim-then-transfer.
-- Run once in Supabase Dashboard > SQL Editor. Safe to run twice.

-- =========================================================
-- 1. PROFILES: users may edit only their name and phone.
--    is_admin and the Stripe payout fields are written by the server (service role) only.
-- =========================================================
revoke insert, update, delete on profiles from anon, authenticated;
grant update (full_name, phone) on profiles to authenticated;
drop policy if exists "profiles insertable by owner" on profiles;
-- (Profiles are created by the handle_new_user() trigger, which runs as its owner.)

-- =========================================================
-- 2. ORDERS: buyers and sellers can read their orders; only the server writes them.
-- =========================================================
drop policy if exists "buyers can confirm receipt on own orders" on orders;
revoke insert, update, delete on orders from anon, authenticated;

alter table orders
  add column if not exists stripe_checkout_session_id text,
  add column if not exists delivered_at timestamptz,        -- carrier-confirmed delivery
  add column if not exists payout_error text,
  add column if not exists payout_attempted_at timestamptz;

-- payout_status values: held | releasing | transferred | disputed | cancelled
-- release_at stays null until delivery is confirmed; then it's delivered_at + 120 hours.
create unique index if not exists idx_orders_checkout_session
  on orders(stripe_checkout_session_id) where stripe_checkout_session_id is not null;
create unique index if not exists idx_orders_payment_intent
  on orders(stripe_payment_intent_id) where stripe_payment_intent_id is not null;
create unique index if not exists idx_orders_listing_live
  on orders(listing_id) where status = 'paid';

-- The inspection clock starts once, from the first confirmed delivery. Later delivery
-- updates never reset it.
create or replace function orders_start_inspection_clock()
returns trigger language plpgsql as $$
begin
  if old.delivered_at is not null and new.delivered_at is distinct from old.delivered_at then
    new.delivered_at := old.delivered_at;
  end if;
  if old.delivered_at is null and new.delivered_at is not null and new.release_at is null then
    new.release_at := new.delivered_at + interval '120 hours';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_orders_inspection_clock on orders;
create trigger trg_orders_inspection_clock
  before update of delivered_at on orders
  for each row execute function orders_start_inspection_clock();

-- =========================================================
-- 3. LISTINGS: sellers can't publish, un-sell, or edit a saddle mid-sale.
--    Only enforced for signed-in browser/API sessions; the server (service role),
--    admins, and security-definer functions such as claim_listing() are unaffected.
-- =========================================================
-- Deliberately NOT security definer: current_user must be the caller's role.
create or replace function listings_guard_seller_changes()
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
     or new.claim_token is distinct from old.claim_token
     or new.claimed_at is distinct from old.claimed_at
     or new.source is distinct from old.source then
    raise exception 'That field can''t be changed.' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_listings_guard on listings;
create trigger trg_listings_guard
  before insert or update on listings
  for each row execute function listings_guard_seller_changes();

-- Saddles in checkout stay viewable (shown as "in checkout"), but browse pages filter to active.
drop policy if exists "active listings are public" on listings;
create policy "active listings are public" on listings
  for select using (status in ('active', 'pending_sale') or seller_id = auth.uid());

-- =========================================================
-- 4. CHECKOUT RESERVATIONS: one buyer at a time per saddle.
--    Kept in their own table so who's buying is never public.
-- =========================================================
create table if not exists listing_reservations (
  listing_id uuid primary key references listings(id) on delete cascade,
  buyer_id uuid not null references profiles(id) on delete cascade,
  stripe_checkout_session_id text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table listing_reservations enable row level security;
drop policy if exists "system only" on listing_reservations;
create policy "system only" on listing_reservations for all using (false);

-- Payments that couldn't be matched to a reservation (refunded automatically) and other
-- money problems support needs to see.
create table if not exists payment_exceptions (
  id uuid primary key default gen_random_uuid(),
  kind text not null,                       -- checkout_conflict | payout_failed | ...
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  order_id uuid references orders(id),
  listing_id uuid references listings(id),
  buyer_id uuid references profiles(id),
  detail jsonb,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists idx_payment_exceptions_session_kind
  on payment_exceptions(stripe_checkout_session_id, kind) where stripe_checkout_session_id is not null;
alter table payment_exceptions enable row level security;
drop policy if exists "admins read payment exceptions" on payment_exceptions;
create policy "admins read payment exceptions" on payment_exceptions
  for select using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

-- Reserve a saddle for a buyer. Returns:
--   'reserved'                      fresh reservation
--   'renewed:<old session id>'      same buyer clicked Buy again; caller expires the old session
--   'unavailable'                   sold, removed, or another buyer is checking out
create or replace function reserve_listing(p_listing_id uuid, p_buyer_id uuid, p_expires_at timestamptz)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_status listing_status;
  v_res listing_reservations%rowtype;
begin
  select status into v_status from listings where id = p_listing_id for update;
  if v_status is null then return 'unavailable'; end if;

  select * into v_res from listing_reservations where listing_id = p_listing_id;

  if v_status = 'pending_sale' and v_res.listing_id is not null
     and v_res.expires_at > now() and v_res.buyer_id <> p_buyer_id then
    return 'unavailable';
  end if;
  if v_status not in ('active', 'pending_sale') then
    return 'unavailable';
  end if;

  update listings set status = 'pending_sale' where id = p_listing_id;
  insert into listing_reservations (listing_id, buyer_id, expires_at)
  values (p_listing_id, p_buyer_id, p_expires_at)
  on conflict (listing_id) do update
    set buyer_id = excluded.buyer_id, expires_at = excluded.expires_at,
        stripe_checkout_session_id = null, created_at = now();

  if v_res.listing_id is not null and v_res.buyer_id = p_buyer_id
     and v_res.expires_at > now() and v_res.stripe_checkout_session_id is not null then
    return 'renewed:' || v_res.stripe_checkout_session_id;
  end if;
  return 'reserved';
end;
$$;

-- Attach the Stripe session to the buyer's reservation.
create or replace function attach_reservation_session(p_listing_id uuid, p_buyer_id uuid, p_session_id text)
returns boolean language sql security definer set search_path = public as $$
  update listing_reservations set stripe_checkout_session_id = p_session_id
   where listing_id = p_listing_id and buyer_id = p_buyer_id and stripe_checkout_session_id is null
  returning true;
$$;

-- Release a reservation: by session (Stripe said it expired), by listing+buyer (session
-- creation failed), or every reservation more than p_grace past expiry (daily cleanup).
create or replace function release_reservation(p_session_id text default null,
                                               p_listing_id uuid default null,
                                               p_buyer_id uuid default null,
                                               p_grace interval default null)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_ids uuid[];
begin
  with gone as (
    delete from listing_reservations r
     where (p_session_id is not null and r.stripe_checkout_session_id = p_session_id)
        or (p_listing_id is not null and r.listing_id = p_listing_id and r.buyer_id = p_buyer_id)
        or (p_grace is not null and r.expires_at < now() - p_grace)
    returning r.listing_id
  )
  select array_agg(listing_id) into v_ids from gone;

  update listings set status = 'active'
   where id = any(coalesce(v_ids, '{}')) and status = 'pending_sale';
  return coalesce(array_length(v_ids, 1), 0);
end;
$$;

-- Turn a paid Checkout Session into an order exactly once. Returns:
--   'created'    order created, listing marked sold
--   'duplicate'  this session was already fulfilled (repeat webhook)
--   'conflict'   the session no longer holds the reservation (caller refunds the payment)
create or replace function fulfill_checkout(p_session_id text, p_payment_intent_id text,
                                            p_listing_id uuid, p_buyer_id uuid,
                                            p_sale_price_cents int, p_commission_cents int)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_listing listings%rowtype;
begin
  -- Lock the saddle so concurrent deliveries of the same event run one at a time.
  select * into v_listing from listings where id = p_listing_id for update;

  if exists (select 1 from orders where stripe_checkout_session_id = p_session_id) then
    return 'duplicate';
  end if;

  if v_listing.id is null or v_listing.status <> 'pending_sale' or not exists (
       select 1 from listing_reservations
        where listing_id = p_listing_id and stripe_checkout_session_id = p_session_id
          and buyer_id = p_buyer_id) then
    return 'conflict';
  end if;

  insert into orders (listing_id, buyer_id, seller_id, sale_price_cents, commission_cents,
                      seller_payout_cents, stripe_payment_intent_id, stripe_checkout_session_id,
                      status, payout_status, release_at)
  values (p_listing_id, p_buyer_id, v_listing.seller_id, p_sale_price_cents, p_commission_cents,
          p_sale_price_cents - p_commission_cents, p_payment_intent_id, p_session_id,
          'paid', 'held', null);

  update listings set status = 'sold' where id = p_listing_id;
  delete from listing_reservations where listing_id = p_listing_id;
  return 'created';
end;
$$;

-- Claim an order's payout so only one caller can transfer it. p_by_buyer = confirm receipt
-- (ignores the clock); otherwise the inspection window must have ended.
create or replace function claim_payout(p_order_id uuid, p_by_buyer boolean)
returns setof orders language plpgsql security definer set search_path = public as $$
begin
  return query
  update orders
     set payout_status = 'releasing',
         payout_attempted_at = now(),
         confirmed_at = case when p_by_buyer then coalesce(confirmed_at, now()) else confirmed_at end
   where id = p_order_id
     and status = 'paid'
     and payout_status = 'held'
     and (p_by_buyer or confirmed_at is not null or (release_at is not null and release_at <= now()))
  returning *;
end;
$$;

-- Server-only functions.
revoke all on function reserve_listing(uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function attach_reservation_session(uuid, uuid, text) from public, anon, authenticated;
revoke all on function release_reservation(text, uuid, uuid, interval) from public, anon, authenticated;
revoke all on function fulfill_checkout(text, text, uuid, uuid, int, int) from public, anon, authenticated;
revoke all on function claim_payout(uuid, boolean) from public, anon, authenticated;
grant execute on function reserve_listing(uuid, uuid, timestamptz) to service_role;
grant execute on function attach_reservation_session(uuid, uuid, text) to service_role;
grant execute on function release_reservation(text, uuid, uuid, interval) to service_role;
grant execute on function fulfill_checkout(text, text, uuid, uuid, int, int) to service_role;
grant execute on function claim_payout(uuid, boolean) to service_role;
