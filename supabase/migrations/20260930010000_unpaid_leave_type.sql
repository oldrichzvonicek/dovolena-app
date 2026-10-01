-- Nový výchozí (ale neaktivní) typ absence "Neplacené volno" — admin ho zapne v Nastavení firmy →
-- Typy absencí, až ho bude potřebovat, stejně jako u ostatních neaktivně seedovaných typů.

create or replace function seed_default_leave_types(target_company_id uuid)
returns void
language sql
as $$
  insert into leave_types (company_id, key, label, color, counts_against, active) values
    (target_company_id, 'dovolena', 'Dovolená', 'teal', 'vacation', true),
    (target_company_id, 'sick', 'Sick Day', 'wine', 'sick', true),
    (target_company_id, 'home_office', 'Home Office', 'sky', 'none', true),
    (target_company_id, 'lekar', 'Lékař', 'violet', 'none', true),
    -- 'gold' se v kalendáři barevně plete se žlutým podbarvením státních svátků — 'rust' (neutrální šedohnědá) je od
    -- svátků i od ostatních výchozích typů absencí jasně odlišitelná.
    (target_company_id, 'nahradni_volno', 'Náhradní volno', 'rust', 'none', true),
    -- Seeded but off by default — admin switches these on in Typy absencí
    -- once actually needed, rather than every company starting with them live.
    (target_company_id, 'osetrovacka', 'Ošetřování člena rodiny', 'plum', 'none', false),
    (target_company_id, 'materska', 'Mateřská dovolená', 'forest', 'none', false),
    (target_company_id, 'nemoc', 'Nemoc', 'sage', 'none', false),
    (target_company_id, 'sluzebni_cesta', 'Služební cesta', 'slate', 'none', false),
    (target_company_id, 'neplacene_volno', 'Neplacené volno', 'amber', 'none', false)
  on conflict (company_id, key) do nothing;

  -- Home Office a služební cesta: člověk pracuje, takže nesnižuje kapacitu týmu a nekryje se s jinou absencí.
  update leave_types set counts_as_present = true
   where company_id = target_company_id and key in ('home_office', 'sluzebni_cesta') and counts_as_present = false;

  -- Neplacené volno se na rozdíl od ostatních výchozích typů nevyplácí.
  update leave_types set paid = false
   where company_id = target_company_id and key = 'neplacene_volno' and paid = true;
$$;

-- One-off backfill: give every existing company the new "Neplacené volno" type too
-- (seed_default_leave_types only runs for brand-new companies).
insert into leave_types (company_id, key, label, color, counts_against, active, paid)
select id, 'neplacene_volno', 'Neplacené volno', 'amber', 'none', false, false from companies
on conflict (company_id, key) do nothing;
