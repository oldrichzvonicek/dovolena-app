-- Připomínka lidem, kteří se zaregistrovali a nepotvrdili e-mail (api/cron/daily): po 24 h a po 7 dnech; nepotvrzený účet bez
-- profilu se po 30 dnech smaže. Evidence odeslaných připomínek je bez cizího klíče (uživatel může být smazán).
create table if not exists signup_reminders (
  user_id uuid primary key,
  first_sent_at timestamptz,
  last_sent_at timestamptz
);
alter table signup_reminders enable row level security;
revoke all on signup_reminders from public, anon, authenticated;

-- Nepotvrzené registrace starší než p_older_than, které ještě nemají profil. Jen service role.
create or replace function unconfirmed_signups(p_older_than interval)
returns table (id uuid, email text, created_at timestamptz)
language sql
security definer
stable
set search_path = public, auth, pg_temp
as $$
  select u.id, u.email::text, u.created_at
  from auth.users u
  where u.email_confirmed_at is null
    and u.email is not null
    and u.created_at < now() - p_older_than
    and not exists (select 1 from public.profiles p where p.id = u.id)
  order by u.created_at
  limit 200;
$$;

revoke execute on function unconfirmed_signups(interval) from public, anon, authenticated;
grant execute on function unconfirmed_signups(interval) to service_role;
