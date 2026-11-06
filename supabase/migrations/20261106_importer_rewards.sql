-- Importer rewards: when a saddle someone imported sells and the sale is final (the buyer kept
-- it and the seller has been paid), the importer earns a share of what SaddleUp actually kept:
-- our fee minus Stripe's processing fee for that sale. Paid out by an admin (manually for now).
-- Run once in Supabase Dashboard > SQL Editor. Safe to run twice.

create table if not exists importer_rewards (
  order_id uuid primary key references orders(id),   -- one reward per sale, however often it's checked
  importer_id uuid not null references profiles(id),
  listing_id uuid not null references listings(id),
  sale_price_cents int not null,
  platform_fee_cents int not null,      -- SaddleUp's fee on the sale
  processing_fee_cents int not null,    -- Stripe's actual fee for the buyer's payment
  net_cents int not null,               -- platform fee minus processing fee (never below 0)
  reward_percent numeric(5,2) not null, -- e.g. 25.00
  amount_cents int not null,            -- what the importer earns
  status text not null default 'earned' check (status in ('earned', 'paid', 'void')),
  void_reason text,                     -- e.g. importer was the buyer; sale refunded
  needs_review boolean not null default false,  -- e.g. refunded after the reward was already paid
  paid_at timestamptz,
  paid_note text,                       -- e.g. "Venmo 11/14"
  paid_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_importer_rewards_importer on importer_rewards(importer_id, status);

drop trigger if exists trg_importer_rewards_touch on importer_rewards;
create trigger trg_importer_rewards_touch before update on importer_rewards
  for each row execute function touch_updated_at();

alter table importer_rewards enable row level security;
drop policy if exists "importers read own rewards" on importer_rewards;
create policy "importers read own rewards" on importer_rewards
  for select using (
    importer_id = auth.uid()
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin)
  );
-- Written only by the server.
revoke insert, update, delete on importer_rewards from anon, authenticated;
revoke all on importer_rewards from anon;
