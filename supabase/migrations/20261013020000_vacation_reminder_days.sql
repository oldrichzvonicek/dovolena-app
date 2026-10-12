-- Hromadná připomínka nevyčerpané dovolené s počtem zbývajících dnů. Zůstatek počítá aplikace (převody, rozdělení přes
-- konec roku) a posílá ho v p_days jako {"<profile_id>": dny}; SQL ho jen ověří a vloží do textu. Původní funkce
-- send_vacation_reminders (bez počtu dnů) zůstává jako záloha.
create or replace function send_vacation_reminders_with_days(target_profile_ids uuid[], p_days jsonb)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  n int := 0;
  r record;
  d numeric;
  num text;
  unit text;
  verb text;
  body text;
begin
  if current_user_role() is distinct from 'admin' and current_user_staff() is distinct from 'hr' then
    raise exception 'Jen admin nebo HR může odeslat hromadnou připomínku.';
  end if;

  for r in select id from profiles where id = any(target_profile_ids) and company_id = current_company_id() loop
    begin
      d := (p_days ->> r.id::text)::numeric;
    exception when others then
      d := null;
    end;
    if d is not null and d > 0 and d <= 366 then
      if d = trunc(d) then
        num := d::int::text;
        unit := case when d = 1 then 'den' when d between 2 and 4 then 'dny' else 'dní' end;
        verb := case when d between 2 and 4 then 'zbývají' else 'zbývá' end;
      else
        num := replace(to_char(d, 'FM999990.0'), '.', ',');
        unit := 'dne';
        verb := 'zbývá';
      end if;
      body := 'Do konce roku vám ' || verb || ' ' || num || ' ' || unit || ' nevyčerpané dovolené. Naplánujte si ji včas, ať vám nepropadne.';
    else
      body := 'Do konce roku vám zbývá nevyčerpaná dovolená. Naplánujte si ji včas, ať vám nepropadne.';
    end if;
    insert into notifications (profile_id, type, title, body) values (r.id, 'vacation_reminder', 'Nevyčerpaná dovolená', body);
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke execute on function send_vacation_reminders_with_days(uuid[], jsonb) from public, anon;
grant execute on function send_vacation_reminders_with_days(uuid[], jsonb) to authenticated;
