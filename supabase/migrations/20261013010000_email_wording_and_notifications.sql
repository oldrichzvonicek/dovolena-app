-- E-maily: čitelnější formulace (vykání, bez „(a)“ a slangu, bez jmen v 1. pádě) a nové notifikace:
--   account_approved  — registraci z odkazu schválil admin,
--   welcome           — nový člověk (z pozvánky / odkazu bez schvalování) nebo zakladatel firmy,
--   leave_booked      — manažer zapsal absenci za zaměstnance,
--   request_withdrawn — žadatel stáhl čekající žádost (schvalovatel o tom jinak neví, e-mail s tlačítky mu zůstane),
--   leave_starting    — zítra (v pátek i o víkendu) začíná schválená dovolená; posílá api/cron/daily.
-- Texty u nových typů se zobrazují i ve zvonečku, e-mail se vyrábí stejně jako u ostatních (queue_notification_email).
-- Všechny přepisované funkce mají pevný search_path (viz 20261012000000_pin_function_search_path.sql).

alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('request_created', 'request_approved', 'request_rejected', 'vacation_reminder', 'carryover_expiring', 'help_question',
                  'cancellation_requested', 'cancellation_resolved', 'join_pending',
                  'account_approved', 'welcome', 'leave_booked', 'request_withdrawn', 'leave_starting'));

alter table leave_requests add column if not exists start_reminded_at timestamptz; -- připomínka "zítra začíná dovolená" se pošle jednou

