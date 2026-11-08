-- Brands people add themselves. A seller or importer can add a brand that isn't in the list; it
-- works on their listing straight away, and shows up in the admin Brands page so Danielle can
-- check the spelling (approve, fix, or merge it into an existing brand). Until it's approved it
-- only appears in the brand list of the person who added it, not in search filters.
-- Run once in Supabase Dashboard > SQL Editor. Safe to run twice.

alter table brands
  add column if not exists approved boolean not null default true,
  add column if not exists suggested_by uuid references profiles(id) on delete set null,
  add column if not exists created_at timestamptz not null default now();

create index if not exists idx_brands_pending on brands(approved) where not approved;

-- Keep in sync with src/lib/saddle-catalog.ts
insert into brands (name, slug) values ('Henri de Rivel', 'henri-de-rivel')
on conflict do nothing;
