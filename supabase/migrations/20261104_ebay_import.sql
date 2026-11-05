-- eBay import: remember which eBay listing (and eBay seller account) a SaddleUp listing came from.
-- Run once in Supabase Dashboard > SQL Editor before deploying the eBay import feature.

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
