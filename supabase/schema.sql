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
  create type leave_color as enum ('teal', 'rust', 'moss', 'violet', 'amber');
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

-- ---------------------------------------------------------------------------
-- departments
-- ---------------------------------------------------------------------------
create table if not exists departments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

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
  select company_id from profiles where id = auth.uid();
$$;

create or replace function current_user_role()
returns user_role
language sql
security definer
stable
as $$
  select role from profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- seed_default_leave_types — call this right after creating a company to
-- populate the standard Czech absence types.
-- ---------------------------------------------------------------------------
create or replace function seed_default_leave_types(target_company_id uuid)
returns void
language sql
as $$
  insert into leave_types (company_id, key, label, color, counts_against) values
    (target_company_id, 'dovolena', 'Dovolená', 'teal', 'vacation'),
    (target_company_id, 'sick', 'Sick Day', 'rust', 'sick'),
    (target_company_id, 'home_office', 'Home Office', 'moss', 'none'),
    (target_company_id, 'osetrovacka', 'Ošetřování člena rodiny', 'violet', 'none'),
    (target_company_id, 'lekar', 'Lékař', 'violet', 'none'),
    (target_company_id, 'nahradni_volno', 'Náhradní volno', 'amber', 'none')
  on conflict (company_id, key) do nothing;
$$;

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

drop policy if exists "update own profile" on profiles;
create policy "update own profile" on profiles
  for update using (id = auth.uid());

drop policy if exists "admins update any profile in company" on profiles;
create policy "admins update any profile in company" on profiles
  for update using (company_id = current_company_id() and current_user_role() = 'admin');

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

drop policy if exists "update own pending leave_requests" on leave_requests;
create policy "update own pending leave_requests" on leave_requests
  for update using (profile_id = auth.uid() and status = 'pending');

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
begin
  if exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'Profile already exists for this user';
  end if;

  insert into companies (name) values (p_company_name)
  returning id into new_company_id;

  insert into profiles (id, company_id, name, role, avatar_initials)
  values (
    auth.uid(),
    new_company_id,
    p_admin_name,
    'admin',
    upper(left(split_part(p_admin_name, ' ', 1), 1) || left(split_part(p_admin_name, ' ', 2), 1))
  );

  perform seed_default_leave_types(new_company_id);

  -- Give the founding admin a starting entitlement so the dashboard isn't
  -- empty on day one — adjust later from Nastavení firmy.
  insert into leave_entitlements (profile_id, leave_type_id, year, total_days)
  select auth.uid(), lt.id, extract(year from now())::int,
    case lt.key when 'dovolena' then 20 when 'sick' then 5 end
  from leave_types lt
  where lt.company_id = new_company_id and lt.key in ('dovolena', 'sick');

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
  select target_profile_id, lt.id, extract(year from now())::int,
    case lt.key when 'dovolena' then 20 when 'sick' then 5 end
  from leave_types lt
  where lt.company_id = target_company_id and lt.key in ('dovolena', 'sick')
  on conflict (profile_id, leave_type_id, year) do nothing;
$$;
