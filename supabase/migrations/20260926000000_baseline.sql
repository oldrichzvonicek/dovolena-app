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

-- Billing details — filled in by hand or looked up from ARES by IČO (a
-- public, no-auth-required Czech government API; the app calls it directly
-- from the browser, nothing is stored server-side beyond what's saved here).
alter table companies add column if not exists billing_name text;
alter table companies add column if not exists billing_ico text;
alter table companies add column if not exists billing_dic text;
alter table companies add column if not exists billing_street text;
alter table companies add column if not exists billing_city text;
alter table companies add column if not exists billing_zip text;
alter table companies add column if not exists logo_url text;

-- Poměrná dovolená pro nováčky během roku: nárok se krátí podle zbývajících
-- měsíců (včetně měsíce nástupu), zaokrouhleno na půl dne.
alter table companies add column if not exists prorate_new_hires boolean not null default false;

create or replace function prorate_days(p_days numeric, p_company_id uuid)
returns numeric
language sql
stable
as $$
  select case
    when coalesce((select prorate_new_hires from companies where id = p_company_id), false)
      then round(p_days * (13 - extract(month from now())::int) / 12.0 * 2) / 2
    else p_days
  end;
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

-- Unguessable id for the personal iCal feed URL (see src/app/api/ical) — the
-- feed is fetched unauthenticated by calendar apps, so the token itself is
-- what stands in for auth. Regenerable from Nastavení/Tým if it ever leaks.
alter table profiles add column if not exists calendar_token uuid not null default gen_random_uuid() unique;

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
alter table leave_types add column if not exists requires_attachment boolean not null default false;
alter table leave_types add column if not exists allow_half_day boolean not null default true;
alter table leave_types add column if not exists allow_hours boolean not null default true;
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

-- Storage path of a supporting document (e.g. a doctor's note), set when the
-- chosen leave_type.requires_attachment is true — see leave-attachments
-- bucket policies below.
alter table leave_requests add column if not exists attachment_url text;

-- ---------------------------------------------------------------------------
-- leave-attachments storage bucket — private. The requester can upload/read
-- their own; managers/admins of the same company can read (to review a
-- pending request), matching who can already see the request row itself.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('leave-attachments', 'leave-attachments', false)
on conflict (id) do nothing;

drop policy if exists "own leave attachments" on storage.objects;
create policy "own leave attachments" on storage.objects
  for all using (
    bucket_id = 'leave-attachments' and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'leave-attachments' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "managers read leave attachments" on storage.objects;
create policy "managers read leave attachments" on storage.objects
  for select using (
    bucket_id = 'leave-attachments'
    and current_user_role() in ('manager', 'admin')
    and exists (
      select 1 from profiles p
      where p.id::text = (storage.foldername(name))[1] and p.company_id = current_company_id()
    )
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
    (target_company_id, 'sick', 'Sick Day', 'rust', 'sick', true),
    (target_company_id, 'home_office', 'Home Office', 'moss', 'none', true),
    (target_company_id, 'lekar', 'Lékař', 'violet', 'none', true),
    (target_company_id, 'nahradni_volno', 'Náhradní volno', 'amber', 'none', true),
    -- Seeded but off by default — admin switches these on in Typy absencí
    -- once actually needed, rather than every company starting with them live.
    (target_company_id, 'osetrovacka', 'Ošetřování člena rodiny', 'plum', 'none', false),
    (target_company_id, 'materska', 'Mateřská dovolená', 'sky', 'none', false),
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
  for all using (company_id = current_company_id() and current_user_role() = 'admin')
  with check (company_id = current_company_id() and current_user_role() = 'admin');

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
  check (type in ('request_created', 'request_approved', 'request_rejected', 'vacation_reminder', 'help_question', 'cancellation_requested', 'cancellation_resolved'));

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

  if blackout_label is not null then
    notif_title := '⚠️ Žádost v blokovaném termínu';
    notif_body := requester_name || ' přesto podal(a) žádost o volno v blokovaném termínu (' || blackout_label || ').';
  else
    notif_title := 'Nová žádost o volno';
    notif_body := requester_name || ' žádá o volno ke schválení.';
  end if;

  for mgr in
    select id from profiles
    where company_id = requester_company_id and role in ('manager', 'admin') and active and id <> new.profile_id
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
begin
  if new.status = old.status then
    return new;
  end if;

  if new.status = 'approved' then
    insert into notifications (profile_id, type, leave_request_id, title, body)
    values (new.profile_id, 'request_approved', new.id, 'Žádost schválena', 'Vaše žádost o volno byla schválena.');
  elsif new.status = 'rejected' then
    insert into notifications (profile_id, type, leave_request_id, title, body)
    values (
      new.profile_id, 'request_rejected', new.id, 'Žádost zamítnuta',
      case when new.rejection_reason is not null and new.rejection_reason <> ''
        then 'Důvod: ' || new.rejection_reason
        else 'Vaše žádost o volno byla zamítnuta.'
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
  if current_user_role() <> 'admin' then
    raise exception 'Jen admin firmy může odeslat hromadnou připomínku.';
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
  for select using (company_id = current_company_id() and current_user_role() = 'admin');

create or replace function audit_leave_requests()
returns trigger
language plpgsql
security definer
as $$
declare
  owner_id uuid := coalesce(new.profile_id, old.profile_id);
  cid uuid;
begin
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
  return coalesce(new, old);
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

  if current_user_role() in ('manager', 'admin') and new.profile_id <> auth.uid() then
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
  if current_user_role() <> 'admin' or current_company_id() <> target_company_id then
    raise exception 'Jen admin firmy může importovat zaměstnance.';
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
      coalesce(nullif(r->>'role', '')::user_role, 'employee')
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
     and current_user_role() not in ('admin', 'manager') then
    raise exception 'Oddělení, nadřízeného a zástupce může měnit jen manažer nebo admin.';
  end if;
  if new.company_id is distinct from old.company_id then
    raise exception 'Firmu u profilu nelze změnit.';
  end if;
  if new.active is distinct from old.active and (current_user_role() <> 'admin' or new.id = auth.uid()) then
    raise exception 'Deaktivovat může jen admin, a ne sám sebe.';
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
      when 'dovolena' then prorate_days((select default_vacation_days from companies where id = target_company_id), target_company_id)
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
