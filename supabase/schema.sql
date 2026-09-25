-- ============================================================================
-- Dovolená APP — Supabase schema
-- Run this once in Supabase Studio → SQL Editor → New query → paste → Run.
-- Safe to re-run: uses IF NOT EXISTS / DROP ... IF EXISTS where sensible.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto"; -- for gen_random_uuid()

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type user_role as enum ('employee', 'manager', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type request_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type leave_color as enum ('teal', 'rust', 'moss', 'violet', 'amber', 'sky', 'plum', 'sage');
exception when duplicate_object then null; end $$;

do $$ begin
  alter type leave_color add value if not exists 'sky';
  alter type leave_color add value if not exists 'plum';
  alter type leave_color add value if not exists 'sage';
exception when duplicate_object then null; end $$;

do $$ begin
  alter type leave_color add value if not exists 'gold';
  alter type leave_color add value if not exists 'wine';
  alter type leave_color add value if not exists 'slate';
  alter type leave_color add value if not exists 'forest';
exception when duplicate_object then null; end $$;

do $$ begin
  create type integration_provider as enum ('slack', 'teams');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- companies — the multitenancy root. Every other table hangs off this.
-- ---------------------------------------------------------------------------
create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- Whether this company operates on weekends (e.g. retail/e-shop shift work).
-- When false (the common case), the team calendar hides Saturday/Sunday
-- columns entirely instead of showing them as always-empty gray columns.
-- Purely a display setting — working-day/holiday calculations always treat
-- Sat/Sun as non-working regardless of this flag.
alter table companies add column if not exists weekend_operations boolean not null default false;

-- ---------------------------------------------------------------------------
-- Provoz (Nastavení firmy) — company-wide operating rules.
-- shift_pattern / standard_daily_hours / work_days are informational/display
-- settings for now (not yet wired into the working-day calculation, which
-- still assumes a flat Mon–Fri week — changing that touches every balance
-- computation in the app, so it's deliberately out of scope here).
-- The rest (backdating, negative balance, advance notice, capacity warning,
-- carryover expiry) ARE enforced — see RequestLeaveModal and PendingApprovals.
-- approval_reminder_hours is stored only; no email is sent yet (needs an
-- email provider, a separate piece of work).
-- ---------------------------------------------------------------------------
do $$ begin
  create type shift_pattern as enum ('none', 'two_shift', 'three_shift');
exception when duplicate_object then null; end $$;

alter table companies add column if not exists shift_pattern shift_pattern not null default 'none';
alter table companies add column if not exists standard_daily_hours numeric(4,1) not null default 8;
alter table companies add column if not exists work_days int[] not null default '{1,2,3,4,5}'; -- 1=Mon..7=Sun (ISO)
alter table companies add column if not exists min_advance_days int not null default 0;
alter table companies add column if not exists min_advance_threshold_days numeric(4,1) not null default 3;
alter table companies add column if not exists backdating_allowed boolean not null default true;
alter table companies add column if not exists backdating_max_days int not null default 3;
alter table companies add column if not exists allow_negative_balance boolean not null default false;
alter table companies add column if not exists max_negative_balance_days numeric(4,1) not null default 5;
alter table companies add column if not exists carryover_expiry_md text; -- 'MM-DD', null = no expiry
alter table companies add column if not exists max_carryover_days numeric(5,1); -- null = no cap on how much rolls into the next year
alter table companies add column if not exists capacity_warning_percent int not null default 30;
alter table companies add column if not exists approval_reminder_hours int; -- null = disabled

-- Defaults granted to a newly onboarded/joining employee (see
-- onboard_new_company / grant_default_entitlements / claim_invite below).
-- default_home_office_days is stored for reference only — home office isn't
-- balance-tracked (its leave_type.counts_against is 'none'), so nothing
-- currently enforces this number.
alter table companies add column if not exists default_vacation_days numeric(5,1) not null default 20;
alter table companies add column if not exists default_sick_days numeric(5,1) not null default 5;
alter table companies add column if not exists default_home_office_days numeric(5,1) not null default 0;

-- Fakturační údaje (název, IČO, DIČ, adresa, e-mail pro faktury, způsob platby)
-- jsou v tabulce company_billing, kterou čte jen admin firmy — viz konec souboru.
alter table companies add column if not exists logo_url text;

-- Poměrná dovolená pro nováčky během roku: nárok se krátí podle zbývajících
-- měsíců (včetně měsíce nástupu), zaokrouhleno na půl dne.
alter table companies add column if not exists prorate_new_hires boolean not null default false;

-- Tarif firmy (free / starter / pro / enterprise) — názvy, limity a ceny viz src/lib/plans.ts.
alter table companies add column if not exists plan text not null default 'free';
-- První verze sloupce používala výchozí hodnotu 'start' — přejmenováno na 'free'.
alter table companies alter column plan set default 'free';
update companies set plan = 'free' where plan = 'start';

-- Poměrné krácení podle měsíce nástupu (včetně měsíce nástupu), zaokrouhleno na půl dne.
create or replace function prorate_from(p_days numeric, p_company_id uuid, p_start date)
returns numeric
language sql
stable
as $$
  select case
    when coalesce((select prorate_new_hires from companies where id = p_company_id), false)
      then round(p_days * (13 - extract(month from p_start)::int) / 12.0 * 2) / 2
    else p_days
  end;
$$;

-- Zpětně kompatibilní varianta: krátí podle dneška (když datum nástupu není známé).
create or replace function prorate_days(p_days numeric, p_company_id uuid)
returns numeric
language sql
stable
as $$
  select prorate_from(p_days, p_company_id, current_date);
$$;

-- Příplatek k dovolené za odpracované roky: admin zapne a zadá stupně
-- [{"years": 5, "extra_days": 5}, ...]. Platí nejvyšší dosažený stupeň
-- (počet let se počítá k 31. 12. daného roku).
alter table companies add column if not exists seniority_enabled boolean not null default false;
alter table companies add column if not exists seniority_rules jsonb not null default '[]'::jsonb;

create or replace function seniority_bonus_days(p_hire date, p_company_id uuid, p_year int)
returns numeric
language sql
stable
set search_path = public
as $$
  select coalesce((
    select (r.rule ->> 'extra_days')::numeric
    from companies c, jsonb_array_elements(c.seniority_rules) as r(rule)
    where c.id = p_company_id
      and c.seniority_enabled
      and p_hire is not null
      and (r.rule ->> 'years')::numeric <= date_part('year', age(make_date(p_year, 12, 31), p_hire))
    order by (r.rule ->> 'years')::numeric desc
    limit 1
  ), 0);
$$;

-- ---------------------------------------------------------------------------
-- company-logos storage bucket — public read (logos are shown in the app
-- chrome, not sensitive), admin-only write, one file per company.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('company-logos', 'company-logos', true)
on conflict (id) do nothing;

drop policy if exists "public read company logos" on storage.objects;
create policy "public read company logos" on storage.objects
  for select using (bucket_id = 'company-logos');

drop policy if exists "admins upload own company logo" on storage.objects;
create policy "admins upload own company logo" on storage.objects
  for insert with check (
    bucket_id = 'company-logos'
    and current_user_role() = 'admin'
    and (storage.foldername(name))[1] = current_company_id()::text
  );

drop policy if exists "admins update own company logo" on storage.objects;
create policy "admins update own company logo" on storage.objects
  for update using (
    bucket_id = 'company-logos'
    and current_user_role() = 'admin'
    and (storage.foldername(name))[1] = current_company_id()::text
  );

drop policy if exists "admins delete own company logo" on storage.objects;
create policy "admins delete own company logo" on storage.objects
  for delete using (
    bucket_id = 'company-logos'
    and current_user_role() = 'admin'
    and (storage.foldername(name))[1] = current_company_id()::text
  );

-- ---------------------------------------------------------------------------
-- company_invoices — invoices Dodio itself issues to a company for using the
-- service. Read-only from the app's side: there's no billing/subscription
-- system yet (no Stripe etc.), so rows only get added from the platform side
-- (service role / future billing integration), never by a company's own
-- admin — hence select-only RLS with no insert/update/delete policy at all.
-- ---------------------------------------------------------------------------
create table if not exists company_invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  number text not null,
  issue_date date not null,
  amount numeric(10,2) not null,
  currency text not null default 'CZK',
  file_url text,
  created_at timestamptz not null default now()
);

alter table company_invoices enable row level security;

drop policy if exists "admins manage company invoices" on company_invoices;
drop policy if exists "admins read own company invoices" on company_invoices;
create policy "admins read own company invoices" on company_invoices
  for select using (company_id = current_company_id() and current_user_role() = 'admin');

-- Private bucket — unlike company-logos, invoices aren't meant to be
-- publicly readable, only fetched by the admin who's already authenticated.
-- Read-only for the same reason as the table above: uploads happen from the
-- platform side, not from a company's own admin.
insert into storage.buckets (id, name, public)
values ('company-invoices', 'company-invoices', false)
on conflict (id) do nothing;

drop policy if exists "admins upload own company invoices" on storage.objects;
drop policy if exists "admins delete own company invoices" on storage.objects;
drop policy if exists "admins read own company invoices" on storage.objects;
create policy "admins read own company invoices" on storage.objects
  for select using (
    bucket_id = 'company-invoices'
    and current_user_role() = 'admin'
    and (storage.foldername(name))[1] = current_company_id()::text
  );

-- ---------------------------------------------------------------------------
-- blackout_periods — admin-locked date ranges (e.g. year-end inventory)
-- during which ordinary leave requests are blocked.
-- ---------------------------------------------------------------------------
create table if not exists blackout_periods (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  label text not null,
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

alter table blackout_periods enable row level security;

drop policy if exists "select blackout_periods in company" on blackout_periods;
create policy "select blackout_periods in company" on blackout_periods
  for select using (company_id = current_company_id());

drop policy if exists "admins manage blackout_periods" on blackout_periods;
create policy "admins manage blackout_periods" on blackout_periods
  for all using (company_id = current_company_id() and current_user_role() = 'admin')
  with check (company_id = current_company_id() and current_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- create_company_wide_leave — "celozávodní dovolená": admin books the same
-- approved leave (e.g. a Christmas shutdown) for every single employee at
-- once. working_days is computed client-side (src/lib/working-days.ts
-- already implements the Czech holiday calendar; duplicating that logic in
-- SQL isn't worth it) and passed in already-calculated.
-- security definer because a plain admin has no RLS insert privilege on
-- other people's leave_requests rows (see "create own leave_requests").
-- ---------------------------------------------------------------------------
-- Starý podpis bez target_department_ids by kolidoval s novým (PostgREST by nevěděl, kterou verzi volat).
drop function if exists create_company_wide_leave(uuid, uuid, date, date, numeric, text);

create or replace function create_company_wide_leave(
  target_company_id uuid,
  target_leave_type_id uuid,
  p_start_date date,
  p_end_date date,
  p_working_days numeric,
  p_note text,
  target_department_ids uuid[] default null
)
returns int
language plpgsql
security definer
as $$
declare
  n int;
begin
  if current_user_role() <> 'admin' or current_company_id() <> target_company_id then
    raise exception 'Jen admin firmy může naplánovat celozávodní dovolenou.';
  end if;

  -- target_department_ids null (or left out) means "everyone"; a non-null
  -- array restricts the company-wide leave to just those departments.
  insert into leave_requests (profile_id, leave_type_id, start_date, end_date, half_day, working_days, status, note, approved_by)
  select p.id, target_leave_type_id, p_start_date, p_end_date, false, p_working_days, 'approved', p_note, auth.uid()
  from profiles p
  where p.company_id = target_company_id
    and (target_department_ids is null or p.department_id = any(target_department_ids));

  get diagnostics n = row_count;
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- departments
-- ---------------------------------------------------------------------------
create table if not exists departments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

alter table departments add column if not exists head_profile_id uuid references profiles(id) on delete set null;

-- Deputy head — stands in for approvals/visibility when the head is away.
-- Same "team scope" rules as head_profile_id apply to whoever holds this.
alter table departments add column if not exists deputy_head_profile_id uuid references profiles(id) on delete set null;

-- Color accent shown next to the department name across the app (team page,
-- calendar row labels) so which team someone belongs to reads at a glance.
alter table departments add column if not exists color leave_color not null default 'slate';

-- Per-department override of companies.capacity_warning_percent — null means
-- "use the company default" (see PendingApprovals' capacity check).
alter table departments add column if not exists capacity_warning_percent int;

-- ---------------------------------------------------------------------------
-- profiles — one row per app user, 1:1 with an auth.users row.
-- id intentionally matches auth.users.id so RLS can use auth.uid() directly.
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid references companies(id) on delete cascade,
  department_id uuid references departments(id) on delete set null,
  manager_id uuid references profiles(id) on delete set null,
  name text not null,
  role user_role not null default 'employee',
  avatar_initials text,
  created_at timestamptz not null default now()
);

-- Deaktivace odcházejícího zaměstnance: účet ztratí přístup (viz current_company_id),
-- ale historie absencí zůstává. Nikdy se nemaže — jen se přepíná.
alter table profiles add column if not exists active boolean not null default true;
alter table profiles add column if not exists deactivated_at timestamptz;

-- Standing deputy/substitute for this employee — distinct from
-- leave_requests.covering_profile_id, which is the (optional, one-off)
-- cover named on a single request. This is the default that prefills it.
alter table profiles add column if not exists substitute_id uuid references profiles(id) on delete set null;

-- Datum nástupu — základ pro příplatek k dovolené za odpracované roky (companies.seniority_*).
-- (datum nástupu je v tabulce profile_hr — čte ho jen dotčená osoba, HR a admin; viz konec souboru)
create table if not exists profile_hr (
  profile_id uuid primary key references profiles(id) on delete cascade,
  hire_date date
);

-- Doplňková role vedle role zaměstnanec / manažer / admin (nastavuje jen admin, viz guard_profile_update):
--   hr         — personalistika: vidí všechna data o absencích a nárocích, spravuje lidi (oddělení, nadřízený,
--                datum nástupu, nároky, pozvánky), čte Analytiku, Exporty a Historii změn. Nespravuje firmu, role ani fakturaci.
--   accountant — mzdová účetní: jen čte absence a nároky celé firmy pro mzdy (Exporty, Analytika). Nic nemění.
alter table profiles add column if not exists staff_role text check (staff_role in ('hr', 'accountant'));

-- Nové registrace z odkazu čekají na schválení adminem (viz company_join / join_company_by_code).
alter table profiles add column if not exists join_pending boolean not null default false;

-- Token osobního iCal odkazu je v tabulce profile_secrets (čte ji jen vlastník) — viz konec souboru.

-- Denormalized copy of auth.users.email — client code can't join auth.users
-- directly (no RLS-visible table), and Uživatelé needs to show it. Set once
-- at signup time by onboard_new_company/join_existing_company/claim_invite;
-- backfilled below for accounts created before this column existed.
alter table profiles add column if not exists email text;
update profiles set email = u.email from auth.users u where profiles.id = u.id and profiles.email is null;

-- ---------------------------------------------------------------------------
-- leave_types — company-scoped so each company can rename/add types later,
-- but every new company is seeded with the standard Czech set (see function
-- seed_default_leave_types below).
-- ---------------------------------------------------------------------------
create table if not exists leave_types (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  key text not null,
  label text not null,
  color leave_color not null,
  counts_against text not null default 'none' check (counts_against in ('vacation', 'sick', 'none')),
  unique (company_id, key)
);

-- Per-type request rules (Typy absencí → pokročilá pravidla).
alter table leave_types add column if not exists requires_approval boolean not null default true;
alter table leave_types add column if not exists paid boolean not null default true;
alter table leave_types add column if not exists allow_half_day boolean not null default true;
alter table leave_types add column if not exists allow_hours boolean not null default true;
-- Typ, při kterém člověk dál pracuje (Home Office, služební cesta…): nesnižuje kapacitu týmu a nepočítá se jako nepřítomnost.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'leave_types' and column_name = 'counts_as_present'
  ) then
    alter table leave_types add column counts_as_present boolean not null default false;
    update leave_types set counts_as_present = true where key = 'home_office';
  end if;
end $$;
-- Display order in pickers (request form, quick CTA) — admin-controlled via
-- up/down reorder in Typy absencí, not tied to creation order any more.
alter table leave_types add column if not exists sort_order int not null default 0;

-- One-off backfill so existing types don't all start at the same sort_order
-- (ctid approximates original insert order — safe to re-run, a no-op once
-- every row already has a distinct value within its company).
update leave_types lt set sort_order = ranked.rn
from (select id, row_number() over (partition by company_id order by ctid) as rn from leave_types) ranked
where lt.id = ranked.id and lt.sort_order = 0;

-- Inactive types are kept out of employee-facing pickers (request form, quick
-- CTA) but still shown/manageable in Nastavení firmy → Typy absencí — lets an
-- admin pre-provision a type (e.g. Mateřská dovolená) and switch it on only
-- when actually needed.
alter table leave_types add column if not exists active boolean not null default true;

-- ---------------------------------------------------------------------------
-- leave_entitlements — annual day allowances per profile per leave type
-- (only vacation and sick typically need this; home office etc. don't).
-- ---------------------------------------------------------------------------
create table if not exists leave_entitlements (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  leave_type_id uuid not null references leave_types(id) on delete cascade,
  year int not null,
  total_days numeric(5,1) not null default 0,
  unique (profile_id, leave_type_id, year)
);

-- ---------------------------------------------------------------------------
-- leave_requests
-- ---------------------------------------------------------------------------
create table if not exists leave_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  leave_type_id uuid not null references leave_types(id),
  start_date date not null,
  end_date date not null,
  half_day boolean not null default false,
  working_days numeric(5,1) not null,
  status request_status not null default 'pending',
  note text,
  covering_profile_id uuid references profiles(id) on delete set null,
  approved_by uuid references profiles(id) on delete set null,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);


-- ---------------------------------------------------------------------------
-- company_integrations — Slack/Teams connection config (added later; the
-- config jsonb column holds provider-specific tokens/channel ids).
-- ---------------------------------------------------------------------------
create table if not exists company_integrations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  provider integration_provider not null,
  config jsonb not null default '{}'::jsonb,
  connected_at timestamptz not null default now(),
  unique (company_id, provider)
);

-- ---------------------------------------------------------------------------
-- Helper: current user's company_id, used throughout RLS policies below.
-- security definer + stable so it can be used cheaply inside policies.
-- ---------------------------------------------------------------------------
create or replace function current_company_id()
returns uuid
language sql
security definer
stable
as $$
  select company_id from profiles where id = auth.uid() and active;
$$;

create or replace function current_user_role()
returns user_role
language sql
security definer
stable
as $$
  select role from profiles where id = auth.uid() and active;
$$;

create or replace function current_user_staff()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select staff_role from profiles where id = auth.uid() and active;
$$;

-- ---------------------------------------------------------------------------
-- seed_default_leave_types — call this right after creating a company to
-- populate the standard Czech absence types.
-- ---------------------------------------------------------------------------
create or replace function seed_default_leave_types(target_company_id uuid)
returns void
language sql
as $$
  insert into leave_types (company_id, key, label, color, counts_against, active) values
    (target_company_id, 'dovolena', 'Dovolená', 'teal', 'vacation', true),
    (target_company_id, 'sick', 'Sick Day', 'wine', 'sick', true),
    (target_company_id, 'home_office', 'Home Office', 'sky', 'none', true),
    (target_company_id, 'lekar', 'Lékař', 'violet', 'none', true),
    (target_company_id, 'nahradni_volno', 'Náhradní volno', 'gold', 'none', true),
    -- Seeded but off by default — admin switches these on in Typy absencí
    -- once actually needed, rather than every company starting with them live.
    (target_company_id, 'osetrovacka', 'Ošetřování člena rodiny', 'plum', 'none', false),
    (target_company_id, 'materska', 'Mateřská dovolená', 'forest', 'none', false),
    (target_company_id, 'nemoc', 'Nemoc', 'sage', 'none', false),
    (target_company_id, 'sluzebni_cesta', 'Služební cesta', 'slate', 'none', false)
  on conflict (company_id, key) do nothing;
$$;

-- One-off backfill: "Ošetřování člena rodiny" was originally seeded active
-- by default; it should have shipped inactive like Mateřská/Nemoc. Safe to
-- re-run — only touches rows still sitting at that old auto-seeded default.
update leave_types set active = false where key = 'osetrovacka' and active = true;

-- One-off backfill: give every existing company the new "Služební cesta"
-- type too (seed_default_leave_types only runs for brand-new companies).
insert into leave_types (company_id, key, label, color, counts_against, active)
select id, 'sluzebni_cesta', 'Služební cesta', 'slate', 'none', false from companies
on conflict (company_id, key) do nothing;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table companies enable row level security;
alter table departments enable row level security;
alter table profiles enable row level security;
alter table leave_types enable row level security;
alter table leave_entitlements enable row level security;
alter table leave_requests enable row level security;
alter table company_integrations enable row level security;

-- companies: a user can only see their own company.
drop policy if exists "select own company" on companies;
create policy "select own company" on companies
  for select using (id = current_company_id());

drop policy if exists "admins update own company" on companies;
create policy "admins update own company" on companies
  for update using (id = current_company_id() and current_user_role() = 'admin');

-- departments: read within company; write restricted to admins.
drop policy if exists "select departments in company" on departments;
create policy "select departments in company" on departments
  for select using (company_id = current_company_id());

drop policy if exists "admins manage departments" on departments;
create policy "admins manage departments" on departments
  for all using (company_id = current_company_id() and current_user_role() = 'admin')
  with check (company_id = current_company_id() and current_user_role() = 'admin');

-- profiles: everyone in a company can see each other's profiles (needed for
-- "who is out today", team calendar, manager approvals); users can only
-- update their own row, admins can update any row in their company.
drop policy if exists "select profiles in company" on profiles;
create policy "select profiles in company" on profiles
  for select using (company_id = current_company_id());

-- Deaktivovaný uživatel nemá firmu (current_company_id() je null), ale musí vidět aspoň vlastní řádek,
-- aby ho aplikace mohla odhlásit s vysvětlením.
drop policy if exists "select own profile" on profiles;
create policy "select own profile" on profiles
  for select using (id = auth.uid());

drop policy if exists "update own profile" on profiles;
create policy "update own profile" on profiles
  for update using (id = auth.uid());

drop policy if exists "admins update any profile in company" on profiles;
create policy "admins update any profile in company" on profiles
  for update using (company_id = current_company_id() and current_user_role() = 'admin');

-- Managers can reassign department/manager for anyone in their company (e.g.
-- from "Můj tým"); the guard_profile_update trigger below still stops a
-- manager (or a user editing their own row) from touching role or company.
drop policy if exists "managers update team profiles" on profiles;
create policy "managers update team profiles" on profiles
  for update using (company_id = current_company_id() and current_user_role() in ('manager', 'admin'));

-- leave_types: read within company; write restricted to admins.
drop policy if exists "select leave_types in company" on leave_types;
create policy "select leave_types in company" on leave_types
  for select using (company_id = current_company_id());

drop policy if exists "admins manage leave_types" on leave_types;
create policy "admins manage leave_types" on leave_types
  for all using (company_id = current_company_id() and current_user_role() = 'admin')
  with check (company_id = current_company_id() and current_user_role() = 'admin');

-- leave_entitlements: a user can read their own; managers/admins can read
-- their whole company's; only admins can write.
drop policy if exists "select own entitlements" on leave_entitlements;
create policy "select own entitlements" on leave_entitlements
  for select using (
    profile_id = auth.uid()
    or exists (
      select 1 from profiles p
      where p.id = leave_entitlements.profile_id
        and p.company_id = current_company_id()
        and current_user_role() in ('manager', 'admin')
    )
  );

drop policy if exists "admins manage entitlements" on leave_entitlements;
create policy "admins manage entitlements" on leave_entitlements
  for all using (
    current_user_role() = 'admin'
    and exists (
      select 1 from profiles p
      where p.id = leave_entitlements.profile_id and p.company_id = current_company_id()
    )
  );

-- leave_requests: everyone in a company can read requests (calendar, who's
-- out today, collision checks); a user can create/update their own pending
-- requests; managers/admins can update (approve/reject) any request in their
-- company.
drop policy if exists "select leave_requests in company" on leave_requests;
create policy "select leave_requests in company" on leave_requests
  for select using (
    exists (
      select 1 from profiles p
      where p.id = leave_requests.profile_id and p.company_id = current_company_id()
    )
  );

drop policy if exists "create own leave_requests" on leave_requests;
create policy "create own leave_requests" on leave_requests
  for insert with check (profile_id = auth.uid());

-- A manager/admin booking leave on someone's behalf (e.g. a phoned-in sick
-- day) — always for someone in their own company, not necessarily a direct
-- report.
drop policy if exists "managers create leave_requests for team" on leave_requests;
create policy "managers create leave_requests for team" on leave_requests
  for insert with check (
    current_user_role() in ('manager', 'admin')
    and exists (select 1 from profiles p where p.id = leave_requests.profile_id and p.company_id = current_company_id())
  );

