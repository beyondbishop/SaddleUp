-- Order timeline (slice 3a): what the buyer bought as it was at purchase, the seller's dispatch
-- deadline, the buyer's inspection decision, and a permanent history of everything that happens.
-- Run once in Supabase Dashboard > SQL Editor. Safe to run twice.

alter table orders
  add column if not exists listing_snapshot jsonb,       -- listing details + photos at purchase
  add column if not exists terms_version text,           -- buyer terms accepted at checkout
  add column if not exists fee_percent numeric(5,2),     -- SaddleUp fee rate applied
  add column if not exists dispatch_due_at timestamptz,  -- seller must hand to carrier by then
  add column if not exists kept_at timestamptz,          -- buyer chose "Keep this saddle"
  add column if not exists issue_type text check (issue_type is null or issue_type in ('return_request', 'problem')),
  add column if not exists issue_reason text,
  add column if not exists issue_details text check (issue_details is null or char_length(issue_details) <= 4000),
  add column if not exists issue_opened_at timestamptz,
  add column if not exists review_status text not null default 'none'
    check (review_status in ('none', 'open', 'resolved')),
  add column if not exists review_note text,
  -- Until Shippo labels are connected, sellers enter tracking by hand and an admin confirms delivery.
  add column if not exists shipped_at timestamptz,
  add column if not exists carrier text check (carrier is null or char_length(carrier) <= 40),
  add column if not exists tracking_number text check (tracking_number is null or char_length(tracking_number) <= 60);
-- payout_status adds 'on_hold': a return request, problem report or review pauses the payout.

create index if not exists idx_orders_review on orders(review_status) where review_status = 'open';
create index if not exists idx_orders_dispatch on orders(dispatch_due_at) where status = 'paid';

create table if not exists order_events (
  id bigserial primary key,
  order_id uuid not null references orders(id) on delete cascade,
  type text not null,             -- paid, return_requested, problem_reported, kept, delivered, payout_sent, ...
  actor text not null check (actor in ('buyer', 'seller', 'admin', 'system')),
  actor_id uuid references profiles(id),
  data jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_order_events_order on order_events(order_id, created_at);

alter table order_events enable row level security;
drop policy if exists "order parties read events" on order_events;
create policy "order parties read events" on order_events
  for select using (
    exists (select 1 from orders o where o.id = order_id and (o.buyer_id = auth.uid() or o.seller_id = auth.uid()))
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin)
  );
-- Permanent history: written only by the server, never edited or deleted from the app.
revoke insert, update, delete on order_events from anon, authenticated;
revoke all on order_events from anon;

-- Admins can read every order (the review queue).
drop policy if exists "admins read all orders" on orders;
create policy "admins read all orders" on orders
  for select using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

-- Buyer and seller can see the saddle from their own order even after it's sold (seller already can).
-- (Buyers: see 20261105_buyers_see_purchased.sql.)
