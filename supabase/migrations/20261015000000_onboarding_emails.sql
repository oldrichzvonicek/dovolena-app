-- Sekvence tipů „Co Dodio umí“ (api/cron/daily): evidence odeslaných a přeskočených kroků + nový přepínač kategorie e-mailů.
create table if not exists onboarding_emails (
  profile_id uuid not null references profiles(id) on delete cascade,
  step text not null,
  skipped boolean not null default false,
  sent_at timestamptz not null default now(),
  primary key (profile_id, step)
);
alter table onboarding_emails enable row level security;
revoke all on onboarding_emails from public, anon, authenticated;

-- Přepínač kategorie "onboarding_tips" (Nastavení → Notifikace); ostatní pravidla beze změny.
create or replace function set_email_setting(p_key text, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  cid uuid := current_company_id();
begin
  if cid is null then
    raise exception 'Nejste přihlášeni.';
  end if;
  if p_key not in ('approver_requests', 'requester_decisions', 'weekly_digest', 'hr_digest', 'reminders', 'help_questions', 'join_pending', 'onboarding_tips') then
    raise exception 'Neznámý typ e-mailu.';
  end if;
  if current_user_role() is distinct from 'admin'
     and not (coalesce(current_user_staff() = 'hr', false) and p_key in ('hr_digest', 'reminders')) then
    raise exception 'Tento e-mail smí nastavit jen admin.';
  end if;
  update companies set email_settings = jsonb_set(coalesce(email_settings, '{}'::jsonb), array[p_key], to_jsonb(p_enabled)) where id = cid;
end;
$$;