drop policy if exists "update own pending leave_requests" on leave_requests;
create policy "update own pending leave_requests" on leave_requests
  for update using (profile_id = auth.uid() and status = 'pending');

-- A request can't be edited (see guard above — only its own owner can even
-- update it, and only while pending), but it can be withdrawn and resubmitted.
drop policy if exists "delete own pending leave_requests" on leave_requests;
create policy "delete own pending leave_requests" on leave_requests
  for delete using (profile_id = auth.uid() and status = 'pending');

drop policy if exists "managers approve leave_requests" on leave_requests;
create policy "managers approve leave_requests" on leave_requests
  for update using (
    current_user_role() in ('manager', 'admin')
    and exists (
      select 1 from profiles p
      where p.id = leave_requests.profile_id and p.company_id = current_company_id()
    )
  );

-- company_integrations: admins only, scoped to their company.
drop policy if exists "admins manage integrations" on company_integrations;
create policy "admins manage integrations" on company_integrations
  for all using (company_id = current_company_id() and current_user_role() = 'admin')
  with check (company_id = current_company_id() and current_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- updated_at trigger for leave_requests
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists leave_requests_set_updated_at on leave_requests;
create trigger leave_requests_set_updated_at
  before update on leave_requests
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- leave_entitlements.opening_used_days — days already used this year before
-- an employee's record existed in this app (CSV import has no historical
-- leave_requests to sum "used so far" from, so it's carried here instead).
-- Every read of "remaining balance" must subtract this alongside approved
-- leave_requests — see BalanceCards.tsx, TeamCalendar/team page, PendingApprovals.
-- ---------------------------------------------------------------------------
alter table leave_entitlements add column if not exists opening_used_days numeric(5,1) not null default 0;

-- ---------------------------------------------------------------------------
-- company_invites — one row per person an admin has added or CSV-imported
-- but who hasn't signed up yet. Populated from Nastavení firmy → Uživatelé
-- (single add or bulk CSV import). When someone signs up with a matching
-- email, claim_invite() below turns this into a real profile + entitlements
-- and removes the row.
-- ---------------------------------------------------------------------------
create table if not exists company_invites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  email text not null,
  name text not null,
  role user_role not null default 'employee',
  department_id uuid references departments(id) on delete set null,
  manager_id uuid references profiles(id) on delete set null,
  -- Set when the imported manager is themselves just another invite in the
  -- same batch (no profile yet) — resolved to manager_id once that person
  -- also joins. If the manager joins first, manager_id above is used instead.
  manager_invite_email text,
  vacation_total numeric(5,1) not null default 0,
  vacation_opening_used numeric(5,1) not null default 0,
  sick_total numeric(5,1) not null default 0,
  sick_opening_used numeric(5,1) not null default 0,
  created_at timestamptz not null default now(),
  unique (company_id, email)
);

