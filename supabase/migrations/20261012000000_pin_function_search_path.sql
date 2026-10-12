-- Supabase security advisor: 17 funkcí nemělo pevně nastavený search_path, takže by teoreticky šlo
-- poslat dotaz s objektem stejného jména ve schématu, co se prohledá dřív než "public", a tím podvrhnout
-- chování SECURITY DEFINER funkce. ALTER FUNCTION jen připíná search_path, těla funkcí se nemění.
alter function public.claim_invite() set search_path = public, pg_temp;
alter function public.count_working_days(s date, e date, wd integer[]) set search_path = public, pg_temp;
alter function public.czech_holiday(d date) set search_path = public, pg_temp;
alter function public.easter_sunday(y integer) set search_path = public, pg_temp;
alter function public.guard_company_update() set search_path = public, pg_temp;
alter function public.guard_leave_request_decision() set search_path = public, pg_temp;
alter function public.guard_leave_type_delete() set search_path = public, pg_temp;
alter function public.guard_profile_update() set search_path = public, pg_temp;
alter function public.import_employees(target_company_id uuid, rows jsonb) set search_path = public, pg_temp;
alter function public.notify_on_leave_request_insert() set search_path = public, pg_temp;
alter function public.notify_on_leave_request_status_change() set search_path = public, pg_temp;
alter function public.platform_audit_immutable() set search_path = public, pg_temp;
alter function public.queue_integration_events() set search_path = public, pg_temp;
alter function public.request_leave_cancellation(p_request_id uuid) set search_path = public, pg_temp;
alter function public.resolve_leave_cancellation(p_request_id uuid, p_approve boolean) set search_path = public, pg_temp;
alter function public.seed_default_leave_types(target_company_id uuid) set search_path = public, pg_temp;
alter function public.send_vacation_reminders(target_profile_ids uuid[]) set search_path = public, pg_temp;

-- guard_company_writable je trigger funkce (nedává smysl ji volat jako RPC) a reopen_payroll_month má
-- vlastní kontrolu role uvnitř (cid is null → chyba), takže anon reálně nic nezmůže — ale PostgREST ji
-- bez tohohle REVOKE pořád nabízí na /rest/v1/rpc/... nepřihlášeným, zbytečně.
-- Revoke musí jít na PUBLIC, ne na "anon" samotné — anon je implicitně členem PUBLIC, takže dokud má
-- EXECUTE PUBLIC (výchozí stav při vytvoření funkce), revoke jen z role "anon" je no-op.
revoke execute on function public.guard_company_writable() from public;
revoke execute on function public.reopen_payroll_month(date, text) from public;
