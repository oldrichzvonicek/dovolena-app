-- ---------------------------------------------------------------------------
-- Dodio Super-admin, fáze 2 a 3: pozastavení a mazání firem, export, GDPR žádosti, právní dokumenty a souhlasy,
-- ceník v databázi, upomínky, fronta úloh a náhled firmy (impersonace jen pro čtení). Skript je idempotentní.
-- Navazuje na 20260928000000_platform_phase1.sql.
-- ---------------------------------------------------------------------------

-- 1) companies: naplánované smazání, náhrobek, zamčená cena -------------------------------------------------------------
alter table companies add column if not exists deletion_scheduled_at timestamptz;
alter table companies add column if not exists deletion_reason text;
alter table companies add column if not exists status_before_deletion text;
alter table companies add column if not exists deleted_at timestamptz;
alter table companies add column if not exists locked_plan_id uuid;

-- 2) Ceník: verzované řádky (změna ceny = nový řádek s valid_from). Funkce tarifů zůstávají v kódu a SQL. -----------------------
create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code in ('free', 'basic', 'starter', 'pro')),
  name text not null,
  user_limit int,
  included_users int,
  price_monthly numeric(10,2) not null default 0,
  price_yearly numeric(10,2) not null default 0,
  price_extra_user_monthly numeric(10,2),
  price_extra_user_yearly numeric(10,2),
  valid_from date not null,
  created_by uuid,
  created_at timestamptz not null default now()
);
create unique index if not exists plans_code_valid_from_idx on plans (code, valid_from);

-- Výchozí ceník = hodnoty ze src/lib/plans.ts (klíče basic = Starter, starter = Team).
insert into plans (code, name, user_limit, included_users, price_monthly, price_yearly, price_extra_user_monthly, price_extra_user_yearly, valid_from)
select v.* from (values
  ('free',    'Free',    5,    null::int, 0::numeric,    0::numeric,     null::numeric, null::numeric, date '2026-01-01'),
  ('basic',   'Starter', 10,   null,      290,           2900,           null,          null,          date '2026-01-01'),
  ('starter', 'Team',    15,   null,      590,           5900,           null,          null,          date '2026-01-01'),
  ('pro',     'Pro',     null, 30,        1190,          11900,          39,            390,           date '2026-01-01')
) as v(code, name, user_limit, included_users, price_monthly, price_yearly, price_extra_user_monthly, price_extra_user_yearly, valid_from)
where not exists (select 1 from plans p where p.code = v.code);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'companies_locked_plan_fk') then
    alter table companies add constraint companies_locked_plan_fk foreign key (locked_plan_id) references plans(id) on delete set null;
  end if;
end
$$;

-- Ceny jsou veřejná informace: čte je i zákaznická aplikace (aktuální řádek), měnit je smí jen service role.
alter table plans enable row level security;
drop policy if exists "plans public read" on plans;
create policy "plans public read" on plans for select using (valid_from <= current_date);
revoke all on table plans from anon, authenticated;
grant select on table plans to anon, authenticated;
grant select, insert, update, delete on table plans to service_role;

-- 3) Ochrana provozních sloupců firmy před adminem firmy (rozšíření triggeru z fáze 1) --------------------------------------
create or replace function guard_company_update()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null and (new.status is distinct from old.status or new.discount_pct is distinct from old.discount_pct
      or new.is_test is distinct from old.is_test or new.last_activity_at is distinct from old.last_activity_at
      or new.deletion_scheduled_at is distinct from old.deletion_scheduled_at or new.deletion_reason is distinct from old.deletion_reason
      or new.status_before_deletion is distinct from old.status_before_deletion or new.deleted_at is distinct from old.deleted_at
      or new.locked_plan_id is distinct from old.locked_plan_id) then
    raise exception 'Stav účtu, slevu a provozní příznaky firmy mění provozovatel služby.';
  end if;
  if auth.uid() is not null and (new.plan is distinct from old.plan or new.addons is distinct from old.addons
      or new.billing_period is distinct from old.billing_period or new.plan_paid_until is distinct from old.plan_paid_until
      or (coalesce(current_setting('dodio.plan_change', true), '') <> '1'
          and (new.pending_plan is distinct from old.pending_plan or new.pending_plan_from is distinct from old.pending_plan_from
               or new.pending_plan_notified is distinct from old.pending_plan_notified))) then
    raise exception 'Tarif, doplňky a jeho platnost mění provozovatel služby.';
  end if;
  if auth.uid() is not null and new.seniority_enabled and not coalesce(old.seniority_enabled, false)
     and not coalesce(company_feature(new.id, 'seniority'), false) then
    raise exception 'Nárok podle odpracovaných let je od tarifu Team.';
  end if;
  if auth.uid() is not null and new.approval_reminder_hours is not null
     and new.approval_reminder_hours is distinct from old.approval_reminder_hours
     and not coalesce(company_feature(new.id, 'escalation'), false) then
    raise exception 'Eskalace schvalování je od tarifu Pro.';
  end if;
  return new;
