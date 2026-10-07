-- Doplňková role (HR / účetní) dřív šla nastavit jen dodatečně, úpravou už přijatého profilu — účetní/HR
-- tak vždycky musel projít pozvánkou jako obyčejný zaměstnanec a admin ho pak musel ručně přenastavit.
-- Teď jde nastavit rovnou při pozvání (viz InviteUserModal.tsx).
alter table company_invites add column if not exists staff_role text check (staff_role in ('hr', 'accountant'));

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
  perform assert_user_capacity(inv.company_id, 1);
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

  insert into profiles (id, company_id, department_id, manager_id, name, role, avatar_initials, email, staff_role)
  values (
    auth.uid(), inv.company_id, inv.department_id, resolved_manager_id, inv.name, inv.role,
    upper(left(split_part(inv.name, ' ', 1), 1) || left(split_part(inv.name, ' ', 2), 1)),
    caller_email, inv.staff_role
  );

  if inv.hire_date is not null then
    insert into profile_hr (profile_id, hire_date) values (auth.uid(), inv.hire_date)
    on conflict (profile_id) do update set hire_date = excluded.hire_date;
  end if;

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
  wanted_staff_role text;
begin
  if current_company_id() is distinct from target_company_id
     or (current_user_role() is distinct from 'admin' and current_user_staff() is distinct from 'hr') then
    raise exception 'Jen admin nebo HR firmy může importovat zaměstnance.';
  end if;

  -- Limit tarifu: aktivní lidé + čekající pozvánky + nové adresy z tohoto importu.
  perform assert_user_capacity(
    target_company_id,
    (select count(*) from company_invites where company_id = target_company_id)::int
    + (select count(distinct lower(trim(x ->> 'email'))) from jsonb_array_elements(rows) x
        where lower(trim(x ->> 'email')) not in (select email from company_invites where company_id = target_company_id))::int
  );

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

    -- Doplňková role (HR / účetní): stejné omezení jako při úpravě už přijatého profilu — smí ji
    -- nastavit jen admin, a jen pokud to dovoluje tarif firmy.
    wanted_staff_role := nullif(r->>'staff_role', '');
    if wanted_staff_role is not null then
      if current_user_role() is distinct from 'admin' then
        raise exception 'Doplňkovou roli (HR / účetní) může nastavit jen admin.';
      end if;
      if wanted_staff_role = 'hr' and not coalesce(company_has_feature('hr_insights'), false) then
        raise exception 'Role HR je součástí doplňku HR Insights (v tarifu Pro v ceně).';
      end if;
      if wanted_staff_role = 'accountant' and not coalesce(company_has_feature('accountant'), false) then
        raise exception 'Role Účetní je od tarifu Starter v ceně, u Free jde o doplněk.';
      end if;
    end if;

    insert into company_invites (
      company_id, email, name, department_id, manager_id, manager_invite_email,
      vacation_total, vacation_opening_used, sick_total, sick_opening_used, role, hire_date, staff_role
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
      case when current_user_role() = 'admin' then coalesce(nullif(r->>'role', '')::user_role, 'employee') else 'employee'::user_role end,
      nullif(r->>'hire_date', '')::date,
      wanted_staff_role
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
      role = excluded.role,
      hire_date = excluded.hire_date,
      staff_role = excluded.staff_role;

    n := n + 1;
  end loop;

  return n;
end;
$$;
