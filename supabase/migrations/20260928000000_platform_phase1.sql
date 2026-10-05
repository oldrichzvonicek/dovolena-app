-- ---------------------------------------------------------------------------
-- Dodio Super-admin, fáze 1 (viz dokument „Dodio Super-admin – technická dokumentace BE“).
-- Interní backend provozovatele: správa firem, tarifů, faktur a audit. Skript je idempotentní.
-- Tabulky platform_* nemají žádný přístup z prohlížeče (RLS + politika „false“ + revoke); čte je jen service role
-- z kódu adminu (src/server/platform) po kontrole session, TOTP a řádku v platform_admins.
-- ---------------------------------------------------------------------------

-- 1) companies: stav účtu a příznaky, které mění jen provozovatel -------------------------------------------------
alter table companies add column if not exists status text not null default 'active';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'companies_status_check') then
    alter table companies add constraint companies_status_check check (status in ('active', 'suspended', 'pending_deletion', 'deleted'));
  end if;
end
$$;
alter table companies add column if not exists discount_pct numeric(4,1) not null default 0;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'companies_discount_pct_check') then
    alter table companies add constraint companies_discount_pct_check check (discount_pct >= 0 and discount_pct <= 100);
  end if;
end
$$;
alter table companies add column if not exists is_test boolean not null default false;      -- testovací firmy se nezapočítávají do KPI
alter table companies add column if not exists last_activity_at timestamptz;               -- pro filtr „neaktivní“ (plní denní úloha)

-- Admin firmy smí měnit celý řádek své firmy (RLS), proto trigger zakazuje i nové provozní sloupce.
-- Tělo je původní guard_company_update ze schema.sql + jedna nová kontrola na začátku.
create or replace function guard_company_update()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null and (new.status is distinct from old.status or new.discount_pct is distinct from old.discount_pct
      or new.is_test is distinct from old.is_test or new.last_activity_at is distinct from old.last_activity_at) then
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

-- 2) company_invoices: rozšíření (faktury se nikdy nemažou, firma je nemůže měnit) -----------------------------------
alter table company_invoices add column if not exists due_at date;
alter table company_invoices add column if not exists paid_at date;
alter table company_invoices add column if not exists vat numeric(10,2) not null default 0;
alter table company_invoices add column if not exists status text not null default 'issued';
alter table company_invoices add column if not exists buyer_snapshot jsonb;   -- kopie odběratele v době vystavení (název, IČO, DIČ, adresa)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'company_invoices_status_check') then
    alter table company_invoices add constraint company_invoices_status_check check (status in ('issued', 'paid', 'void'));
  end if;
  -- Faktura musí přežít smazání firmy (firma se mění na „náhrobek“, řádek zůstává) — pojistka proti chybě v kódu.
  if exists (select 1 from pg_constraint where conname = 'company_invoices_company_id_fkey') then
    alter table company_invoices drop constraint company_invoices_company_id_fkey;
    alter table company_invoices add constraint company_invoices_company_id_fkey foreign key (company_id) references companies(id) on delete restrict;
  end if;
end
$$;
create index if not exists company_invoices_status_due_idx on company_invoices (status, due_at);

-- 3) Tabulky platformy -------------------------------------------------------------------------------------------------
create table if not exists platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null default '',
  role text not null check (role in ('super_admin', 'support', 'billing')),
  active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists platform_admin_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references platform_admins(user_id) on delete cascade,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ended_at timestamptz,
  ip text,
  user_agent text
);
create index if not exists platform_admin_sessions_admin_idx on platform_admin_sessions (admin_id, started_at desc);

create table if not exists platform_stepup_tokens (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references platform_admins(user_id) on delete cascade,
  action text not null,
  token_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists platform_stepup_tokens_hash_idx on platform_stepup_tokens (token_hash);

-- company_id záměrně bez cizího klíče: audit musí přežít cokoli, co se s firmou stane. company_label = název + č. firmy v čase akce.
create table if not exists platform_audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  request_id text,
  actor_type text not null check (actor_type in ('admin', 'system', 'impersonation')),
  actor_id uuid,
  actor_label text,
  action text not null,
  result text not null default 'ok' check (result in ('ok', 'denied', 'error')),
  company_id uuid,
  company_label text,
  details jsonb not null default '{}'::jsonb,
  ip text,
  user_agent text,
  via_impersonation boolean not null default false
);
create index if not exists platform_audit_log_created_idx on platform_audit_log (created_at desc);
create index if not exists platform_audit_log_company_idx on platform_audit_log (company_id, created_at desc);

create table if not exists platform_company_notes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  author_id uuid,
  author_label text,
  body text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists platform_company_notes_company_idx on platform_company_notes (company_id, created_at desc);

-- Platby: ruční „Označit jako zaplaceno“ dnes, webhook platební brány později.
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references company_invoices(id) on delete restrict,
  company_id uuid not null references companies(id) on delete restrict,
  source text not null check (source in ('manual', 'gateway')),
  provider_ref text,
  amount numeric(10,2) not null,
  received_at date not null,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists payments_invoice_idx on payments (invoice_id);

-- 4) Zabezpečení: žádný přístup z prohlížeče, audit jen k přidávání -------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['platform_admins', 'platform_admin_sessions', 'platform_stepup_tokens', 'platform_audit_log', 'platform_company_notes', 'payments']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "platform deny all" on %I', t);
    -- Politika je nutná, protože security_audit() hlásí tabulky s RLS bez politik; „false“ = nikdo z prohlížeče nic.
    execute format('create policy "platform deny all" on %I for all using (false)', t);
    execute format('revoke all on table %I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on table %I to service_role', t);
  end loop;
end
$$;

revoke update, delete, truncate on table platform_audit_log from service_role;

create or replace function platform_audit_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'platform_audit_log je určen jen k přidávání záznamů.';
end;
$$;

drop trigger if exists platform_audit_log_no_change on platform_audit_log;
create trigger platform_audit_log_no_change
  before update or delete on platform_audit_log
  for each row execute function platform_audit_immutable();

drop trigger if exists platform_audit_log_no_truncate on platform_audit_log;
create trigger platform_audit_log_no_truncate
  before truncate on platform_audit_log
  for each statement execute function platform_audit_immutable();
