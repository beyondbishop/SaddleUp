-- Brands: let the website read them, and add more English + Western brands.
-- Row-level security is on for `brands` with no read policy, so every brand dropdown and
-- "Shop by brand" list on the site came back empty. Brands are public reference data.
-- Run once in Supabase Dashboard > SQL Editor.

alter table brands enable row level security;

drop policy if exists "brands are public" on brands;
create policy "brands are public" on brands
  for select using (true);

-- Keep in sync with src/lib/saddle-catalog.ts
insert into brands (name, slug) values
  ('Bates','bates'),
  ('Butet','butet'),
  ('Childeric','childeric'),
  ('Kent & Masters','kent-and-masters'),
  ('Kieffer','kieffer'),
  ('Passier','passier'),
  ('Thorowgood','thorowgood'),
  ('Big Horn','big-horn'),
  ('Billy Cook','billy-cook'),
  ('Circle Y','circle-y'),
  ('Crates','crates'),
  ('Dale Chavez','dale-chavez'),
  ('Martin Saddlery','martin-saddlery'),
  ('Reinsman','reinsman'),
  ('Tucker','tucker')
on conflict do nothing;