end;
$$;

-- 4) Stav účtu v aplikaci ---------------------------------------------------------------------------------------------------
-- Firma ke smazání nebo smazaná: current_company_id() vrací null, takže RLS nepustí žádná firemní data.
-- Pozastavená firma (suspended) zůstává čitelná, zápisy blokuje trigger guard_company_writable níže.
create or replace function current_company_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select p.company_id
    from profiles p
    join companies c on c.id = p.company_id
   where p.id = auth.uid() and p.active and c.status in ('active', 'suspended');
$$;

-- Aplikace podle toho ukáže pruh „jen pro čtení“ nebo obrazovku „účet je ke smazání“ (RLS firmu v tom stavu nepustí).
create or replace function company_access_state()
returns table (status text, deletion_scheduled_at timestamptz)
language sql
security definer
stable
set search_path = public
as $$
  select c.status, c.deletion_scheduled_at
    from profiles p
    join companies c on c.id = p.company_id
   where p.id = auth.uid();
$$;
revoke all on function company_access_state() from public, anon;
grant execute on function company_access_state() to authenticated;

create or replace function guard_company_writable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cid uuid;
  st text;
begin
  -- Server (service role, cron) smí vždy; blokuje se jen zápis od přihlášeného uživatele pozastavené firmy.
  if auth.uid() is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_table_name = 'leave_requests' then
    select company_id into cid from profiles where id = case when tg_op = 'DELETE' then old.profile_id else new.profile_id end;
  else
    cid := case when tg_op = 'DELETE' then old.company_id else new.company_id end;
  end if;
  select status into st from companies where id = cid;
  if st = 'suspended' then
    raise exception 'Účet firmy je pozastavený (jen pro čtení). Kontaktujte provozovatele služby.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['leave_requests', 'profiles', 'departments', 'leave_types', 'company_invites']
  loop
    execute format('drop trigger if exists %I on %I', t || '_guard_writable', t);
    execute format('create trigger %I before insert or update or delete on %I for each row execute function guard_company_writable()', t || '_guard_writable', t);
  end loop;
end
$$;

-- Výchozí typy absence (dovolená, nemoc) nejdou smazat, dokud firma existuje. Při definitivním smazání firmy (řádek zůstává
-- jako „náhrobek“) je smí smazat jen mazací funkce, která si nastaví dodio.purge.
create or replace function guard_leave_type_delete()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('dodio.purge', true), '') = '1' then
    return old;
  end if;
  -- Při mazání celé firmy (kaskáda) už firma neexistuje — to blokovat nesmíme, jinak by firmu nešlo nikdy smazat.
  if old.key in ('dovolena', 'sick') and exists (select 1 from companies where id = old.company_id) then
    raise exception 'Výchozí typ absence "%" nelze smazat.', old.label;
  end if;
  return old;
end;
$$;

-- 5) Nové tabulky platformy --------------------------------------------------------------------------------------------------
-- company_id bez cizího klíče u úloh a impersonace: musí přežít cokoli, co se s firmou stane.
create table if not exists platform_jobs (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  company_id uuid,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'running', 'done', 'failed', 'cancelled')),
  run_at timestamptz not null default now(),
  attempts int not null default 0,
  error text,
  result jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
create index if not exists platform_jobs_due_idx on platform_jobs (status, run_at);
create index if not exists platform_jobs_company_idx on platform_jobs (company_id, created_at desc);

create table if not exists platform_impersonation_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null,
  company_id uuid not null,
  reason text not null,
  note text,
  minutes int not null check (minutes in (15, 30, 60)),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz
);
create index if not exists platform_impersonation_admin_idx on platform_impersonation_sessions (admin_id, started_at desc);

