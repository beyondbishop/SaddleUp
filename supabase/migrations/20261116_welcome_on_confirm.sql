-- Welcome email the moment an email is confirmed.
-- When Supabase marks someone's email confirmed (or creates a Google user, who arrives
-- confirmed), call the site's /api/hooks/welcome, which sends the welcome email once. This works
-- whatever browser or device they clicked the confirmation link on. The call is made after the
-- sign-up commits, and a failure here can never block sign-up.
-- Also records why a welcome email failed, on the profile, for debugging.
-- Run once in Supabase Dashboard > SQL Editor. Safe to run twice.

alter table public.profiles add column if not exists welcome_last_error text;

create extension if not exists pg_net with schema extensions;

create or replace function public.welcome_on_confirm()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email_confirmed_at is not null and (tg_op = 'INSERT' or old.email_confirmed_at is null) then
    begin
      perform net.http_post(
        url := 'https://saddleup.me/api/hooks/welcome',
        body := jsonb_build_object('user_id', new.id),
        headers := '{"Content-Type": "application/json"}'::jsonb
      );
    exception when others then
      null; -- never let the welcome email get in the way of signing up
    end;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed
  after insert or update of email_confirmed_at on auth.users
  for each row execute procedure public.welcome_on_confirm();
