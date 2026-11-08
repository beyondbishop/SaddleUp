-- Who added each listing, and when it last changed, for reviewing old inventory.
--   created_by: the person who added it. The seller for listings they made themselves; the
--               importer (or admin) for saddles added on someone's behalf. Unlike seller_id it
--               never changes when a seller claims the listing.
--   updated_at: now kept current on every change (it used to stay at the create date).
-- Run once in Supabase Dashboard > SQL Editor. Safe to run twice.

alter table listings
  add column if not exists created_by uuid references profiles(id) on delete set null default auth.uid();

-- Backfill: imported saddles were added by their importer; everything else by its seller.
update listings l set created_by = i.importer_id
from listing_imports i
where i.listing_id = l.id and l.created_by is null;

update listings set created_by = seller_id
where created_by is null and seller_id is not null and coalesce(source, 'seller') <> 'seeded';

create index if not exists idx_listings_created_by on listings(created_by);
create index if not exists idx_listings_created_at on listings(created_at);

-- Keep updated_at current.
create or replace function listings_touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_listings_touch_updated_at on listings;
create trigger trg_listings_touch_updated_at before update on listings
  for each row execute function listings_touch_updated_at();