alter table company_invites enable row level security;

drop policy if exists "admins manage invites" on company_invites;
create policy "admins manage invites" on company_invites
  for all using (company_id = current_company_id() and (current_user_role() = 'admin' or current_user_staff() = 'hr'))
  with check (company_id = current_company_id() and (current_user_role() = 'admin' or current_user_staff() = 'hr'));

-- ---------------------------------------------------------------------------
-- claim_invite — call right after a brand-new user's first sign-up/sign-in.
-- If their email matches a pending company_invites row, this creates their
-- profile pre-filled with the imported department/manager/entitlements and
-- removes the invite, returning the company id. Returns null (not an error)
-- when this email has no pending invite — the caller then falls back to
-- onboard_new_company or join_existing_company.
-- ---------------------------------------------------------------------------
create or replace function claim_invite()
returns uuid
language plpgsql
security definer
as $$
declare
  inv company_invites%rowtype;
  resolved_manager_id uuid;
  caller_email text;
  year_now int := extract(year from now())::int;
begin
  if exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'Profile already exists for this user';
  end if;

  select email into caller_email from auth.users where id = auth.uid();
  select * into inv from company_invites where email = caller_email limit 1;
  if inv.id is null then
    return null;
  end if;
  -- Pozvánka se váže na e-mail: bez potvrzení e-mailu by ji mohl převzít kdokoli, kdo adresu jen zná.
  if (select email_confirmed_at from auth.users where id = auth.uid()) is null then
    raise exception 'Nejdřív potvrďte svůj e-mail (odkaz jsme vám poslali).';
  end if;

  resolved_manager_id := inv.manager_id;
  if resolved_manager_id is null and inv.manager_invite_email is not null then
    select p.id into resolved_manager_id
    from profiles p join auth.users u on u.id = p.id
    where u.email = inv.manager_invite_email and p.company_id = inv.company_id;
  end if;

  insert into profiles (id, company_id, department_id, manager_id, name, role, avatar_initials, email)
  values (
    auth.uid(), inv.company_id, inv.department_id, resolved_manager_id, inv.name, inv.role,
    upper(left(split_part(inv.name, ' ', 1), 1) || left(split_part(inv.name, ' ', 2), 1)),
    caller_email
  );

  insert into leave_entitlements (profile_id, leave_type_id, year, total_days, opening_used_days)
  select auth.uid(), lt.id, year_now, prorate_days(inv.vacation_total, inv.company_id), inv.vacation_opening_used
  from leave_types lt where lt.company_id = inv.company_id and lt.key = 'dovolena'
  on conflict (profile_id, leave_type_id, year)
    do update set total_days = excluded.total_days, opening_used_days = excluded.opening_used_days;

  insert into leave_entitlements (profile_id, leave_type_id, year, total_days, opening_used_days)
  select auth.uid(), lt.id, year_now, inv.sick_total, inv.sick_opening_used
  from leave_types lt where lt.company_id = inv.company_id and lt.key = 'sick'
  on conflict (profile_id, leave_type_id, year)
    do update set total_days = excluded.total_days, opening_used_days = excluded.opening_used_days;

  delete from company_invites where id = inv.id;

  return inv.company_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- guard_leave_type_delete — the 'dovolena' and 'sick' leave types are load-
-- bearing: their keys are hardcoded in onboard_new_company,
-- grant_default_entitlements, claim_invite and the dashboard balance math.
-- Deleting one would silently break balances for the whole company, so it's
-- blocked here regardless of which client tries it. Custom types (and the
-- other seeded ones that don't count against a balance) stay deletable.
-- ---------------------------------------------------------------------------
create or replace function guard_leave_type_delete()
returns trigger
language plpgsql
as $$
begin
  if old.key in ('dovolena', 'sick') then
    raise exception 'Výchozí typ absence "%" nelze smazat.', old.label;
  end if;
  return old;
end;
$$;

drop trigger if exists leave_types_guard_delete on leave_types;
create trigger leave_types_guard_delete
  before delete on leave_types
  for each row execute function guard_leave_type_delete();

-- ---------------------------------------------------------------------------
-- notifications — bell icon in the header. Populated only by the two
-- triggers below (never written to directly by the client), so a
-- notification exists exactly when the underlying leave_requests event
-- happened, regardless of which client/flow caused it.
-- ---------------------------------------------------------------------------
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  type text not null check (type in ('request_created', 'request_approved', 'request_rejected')),
  leave_request_id uuid references leave_requests(id) on delete cascade,
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- 'vacation_reminder' (Smart HR Insights bulk reminder) and 'help_question'
-- (Nápověda v2 "Napsat na HR/Podporu") added on top of the original three.
alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('request_created', 'request_approved', 'request_rejected', 'vacation_reminder', 'help_question', 'cancellation_requested', 'cancellation_resolved', 'join_pending'));

create index if not exists notifications_profile_id_created_at_idx on notifications (profile_id, created_at desc);

alter table notifications enable row level security;

drop policy if exists "select own notifications" on notifications;
create policy "select own notifications" on notifications
  for select using (profile_id = auth.uid());

