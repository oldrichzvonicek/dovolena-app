-- HR: deaktivace uživatelů a zadání schválené absence za kohokoli (dřív jen admin/manažer); role HR přestává
-- být vázaná na doplněk Smart HR (byla to role pro správu lidí, ne placená analytická funkce). Samostatná
-- migrace mimo schema.sql / 20260926000000_baseline.sql, protože se v repu právě souběžně upravují (super-admin
-- vlákno) — po jejich sloučení tyhle dvě definice do obou doplňte, ať schema.sql zůstane úplným současným stavem.

create or replace function guard_profile_update()
returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and current_user_role() is distinct from 'admin' then
    raise exception 'Roli může měnit jen admin.';
  end if;
  if (new.department_id is distinct from old.department_id
      or new.manager_id is distinct from old.manager_id
      or new.substitute_id is distinct from old.substitute_id)
     and auth.uid() is not null
     and coalesce(current_user_role()::text, '') not in ('admin', 'manager')
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
  if new.substitute_id is not null and new.substitute_id is distinct from old.substitute_id and auth.uid() is not null
     and not coalesce(company_feature(new.company_id, 'escalation'), false) then
    raise exception 'Stálý zástup je od tarifu Pro.';
  end if;
  -- Aktivace (nový nebo znovu aktivovaný uživatel) nesmí překročit limit tarifu.
  if new.active and not old.active and auth.uid() is not null and not new.is_demo then
    perform assert_user_capacity(new.company_id, 1);
  end if;
  if new.is_demo is distinct from old.is_demo and auth.uid() is not null then
    raise exception 'Ukázkové účty spravuje jen systém.';
  end if;
  -- E-mail v profilu smí být jen ten z přihlašovacího účtu (jinak by si šlo nechat posílat upozornění na cizí adresu).
  if new.email is distinct from old.email and auth.uid() is not null
     and (new.id is distinct from auth.uid() or new.email is distinct from my_auth_email()) then
    raise exception 'E-mail lze změnit jen v nastavení přihlašovacího účtu.';
  end if;
  if new.staff_role is distinct from old.staff_role and auth.uid() is not null and current_user_role() is distinct from 'admin' then
    raise exception 'Doplňkovou roli (HR / účetní) může nastavit jen admin.';
  end if;
  if new.staff_role is distinct from old.staff_role and new.staff_role is not null and auth.uid() is not null then
    -- Role HR (na rozdíl od role Účetní) není vázaná na žádný doplněk ani tarif — jde o to, kdo smí
    -- spravovat lidi, ne o placenou analytickou funkci (tu Smart HR odemyká zvlášť, ne přes tuhle roli).
    if new.staff_role = 'accountant' and not coalesce(company_has_feature('accountant'), false) then
      raise exception 'Role Účetní je od tarifu Starter v ceně, u Free jde o doplněk.';
    end if;
  end if;
  if new.active is distinct from old.active and auth.uid() is not null then
    if new.id = auth.uid() then
      raise exception 'Deaktivovat sám sebe nejde.';
    end if;
    if current_user_role() is distinct from 'admin' and current_user_staff() is distinct from 'hr' then
      raise exception 'Deaktivovat může jen admin nebo HR.';
    end if;
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

drop policy if exists "managers create leave_requests for team" on leave_requests;
create policy "managers create leave_requests for team" on leave_requests
  for insert with check (
    exists (select 1 from profiles p where p.id = leave_requests.profile_id and p.company_id = current_company_id())
    and (
      current_user_role() = 'admin'
      or current_user_staff() = 'hr'
      or (current_user_role() = 'manager' and is_superior_of(leave_requests.profile_id))
    )
  );
