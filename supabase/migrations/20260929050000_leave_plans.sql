-- "Naplánovat rok dopředu, bez odeslání ke schválení": nová, úplně samostatná tabulka, ne nový stav
-- v leave_requests. leave_requests má na sobě navěšenou spoustu triggerů (kolize, notifikace, audit log,
-- uzávěrka výplat, kapacitní přepočty) — přidat tam další stav by znamenalo provléct 'draft' bezpečně přes
-- všechny z nich. Samostatná tabulka se žádného z nich netýká a je triviálně soukromá (RLS = jen vlastník,
-- nikdo jiný — ani manažer, ani admin — řádek nikdy neuvidí, přesně jak chtěl uživatel).
create table if not exists leave_plans (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  leave_type_id uuid not null references leave_types(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  half_day boolean not null default false,
  working_days numeric(5,1) not null,
  note text,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index if not exists leave_plans_profile_id_idx on leave_plans (profile_id);

alter table leave_plans enable row level security;

drop policy if exists "own leave_plans only" on leave_plans;
create policy "own leave_plans only" on leave_plans
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());
