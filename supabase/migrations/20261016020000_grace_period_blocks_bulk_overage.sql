-- Nalezeno při kontrole kódu: assert_user_capacity propouštěla grace period bez ohledu na p_extra. Jakmile
-- firma jednou vstoupila do 14denní lhůty (např. o 1 člověka navíc), import_employees mohl v tom samém okně
-- naimportovat libovolně velkou dávku (desítky/stovky lidí) — žádost by prošla stejně snadno jako jediný
-- nový uživatel. Grace period teď platí jen pro p_extra <= 1 (běžný signup/pozvánka/join); hromadné navýšení
-- (import) limit tarifu dál blokuje tvrdě, i uprostřed běžící lhůty.
create or replace function assert_user_capacity(p_company uuid, p_extra int default 1)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  lim int;
  used int;
  started timestamptz;
begin
  select plan_user_limit(c.plan) into lim from companies c where c.id = p_company;
  if lim is not null then
    select count(*) into used from profiles where company_id = p_company and active and not is_demo;
    if used + greatest(coalesce(p_extra, 0), 0) > lim then
      if coalesce(p_extra, 0) > 1 then
        raise exception 'Firma by přidáním % uživatelů překročila limit tarifu (nejvýše % uživatelů, nyní %). Správce firmy musí přejít na vyšší tarif (Nastavení firmy → Fakturace & tarify).', p_extra, lim, used;
      end if;
      select over_limit_since into started from companies where id = p_company;
      if started is null then
        update companies set over_limit_since = now() where id = p_company;
      elsif now() - started > interval '14 days' then
        raise exception 'Firma dosáhla limitu uživatelů svého tarifu (nejvýše % uživatelů, nyní %) a 14denní lhůta na úpravu už uplynula. Správce firmy musí přejít na vyšší tarif (Nastavení firmy → Fakturace & tarify).', lim, used;
      end if;
      return;
    end if;
  end if;
  update companies set over_limit_since = null where id = p_company and over_limit_since is not null;
end;
$$;
