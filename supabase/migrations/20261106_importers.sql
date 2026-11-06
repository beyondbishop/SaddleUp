-- Importers: any user an admin allows can add saddles they find (Facebook etc.) as hidden,
-- claimable listings. Each import records who added it, so imports can be tracked (and later
-- rewarded when the saddle sells).
-- Run once in Supabase Dashboard > SQL Editor. Safe to run twice.

-- Granted and removed by admins only (users can't change their own profile flags; see
-- 20261105_transaction_safety.sql, which limits profile edits to name and phone).
alter table profiles add column if not exists is_importer boolean not null default false;

create table if not exists listing_imports (
  listing_id uuid primary key references listings(id) on delete cascade,
  importer_id uuid not null references profiles(id),
  source_url text,                 -- where they found it, for follow-up and duplicate checks
  source_key text,                 -- normalized source_url: the same post can only be imported once
  seller_name text,
  messaged_at timestamptz,         -- importer ticked "I've messaged the seller"
  created_at timestamptz not null default now()
);
create unique index if not exists idx_listing_imports_source on listing_imports(source_key) where source_key is not null;
create index if not exists idx_listing_imports_importer on listing_imports(importer_id, created_at desc);

alter table listing_imports enable row level security;
drop policy if exists "importers read own imports" on listing_imports;
create policy "importers read own imports" on listing_imports
  for select using (
    importer_id = auth.uid()
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin)
  );
-- Written only by the server (service role), after checking the importer's permission.
revoke insert, update, delete on listing_imports from anon, authenticated;
revoke all on listing_imports from anon;