drop policy if exists "update own notifications" on notifications;
create policy "update own notifications" on notifications
  for update using (profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- notify_on_leave_request_insert — tells every manager/admin in the
-- requester's company that a new request is waiting. security definer
-- because the requester (often a plain employee) has no RLS insert
-- privilege on notifications rows belonging to someone else.
-- ---------------------------------------------------------------------------
create or replace function notify_on_leave_request_insert()
returns trigger
language plpgsql
security definer
as $$
declare
  requester_name text;
  requester_company_id uuid;
  blackout_label text;
  notif_title text;
  notif_body text;
  type_label text;
  date_range text;
  mgr record;
begin
  -- A row can be inserted already-approved (e.g. company-wide leave, or a
  -- seeded/imported record) — nothing is actually pending anyone's action then.
  if new.status <> 'pending' then
    return new;
  end if;

  select name, company_id into requester_name, requester_company_id from profiles where id = new.profile_id;

  -- The request form lets an employee submit anyway during a blocked period
  -- (with an explicit "odeslat i přesto" confirmation) — the approving
  -- manager needs to see that flag, not just a generic new-request notice.
  select label into blackout_label
  from blackout_periods
  where company_id = requester_company_id and start_date <= new.end_date and end_date >= new.start_date
  limit 1;

  select label into type_label from leave_types where id = new.leave_type_id;
  date_range := case
    when new.start_date = new.end_date then to_char(new.start_date, 'DD. MM. YYYY')
    else to_char(new.start_date, 'DD. MM.') || ' – ' || to_char(new.end_date, 'DD. MM. YYYY')
  end;

  if blackout_label is not null then
    notif_title := '⚠️ Žádost v blokovaném termínu';
    notif_body := requester_name || ' přesto podal(a) žádost o absenci (' || coalesce(type_label, 'absence') || ', ' || date_range || ') v blokovaném termínu „' || blackout_label || '“. Rozhodněte prosím, zda ji schválíte.';
  else
    notif_title := 'Nová žádost o absenci';
    notif_body := requester_name || ' žádá o absenci: ' || coalesce(type_label, 'absence') || ', ' || date_range || '. Žádost čeká na vaše schválení.';
  end if;

  for mgr in
    select id from profiles
    where company_id = requester_company_id and role in ('manager', 'admin') and active and id <> new.profile_id
      and (role = 'admin' or superior_check(id, new.profile_id))
  loop
    insert into notifications (profile_id, type, leave_request_id, title, body)
    values (mgr.id, 'request_created', new.id, notif_title, notif_body);
  end loop;

  return new;
end;
$$;

drop trigger if exists leave_requests_notify_insert on leave_requests;
create trigger leave_requests_notify_insert
  after insert on leave_requests
  for each row execute function notify_on_leave_request_insert();

-- ---------------------------------------------------------------------------
-- notify_on_leave_request_status_change — tells the requester once their
-- request is approved or rejected.
-- ---------------------------------------------------------------------------
create or replace function notify_on_leave_request_status_change()
returns trigger
language plpgsql
security definer
as $$
declare
  type_label text;
  date_range text;
begin
  if new.status = old.status then
    return new;
  end if;

  select label into type_label from leave_types where id = new.leave_type_id;
  date_range := case
    when new.start_date = new.end_date then to_char(new.start_date, 'DD. MM. YYYY')
    else to_char(new.start_date, 'DD. MM.') || ' – ' || to_char(new.end_date, 'DD. MM. YYYY')
  end;

  if new.status = 'approved' then
    insert into notifications (profile_id, type, leave_request_id, title, body)
    values (new.profile_id, 'request_approved', new.id, 'Žádost schválena',
      'Vaše žádost o absenci (' || coalesce(type_label, 'absence') || ', ' || date_range || ') byla schválena.');
  elsif new.status = 'rejected' then
    insert into notifications (profile_id, type, leave_request_id, title, body)
    values (
      new.profile_id, 'request_rejected', new.id, 'Žádost zamítnuta',
      'Vaše žádost o absenci (' || coalesce(type_label, 'absence') || ', ' || date_range || ') byla zamítnuta.'
        || case when new.rejection_reason is not null and new.rejection_reason <> ''
             then ' Důvod: ' || new.rejection_reason
             else ''
           end
    );
  end if;

  return new;
end;
$$;

drop trigger if exists leave_requests_notify_status_change on leave_requests;
create trigger leave_requests_notify_status_change
  after update on leave_requests
  for each row execute function notify_on_leave_request_status_change();

-- ---------------------------------------------------------------------------
-- send_vacation_reminders — Smart HR Insights: admin picks employees with a
-- large unused vacation balance near year-end and sends them each an
-- in-app nudge. security definer because a plain admin has no RLS insert
-- privilege on other people's notifications rows.
-- ---------------------------------------------------------------------------
create or replace function send_vacation_reminders(target_profile_ids uuid[])
returns int
language plpgsql
security definer
as $$
declare
  n int;
begin
  if current_user_role() <> 'admin' and current_user_staff() is distinct from 'hr' then
    raise exception 'Jen admin nebo HR může odeslat hromadnou připomínku.';
  end if;

  insert into notifications (profile_id, type, title, body)
  select p.id, 'vacation_reminder',
    'Nevyčerpaná dovolená',
    'Do konce roku vám zbývá nevyčerpaná dovolená. Naplánujte si ji včas, ať vám nepropadne.'
  from profiles p
  where p.id = any(target_profile_ids) and p.company_id = current_company_id();

  get diagnostics n = row_count;
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- send_wellbeing_reminder — "Riziko vyhoření": manažer/admin pošle kolegovi
-- přátelské upozornění v aplikaci (bez e-mailu — appka zatím nemá e-mailového
-- poskytovatele). Jen pro lidi ze stejné firmy.
-- ---------------------------------------------------------------------------
create or replace function send_wellbeing_reminder(target_profile_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  first_name text;
begin
  if current_user_role() not in ('manager', 'admin') then
    raise exception 'Jen manažer nebo admin může poslat připomínku.';
  end if;
  select split_part(name, ' ', 1) into first_name from profiles
    where id = target_profile_id and company_id = current_company_id();
  if first_name is null then
    raise exception 'Zaměstnanec nenalezen.';
  end if;
  insert into notifications (profile_id, type, title, body)
  values (
    target_profile_id, 'vacation_reminder', 'Nechceš si naplánovat volno?',
    'Ahoj ' || first_name || ', všimli jsme si, že jsi už dlouho neměl(a) delší odpočinek. Nechceš si naplánovat pár dní volna?'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- send_help_question — Nápověda v2 "Napsat na HR/Podporu": any employee can
-- ping their company's managers/admins with a free-text question. security
-- definer because the sender has no RLS insert privilege on other people's
-- notifications rows.
-- ---------------------------------------------------------------------------
create table if not exists help_question_log (
  id bigint generated always as identity primary key,
  profile_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists help_question_log_idx on help_question_log (profile_id, created_at desc);
alter table help_question_log enable row level security;

create or replace function send_help_question(p_message text)
returns int
language plpgsql
security definer
as $$
declare
  requester_name text;
  requester_company_id uuid;
  n int;
begin
  select name, company_id into requester_name, requester_company_id from profiles where id = auth.uid();

  if p_message is null or trim(p_message) = '' then
    raise exception 'Zpráva nemůže být prázdná.';
  end if;
  if length(p_message) > 2000 then
    raise exception 'Zpráva je příliš dlouhá (nejvýše 2000 znaků).';
  end if;
  -- Ochrana před zahlcením adminů: nejvýše 5 dotazů za hodinu na člověka.
  if (select count(*) from help_question_log where profile_id = auth.uid() and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Příliš mnoho dotazů za sebou. Zkuste to prosím za chvíli.';
  end if;
  insert into help_question_log (profile_id) values (auth.uid());

  insert into notifications (profile_id, type, title, body)
  select id, 'help_question', 'Dotaz na podporu od ' || requester_name, p_message
  from profiles
  where company_id = requester_company_id and role in ('manager', 'admin') and active and id <> auth.uid();

  get diagnostics n = row_count;
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- help_feedback — 👍/👎 rating per Nápověda answer (Nápověda v2). Write-only
-- from the client's point of view (nothing reads it back in the app yet —
-- it's here so real usage data exists once someone wants to act on it).
-- ---------------------------------------------------------------------------
create table if not exists help_feedback (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  question text not null,
  helpful boolean not null,
  created_at timestamptz not null default now()
);

alter table help_feedback enable row level security;

drop policy if exists "create own help feedback" on help_feedback;
create policy "create own help feedback" on help_feedback
  for insert with check (profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Storno schválené absence: zaměstnanec požádá o zrušení, manažer/admin
-- rozhodne. security definer — vlastník nemůže schválenou žádost sám měnit
-- (RLS) a manažer nemá delete policy.
-- ---------------------------------------------------------------------------
alter table leave_requests add column if not exists cancellation_requested_at timestamptz;

create or replace function request_leave_cancellation(p_request_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  req record;
  requester_name text;
  requester_company_id uuid;
begin
  select * into req from leave_requests where id = p_request_id and profile_id = auth.uid();
  if not found then
    raise exception 'Žádost nenalezena.';
  end if;
  if req.status <> 'approved' or req.end_date < current_date then
    raise exception 'Zrušení jde požádat jen u schválené absence, která ještě neskončila.';
  end if;

  update leave_requests set cancellation_requested_at = now() where id = p_request_id;

  select name, company_id into requester_name, requester_company_id from profiles where id = auth.uid();
  insert into notifications (profile_id, type, leave_request_id, title, body)
  select id, 'cancellation_requested', p_request_id, 'Žádost o zrušení absence',
    requester_name || ' žádá o zrušení schválené absence.'
  from profiles
  where company_id = requester_company_id and role in ('manager', 'admin') and active and id <> auth.uid();
end;
$$;

create or replace function resolve_leave_cancellation(p_request_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
as $$
declare
  req record;
begin
  if current_user_role() not in ('manager', 'admin') then
    raise exception 'Jen manažer nebo admin může rozhodnout o zrušení.';
  end if;
  select r.* into req from leave_requests r
    join profiles p on p.id = r.profile_id
    where r.id = p_request_id and p.company_id = current_company_id() and r.cancellation_requested_at is not null;
  if not found then
    raise exception 'Žádost o zrušení nenalezena.';
  end if;
  if current_user_role() <> 'admin' and not is_superior_of(req.profile_id) then
    raise exception 'O zrušení může rozhodnout jen nadřízený nebo zástupce zaměstnance, případně admin.';
  end if;

  if p_approve then
    delete from leave_requests where id = p_request_id;
    insert into notifications (profile_id, type, title, body)
    values (req.profile_id, 'cancellation_resolved', 'Zrušení schváleno', 'Vaše absence byla zrušena.');
  else
    update leave_requests set cancellation_requested_at = null where id = p_request_id;
    insert into notifications (profile_id, type, leave_request_id, title, body)
    values (req.profile_id, 'cancellation_resolved', p_request_id, 'Zrušení zamítnuto', 'Vaše absence zůstává v platnosti.');
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- guard_leave_request_decision — rozhodnutí o žádosti (schválit/zamítnout):
--  * zamítnutí vyžaduje důvod,
--  * nikdo neschvaluje vlastní žádost, pokud ve firmě existuje jiný
--    manažer/admin (jediný admin firmy se schválit může, jinak by žádost
--    zůstala viset).
-- auth.uid() je null u service role / security definer funkcí — ty se nekontrolují.
-- ---------------------------------------------------------------------------
create or replace function guard_leave_request_decision()
returns trigger
language plpgsql
security definer
as $$
begin
  if old.status = 'pending' and new.status = 'rejected' and coalesce(trim(new.rejection_reason), '') = '' then
    raise exception 'Uveďte důvod zamítnutí.';
  end if;

  if old.status = 'pending' and new.status in ('approved', 'rejected')
     and auth.uid() is not null and new.profile_id = auth.uid()
     and exists (
       select 1 from profiles p
       where p.company_id = (select company_id from profiles where id = auth.uid())
         and p.role in ('manager', 'admin') and p.id <> auth.uid()
     ) then
    raise exception 'Vlastní žádost nemůžete rozhodnout — požádejte jiného manažera nebo admina.';
  end if;

  return new;
end;
$$;

drop trigger if exists leave_requests_guard_decision on leave_requests;
create trigger leave_requests_guard_decision
  before update on leave_requests
  for each row execute function guard_leave_request_decision();

-- ---------------------------------------------------------------------------
-- E-mailová upozornění: každá notifikace v aplikaci se zároveň zařadí do fronty
-- email_outbox (pokud má příjemce zapnuto). Odeslání dělá server (viz
-- /api/cron/process) přes poskytovatele e-mailů — tabulka je přístupná jen
-- service roli (RLS bez policies).
-- ---------------------------------------------------------------------------
alter table profiles add column if not exists email_notifications boolean not null default true;

create table if not exists email_outbox (
  id uuid primary key default gen_random_uuid(),
  to_email text not null,
  subject text not null,
  body text not null,
  notification_id uuid references notifications(id) on delete set null,
  attempts int not null default 0,
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table email_outbox enable row level security;

create index if not exists email_outbox_pending_idx on email_outbox (created_at) where sent_at is null;

create or replace function queue_notification_email()
returns trigger
language plpgsql
security definer
as $$
declare
  target record;
begin
  select email, name, email_notifications, active into target from profiles where id = new.profile_id;
  if target.email is null or not target.email_notifications or not target.active then
    return new;
  end if;
  insert into email_outbox (to_email, subject, body, notification_id)
  values (target.email, new.title, coalesce(new.body, ''), new.id);
  return new;
end;
$$;

drop trigger if exists notifications_queue_email on notifications;
create trigger notifications_queue_email
  after insert on notifications
  for each row execute function queue_notification_email();

-- ---------------------------------------------------------------------------
-- Eskalace schvalování + pravidla:
--  * escalated_at — žádost už byla přeposlána zástupci/adminům (jednou),
--  * digest_last_sent — týdenní přehled pro manažery se posílá max. jednou denně,
--  * auto_approve_max_days — typ absence se schválí automaticky do X pracovních
--    dnů (null = vypnuto; přijde na řadu v RequestLeaveModal).
-- ---------------------------------------------------------------------------
alter table leave_requests add column if not exists escalated_at timestamptz;
alter table companies add column if not exists digest_last_sent date;
alter table leave_types add column if not exists auto_approve_max_days numeric(4,1);

-- ---------------------------------------------------------------------------
-- audit_log — historie změn: kdo co s žádostmi (vytvoření, schválení,
-- zamítnutí, storno, smazání) a s profily (role, oddělení, nadřízený,
-- aktivace). Zapisují ji jen triggery; číst ji může admin své firmy.
-- ---------------------------------------------------------------------------
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  actor_id uuid,
  action text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_company_created_idx on audit_log (company_id, created_at desc);

alter table audit_log enable row level security;

drop policy if exists "admins read own company audit log" on audit_log;
create policy "admins read own company audit log" on audit_log
  for select using (company_id = current_company_id() and (current_user_role() = 'admin' or current_user_staff() = 'hr'));

create or replace function audit_leave_requests()
returns trigger
language plpgsql
security definer
as $$
declare
  owner_id uuid;
  cid uuid;
begin
  -- NEW is not assigned in DELETE triggers, so it must not be touched there.
  if tg_op = 'DELETE' then owner_id := old.profile_id; else owner_id := new.profile_id; end if;
  select company_id into cid from profiles where id = owner_id;
  if tg_op = 'INSERT' then
    insert into audit_log (company_id, actor_id, action, entity_id, details)
    values (cid, auth.uid(), 'request.created', new.id,
      jsonb_build_object('employee', owner_id, 'status', new.status, 'start', new.start_date, 'end', new.end_date));
  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      insert into audit_log (company_id, actor_id, action, entity_id, details)
      values (cid, auth.uid(), 'request.' || new.status, new.id,
        jsonb_build_object('employee', owner_id, 'from', old.status, 'start', new.start_date, 'end', new.end_date, 'reason', new.rejection_reason));
    elsif new.cancellation_requested_at is distinct from old.cancellation_requested_at then
      insert into audit_log (company_id, actor_id, action, entity_id, details)
      values (cid, auth.uid(),
        case when new.cancellation_requested_at is null then 'request.cancellation_declined' else 'request.cancellation_requested' end,
        new.id, jsonb_build_object('employee', owner_id, 'start', new.start_date, 'end', new.end_date));
    end if;
  elsif tg_op = 'DELETE' then
    insert into audit_log (company_id, actor_id, action, entity_id, details)
    values (cid, auth.uid(), 'request.deleted', old.id,
      jsonb_build_object('employee', owner_id, 'status', old.status, 'start', old.start_date, 'end', old.end_date));
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists leave_requests_audit on leave_requests;
create trigger leave_requests_audit
  after insert or update or delete on leave_requests
  for each row execute function audit_leave_requests();

create or replace function audit_profiles()
returns trigger
language plpgsql
security definer
as $$
declare
  changes jsonb := '{}'::jsonb;
begin
  if new.role is distinct from old.role then changes := changes || jsonb_build_object('role', jsonb_build_array(old.role, new.role)); end if;
  if new.department_id is distinct from old.department_id then changes := changes || jsonb_build_object('department', true); end if;
  if new.manager_id is distinct from old.manager_id then changes := changes || jsonb_build_object('manager', true); end if;
  if new.active is distinct from old.active then changes := changes || jsonb_build_object('active', jsonb_build_array(old.active, new.active)); end if;
  if changes <> '{}'::jsonb then
    insert into audit_log (company_id, actor_id, action, entity_id, details)
    values (new.company_id, auth.uid(), 'profile.updated', new.id, changes || jsonb_build_object('employee', new.id));
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_audit on profiles;
create trigger profiles_audit
  after update on profiles
  for each row execute function audit_profiles();

-- ---------------------------------------------------------------------------
-- guard_leave_request_insert — klient nesmí vložit rovnou schválenou žádost:
-- schválené vkládá jen manažer/admin za někoho jiného, nebo je to povoleno
-- pravidlem typu (nevyžaduje schválení / automatické schválení do X dnů).
-- Vlastní žádost smí schválit sám jen jediný schvalovatel firmy.
-- Běží jako volající (ne security definer): uvnitř security definer funkcí
-- (celozávodní dovolená) je current_user vlastník, takže se nekontroluje.
-- ---------------------------------------------------------------------------
create or replace function guard_leave_request_insert()
returns trigger
language plpgsql
as $$
declare
  lt record;
  rule_ok boolean := false;
begin
  if new.status = 'pending' or auth.uid() is null or current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  select requires_approval, auto_approve_max_days into lt from leave_types where id = new.leave_type_id;
  rule_ok := lt.requires_approval = false
    or (lt.auto_approve_max_days is not null and new.working_days <= lt.auto_approve_max_days);

  if rule_ok then
    return new;
  end if;

  if current_user_role() in ('manager', 'admin') and new.profile_id <> auth.uid()
     and (current_user_role() = 'admin' or is_superior_of(new.profile_id)) then
    return new;
  end if;

  if current_user_role() in ('manager', 'admin') and new.profile_id = auth.uid()
     and not exists (
       select 1 from profiles p
       where p.company_id = current_company_id() and p.role in ('manager', 'admin') and p.active and p.id <> auth.uid()
     ) then
    return new;
  end if;

  raise exception 'Žádost musí projít schválením.';
end;
$$;

drop trigger if exists leave_requests_guard_insert on leave_requests;
create trigger leave_requests_guard_insert
  before insert on leave_requests
  for each row execute function guard_leave_request_insert();

-- ---------------------------------------------------------------------------
-- Integrace do chatů (Slack, Microsoft Teams, Mattermost, Discord, Google Chat,
-- obecný webhook): admin vloží URL příchozího webhooku a vybere události.
-- Události z leave_requests se řadí do integration_outbox (jen když firma má
-- aktivní webhook na danou událost); odeslání dělá server (/api/cron/process).
-- URL webhooku je tajná — čte a spravuje ji jen admin firmy.
-- ---------------------------------------------------------------------------
create table if not exists webhook_integrations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  provider text not null check (provider in ('slack', 'teams', 'mattermost', 'discord', 'google_chat', 'webhook')),
  name text not null,
  url text not null,
  events text[] not null default '{request_created,request_decided,daily_digest}',
  active boolean not null default true,
  last_status text,
  last_sent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table webhook_integrations enable row level security;

drop policy if exists "admins manage webhook integrations" on webhook_integrations;
create policy "admins manage webhook integrations" on webhook_integrations
  for all using (company_id = current_company_id() and current_user_role() = 'admin')
  with check (company_id = current_company_id() and current_user_role() = 'admin');

create table if not exists integration_outbox (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  event text not null,
  text text not null,
  attempts int not null default 0,
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table integration_outbox enable row level security;

create index if not exists integration_outbox_pending_idx on integration_outbox (created_at) where sent_at is null;

alter table companies add column if not exists integration_digest_last date;

create or replace function queue_integration_events()
returns trigger
language plpgsql
security definer
as $$
declare
  cid uuid;
  who text;
  lt text;
  rng text;
  ev text;
  msg text;
begin
  select company_id, name into cid, who from profiles where id = new.profile_id;
  select case when hide_from_colleagues then 'absenci' else label end into lt from leave_types where id = new.leave_type_id;
  rng := case
    when new.start_date = new.end_date then to_char(new.start_date, 'DD. MM. YYYY')
    else to_char(new.start_date, 'DD. MM.') || ' – ' || to_char(new.end_date, 'DD. MM. YYYY')
  end;

  if tg_op = 'INSERT' and new.status = 'pending' then
    ev := 'request_created';
    msg := '🆕 ' || who || ' žádá o ' || lt || ' (' || rng || ')';
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status and new.status in ('approved', 'rejected') then
    ev := 'request_decided';
    msg := case when new.status = 'approved' then '✅ Schváleno: ' else '❌ Zamítnuto: ' end
      || who || ' — ' || lt || ' (' || rng || ')'
      || case when new.status = 'rejected' and coalesce(new.rejection_reason, '') <> '' then ' — důvod: ' || new.rejection_reason else '' end;
  elsif tg_op = 'UPDATE' and new.cancellation_requested_at is not null and old.cancellation_requested_at is null then
    ev := 'cancellation_requested';
    msg := '↩️ ' || who || ' žádá o zrušení absence: ' || lt || ' (' || rng || ')';
  else
    return new;
  end if;

  if cid is not null and exists (
    select 1 from webhook_integrations w where w.company_id = cid and w.active and ev = any(w.events)
  ) then
    insert into integration_outbox (company_id, event, text) values (cid, ev, msg);
  end if;
  return new;
end;
$$;

drop trigger if exists leave_requests_queue_integrations on leave_requests;
create trigger leave_requests_queue_integrations
  after insert or update on leave_requests
  for each row execute function queue_integration_events();

-- ---------------------------------------------------------------------------
-- import_employees — bulk-create/update company_invites (and any missing
-- departments) from CSV import, as ONE transaction: if any row is malformed
-- the whole call rolls back, instead of leaving half-created departments
-- behind the way two separate client-side calls could (department creation
-- succeeding, then the invites insert failing, over repeated retries).
-- `rows` is a jsonb array of objects: email, name, department_name,
-- manager_id, manager_invite_email, vacation_total, vacation_opening_used,
-- sick_total, sick_opening_used, role (optional, defaults to 'employee').
-- ---------------------------------------------------------------------------
create or replace function import_employees(target_company_id uuid, rows jsonb)
returns int
language plpgsql
security definer
as $$
declare
  r jsonb;
  dept_id uuid;
  dept_name text;
  n int := 0;
begin
  if current_company_id() is distinct from target_company_id
     or (current_user_role() is distinct from 'admin' and current_user_staff() is distinct from 'hr') then
    raise exception 'Jen admin nebo HR firmy může importovat zaměstnance.';
  end if;

  for r in select * from jsonb_array_elements(rows) loop
    dept_id := null;
    dept_name := nullif(trim(r->>'department_name'), '');
    if dept_name is not null then
      select id into dept_id from departments
        where company_id = target_company_id and lower(trim(name)) = lower(dept_name);
      if dept_id is null then
        insert into departments (company_id, name) values (target_company_id, dept_name) returning id into dept_id;
      end if;
    end if;

    insert into company_invites (
      company_id, email, name, department_id, manager_id, manager_invite_email,
      vacation_total, vacation_opening_used, sick_total, sick_opening_used, role
    ) values (
      target_company_id,
      lower(trim(r->>'email')),
      r->>'name',
      dept_id,
      nullif(r->>'manager_id', '')::uuid,
      nullif(r->>'manager_invite_email', ''),
      coalesce((r->>'vacation_total')::numeric, 0),
      coalesce((r->>'vacation_opening_used')::numeric, 0),
      coalesce((r->>'sick_total')::numeric, 0),
      coalesce((r->>'sick_opening_used')::numeric, 0),
      -- HR smí zvát jen zaměstnance; role manažer / admin přiděluje jen admin.
      case when current_user_role() = 'admin' then coalesce(nullif(r->>'role', '')::user_role, 'employee') else 'employee'::user_role end
    )
    on conflict (company_id, email) do update set
      name = excluded.name,
      department_id = excluded.department_id,
      manager_id = excluded.manager_id,
      manager_invite_email = excluded.manager_invite_email,
      vacation_total = excluded.vacation_total,
      vacation_opening_used = excluded.vacation_opening_used,
      sick_total = excluded.sick_total,
      sick_opening_used = excluded.sick_opening_used,
      role = excluded.role;

    n := n + 1;
  end loop;

  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- guard_profile_update — RLS policies above grant broader UPDATE access on
-- `profiles` (a user can update their own row; a manager/admin can update
-- anyone in their company) than should actually apply column-by-column.
-- Postgres RLS is row-level, not column-level, so this trigger is what
-- actually stops e.g. an employee promoting themselves to admin via the
-- "update own profile" policy, or a manager moving someone to a different
-- company.
-- ---------------------------------------------------------------------------
create or replace function guard_profile_update()
returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role and current_user_role() <> 'admin' then
    raise exception 'Roli může měnit jen admin.';
  end if;
  if (new.department_id is distinct from old.department_id
      or new.manager_id is distinct from old.manager_id
      or new.substitute_id is distinct from old.substitute_id)
     and current_user_role() not in ('admin', 'manager')
     and current_user_staff() is distinct from 'hr' then
    raise exception 'Oddělení, nadřízeného a zástupce může měnit jen manažer, HR nebo admin.';
  end if;
  -- Manažer smí přeřazovat jen své lidi (nadřízený / vedoucí / zástupce). Jinak by si mohl přiřadit kohokoli jako podřízeného
  -- a získal by právo schvalovat jeho žádosti a vidět jeho soukromé absence. Výjimka: vlastní zástup.
  if (new.department_id is distinct from old.department_id
      or new.manager_id is distinct from old.manager_id
      or new.substitute_id is distinct from old.substitute_id)
     and current_user_role() = 'manager'
     and not is_superior_of(old.id)
     and not (new.id = auth.uid()
              and new.department_id is not distinct from old.department_id
              and new.manager_id is not distinct from old.manager_id) then
    raise exception 'Přeřadit můžete jen své podřízené — ostatní změní admin.';
  end if;
  if new.company_id is distinct from old.company_id then
    raise exception 'Firmu u profilu nelze změnit.';
  end if;
  -- E-mail v profilu smí být jen ten z přihlašovacího účtu (jinak by si šlo nechat posílat upozornění na cizí adresu).
  if new.email is distinct from old.email and auth.uid() is not null
     and (new.id is distinct from auth.uid() or new.email is distinct from my_auth_email()) then
    raise exception 'E-mail lze změnit jen v nastavení přihlašovacího účtu.';
  end if;
  if new.staff_role is distinct from old.staff_role and auth.uid() is not null and current_user_role() is distinct from 'admin' then
    raise exception 'Doplňkovou roli (HR / účetní) může nastavit jen admin.';
  end if;
  if new.active is distinct from old.active and (current_user_role() <> 'admin' or new.id = auth.uid()) then
    raise exception 'Deaktivovat může jen admin, a ne sám sebe.';
  end if;
  -- Firma nikdy nesmí zůstat bez aktivního admina (jinak by ji nikdo nemohl spravovat).
  if old.role = 'admin' and old.active
     and (new.role <> 'admin' or not new.active)
     and not exists (
       select 1 from profiles p
       where p.company_id = old.company_id and p.role = 'admin' and p.active and p.id <> old.id
     ) then
    raise exception 'Firma musí mít aspoň jednoho aktivního admina.';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_update on profiles;
create trigger profiles_guard_update
  before update on profiles
  for each row execute function guard_profile_update();

-- ---------------------------------------------------------------------------
-- onboard_new_company — call this once, right after auth.signUp(), to turn a
-- brand-new auth user into a company admin. Runs as security definer because
-- a user with no profile yet has no company_id, so the RLS policies above
-- would otherwise block them from creating their own company/profile.
--
-- Call from the app like:
--   const { data, error } = await supabase.rpc('onboard_new_company', {
--     p_company_name: 'NaturaMed s.r.o.',
--     p_admin_name: 'Oldřich Beran',
--   });
-- ---------------------------------------------------------------------------
create or replace function onboard_new_company(p_company_name text, p_admin_name text)
returns uuid
language plpgsql
security definer
as $$
declare
  new_company_id uuid;
  caller_email text;
begin
  if exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'Profile already exists for this user';
  end if;

  select email into caller_email from auth.users where id = auth.uid();

  insert into companies (name) values (p_company_name)
  returning id into new_company_id;

  insert into profiles (id, company_id, name, role, avatar_initials, email)
  values (
    auth.uid(),
    new_company_id,
    p_admin_name,
    'admin',
    upper(left(split_part(p_admin_name, ' ', 1), 1) || left(split_part(p_admin_name, ' ', 2), 1)),
    caller_email
  );

  perform seed_default_leave_types(new_company_id);

  -- Give the founding admin a starting entitlement so the dashboard isn't
  -- empty on day one — adjust later from Nastavení firmy.
  insert into leave_entitlements (profile_id, leave_type_id, year, total_days)
  select auth.uid(), lt.id, extract(year from now())::int,
    case lt.key when 'dovolena' then 20 when 'sick' then 5 end
  from leave_types lt
  where lt.company_id = new_company_id and lt.key in ('dovolena', 'sick');
  -- (Uses the hardcoded 20/5 starter values, same as the company's own
  -- default_vacation_days/default_sick_days at creation time — there's no
  -- company row to read a custom default from until this function returns it.)

  return new_company_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- grant_default_entitlements — call when adding a new employee to an
-- existing company, so they also start with a standard 20/5 allowance.
-- ---------------------------------------------------------------------------
create or replace function grant_default_entitlements(target_profile_id uuid, target_company_id uuid)
returns void
language sql
as $$
  insert into leave_entitlements (profile_id, leave_type_id, year, total_days)
  select
    target_profile_id, lt.id, extract(year from now())::int,
    case lt.key
      when 'dovolena' then (
        -- Datum nástupu (pokud je vyplněné): nástup v dřívějším roce = celý nárok, v letošním roce se krátí podle měsíce nástupu.
        select case
          when h.hire_date is not null and extract(year from h.hire_date) < extract(year from now())
            then c.default_vacation_days + seniority_bonus_days(h.hire_date, c.id, extract(year from now())::int)
          else prorate_from(
                 c.default_vacation_days + seniority_bonus_days(h.hire_date, c.id, extract(year from now())::int),
                 c.id,
                 coalesce(h.hire_date, current_date)
               )
        end
        from companies c
        left join profile_hr h on h.profile_id = target_profile_id
        where c.id = target_company_id
      )
      when 'sick' then (select default_sick_days from companies where id = target_company_id)
    end
  from leave_types lt
  where lt.company_id = target_company_id and lt.key in ('dovolena', 'sick')
  on conflict (profile_id, leave_type_id, year) do nothing;
$$;

-- ---------------------------------------------------------------------------
-- public_company_name — lets an unauthenticated (no-profile-yet) signup page
-- show which company an invite link points to. Returns only the name, never
-- more; RLS on `companies` still blocks direct table reads for such users.
-- ---------------------------------------------------------------------------
create or replace function public_company_name(target_company_id uuid)
returns text
language sql
security definer
stable
as $$
  select name from companies where id = target_company_id;
$$;

-- ---------------------------------------------------------------------------
-- join_existing_company — counterpart to onboard_new_company for someone
-- joining a company an admin already created, via an invite link that
-- carries the company's id (see Nastavení firmy → Uživatelé → Pozvat kolegy).
-- Always creates the new profile as 'employee' — role changes happen later
-- from the admin's Nastavení firmy screen.
-- ---------------------------------------------------------------------------
create or replace function join_existing_company(target_company_id uuid, p_name text)
returns text
language plpgsql
security definer
as $$
declare
  found_company_name text;
  caller_email text;
begin
  if exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'Profile already exists for this user';
  end if;

  select name into found_company_name from companies where id = target_company_id;
  if found_company_name is null then
    raise exception 'Neplatný odkaz na firmu';
  end if;

  select email into caller_email from auth.users where id = auth.uid();

  insert into profiles (id, company_id, name, role, avatar_initials, email)
  values (
    auth.uid(),
    target_company_id,
    p_name,
    'employee',
    upper(left(split_part(p_name, ' ', 1), 1) || left(split_part(p_name, ' ', 2), 1)),
    caller_email
  );

  perform grant_default_entitlements(auth.uid(), target_company_id);

  return found_company_name;
end;
$$;

-- ---------------------------------------------------------------------------
-- search_path funkcí — triggery a funkce běží i pod rolí Supabase Auth
-- (např. při smazání uživatele kaskádou přes profiles), která nemá schéma
-- public v search_path; bez toho by odkazy na tabulky/funkce bez prefixu
-- selhaly ("Database error deleting user"). Nastavíme ho všem našim funkcím.
-- ---------------------------------------------------------------------------
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('alter function %s set search_path = public', f.sig);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Soukromí absencí — typy s hide_from_colleagues (výchozí: nemoc) vidí jen
-- dotčený zaměstnanec, jeho nadřízený (manager_id nebo vedoucí/zástupce
-- oddělení) a admin. Ostatním se místo typu ukáže jen "Nepřítomen":
--  * RLS na leave_requests skryje takové řádky ostatním,
--  * masked_absences() vrátí jen termíny (bez typu, poznámky, přílohy), aby
--    kalendář a kapacity dál fungovaly.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'leave_types' and column_name = 'hide_from_colleagues'
  ) then
    alter table leave_types add column hide_from_colleagues boolean not null default false;
    update leave_types set hide_from_colleagues = true where counts_against = 'sick';
  end if;
end $$;

-- Nový typ čerpaný z limitu nemoci je ve výchozím stavu soukromý (admin to může změnit).
create or replace function default_hide_sick_type()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.counts_against = 'sick' and tg_op = 'INSERT' then
    new.hide_from_colleagues := true;
  end if;
  return new;
end;
$$;

drop trigger if exists default_hide_sick_type on leave_types;
create trigger default_hide_sick_type
  before insert on leave_types
  for each row execute function default_hide_sick_type();

-- Je "approver" nadřízeným (manager_id), vedoucím / zástupcem oddělení nebo stálým zástupcem některého z nich?
create or replace function superior_check(approver uuid, target uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from profiles p
    where p.id = target
      and (
        p.manager_id = approver
        or exists (select 1 from profiles m where m.id = p.manager_id and m.substitute_id = approver)
        or exists (
          select 1 from departments d
          where d.id = p.department_id
            and (
              d.head_profile_id = approver
              or d.deputy_head_profile_id = approver
              or exists (select 1 from profiles h where h.id = d.head_profile_id and h.substitute_id = approver)
            )
        )
      )
  );
$$;

create or replace function is_superior_of(target uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from profiles p where p.id = target and p.company_id = current_company_id())
     and superior_check(auth.uid(), target);
$$;

create or replace function request_type_hidden(type_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select hide_from_colleagues from leave_types where id = type_id), false);
$$;

create or replace function can_view_request(req_profile uuid, req_type uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select req_profile = auth.uid()
    or current_user_role() = 'admin'
    or current_user_staff() is not null
    or not request_type_hidden(req_type)
    or is_superior_of(req_profile);
$$;

drop policy if exists "select leave_requests in company" on leave_requests;
create policy "select leave_requests in company" on leave_requests
  for select using (
    exists (
      select 1 from profiles p
      where p.id = leave_requests.profile_id and p.company_id = current_company_id()
    )
    and can_view_request(leave_requests.profile_id, leave_requests.leave_type_id)
  );

-- Skryté absence pro kolegy: jen kdo a kdy (žádný typ, poznámka ani příloha).
create or replace function masked_absences(p_from date default '1900-01-01', p_to date default '2999-12-31')
returns table (id uuid, profile_id uuid, start_date date, end_date date, half_day boolean, working_days numeric, status request_status)
language sql
security definer
stable
set search_path = public
as $$
  select r.id, r.profile_id, r.start_date, r.end_date, r.half_day, r.working_days, r.status
  from leave_requests r
  join profiles p on p.id = r.profile_id
  where p.company_id = current_company_id()
    and r.status in ('approved', 'pending')
    and r.start_date <= p_to
    and r.end_date >= p_from
    and request_type_hidden(r.leave_type_id)
    and not can_view_request(r.profile_id, r.leave_type_id);
$$;

grant execute on function masked_absences(date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- help_views — kdo kdy otevřel který článek v Nápovědě. Slouží k řazení
-- "Nejčastějších dotazů" podle skutečného zájmu lidí ve firmě.
-- ---------------------------------------------------------------------------
create table if not exists help_views (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  question text not null,
  created_at timestamptz not null default now()
);

create index if not exists help_views_created_idx on help_views (created_at desc);

alter table help_views enable row level security;

drop policy if exists "create own help views" on help_views;
create policy "create own help views" on help_views
  for insert with check (profile_id = auth.uid());

-- Nejčastěji otevírané články za posledních 90 dní ve firmě volajícího.
create or replace function help_top_questions(p_limit int default 10)
returns table (question text, views bigint)
language sql
security definer
stable
set search_path = public
as $$
  select v.question, count(*) as views
  from help_views v
  join profiles p on p.id = v.profile_id
  where p.company_id = current_company_id()
    and v.created_at > now() - interval '90 days'
  group by v.question
  order by count(*) desc, v.question
  limit greatest(p_limit, 1);
$$;

grant execute on function help_top_questions(int) to authenticated;

-- Náhled přepočtu nároků podle odpracovaných let (jen admin). Nic nemění.
create or replace function seniority_preview(p_year int)
returns table (profile_id uuid, name text, hire_date date, years int, bonus numeric, current_total numeric, new_total numeric)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if current_user_role() is distinct from 'admin' and current_user_staff() is distinct from 'hr' then
    raise exception 'Jen admin nebo HR.';
  end if;
  return query
    select p.id, p.name, h.hire_date,
           date_part('year', age(make_date(p_year, 12, 31), h.hire_date))::int,
           seniority_bonus_days(h.hire_date, p.company_id, p_year),
           coalesce(e.total_days, 0)::numeric,
           (case
              when extract(year from h.hire_date) = p_year
                then prorate_from(c.default_vacation_days + seniority_bonus_days(h.hire_date, p.company_id, p_year), p.company_id, h.hire_date)
              else c.default_vacation_days + seniority_bonus_days(h.hire_date, p.company_id, p_year)
            end)::numeric
    from profiles p
    join companies c on c.id = p.company_id
    join profile_hr h on h.profile_id = p.id
    left join leave_types lt on lt.company_id = p.company_id and lt.key = 'dovolena'
    left join leave_entitlements e on e.profile_id = p.id and e.leave_type_id = lt.id and e.year = p_year
    where p.company_id = current_company_id()
      and p.active
      and h.hire_date is not null
    order by p.name;
end;
$$;

-- Použije přepočet: nastaví roční nárok na dovolenou = výchozí nárok + příplatek za roky (jen admin).
create or replace function apply_seniority_entitlements(p_year int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  changed int := 0;
  r record;
  vac_type uuid;
begin
  if current_user_role() is distinct from 'admin' and current_user_staff() is distinct from 'hr' then
    raise exception 'Jen admin nebo HR.';
  end if;
  select id into vac_type from leave_types where company_id = current_company_id() and key = 'dovolena';
  if vac_type is null then
    raise exception 'Typ absence Dovolená nenalezen.';
  end if;
  for r in select * from seniority_preview(p_year) where new_total is distinct from current_total loop
    insert into leave_entitlements (profile_id, leave_type_id, year, total_days)
    values (r.profile_id, vac_type, p_year, r.new_total)
    on conflict (profile_id, leave_type_id, year) do update set total_days = excluded.total_days;
    changed := changed + 1;
  end loop;
  return changed;
end;
$$;

grant execute on function seniority_preview(int) to authenticated;
grant execute on function apply_seniority_entitlements(int) to authenticated;

-- Deaktivace zaměstnance: jeho čekající žádosti už nikdo nemá schvalovat — automaticky se zamítnou.
create or replace function reject_pending_on_deactivation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.active and not new.active then
    update leave_requests
    set status = 'rejected',
        rejection_reason = 'Zaměstnanec byl deaktivován.'
    where profile_id = new.id and status = 'pending';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_reject_pending_on_deactivation on profiles;
create trigger profiles_reject_pending_on_deactivation
  after update of active on profiles
  for each row execute function reject_pending_on_deactivation();

-- ---------------------------------------------------------------------------
-- company_billing — fakturační údaje a způsob platby. Dřív ležely přímo v
-- companies (čitelné každému zaměstnanci); teď je čte a mění jen admin firmy.
-- Údaje se buď vyplní ručně, nebo načtou z ARES podle IČO.
-- ---------------------------------------------------------------------------
create table if not exists company_billing (
  company_id uuid primary key references companies(id) on delete cascade,
  billing_name text,
  billing_ico text,
  billing_dic text,
  billing_street text,
  billing_city text,
  billing_zip text,
  billing_email text,
  payment_method text not null default 'invoice'
);

alter table company_billing enable row level security;

drop policy if exists "admins manage company billing" on company_billing;
create policy "admins manage company billing" on company_billing
  for all
  using (company_id = current_company_id() and current_user_role() = 'admin')
  with check (company_id = current_company_id() and current_user_role() = 'admin');

-- Jednorázový převod ze starých sloupců companies (spustí se jen tehdy, když ještě existují).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'companies' and column_name = 'billing_name'
  ) then
    insert into company_billing (company_id, billing_name, billing_ico, billing_dic, billing_street, billing_city, billing_zip, billing_email, payment_method)
    select id, billing_name, billing_ico, billing_dic, billing_street, billing_city, billing_zip, billing_email, coalesce(payment_method, 'invoice')
    from companies
    on conflict (company_id) do nothing;

    alter table companies drop column if exists billing_name;
    alter table companies drop column if exists billing_ico;
    alter table companies drop column if exists billing_dic;
    alter table companies drop column if exists billing_street;
    alter table companies drop column if exists billing_city;
    alter table companies drop column if exists billing_zip;
    alter table companies drop column if exists billing_email;
    alter table companies drop column if exists payment_method;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Kdo smí rozhodovat a zadávat absence za jiné: jen nadřízený (manager_id),
-- vedoucí / zástupce oddělení nebo jejich stálý zástupce (profiles.substitute_id)
-- a admin. Dřív mohl kterýkoli manažer firmy rozhodnout žádost kohokoli.
-- ---------------------------------------------------------------------------
drop policy if exists "managers approve leave_requests" on leave_requests;
create policy "managers approve leave_requests" on leave_requests
  for update using (
    exists (
      select 1 from profiles p
      where p.id = leave_requests.profile_id and p.company_id = current_company_id()
    )
    and (
      current_user_role() = 'admin'
      or (current_user_role() = 'manager' and is_superior_of(leave_requests.profile_id))
    )
  );

drop policy if exists "managers create leave_requests for team" on leave_requests;
create policy "managers create leave_requests for team" on leave_requests
  for insert with check (
    exists (select 1 from profiles p where p.id = leave_requests.profile_id and p.company_id = current_company_id())
    and (
      current_user_role() = 'admin'
      or (current_user_role() = 'manager' and is_superior_of(leave_requests.profile_id))
    )
  );


-- ---------------------------------------------------------------------------
-- Nároky na absence: čte je dotčená osoba, její nadřízený / zástupce, admin a HR
-- (dřív kterýkoli manažer celé firmy).
-- ---------------------------------------------------------------------------
drop policy if exists "select own entitlements" on leave_entitlements;
create policy "select own entitlements" on leave_entitlements
  for select using (
    profile_id = auth.uid()
    or (
      exists (select 1 from profiles p where p.id = leave_entitlements.profile_id and p.company_id = current_company_id())
      and (
        current_user_role() = 'admin'
        or current_user_staff() is not null
        or (current_user_role() = 'manager' and is_superior_of(leave_entitlements.profile_id))
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Registrační odkaz: tajný kód místo čísla firmy. Admin ho může vypnout nebo
-- vygenerovat znovu (starý přestane platit); noví lidé z odkazu ve výchozím
-- stavu čekají na schválení adminem. Tabulka nemá žádné policies — přístup
-- jen přes funkce níže.
-- ---------------------------------------------------------------------------
create table if not exists company_join (
  company_id uuid primary key references companies(id) on delete cascade,
  join_code uuid not null default gen_random_uuid(),
  enabled boolean not null default true,
  require_approval boolean not null default true
);

alter table company_join enable row level security;

insert into company_join (company_id) select id from companies on conflict (company_id) do nothing;

create or replace function create_company_join()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into company_join (company_id) values (new.id) on conflict (company_id) do nothing;
  return new;
end;
$$;

drop trigger if exists companies_create_join on companies;
create trigger companies_create_join
  after insert on companies
  for each row execute function create_company_join();

create or replace function get_join_link()
returns table (join_code uuid, enabled boolean, require_approval boolean)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if (current_user_role() is null or current_user_role() not in ('manager', 'admin')) and current_user_staff() is distinct from 'hr' then
    raise exception 'Jen manažer, HR nebo admin.';
  end if;
  return query select j.join_code, j.enabled, j.require_approval from company_join j where j.company_id = current_company_id();
end;
$$;

create or replace function set_join_link(p_enabled boolean, p_require_approval boolean, p_regenerate boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_user_role() is distinct from 'admin' then
    raise exception 'Jen admin.';
  end if;
  update company_join
  set enabled = p_enabled,
      require_approval = p_require_approval,
      join_code = case when p_regenerate then gen_random_uuid() else join_code end
  where company_id = current_company_id();
end;
$$;

create or replace function public_company_name_by_code(p_code uuid)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select c.name from company_join j join companies c on c.id = j.company_id where j.join_code = p_code and j.enabled;
$$;

create or replace function join_company_by_code(p_code uuid, p_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  j company_join%rowtype;
  cname text;
  caller_email text;
  admin_id uuid;
begin
  if exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'Profile already exists for this user';
  end if;

  select * into j from company_join where join_code = p_code and enabled;
  if j.company_id is null then
    raise exception 'Odkaz už neplatí nebo byl vypnut. Požádejte správce firmy o nový.';
  end if;

  select email into caller_email from auth.users where id = auth.uid();
  if (select email_confirmed_at from auth.users where id = auth.uid()) is null then
    raise exception 'Nejdřív potvrďte svůj e-mail (odkaz jsme vám poslali).';
  end if;

  select name into cname from companies where id = j.company_id;

  insert into profiles (id, company_id, name, role, avatar_initials, email, active, join_pending)
  values (
    auth.uid(), j.company_id, p_name, 'employee',
    upper(left(split_part(p_name, ' ', 1), 1) || left(split_part(p_name, ' ', 2), 1)),
    caller_email,
    not j.require_approval,
    j.require_approval
  );

  perform grant_default_entitlements(auth.uid(), j.company_id);

  if j.require_approval then
    for admin_id in select id from profiles where company_id = j.company_id and role = 'admin' and active loop
      insert into notifications (profile_id, type, title, body)
      values (admin_id, 'join_pending', 'Nový uživatel čeká na schválení', p_name || ' (' || coalesce(caller_email, '') || ') se zaregistroval(a) přes registrační odkaz.');
    end loop;
  end if;

  return cname;
end;
$$;

grant execute on function get_join_link() to authenticated;
grant execute on function set_join_link(boolean, boolean, boolean) to authenticated;
grant execute on function public_company_name_by_code(uuid) to anon, authenticated;
grant execute on function join_company_by_code(uuid, text) to authenticated;

-- Starý odkaz s číslem firmy už nesmí fungovat.
drop function if exists join_existing_company(uuid, text);
drop function if exists public_company_name(uuid);

-- ---------------------------------------------------------------------------
-- Deaktivace člověka: jeho podřízení přejdou na jeho nadřízeného, vedoucí
-- oddělení na zástupce; odkazy na něj jako na zástupce se zruší. Aby nikdo
-- nezůstal bez schvalovatele.
-- ---------------------------------------------------------------------------
create or replace function reassign_on_deactivation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.active and not new.active then
    update profiles set manager_id = old.manager_id where manager_id = old.id and id <> old.id;
    update profiles set substitute_id = null where substitute_id = old.id;
    update departments set head_profile_id = deputy_head_profile_id, deputy_head_profile_id = null where head_profile_id = old.id;
    update departments set deputy_head_profile_id = null where deputy_head_profile_id = old.id;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_reassign_on_deactivation on profiles;
create trigger profiles_reassign_on_deactivation
  after update of active on profiles
  for each row execute function reassign_on_deactivation();

-- ---------------------------------------------------------------------------
-- HR: správa lidí (nároky, oddělení, nadřízený, datum nástupu, pozvánky) a čtení historie změn.
-- Účetní: jen čtení (viz can_view_request a nároky výše).
-- ---------------------------------------------------------------------------
drop policy if exists "hr update profiles in company" on profiles;
create policy "hr update profiles in company" on profiles
  for update using (company_id = current_company_id() and current_user_staff() = 'hr');

drop policy if exists "hr manage entitlements" on leave_entitlements;
create policy "hr manage entitlements" on leave_entitlements
  for all using (
    current_user_staff() = 'hr'
    and exists (select 1 from profiles p where p.id = leave_entitlements.profile_id and p.company_id = current_company_id())
  );


-- ---------------------------------------------------------------------------
-- Zdravotní údaje neevidujeme: žádné přílohy (potvrzení od lékaře) a žádné
-- poznámky u nemoci / soukromých typů. Úklid po dřívější verzi (idempotentní).
-- Soubory v bucketu leave-attachments je nutné smazat přes Storage API / Dashboard
-- (přímé mazání ze storage.objects Supabase blokuje).
-- ---------------------------------------------------------------------------
drop policy if exists "own leave attachments" on storage.objects;
drop policy if exists "managers read leave attachments" on storage.objects;
alter table leave_requests drop column if exists attachment_url;
alter table leave_types drop column if exists requires_attachment;
update leave_requests set note = null
where note is not null
  and leave_type_id in (select id from leave_types where counts_against = 'sick' or hide_from_colleagues);

-- Odlišné barvy výchozích typů absencí (dřív Dovolená, Home Office i Lékař splývaly v zelených a broskvových odstínech).
-- Mění se jen typy, které mají stále původní výchozí barvu — ručně přebarvené zůstanou.
update leave_types set color = 'wine' where key = 'sick' and color = 'rust';
update leave_types set color = 'sky' where key = 'home_office' and color = 'moss';
update leave_types set color = 'gold' where key = 'nahradni_volno' and color = 'amber';
update leave_types set color = 'forest' where key = 'materska' and color = 'sky';

-- ---------------------------------------------------------------------------
-- profile_secrets — tajný token osobního iCal odkazu (src/app/api/ical). Dřív ležel ve sloupci
-- profiles.calendar_token, který četl každý kolega, a přes cizí token šlo stáhnout jeho
-- kalendář včetně soukromých absencí (nemoc). Teď ho čte jen vlastník; starý sloupec se smaže,
-- takže všechny dřívější odkazy přestanou platit (noví tokeny se vygenerují).
-- ---------------------------------------------------------------------------
create table if not exists profile_secrets (
  profile_id uuid primary key references profiles(id) on delete cascade,
  calendar_token uuid not null default gen_random_uuid() unique
);

alter table profile_secrets enable row level security;

drop policy if exists "own profile secrets" on profile_secrets;
create policy "own profile secrets" on profile_secrets
  for select using (profile_id = auth.uid());

insert into profile_secrets (profile_id) select id from profiles on conflict (profile_id) do nothing;

create or replace function create_profile_secret()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profile_secrets (profile_id) values (new.id) on conflict (profile_id) do nothing;
  return new;
end;
$$;

drop trigger if exists profiles_create_secret on profiles;
create trigger profiles_create_secret
  after insert on profiles
  for each row execute function create_profile_secret();

create or replace function get_my_calendar_token()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select calendar_token from profile_secrets where profile_id = auth.uid();
$$;

create or replace function rotate_calendar_token()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  t uuid := gen_random_uuid();
begin
  if auth.uid() is null then
    raise exception 'Nejste přihlášeni.';
  end if;
  insert into profile_secrets (profile_id, calendar_token) values (auth.uid(), t)
  on conflict (profile_id) do update set calendar_token = excluded.calendar_token;
  return t;
end;
$$;

grant execute on function get_my_calendar_token() to authenticated;
grant execute on function rotate_calendar_token() to authenticated;

alter table profiles drop column if exists calendar_token;

-- ---------------------------------------------------------------------------
-- Pracovní dny na serveru: státní svátky (včetně Velkého pátku a Velikonočního pondělí)
-- a pracovní dny firmy (companies.work_days). Shodné s src/lib/working-days.ts.
-- ---------------------------------------------------------------------------
create or replace function easter_sunday(y int)
returns date
language plpgsql
immutable
as $$
declare
  a int; b int; c int; d int; e int; f int; g int; h int; i int; k int; l int; m int; mo int; da int;
begin
  a := y % 19; b := y / 100; c := y % 100; d := b / 4; e := b % 4;
  f := (b + 8) / 25; g := (b - f + 1) / 3;
  h := (19 * a + b - d - g + 15) % 30; i := c / 4; k := c % 4;
  l := (32 + 2 * e + 2 * i - h - k) % 7;
  m := (a + 11 * h + 22 * l) / 451;
  mo := (h + l - 7 * m + 114) / 31;
  da := ((h + l - 7 * m + 114) % 31) + 1;
  return make_date(y, mo, da);
end;
$$;

create or replace function czech_holiday(d date)
returns boolean
language sql
immutable
as $$
  select (extract(month from d)::int, extract(day from d)::int) in ((1,1),(5,1),(5,8),(7,5),(7,6),(9,28),(10,28),(11,17),(12,24),(12,25),(12,26))
      or d = easter_sunday(extract(year from d)::int) - 2
      or d = easter_sunday(extract(year from d)::int) + 1;
$$;

create or replace function count_working_days(s date, e date, wd int[] default '{1,2,3,4,5}')
returns numeric
language sql
immutable
as $$
  select count(*)::numeric
  from generate_series(s::timestamp, e::timestamp, interval '1 day') g(d)
  where extract(isodow from g.d)::int = any(coalesce(wd, '{1,2,3,4,5}'::int[]))
    and not czech_holiday(g.d::date);
$$;

-- ---------------------------------------------------------------------------
-- Pravidla žádostí vynucená v databázi (dřív jen ve formuláři, přes API šla obejít):
--  * počet dní si server přepočítá sám (žadatel ho nemůže podvrhnout ani nastavit záporný),
--  * zpětné zadávání, minimální předstih a zůstatek (jen vlastní žádosti),
--  * approved_by / escalated_at / rejection_reason nastavuje jen server, ne žadatel,
--  * zastupující musí být ze stejné firmy.
-- Trigger se jmenuje "a_..." aby běžel dřív než guard_leave_request_insert (ten čte working_days).
-- ---------------------------------------------------------------------------
create or replace function a_enforce_leave_request_rules()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  c companies%rowtype;
  expected numeric;
  self_service boolean;
  today_cz date := (now() at time zone 'Europe/Prague')::date;
  cat text;
  yr int;
  n int;
  ent numeric;
  used numeric;
  prev_ent numeric;
  prev_used numeric;
  carry numeric := 0;
  allowed_neg numeric;
begin
  -- Server (service role), SQL Editor a security definer funkce (např. celozávodní volno) se nekontrolují.
  if auth.uid() is null or current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  self_service := new.profile_id = auth.uid();

  if tg_op = 'INSERT' then
    if self_service then
      new.approved_by := null;
    else
      new.approved_by := case when new.status = 'approved' then auth.uid() else null end;
    end if;
    new.escalated_at := null;
    new.rejection_reason := null;
    new.cancellation_requested_at := null;
  elsif self_service and old.status = 'pending' and new.status = 'pending' then
    new.approved_by := old.approved_by;
    new.escalated_at := old.escalated_at;
    new.rejection_reason := old.rejection_reason;
    new.cancellation_requested_at := old.cancellation_requested_at;
  elsif new.status is distinct from old.status and new.status in ('approved', 'rejected') then
    new.approved_by := auth.uid();
  end if;

  if tg_op = 'UPDATE'
     and (new.start_date, new.end_date, new.half_day, new.working_days, new.leave_type_id)
         is not distinct from (old.start_date, old.end_date, old.half_day, old.working_days, old.leave_type_id) then
    return new;
  end if;

  select co.* into c from companies co where co.id = (select company_id from profiles where id = new.profile_id);
  if c.id is null then
    return new;
  end if;

  if new.end_date - new.start_date > 366 then
    raise exception 'Absence může trvat nejvýše rok.';
  end if;

  expected := count_working_days(new.start_date, new.end_date, c.work_days);
  if expected = 0 then
    raise exception 'V zvoleném termínu není žádný pracovní den (víkend nebo státní svátek).';
  end if;

  if new.half_day then
    if new.start_date <> new.end_date then
      raise exception 'Půlden lze zadat jen na jeden den.';
    end if;
    new.working_days := 0.5;
  elsif new.start_date = new.end_date then
    -- Jednodenní: dovolen zlomek (hodiny), ale nikdy víc než celý den a nikdy ≤ 0.
    if new.working_days is null or new.working_days <= 0 or new.working_days > expected then
      new.working_days := expected;
    end if;
  else
    new.working_days := expected;
  end if;

  if new.covering_profile_id is not null
     and not exists (select 1 from profiles p where p.id = new.covering_profile_id and p.company_id = c.id) then
    new.covering_profile_id := null;
  end if;

  if not self_service then
    return new;
  end if;

  -- Zpětné zadávání
  if new.start_date < today_cz then
    if not coalesce(c.backdating_allowed, true) then
      raise exception 'Zpětné zadávání absencí není v této firmě povoleno.';
    elsif c.backdating_max_days is not null and (today_cz - new.start_date) > c.backdating_max_days then
      raise exception 'Zpětně lze zadat maximálně % dní.', c.backdating_max_days;
    end if;
  end if;

  -- Minimální předstih u delších absencí
  if coalesce(c.min_advance_days, 0) > 0
     and new.working_days > coalesce(c.min_advance_threshold_days, 0)
     and (new.start_date - today_cz) < c.min_advance_days then
    raise exception 'Absence delší než % dní je nutné podat min. % dní předem.', c.min_advance_threshold_days, c.min_advance_days;
  end if;

  -- Zůstatek (jen dovolená a sick days; čekající žádosti se stejně jako v aplikaci nepočítají).
  -- Převod z loňska se počítá bez expirace, takže server nikdy není přísnější než formulář.
  select t.counts_against into cat from leave_types t where t.id = new.leave_type_id;
  if cat in ('vacation', 'sick') then
    yr := extract(year from new.start_date)::int;
    select count(*), coalesce(sum(e.total_days), 0), coalesce(sum(e.opening_used_days), 0)
      into n, ent, used
    from leave_entitlements e join leave_types t on t.id = e.leave_type_id
    where e.profile_id = new.profile_id and e.year = yr and t.counts_against = cat;

    if n > 0 then
      select used + coalesce(sum(r.working_days), 0) into used
      from leave_requests r join leave_types t on t.id = r.leave_type_id
      where r.profile_id = new.profile_id and r.status = 'approved'
        and extract(year from r.start_date)::int = yr and t.counts_against = cat
        and r.id is distinct from new.id;

      if cat = 'vacation' then
        select coalesce(sum(e.total_days), 0), coalesce(sum(e.opening_used_days), 0)
          into prev_ent, prev_used
        from leave_entitlements e join leave_types t on t.id = e.leave_type_id
        where e.profile_id = new.profile_id and e.year = yr - 1 and t.counts_against = cat;
        select prev_used + coalesce(sum(r.working_days), 0) into prev_used
        from leave_requests r join leave_types t on t.id = r.leave_type_id
        where r.profile_id = new.profile_id and r.status = 'approved'
          and extract(year from r.start_date)::int = yr - 1 and t.counts_against = cat;
        carry := greatest(0, prev_ent - prev_used);
        if c.max_carryover_days is not null then
          carry := least(carry, c.max_carryover_days);
        end if;
      end if;

      allowed_neg := case when c.allow_negative_balance then coalesce(c.max_negative_balance_days, 0) else 0 end;
      if used + new.working_days > ent + carry + allowed_neg then
        raise exception 'Na tuto absenci nemáte dostatečný zůstatek.';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists a_leave_requests_rules on leave_requests;
create trigger a_leave_requests_rules
  before insert or update on leave_requests
  for each row execute function a_enforce_leave_request_rules();

-- ---------------------------------------------------------------------------
-- profile_hr: datum nástupu čte dotčená osoba, HR a admin; mění jen HR a admin.
-- ---------------------------------------------------------------------------
alter table profile_hr enable row level security;

drop policy if exists "read own or hr hire date" on profile_hr;
create policy "read own or hr hire date" on profile_hr
  for select using (
    profile_id = auth.uid()
    or (
      exists (select 1 from profiles p where p.id = profile_hr.profile_id and p.company_id = current_company_id())
      and (current_user_role() = 'admin' or current_user_staff() = 'hr')
    )
  );

drop policy if exists "hr manage hire date" on profile_hr;
create policy "hr manage hire date" on profile_hr
  for all using (
    exists (select 1 from profiles p where p.id = profile_hr.profile_id and p.company_id = current_company_id())
    and (current_user_role() = 'admin' or current_user_staff() = 'hr')
  )
  with check (
    exists (select 1 from profiles p where p.id = profile_hr.profile_id and p.company_id = current_company_id())
    and (current_user_role() = 'admin' or current_user_staff() = 'hr')
  );

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'hire_date'
  ) then
    insert into profile_hr (profile_id, hire_date)
    select id, hire_date from profiles where hire_date is not null
    on conflict (profile_id) do update set hire_date = excluded.hire_date;
    alter table profiles drop column hire_date;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Ochrana před zahlcením: statistika Nápovědy (nejvýše 300 záznamů za hodinu na člověka)
-- a délka textu.
-- ---------------------------------------------------------------------------
create or replace function limit_help_rows()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  if tg_table_name = 'help_views' then
    select count(*) into n from help_views where profile_id = new.profile_id and created_at > now() - interval '1 hour';
  else
    select count(*) into n from help_feedback where profile_id = new.profile_id and created_at > now() - interval '1 hour';
  end if;
  if n >= 300 then
    raise exception 'Příliš mnoho záznamů za hodinu.';
  end if;
  if length(new.question) > 300 then
    new.question := left(new.question, 300);
  end if;
  return new;
end;
$$;

drop trigger if exists help_views_limit on help_views;
create trigger help_views_limit before insert on help_views for each row execute function limit_help_rows();
drop trigger if exists help_feedback_limit on help_feedback;
create trigger help_feedback_limit before insert on help_feedback for each row execute function limit_help_rows();

-- ---------------------------------------------------------------------------
-- E-mailová fronta: bezpečné vyzvednutí (dvě souběžná spuštění neposlala stejný e-mail dvakrát).
-- ---------------------------------------------------------------------------
alter table email_outbox add column if not exists claimed_at timestamptz;
alter table integration_outbox add column if not exists claimed_at timestamptz;

create or replace function claim_email_outbox(p_limit int default 50)
returns setof email_outbox
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with picked as (
    select id from email_outbox
    where sent_at is null and attempts < 5
      and (claimed_at is null or claimed_at < now() - interval '5 minutes')
    order by created_at
    limit p_limit
    for update skip locked
  )
  update email_outbox o set claimed_at = now()
  from picked where o.id = picked.id
  returning o.*;
end;
$$;

revoke execute on function claim_email_outbox(int) from public, anon, authenticated;
grant execute on function claim_email_outbox(int) to service_role;

create or replace function my_auth_email()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select email from auth.users where id = auth.uid();
$$;
