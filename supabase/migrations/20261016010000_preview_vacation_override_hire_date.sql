-- preview_prorated_vacation vždy četla uložené datum nástupu z profile_hr, i když admin v Upravit uživatele
-- mezitím napsal nové datum do pole a ještě ho neuložil — tlačítko Přepočítat tak počítalo se starým (nebo
-- žádným) datem. Nový volitelný parametr dovolí přepočet rovnou podle rozepsané hodnoty ve formuláři.
create or replace function preview_prorated_vacation(target_profile_id uuid, target_year int, override_hire_date date default null)
returns numeric
language sql
stable
as $$
  select case
    when coalesce(override_hire_date, h.hire_date) is not null and extract(year from coalesce(override_hire_date, h.hire_date)) < target_year
      then c.default_vacation_days + seniority_bonus_days(coalesce(override_hire_date, h.hire_date), c.id, target_year)
    else prorate_from(
           c.default_vacation_days + seniority_bonus_days(coalesce(override_hire_date, h.hire_date), c.id, target_year),
           c.id,
           coalesce(override_hire_date, h.hire_date, make_date(target_year, 1, 1))
         )
  end
  from profiles p
  join companies c on c.id = p.company_id
  left join profile_hr h on h.profile_id = p.id
  where p.id = target_profile_id;
$$;
