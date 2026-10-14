-- Tvrdé zablokování při dosažení limitu uživatelů tarifu bylo příliš nemilosrdné (např. krátké přerušení
-- platby, nebo firma čekající na schválení vyššího tarifu). Nový uživatel je po dosažení limitu povolen
-- ještě 14 dní od prvního překročení; po 14 dnech bez nápravy se žádost dál blokuje jako dřív.
alter table companies add column if not exists over_limit_since timestamptz;

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
  if lim is null then
    update companies set over_limit_since = null where id = p_company and over_limit_since is not null;
    return;
  end if;
  select count(*) into used from profiles where company_id = p_company and active and not is_demo;
  if used + greatest(coalesce(p_extra, 0), 0) > lim then
    select over_limit_since into started from companies where id = p_company;
    if started is null then
      update companies set over_limit_since = now() where id = p_company;
    elsif now() - started > interval '14 days' then
      raise exception 'Firma dosáhla limitu uživatelů svého tarifu (nejvýše % uživatelů, nyní %) a 14denní lhůta na úpravu už uplynula. Správce firmy musí přejít na vyšší tarif (Nastavení firmy → Fakturace & tarify).', lim, used;
    end if;
  else
    update companies set over_limit_since = null where id = p_company and over_limit_since is not null;
  end if;
end;
$$;
