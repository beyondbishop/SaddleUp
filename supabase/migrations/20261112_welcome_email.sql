-- Welcome email: remembers who has already been sent it, so each person gets it exactly once.
-- People who signed up before this existed are marked as already welcomed (no surprise email).
-- Run once in Supabase Dashboard > SQL Editor. Safe to run twice (the backfill only happens
-- the first time, when the column is created).

do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'profiles' and column_name = 'welcome_sent_at') then
    alter table public.profiles add column welcome_sent_at timestamptz;
    update public.profiles set welcome_sent_at = coalesce(created_at, now());
  end if;
end $$;
