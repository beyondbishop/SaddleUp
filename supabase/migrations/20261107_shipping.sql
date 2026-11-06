-- Shipping (slice 3b): packed box size on listings, ZIP-based shipping quotes the buyer pays at
-- checkout, the buyer's ship-to address, and shipments with Shippo labels and tracking.
-- Run once in Supabase Dashboard > SQL Editor. Safe to run twice.

-- Packed box (inches / pounds). Blank means the standard saddle box default.
alter table listings
  add column if not exists pkg_length_in numeric(5,1) check (pkg_length_in is null or pkg_length_in between 6 and 80),
  add column if not exists pkg_width_in numeric(5,1) check (pkg_width_in is null or pkg_width_in between 6 and 80),
  add column if not exists pkg_height_in numeric(5,1) check (pkg_height_in is null or pkg_height_in between 3 and 80),
  add column if not exists pkg_weight_lb numeric(5,1) check (pkg_weight_lb is null or pkg_weight_lb between 1 and 150);

-- Where a seller ships from (reused for each label). Written by the server only.
alter table profiles add column if not exists ship_from jsonb;

-- A price the buyer was shown for one saddle to one ZIP. Checkout charges exactly this.
create table if not exists shipping_quotes (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  buyer_id uuid references profiles(id) on delete cascade,  -- null when quoted before sign-in
  to_zip text not null check (to_zip ~ '^\d{5}$'),
  from_zip text not null,
  amount_cents int not null check (amount_cents >= 0),
  carrier text not null,
  service_token text not null,
  service_name text,
  estimated_days int,
  insured_cents int not null,
  parcel jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_shipping_quotes_listing on shipping_quotes(listing_id, to_zip, created_at desc);
alter table shipping_quotes enable row level security;
drop policy if exists "system only" on shipping_quotes;
create policy "system only" on shipping_quotes for all using (false);

alter table orders
  add column if not exists shipping_cents int not null default 0,
  add column if not exists shipping_quote_id uuid references shipping_quotes(id),
  add column if not exists ship_to jsonb,             -- name, address, phone from checkout
  add column if not exists ship_to_zip_mismatch boolean not null default false;

create table if not exists shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  direction text not null default 'outbound' check (direction in ('outbound', 'return')),
  source text not null check (source in ('shippo_label', 'manual')),
  carrier text not null,
  service_token text,
  tracking_number text not null,
  tracking_url text,
  label_url text,                       -- seller-only (contains both addresses)
  label_cost_cents int,
  insured_cents int,
  signature_required boolean not null default true,
  shippo_shipment_id text,
  shippo_transaction_id text unique,
  status text not null default 'label_created'
    check (status in ('label_created', 'pre_transit', 'in_transit', 'delivered', 'returned', 'failure', 'unknown')),
  accepted_at timestamptz,              -- first carrier scan
  delivered_at timestamptz,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists idx_shipments_tracking on shipments(carrier, tracking_number);
create index if not exists idx_shipments_open on shipments(status) where status not in ('delivered', 'returned');
create index if not exists idx_shipments_order on shipments(order_id);
drop trigger if exists trg_shipments_touch on shipments;
create trigger trg_shipments_touch before update on shipments for each row execute function touch_updated_at();

alter table shipments enable row level security;
drop policy if exists "order parties read shipments" on shipments;
create policy "order parties read shipments" on shipments
  for select using (
    exists (select 1 from orders o where o.id = order_id and (o.buyer_id = auth.uid() or o.seller_id = auth.uid()))
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin)
  );
revoke insert, update, delete on shipments from anon, authenticated;
revoke all on shipments from anon;
-- The label PDF shows both addresses; only the server hands it to the seller. (A table-wide
-- SELECT would override a column revoke, so grant the other columns explicitly.)
revoke select on shipments from authenticated;
grant select (id, order_id, direction, source, carrier, service_token, tracking_number, tracking_url,
              label_cost_cents, insured_cents, signature_required, status, accepted_at, delivered_at,
              created_at, updated_at)
  on shipments to authenticated;

-- fulfill_checkout now records the saddle price and shipping separately (fee is on the saddle only).
create or replace function fulfill_checkout(p_session_id text, p_payment_intent_id text,
                                            p_listing_id uuid, p_buyer_id uuid,
                                            p_sale_price_cents int, p_commission_cents int,
                                            p_shipping_cents int default 0, p_quote_id uuid default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_listing listings%rowtype;
begin
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
                      status, payout_status, release_at, shipping_cents, shipping_quote_id)
  values (p_listing_id, p_buyer_id, v_listing.seller_id, p_sale_price_cents, p_commission_cents,
          p_sale_price_cents - p_commission_cents, p_payment_intent_id, p_session_id,
          'paid', 'held', null, coalesce(p_shipping_cents, 0), p_quote_id);

  update listings set status = 'sold' where id = p_listing_id;
  delete from listing_reservations where listing_id = p_listing_id;
  return 'created';
end;
$$;
revoke all on function fulfill_checkout(text, text, uuid, uuid, int, int, int, uuid) from public, anon, authenticated;
grant execute on function fulfill_checkout(text, text, uuid, uuid, int, int, int, uuid) to service_role;
-- Remove the old 6-argument version so there's only one way to fulfil a checkout.
drop function if exists fulfill_checkout(text, text, uuid, uuid, int, int);
