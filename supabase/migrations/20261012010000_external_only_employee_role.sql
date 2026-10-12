-- Externí (dodavatel, ne zaměstnanec firmy) nikdy nemá smysl jako Manažer/Admin — nemá oddělení ani
-- nadřízené, nemůže nikoho reálně řídit. Appka to dřív nevynucovala vůbec: InviteUserModal i
-- EditEmployeeModal dovolily "externí manažer"/"externí admin", a import_employees ignoroval roli
-- u externích řádků úplně. CHECK constraint je poslední záchytná síť bez ohledu na to, kudy se zapisuje.
alter table profiles add constraint profiles_external_only_employee check (not is_external or role = 'employee');
alter table company_invites add constraint company_invites_external_only_employee check (not is_external or role = 'employee');

-- Stejná logika v import_employees (CSV import) — dřív vzal roli z řádku i pro externí; teď ji pro
-- externí vždy přepíše na 'employee', ať CSV s nesmyslnou kombinací neshodí celý import na constraint.
create or replace function import_employees(target_company_id uuid, rows jsonb)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r jsonb;
  dept_id uuid;
  dept_name text;
  n int := 0;
  wanted_staff_role text;
  wanted_external boolean;
begin
  if current_company_id() is distinct from target_company_id
     or (current_user_role() is distinct from 'admin' and current_user_staff() is distinct from 'hr') then
    raise exception 'Jen admin nebo HR firmy může importovat zaměstnance.';
  end if;

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

    wanted_external := wanted_staff_role is not null and coalesce((r->>'is_external')::boolean, false);
    if wanted_external then
      dept_id := null;
    end if;

    insert into company_invites (
      company_id, email, name, department_id, manager_id, manager_invite_email,
      vacation_total, vacation_opening_used, sick_total, sick_opening_used, role, hire_date, staff_role, is_external
    ) values (
      target_company_id,
      lower(trim(r->>'email')),
      r->>'name',
      dept_id,
      case when wanted_external then null else nullif(r->>'manager_id', '')::uuid end,
      case when wanted_external then null else nullif(r->>'manager_invite_email', '') end,
      coalesce((r->>'vacation_total')::numeric, 0),
      coalesce((r->>'vacation_opening_used')::numeric, 0),
      coalesce((r->>'sick_total')::numeric, 0),
      coalesce((r->>'sick_opening_used')::numeric, 0),
      -- Externí je vždy jen Zaměstnanec (viz profiles_external_only_employee) — jinak: HR smí zvát jen
      -- zaměstnance, roli manažer / admin přiděluje jen admin.
      case
        when wanted_external then 'employee'::user_role
        when current_user_role() = 'admin' then coalesce(nullif(r->>'role', '')::user_role, 'employee')
        else 'employee'::user_role
      end,
      nullif(r->>'hire_date', '')::date,
      wanted_staff_role,
      wanted_external
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
      staff_role = excluded.staff_role,
      is_external = excluded.is_external;

    n := n + 1;
  end loop;

  return n;
end;
$$;