create table if not exists dunning_events (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references company_invoices(id) on delete restrict,
  company_id uuid not null references companies(id) on delete restrict,
  step text not null check (step in ('reminder_1', 'reminder_2', 'reminder_3', 'suspend', 'manual')),
  sent_at timestamptz not null default now()
);
create unique index if not exists dunning_events_step_idx on dunning_events (invoice_id, step) where step <> 'manual';

create table if not exists data_subject_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete restrict,
  type text not null check (type in ('access', 'erasure', 'rectification', 'portability', 'restriction', 'objection')),
  subject_label text not null,
  received_at date not null default current_date,
  due_at date not null,
  status text not null default 'received' check (status in ('received', 'forwarded', 'resolved')),
  forwarded_at timestamptz,
  resolved_at timestamptz,
  resolution_note text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists data_subject_requests_status_idx on data_subject_requests (status, due_at);

create table if not exists legal_documents (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('terms', 'dpa', 'privacy')),
  version text not null,
  effective_from date not null,
  file_path text,
  note text,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (type, version)
);

-- Souhlasy se jen přidávají. Aplikace je dnes nesbírá; tabulka je připravená pro sběr při registraci a při nové verzi.
create table if not exists consents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  profile_id uuid,
  document_id uuid not null references legal_documents(id) on delete restrict,
  granted boolean not null default true,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists consents_company_idx on consents (company_id, document_id);

do $$
declare
  t text;
begin
  foreach t in array array['platform_jobs', 'platform_impersonation_sessions', 'dunning_events', 'data_subject_requests', 'legal_documents', 'consents']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "platform deny all" on %I', t);
    execute format('create policy "platform deny all" on %I for all using (false)', t);
    execute format('revoke all on table %I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on table %I to service_role', t);
  end loop;
end
$$;

-- 6) Funkce pro server ------------------------------------------------------------------------------------------------------
-- Atomické převzetí úloh (žádná úloha se nespustí dvakrát); úlohy „running“ starší 10 minut se berou jako spadlé.
create or replace function platform_claim_jobs(p_limit int default 5)
returns setof platform_jobs
language sql
security definer
set search_path = public
as $$
  update platform_jobs
     set status = 'running', started_at = now(), attempts = attempts + 1
   where id in (
     select id from platform_jobs
      where (status = 'pending' and run_at <= now()) or (status = 'running' and started_at < now() - interval '10 minutes')
      order by run_at
      limit greatest(p_limit, 1)
      for update skip locked
   )
  returning *;
$$;

-- Odhlásí všechny členy firmy (smazání sessions v Supabase Auth; refresh tokeny se smažou kaskádou).
create or replace function platform_revoke_company_sessions(p_company uuid)
returns int
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  n int;
begin
  delete from auth.sessions where user_id in (select id from profiles where company_id = p_company);
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Definitivní smazání firemních dat. Členy (auth.users → profiles → žádosti, nároky, notifikace) maže server přes Auth API
-- dřív; tady zbývají tabulky s company_id. Řádek companies, faktury, platby, upomínky a GDPR žádosti zůstávají.
create or replace function platform_purge_company(p_company uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t text;
  n int;
  result jsonb := '{}'::jsonb;
begin
  if exists (select 1 from profiles where company_id = p_company) then
    raise exception 'Firma má ještě členy; nejdřív se musí smazat jejich účty.';
  end if;
  perform set_config('dodio.purge', '1', true);
  foreach t in array array[
    'blackout_periods', 'company_invites', 'company_join', 'company_hr_settings', 'company_integrations', 'webhook_integrations',
    'integration_outbox', 'email_outbox', 'payroll_closures', 'departments', 'leave_types', 'company_billing', 'consents', 'platform_company_notes', 'audit_log'
  ]
  loop
    execute format('delete from %I where company_id = $1', t) using p_company;
    get diagnostics n = row_count;
    result := result || jsonb_build_object(t, n);
  end loop;
  return result;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array['platform_claim_jobs(int)', 'platform_revoke_company_sessions(uuid)', 'platform_purge_company(uuid)']
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end
$$;

-- 7) Úložiště: exporty firem a právní dokumenty (soukromé, jen server) -------------------------------------------------------
insert into storage.buckets (id, name, public) values ('company-exports', 'company-exports', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('legal-documents', 'legal-documents', false) on conflict (id) do nothing;
