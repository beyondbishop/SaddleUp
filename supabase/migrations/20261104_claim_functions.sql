-- Claim flow fix: lets a seller with a valid claim link see and claim their unclaimed listing.
-- Row-level security hides unclaimed listings from everyone (they have no seller yet), so the
-- claim page goes through these two functions instead, which only ever expose the one listing
-- that matches the secret claim token.
-- Run once in Supabase Dashboard > SQL Editor.

-- Read the listing behind a claim link (limited fields; never returns the token itself).
create or replace function get_claimable_listing(p_token uuid)
returns table (id uuid, seat_size numeric, model text, brand_name text, tree_width tree_width, price_cents int)
language sql
security definer
set search_path = public
stable
as $$
  select l.id, l.seat_size, l.model, b.name, l.tree_width, l.price_cents
  from listings l
  left join brands b on b.id = l.brand_id
  where l.claim_token = p_token
    and l.status = 'unclaimed'
    and l.seller_id is null;
$$;

-- Attach the listing to the signed-in user. It becomes a draft (goes to admin review once the
-- seller has checked details and added photos), and the claim link stops working.
create or replace function claim_listing(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  update listings
     set seller_id = auth.uid(),
         status = 'draft',
         claimed_at = now(),
         claim_token = null
   where claim_token = p_token
     and status = 'unclaimed'
     and seller_id is null
  returning id into v_id;

  if v_id is null then
    raise exception 'claim link is invalid or already used';
  end if;
  return v_id;
end;
$$;

revoke all on function get_claimable_listing(uuid) from public;
revoke all on function claim_listing(uuid) from public;
grant execute on function get_claimable_listing(uuid) to anon, authenticated;
grant execute on function claim_listing(uuid) to authenticated;
