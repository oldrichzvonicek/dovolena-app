-- Znovu otevřít uzavřenou uzávěrku je silný zásah (mzdy už se mohly zpracovat) — klient (PayrollDetailPanel)
-- proto vynucuje důvod přes dialog, a ten se tu zapíše do audit_log (Historie změn), ať je dohledatelný.
drop function if exists reopen_payroll_month(date);
create or replace function reopen_payroll_month(p_month date, p_reason text default '')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cid uuid := current_company_id();
begin
  if cid is null or (current_user_role() is distinct from 'admin' and current_user_staff() is null) then
    raise exception 'Měsíc smí znovu otevřít admin, HR nebo účetní.';
  end if;
  delete from payroll_closures where company_id = cid and month = date_trunc('month', p_month)::date;
  insert into audit_log (company_id, actor_id, action, details)
  values (cid, auth.uid(), 'payroll.reopened', jsonb_build_object('month', date_trunc('month', p_month)::date, 'reason', nullif(trim(p_reason), '')));
end;
$$;
