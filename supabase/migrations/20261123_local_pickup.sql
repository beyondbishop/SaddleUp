-- Local pickup: sellers can offer pickup on a listing, and the buyer chooses pickup or shipping
-- at checkout. Pickup orders pay only the saddle price; the seller hands it over in person.
-- Run once in Supabase Dashboard > SQL Editor. Safe to run twice.

-- Seller offers local pickup for this saddle. "Roughly where" is the listing's city/state;
-- pickup_note is optional extra detail ("near Ocala, weekday evenings").
alter table listings
  add column if not exists pickup_available boolean not null default false,
  add column if not exists pickup_note text check (pickup_note is null or char_length(pickup_note) <= 200);

-- How the buyer chose to receive the saddle. Older orders all shipped.
alter table orders
  add column if not exists fulfillment text not null default 'ship' check (fulfillment in ('ship', 'pickup'));
