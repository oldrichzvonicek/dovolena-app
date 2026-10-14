-- seed_default_leave_types vkládala typy bez explicitního sort_order (default 0), a dřívější jednorázový
-- backfill řadil podle ctid — jenže ctid se po insertu posune dalšími update (counts_as_present/paid) v téže
-- funkci, takže pořadí v pickeru (request form, quick CTA) vyšlo v podstatě náhodné, ne "dovolená, sick,
-- home office…", jak admin čeká. Seed teď dává pořadí natvrdo; tahle migrace dorovná už existující firmy.
create or replace function seed_default_leave_types(target_company_id uuid)
returns void
language sql
as $$
  insert into leave_types (company_id, key, label, color, counts_against, active, hide_from_colleagues, sort_order) values
    (target_company_id, 'dovolena', 'Dovolená', 'teal', 'vacation', true, false, 0),
    (target_company_id, 'sick', 'Sick Day', 'wine', 'sick', true, true, 1),
    (target_company_id, 'home_office', 'Home Office', 'sky', 'none', true, false, 2),
    (target_company_id, 'lekar', 'Lékař', 'violet', 'none', true, true, 3),
    (target_company_id, 'nahradni_volno', 'Náhradní volno', 'rust', 'none', true, false, 4),
    (target_company_id, 'osetrovacka', 'Ošetřování člena rodiny', 'plum', 'none', false, false, 5),
    (target_company_id, 'materska', 'Mateřská dovolená', 'forest', 'none', false, false, 6),
    (target_company_id, 'nemoc', 'Nemoc', 'sage', 'none', false, true, 7),
    (target_company_id, 'sluzebni_cesta', 'Služební cesta', 'slate', 'none', false, false, 8),
    (target_company_id, 'neplacene_volno', 'Neplacené volno', 'amber', 'none', false, false, 9)
  on conflict (company_id, key) do nothing;

  update leave_types set counts_as_present = true
   where company_id = target_company_id and key in ('home_office', 'sluzebni_cesta') and counts_as_present = false;

  update leave_types set paid = false
   where company_id = target_company_id and key = 'neplacene_volno' and paid = true;
$$;

-- Přepočítá jen firmy, které typy nikdy ručně nepřerovnaly (všechny na 0) — admin-zvolené pořadí u ostatních
-- zůstává nedotčené. Bezpečné spustit opakovaně.
with canonical(key, rnk) as (
  values ('dovolena',0),('sick',1),('home_office',2),('lekar',3),('nahradni_volno',4),
         ('osetrovacka',5),('materska',6),('nemoc',7),('sluzebni_cesta',8),('neplacene_volno',9)
), untouched as (
  select company_id from leave_types group by company_id having count(*) > 1 and max(sort_order) = 0
), ranked as (
  select lt.id, coalesce(c.rnk, 10 + row_number() over (partition by lt.company_id order by lt.key)) as new_rank
  from leave_types lt
  join untouched u on u.company_id = lt.company_id
  left join canonical c on c.key = lt.key
)
update leave_types lt set sort_order = ranked.new_rank
from ranked where lt.id = ranked.id;
