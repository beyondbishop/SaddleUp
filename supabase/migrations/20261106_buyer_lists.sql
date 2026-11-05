-- Named buyer lists ("Lionel", "Whit's hunting saddle", "Client Sarah") replace the single
-- favorites list. A saddle can be on many lists, with a private note per list.
-- Run once in Supabase Dashboard > SQL Editor. Safe to run twice.

create table if not exists buyer_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  description text check (description is null or char_length(description) <= 500),
  criteria jsonb,                              -- saved search criteria (step 3)
  is_default boolean not null default false,   -- "My favorites"
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- No two active lists with the same name for one buyer; one default list each.
create unique index if not exists idx_buyer_lists_name
  on buyer_lists(user_id, lower(btrim(name))) where archived_at is null;
create unique index if not exists idx_buyer_lists_default
  on buyer_lists(user_id) where is_default;
create index if not exists idx_buyer_lists_user on buyer_lists(user_id);

create table if not exists buyer_list_items (
  list_id uuid not null references buyer_lists(id) on delete cascade,
  listing_id uuid not null references listings(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  note text check (note is null or char_length(note) <= 2000),
  added_via text not null default 'manual' check (added_via in ('manual', 'suggestion', 'migrated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (list_id, listing_id)            -- one membership per list, however many requests
);
create index if not exists idx_buyer_list_items_user_listing on buyer_list_items(user_id, listing_id);

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists trg_buyer_lists_touch on buyer_lists;
create trigger trg_buyer_lists_touch before update on buyer_lists
  for each row execute function touch_updated_at();
drop trigger if exists trg_buyer_list_items_touch on buyer_list_items;
create trigger trg_buyer_list_items_touch before update on buyer_list_items
  for each row execute function touch_updated_at();

-- ---------- Access: each buyer sees and changes only their own lists and notes ----------
alter table buyer_lists enable row level security;
drop policy if exists "owners manage own lists" on buyer_lists;
create policy "owners manage own lists" on buyer_lists
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table buyer_list_items enable row level security;
drop policy if exists "owners manage own list items" on buyer_list_items;
create policy "owners manage own list items" on buyer_list_items
  for all
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from buyer_lists l where l.id = list_id and l.user_id = auth.uid())
  );

revoke all on buyer_lists, buyer_list_items from anon;
-- An item can't be moved to another list or saddle; remove and re-add instead.
revoke update on buyer_list_items from authenticated;
grant update (note) on buyer_list_items to authenticated;

-- ---------- Availability of saved saddles ----------
-- Sold or withdrawn saddles are hidden from buyers, so a list can't read them directly. This
-- returns only what a list needs to show a placeholder and "similar saddles" link, for saddles
-- on the caller's own lists. No photos, description, price or seller details.
create or replace function my_saved_listing_states()
returns table (listing_id uuid, availability text, discipline discipline, seat_size numeric,
               tree_width tree_width, brand_slug text)
language sql security definer set search_path = public stable as $$
  select distinct on (l.id)
         l.id,
         case l.status
           when 'active' then 'available'
           when 'pending_sale' then 'in_checkout'
           when 'sold' then 'sold'
           else 'unavailable'
         end,
         l.discipline, l.seat_size, l.tree_width, b.slug
    from buyer_list_items i
    join listings l on l.id = i.listing_id
    left join brands b on b.id = l.brand_id
   where i.user_id = auth.uid();
$$;
revoke all on function my_saved_listing_states() from public, anon;
grant execute on function my_saved_listing_states() to authenticated;

-- ---------- Move existing favorites into each buyer's "My favorites" ----------
insert into buyer_lists (user_id, name, is_default)
select distinct f.user_id, 'My favorites', true
  from favorites f
 where not exists (select 1 from buyer_lists l where l.user_id = f.user_id and l.is_default)
on conflict do nothing;

insert into buyer_list_items (list_id, listing_id, user_id, added_via, created_at)
select l.id, f.listing_id, f.user_id, 'migrated', f.created_at
  from favorites f
  join buyer_lists l on l.user_id = f.user_id and l.is_default
on conflict (list_id, listing_id) do nothing;
-- The favorites table is no longer written to; drop it in a later release.
