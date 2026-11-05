-- Buyers can still see a saddle after they've bought it (sold listings are otherwise hidden,
-- which left order pages without the saddle's name).
-- Run once in Supabase Dashboard > SQL Editor. Safe to run twice.

drop policy if exists "buyers see listings they ordered" on listings;
create policy "buyers see listings they ordered" on listings
  for select using (
    exists (select 1 from orders o where o.listing_id = listings.id and o.buyer_id = auth.uid())
  );
