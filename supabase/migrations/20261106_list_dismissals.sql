-- Suggestions a buyer dismissed for one list. Dismissing applies only to that list.
-- Run once in Supabase Dashboard > SQL Editor. Safe to run twice.

create table if not exists buyer_list_dismissals (
  list_id uuid not null references buyer_lists(id) on delete cascade,
  listing_id uuid not null references listings(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (list_id, listing_id)
);

alter table buyer_list_dismissals enable row level security;
drop policy if exists "owners manage own dismissals" on buyer_list_dismissals;
create policy "owners manage own dismissals" on buyer_list_dismissals
  for all
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from buyer_lists l where l.id = list_id and l.user_id = auth.uid())
  );
revoke all on buyer_list_dismissals from anon;
revoke update on buyer_list_dismissals from authenticated;

-- When criteria last changed, so the list page can say "new since you set these".
alter table buyer_lists add column if not exists criteria_updated_at timestamptz;
