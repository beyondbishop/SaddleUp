-- Order notifications (slice 3c): email and text updates, with verified phones, recorded text
-- opt-in/opt-out, and a log that stops the same message going out twice.
-- Run once in Supabase Dashboard > SQL Editor. Safe to run twice.

alter table profiles
  add column if not exists phone_verified_at timestamptz,
  add column if not exists sms_opt_in_at timestamptz,
  add column if not exists sms_opt_in_source text,        -- where they agreed, e.g. 'notification_settings'
  add column if not exists sms_consent_version text,      -- the consent wording they agreed to
  add column if not exists sms_opt_out_at timestamptz;    -- replied STOP or turned texts off

-- Changing your phone number un-verifies it and clears text consent for the old number.
create or replace function profiles_phone_changed() returns trigger language plpgsql as $$
begin
  if new.phone is distinct from old.phone then
    new.phone_verified_at := null;
    new.sms_opt_in_at := null;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_profiles_phone_changed on profiles;
create trigger trg_profiles_phone_changed before update of phone on profiles
  for each row execute function profiles_phone_changed();

-- One row per message. dedupe_key is unique, so a repeated webhook or job can't send it twice.
create table if not exists notification_log (
  id bigserial primary key,
  dedupe_key text not null unique,            -- e.g. "<order>:delivered:buyer:email"
  order_id uuid references orders(id) on delete set null,
  user_id uuid references profiles(id) on delete set null,
  channel text not null check (channel in ('email', 'sms')),
  template text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  detail text,                                -- provider id, or why it failed / was skipped
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_notification_log_order on notification_log(order_id, created_at);
drop trigger if exists trg_notification_log_touch on notification_log;
create trigger trg_notification_log_touch before update on notification_log
  for each row execute function touch_updated_at();
alter table notification_log enable row level security;
drop policy if exists "admins read notification log" on notification_log;
create policy "admins read notification log" on notification_log
  for select using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));
revoke insert, update, delete on notification_log from anon, authenticated;
revoke all on notification_log from anon;