create or replace function email_category_for_notification(t text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case t
    when 'request_created' then 'approver_requests'
    when 'cancellation_requested' then 'approver_requests'
    when 'request_withdrawn' then 'approver_requests'
    when 'request_approved' then 'requester_decisions'
    when 'request_rejected' then 'requester_decisions'
    when 'cancellation_resolved' then 'requester_decisions'
    when 'leave_booked' then 'requester_decisions'
    when 'vacation_reminder' then 'reminders'
    when 'carryover_expiring' then 'reminders'
    when 'leave_starting' then 'reminders'
    when 'help_question' then 'help_questions'
    when 'join_pending' then 'join_pending'
    else null
  end;
$$;

-- ---------------------------------------------------------------------------
-- Nová žádost → schvalovatelé; absence zapsaná za zaměstnance → zaměstnanec
-- ---------------------------------------------------------------------------
create or replace function notify_on_leave_request_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  requester_name text;
  requester_company_id uuid;
  blackout_label text;
  booker_name text;
  notif_title text;
  notif_body text;
  type_key text;
  type_label text;
  what text;
  date_range text;
  mgr record;
begin
  select key, label into type_key, type_label from leave_types where id = new.leave_type_id;
  date_range := case
    -- FM potlačí nuly na začátku (to_char bez něj dává "09. 11.", zbytek appky píše "9. 11.").
    when new.start_date = new.end_date then to_char(new.start_date, 'FMDD. FMMM. YYYY')
    else to_char(new.start_date, 'FMDD. FMMM.') || ' – ' || to_char(new.end_date, 'FMDD. FMMM. YYYY')
  end;

  -- Absenci za zaměstnance zapsal někdo jiný a rovnou ji schválil: zaměstnanec se to musí dozvědět. Hromadné zápisy
  -- (celofiremní volno, import) nastavují dodio.skip_overlap — těm se nepíše, ať nikdo nedostane desítky e-mailů.
  if new.status = 'approved' and auth.uid() is not null and auth.uid() <> new.profile_id
     and coalesce(current_setting('dodio.skip_overlap', true), '') <> '1' then
    select name into booker_name from profiles where id = auth.uid();
    insert into notifications (profile_id, type, leave_request_id, title, body)
    values (new.profile_id, 'leave_booked', new.id, 'Absence zapsána do kalendáře',
      'Do kalendáře vám byla zapsána absence typu „' || coalesce(type_label, 'absence') || '“ (' || date_range || ').'
        || case when booker_name is not null then ' Zapsáno uživatelem ' || booker_name || '.' else '' end);
  end if;

  -- Řádek vložený už schválený (celofiremní volno, import) nikomu nečeká na rozhodnutí.
  if new.status <> 'pending' then
    return new;
  end if;

  select name, company_id into requester_name, requester_company_id from profiles where id = new.profile_id;

  select label into blackout_label
  from blackout_periods
  where company_id = requester_company_id and start_date <= new.end_date and end_date >= new.start_date
  limit 1;

  -- Typ (leave_types.label) je volný text, který si firma může přejmenovat, takže ho nejde skloňovat: výchozí
  -- "Dovolená" má vlastní tvar, u všeho ostatního je typ v uvozovkách.
  what := case when type_key = 'dovolena' then 'o dovolenou' else 'o absenci typu „' || coalesce(type_label, 'absence') || '“' end;

  if blackout_label is not null then
    notif_title := '⚠️ Žádost v blokovaném termínu';
    notif_body := requester_name || ' žádá ' || what || ' (' || date_range || ') v blokovaném termínu „' || blackout_label || '“. Rozhodněte prosím, zda ji schválíte.';
  else
    notif_title := case when type_key = 'dovolena' then 'Nová žádost o dovolenou' else 'Nová žádost o absenci' end;
    notif_body := requester_name || ' žádá ' || what || ': ' || date_range || '.';
  end if;

  for mgr in
    select id from profiles
    where company_id = requester_company_id and role in ('manager', 'admin') and active and id <> new.profile_id
      and (role = 'admin' or superior_check(id, new.profile_id))
  loop
    insert into notifications (profile_id, type, leave_request_id, title, body)
    values (mgr.id, 'request_created', new.id, notif_title, notif_body);
  end loop;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rozhodnutí o žádosti → žadatel
-- ---------------------------------------------------------------------------
create or replace function notify_on_leave_request_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  type_key text;
  type_label text;
  what text;
  date_range text;
begin
  if new.status = old.status then
    return new;
  end if;

  select key, label into type_key, type_label from leave_types where id = new.leave_type_id;
  date_range := case
    when new.start_date = new.end_date then to_char(new.start_date, 'FMDD. FMMM. YYYY')
    else to_char(new.start_date, 'FMDD. FMMM.') || ' – ' || to_char(new.end_date, 'FMDD. FMMM. YYYY')
  end;
  what := case when type_key = 'dovolena' then 'o dovolenou' else 'typu „' || coalesce(type_label, 'absence') || '“' end;

  if new.status = 'approved' then
    insert into notifications (profile_id, type, leave_request_id, title, body)
    values (new.profile_id, 'request_approved', new.id, 'Žádost schválena',
      'Vaše žádost ' || what || ' (' || date_range || ') byla schválena.');
  elsif new.status = 'rejected' then
    insert into notifications (profile_id, type, leave_request_id, title, body)
    values (
      new.profile_id, 'request_rejected', new.id, 'Žádost zamítnuta',
      'Vaše žádost ' || what || ' (' || date_range || ') byla zamítnuta.'
        || case when new.rejection_reason is not null and new.rejection_reason <> ''
             then ' Důvod: ' || new.rejection_reason
             else ''
           end
    );
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Žadatel stáhl čekající žádost → schvalovatelé, kterým ji předtím poslal
-- ---------------------------------------------------------------------------
create or replace function notify_on_request_withdrawn()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  requester_name text;
  requester_company_id uuid;
  type_label text;
  date_range text;
begin
  -- Jen čekající žádost, kterou maže sám žadatel (ne kaskáda při mazání uživatele nebo firmy).
  if old.status <> 'pending' or auth.uid() is distinct from old.profile_id then
    return old;
  end if;
  select name, company_id into requester_name, requester_company_id from profiles where id = old.profile_id;
  if requester_name is null then
    return old;
  end if;
  select label into type_label from leave_types where id = old.leave_type_id;
  date_range := case
    when old.start_date = old.end_date then to_char(old.start_date, 'FMDD. FMMM. YYYY')
    else to_char(old.start_date, 'FMDD. FMMM.') || ' – ' || to_char(old.end_date, 'FMDD. FMMM. YYYY')
  end;

  insert into notifications (profile_id, type, title, body)
  select id, 'request_withdrawn', 'Žádost byla stažena',
    'Žádost od ' || requester_name || ' (' || coalesce(type_label, 'absence') || ', ' || date_range || ') byla stažena, už ji není potřeba řešit.'
  from profiles
  where company_id = requester_company_id and role in ('manager', 'admin') and active and id <> old.profile_id
    and (role = 'admin' or superior_check(id, old.profile_id));
  return old;
end;
$$;

drop trigger if exists leave_requests_notify_withdrawn on leave_requests;
create trigger leave_requests_notify_withdrawn
  before delete on leave_requests
  for each row execute function notify_on_request_withdrawn();

-- ---------------------------------------------------------------------------
-- Žádost o zrušení schválené absence a její vyřízení — s typem a termínem
-- ---------------------------------------------------------------------------
create or replace function request_leave_cancellation(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  req record;
  requester_name text;
  requester_company_id uuid;
  type_label text;
  date_range text;
begin
  select * into req from leave_requests where id = p_request_id and profile_id = auth.uid();
  if not found then
    raise exception 'Žádost nenalezena.';
  end if;
  if req.status <> 'approved' or req.end_date < current_date then
    raise exception 'Zrušení jde požádat jen u schválené absence, která ještě neskončila.';
  end if;

  update leave_requests set cancellation_requested_at = now() where id = p_request_id;

  select name, company_id into requester_name, requester_company_id from profiles where id = auth.uid();
  select label into type_label from leave_types where id = req.leave_type_id;
  date_range := case
    when req.start_date = req.end_date then to_char(req.start_date, 'FMDD. FMMM. YYYY')
    else to_char(req.start_date, 'FMDD. FMMM.') || ' – ' || to_char(req.end_date, 'FMDD. FMMM. YYYY')
  end;
  insert into notifications (profile_id, type, leave_request_id, title, body)
  select id, 'cancellation_requested', p_request_id, 'Žádost o zrušení absence',
    requester_name || ' žádá o zrušení schválené absence (' || coalesce(type_label, 'absence') || ', ' || date_range || ').'
  from profiles
  where company_id = requester_company_id and role in ('manager', 'admin') and active and id <> auth.uid();
end;
$$;

create or replace function resolve_leave_cancellation(p_request_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  req record;
  type_label text;
  what text;
  date_range text;
begin
  if coalesce(current_user_role()::text, '') not in ('manager', 'admin') then
    raise exception 'Jen manažer nebo admin může rozhodnout o zrušení.';
  end if;
  select r.* into req from leave_requests r
    join profiles p on p.id = r.profile_id
    where r.id = p_request_id and p.company_id = current_company_id() and r.cancellation_requested_at is not null;
  if not found then
    raise exception 'Žádost o zrušení nenalezena.';
  end if;
  if current_user_role() is distinct from 'admin' and not is_superior_of(req.profile_id) then
    raise exception 'O zrušení může rozhodnout jen nadřízený nebo zástupce zaměstnance, případně admin.';
  end if;

  select label into type_label from leave_types where id = req.leave_type_id;
  date_range := case
    when req.start_date = req.end_date then to_char(req.start_date, 'FMDD. FMMM. YYYY')
    else to_char(req.start_date, 'FMDD. FMMM.') || ' – ' || to_char(req.end_date, 'FMDD. FMMM. YYYY')
  end;
  what := coalesce(type_label, 'absence') || ', ' || date_range;

  if p_approve then
    delete from leave_requests where id = p_request_id;
    insert into notifications (profile_id, type, title, body)
    values (req.profile_id, 'cancellation_resolved', 'Zrušení schváleno', 'Zrušení absence (' || what || ') bylo schváleno, absence je odstraněna z kalendáře.');
  else
    update leave_requests set cancellation_requested_at = null where id = p_request_id;
    insert into notifications (profile_id, type, leave_request_id, title, body)
    values (req.profile_id, 'cancellation_resolved', p_request_id, 'Zrušení zamítnuto', 'Zrušení absence (' || what || ') nebylo schváleno, absence platí beze změny.');
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Připomínka delšího odpočinku od manažera: vykání, bez jména a rodu
-- ---------------------------------------------------------------------------
create or replace function send_wellbeing_reminder(target_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(current_user_role()::text, '') not in ('manager', 'admin') then
    raise exception 'Jen manažer nebo admin může poslat připomínku.';
  end if;
  if not exists (select 1 from profiles where id = target_profile_id and company_id = current_company_id()) then
    raise exception 'Zaměstnanec nenalezen.';
  end if;
  insert into notifications (profile_id, type, title, body)
  values (
    target_profile_id, 'vacation_reminder', 'Čas na pořádný odpočinek',
    'Delší dobu nemáte naplánované žádné volno. Naplánujte si pár dní odpočinku, zasloužíte si ho.'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Registrace přes odkaz: nový text pro adminy; bez schvalování rovnou uvítání
-- ---------------------------------------------------------------------------
create or replace function join_company_by_code(p_code uuid, p_name text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  j company_join%rowtype;
  cname text;
  caller_email text;
  admin_id uuid;
begin
  if exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'Profile already exists for this user';
  end if;

  select * into j from company_join where join_code = p_code and enabled;
  if j.company_id is null then
    raise exception 'Odkaz už neplatí nebo byl vypnut. Požádejte správce firmy o nový.';
  end if;

  select email into caller_email from auth.users where id = auth.uid();
  if (select email_confirmed_at from auth.users where id = auth.uid()) is null then
    raise exception 'Nejdřív potvrďte svůj e-mail (odkaz jsme vám poslali).';
  end if;

  select name into cname from companies where id = j.company_id;

  -- Bez schvalování se nový člověk aktivuje hned, proto se limit ověřuje už teď (při schvalování se ověří při aktivaci).
  if not j.require_approval then
    perform assert_user_capacity(j.company_id, 1);
  end if;

  insert into profiles (id, company_id, name, role, avatar_initials, email, active, join_pending)
  values (
    auth.uid(), j.company_id, p_name, 'employee',
    upper(left(split_part(p_name, ' ', 1), 1) || left(split_part(p_name, ' ', 2), 1)),
    caller_email,
    not j.require_approval,
    j.require_approval
  );

  perform grant_default_entitlements(auth.uid(), j.company_id);

  if j.require_approval then
    for admin_id in select id from profiles where company_id = j.company_id and role = 'admin' and active loop
      insert into notifications (profile_id, type, title, body)
      values (admin_id, 'join_pending', 'Nový uživatel čeká na schválení',
        'Nová registrace přes registrační odkaz: ' || p_name || ' (' || coalesce(caller_email, '') || '). Do schválení se do firmy nedostane.');
    end loop;
  else
    insert into notifications (profile_id, type, title, body)
    values (auth.uid(), 'welcome', 'Vítejte v Dodio',
      'Váš účet ve firmě ' || cname || ' je připravený. Žádost o dovolenou podáte tlačítkem „Nová žádost“, v kalendáři uvidíte, kdo z týmu je pryč.');
  end if;

  return cname;
end;
$$;

-- ---------------------------------------------------------------------------
-- Schválení registrace adminem → uživatel dostane e-mail (dřív se to nedozvěděl)
-- ---------------------------------------------------------------------------
create or replace function notify_on_account_approved()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  cname text;
begin
  if old.join_pending and not new.join_pending and new.active and not old.active then
    select name into cname from companies where id = new.company_id;
    insert into notifications (profile_id, type, title, body)
    values (new.id, 'account_approved', 'Váš účet byl schválen',
      'Správce firmy ' || coalesce(cname, '') || ' schválil vaši registraci. Můžete se přihlásit a začít Dodio používat.');
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_notify_account_approved on profiles;
create trigger profiles_notify_account_approved
  after update of join_pending, active on profiles
  for each row execute function notify_on_account_approved();

-- ---------------------------------------------------------------------------
-- Pozvánka: po vytvoření profilu uvítání
-- ---------------------------------------------------------------------------
create or replace function claim_invite()
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  inv company_invites%rowtype;
  resolved_manager_id uuid;
  caller_email text;
  cname text;
  year_now int := extract(year from now())::int;
begin
  if exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'Profile already exists for this user';
  end if;

  select email into caller_email from auth.users where id = auth.uid();
  select * into inv from company_invites where email = caller_email limit 1;
  if inv.id is null then
    return null;
  end if;
  perform assert_user_capacity(inv.company_id, 1);
  -- Pozvánka se váže na e-mail: bez potvrzení e-mailu by ji mohl převzít kdokoli, kdo adresu jen zná.
  if (select email_confirmed_at from auth.users where id = auth.uid()) is null then
    raise exception 'Nejdřív potvrďte svůj e-mail (odkaz jsme vám poslali).';
  end if;

  resolved_manager_id := inv.manager_id;
  if resolved_manager_id is null and inv.manager_invite_email is not null then
    select p.id into resolved_manager_id
    from profiles p join auth.users u on u.id = p.id
    where u.email = inv.manager_invite_email and p.company_id = inv.company_id;
  end if;

  insert into profiles (id, company_id, department_id, manager_id, name, role, avatar_initials, email, staff_role, is_external)
  values (
    auth.uid(), inv.company_id, inv.department_id, resolved_manager_id, inv.name, inv.role,
    upper(left(split_part(inv.name, ' ', 1), 1) || left(split_part(inv.name, ' ', 2), 1)),
    caller_email, inv.staff_role, inv.is_external
  );

  if inv.hire_date is not null then
    insert into profile_hr (profile_id, hire_date) values (auth.uid(), inv.hire_date)
    on conflict (profile_id) do update set hire_date = excluded.hire_date;
  end if;

  insert into leave_entitlements (profile_id, leave_type_id, year, total_days, opening_used_days)
  select auth.uid(), lt.id, year_now, prorate_days(inv.vacation_total, inv.company_id), inv.vacation_opening_used
  from leave_types lt where lt.company_id = inv.company_id and lt.key = 'dovolena'
  on conflict (profile_id, leave_type_id, year)
    do update set total_days = excluded.total_days, opening_used_days = excluded.opening_used_days;

  insert into leave_entitlements (profile_id, leave_type_id, year, total_days, opening_used_days)
  select auth.uid(), lt.id, year_now, inv.sick_total, inv.sick_opening_used
  from leave_types lt where lt.company_id = inv.company_id and lt.key = 'sick'
  on conflict (profile_id, leave_type_id, year)
    do update set total_days = excluded.total_days, opening_used_days = excluded.opening_used_days;

  delete from company_invites where id = inv.id;

  select name into cname from companies where id = inv.company_id;
  insert into notifications (profile_id, type, title, body)
  values (auth.uid(), 'welcome', 'Vítejte v Dodio',
    'Váš účet ve firmě ' || coalesce(cname, '') || ' je připravený. Žádost o dovolenou podáte tlačítkem „Nová žádost“, v kalendáři uvidíte, kdo z týmu je pryč.');

  return inv.company_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Založení firmy: uvítání zakladatele
-- ---------------------------------------------------------------------------
create or replace function onboard_new_company(p_company_name text, p_admin_name text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_company_id uuid;
  caller_email text;
begin
  if exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'Profile already exists for this user';
  end if;

  select email into caller_email from auth.users where id = auth.uid();

  insert into companies (name) values (p_company_name)
  returning id into new_company_id;

  insert into profiles (id, company_id, name, role, avatar_initials, email)
  values (
    auth.uid(),
    new_company_id,
    p_admin_name,
    'admin',
    upper(left(split_part(p_admin_name, ' ', 1), 1) || left(split_part(p_admin_name, ' ', 2), 1)),
    caller_email
  );

  perform seed_default_leave_types(new_company_id);

  -- Počáteční nárok zakladatele, ať nástěnka není první den prázdná (upraví se v Nastavení firmy).
  insert into leave_entitlements (profile_id, leave_type_id, year, total_days)
  select auth.uid(), lt.id, extract(year from now())::int,
    case lt.key when 'dovolena' then 20 when 'sick' then 5 end
  from leave_types lt
  where lt.company_id = new_company_id and lt.key in ('dovolena', 'sick');

  insert into notifications (profile_id, type, title, body)
  values (auth.uid(), 'welcome', 'Vítejte v Dodio',
    'Firma ' || p_company_name || ' je založená a můžete začít. Na nástěnce najdete průvodce „Začínáme“: doplňte údaje o firmě, vytvořte oddělení, pozvěte kolegy a zkontrolujte pravidla absencí.');

  return new_company_id;
end;
$$;
