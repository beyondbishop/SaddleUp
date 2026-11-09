-- What we noticed while importing a saddle (spelling fixes, judgment calls on the listing,
-- whether to point them to the measuring guide). The Facebook message is kept short, so these
-- are shown to the seller on the Edit page after they claim instead.
-- Written only by the server (service key). Run once in Supabase Dashboard > SQL Editor. Safe to run twice.

alter table listing_imports add column if not exists seller_notes jsonb;
