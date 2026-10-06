-- "Lékař" a "Nemoc" jsou stejně citlivé zdravotní typy jako Sick Day, ale seed je zakládal s counts_against =
-- 'none', takže je dřívější backfill (where counts_against = 'sick') nezahrnul: kolegům bez nároku na detail se
-- ukazoval konkrétní typ absence ("Lékař") místo "Nepřítomen". Oprava: seed pro nové firmy + backfill pro firmy,
-- co tyto typy mají už založené se starým výchozím nastavením a admin ho sám nezměnil.
create or replace function seed_default_leave_types(target_company_id uuid)
returns void
language sql
as $$
  insert into leave_types (company_id, key, label, color, counts_against, active, hide_from_colleagues) values
    (target_company_id, 'dovolena', 'Dovolená', 'teal', 'vacation', true, false),
    (target_company_id, 'sick', 'Sick Day', 'wine', 'sick', true, true),
    (target_company_id, 'home_office', 'Home Office', 'sky', 'none', true, false),
    (target_company_id, 'lekar', 'Lékař', 'violet', 'none', true, true),
    (target_company_id, 'nahradni_volno', 'Náhradní volno', 'rust', 'none', true, false),
    (target_company_id, 'osetrovacka', 'Ošetřování člena rodiny', 'plum', 'none', false, false),
    (target_company_id, 'materska', 'Mateřská dovolená', 'forest', 'none', false, false),
    (target_company_id, 'nemoc', 'Nemoc', 'sage', 'none', false, true),
    (target_company_id, 'sluzebni_cesta', 'Služební cesta', 'slate', 'none', false, false)
  on conflict (company_id, key) do nothing;

  update leave_types set counts_as_present = true
   where company_id = target_company_id and key in ('home_office', 'sluzebni_cesta') and counts_as_present = false;
$$;

update leave_types set hide_from_colleagues = true where key in ('lekar', 'nemoc') and hide_from_colleagues = false;
