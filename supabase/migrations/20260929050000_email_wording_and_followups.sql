-- Konkrétnější texty procesních e-mailů (žádost, schválení, zamítnutí, zrušení), upozornění pro zastupujícího
-- kolegu a sloupce pro připomínku nedokončené pozvánky. Logika žádostí se nemění, jen texty a nová upozornění.
-- Katalog textů: src/lib/email-templates.ts.

-- ---------------------------------------------------------------------------
-- Pomocné funkce pro česky formátované termíny a počty dní.
-- ---------------------------------------------------------------------------
create or replace function cz_date_range(a date, b date)
returns text
language sql
immutable
as $$
  select case
    when a = b then to_char(a, 'FMDD. FMMM. YYYY')
    when to_char(a, 'YYYY') = to_char(b, 'YYYY') then to_char(a, 'FMDD. FMMM.') || ' – ' || to_char(b, 'FMDD. FMMM. YYYY')
    else to_char(a, 'FMDD. FMMM. YYYY') || ' – ' || to_char(b, 'FMDD. FMMM. YYYY')
  end;
$$;

create or replace function cz_working_days(n numeric)
returns text
language sql
immutable
as $$
  select case
    when n is null then ''
    when n = 1 then '1 pracovní den'
    when n in (2, 3, 4) then n::int::text || ' pracovní dny'
    when n = trunc(n) then n::int::text || ' pracovních dnů'
    else replace(n::text, '.', ',') || ' pracovního dne'
  end;
$$;

-- ---------------------------------------------------------------------------
-- Nová upozornění: zastupující kolega se dozví, že někoho zastupuje.
-- ---------------------------------------------------------------------------
alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('request_created', 'request_approved', 'request_rejected', 'vacation_reminder', 'help_question', 'cancellation_requested', 'cancellation_resolved', 'join_pending', 'covering_assigned'));

create or replace function email_category_for_notification(t text)
returns text
language sql
immutable
as $$
  select case t
    when 'request_created' then 'approver_requests'
    when 'cancellation_requested' then 'approver_requests'
    when 'request_approved' then 'requester_decisions'
    when 'request_rejected' then 'requester_decisions'
    when 'cancellation_resolved' then 'requester_decisions'
    when 'covering_assigned' then 'requester_decisions'
    when 'vacation_reminder' then 'reminders'
    when 'help_question' then 'help_questions'
    when 'join_pending' then 'join_pending'
    else null
  end;
$$;

-- ---------------------------------------------------------------------------
-- Nová žádost / žádost v blokovaném termínu (schvalovatel).
-- ---------------------------------------------------------------------------
create or replace function notify_on_leave_request_insert()
returns trigger
language plpgsql
security definer
as $$
declare
  requester_name text;
  requester_company_id uuid;
  requester_dept uuid;
  blackout_label text;
  notif_title text;
  notif_body text;
  type_label text;
  date_range text;
  overlap int;
  overlap_text text := '';
  mgr record;
begin
  -- Řádek vložený rovnou jako schválený (celozávodní volno, import) nikdo neschvaluje.
  if new.status <> 'pending' then
    return new;
  end if;

  select name, company_id, department_id into requester_name, requester_company_id, requester_dept from profiles where id = new.profile_id;

  select label into blackout_label
  from blackout_periods
  where company_id = requester_company_id and start_date <= new.end_date and end_date >= new.start_date
  limit 1;

  select label into type_label from leave_types where id = new.leave_type_id;
  date_range := cz_date_range(new.start_date, new.end_date);

  -- Kolik lidí z jeho oddělení už má ve stejném termínu schválenou absenci (Home Office se nepočítá).
  if requester_dept is not null then
    select count(distinct r.profile_id) into overlap
    from leave_requests r
    join profiles p on p.id = r.profile_id
    join leave_types lt on lt.id = r.leave_type_id
    where p.department_id = requester_dept and p.id <> new.profile_id and r.status = 'approved'
      and r.start_date <= new.end_date and r.end_date >= new.start_date and not lt.counts_as_present;
    if overlap = 1 then
      overlap_text := ' Ve stejném termínu chybí z jeho oddělení ještě 1 kolega.';
    elsif overlap between 2 and 4 then
      overlap_text := ' Ve stejném termínu chybí z jeho oddělení ještě ' || overlap || ' kolegové.';
    elsif overlap >= 5 then
      overlap_text := ' Ve stejném termínu chybí z jeho oddělení ještě ' || overlap || ' kolegů.';
    end if;
  end if;

  if blackout_label is not null then
    notif_title := 'Žádost v blokovaném termínu: ' || requester_name;
    notif_body := requester_name || ' žádá o absenci (' || coalesce(type_label, 'absence') || ', ' || date_range || ', ' || cz_working_days(new.working_days) || '), i když termín spadá do blokovaného období „' || blackout_label || '“. Posuďte prosím, zda ji přesto schválíte.' || overlap_text;
  else
    notif_title := 'Nová žádost: ' || requester_name || ', ' || coalesce(type_label, 'absence');
    notif_body := requester_name || ' žádá o absenci (' || coalesce(type_label, 'absence') || ', ' || date_range || ', ' || cz_working_days(new.working_days) || ').' || overlap_text || ' Rozhodnout můžete jedním kliknutím.';
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
-- Schválení / zamítnutí (žadatel) + upozornění pro zastupujícího.
-- ---------------------------------------------------------------------------
create or replace function notify_on_leave_request_status_change()
returns trigger
language plpgsql
security definer
as $$
declare
  type_label text;
  date_range text;
  first_name text;
  requester_name text;
  approver_name text;
  cover_name text;
begin
  if new.status = old.status then
    return new;
  end if;

  select label into type_label from leave_types where id = new.leave_type_id;
  date_range := cz_date_range(new.start_date, new.end_date);
  select name into requester_name from profiles where id = new.profile_id;
  first_name := split_part(coalesce(requester_name, ''), ' ', 1);
  select name into approver_name from profiles where id = new.approved_by;
  select name into cover_name from profiles where id = new.covering_profile_id;

  if new.status = 'approved' then
    insert into notifications (profile_id, type, leave_request_id, title, body)
    values (new.profile_id, 'request_approved', new.id,
      coalesce(type_label, 'Absence') || ' schválena: ' || date_range,
      case when first_name <> '' then first_name || ', ' else '' end
        || 'vaše žádost (' || coalesce(type_label, 'absence') || ', ' || date_range || ', ' || cz_working_days(new.working_days) || ') je schválená'
        || case when approver_name is not null then ' — potvrdil(a) ji ' || approver_name else ' — schválila se automaticky podle pravidel firmy' end
        || '.'
        || case when cover_name is not null then ' Zastupovat vás bude ' || cover_name || '.' else '' end
        || ' Termín už máte v týmovém kalendáři.');

    -- Kdo je uveden jako zástup, dozví se to. Typ absence se mu neříká (může být soukromý).
    if new.covering_profile_id is not null and new.covering_profile_id <> new.profile_id then
      insert into notifications (profile_id, type, leave_request_id, title, body)
      values (new.covering_profile_id, 'covering_assigned', new.id,
        requester_name || ' vás bude mít jako zástup',
        requester_name || ' bude nepřítomen(a) ' || date_range || ' a jako zástup je uvedeno vaše jméno. Předat si agendu můžete s předstihem, ať to nezůstane na poslední chvíli.');
    end if;
  elsif new.status = 'rejected' then
    insert into notifications (profile_id, type, leave_request_id, title, body)
    values (
      new.profile_id, 'request_rejected', new.id,
      'Žádost zamítnuta: ' || coalesce(type_label, 'absence') || ', ' || date_range,
      'Žádost (' || coalesce(type_label, 'absence') || ', ' || date_range || ') bohužel nebyla schválena'
        || case when approver_name is not null then ' — rozhodl(a) ' || approver_name else '' end
        || '.'
        || case when new.rejection_reason is not null and new.rejection_reason <> ''
             then ' Důvod: „' || new.rejection_reason || '“.'
             else ''
           end
        || ' Můžete ji upravit (třeba posunout termín) a poslat znovu, nebo se s rozhodujícím domluvit osobně.'
    );
  end if;

  -- Zamítnutí i schválení zruší i nepřečtenou „Nová žádost“ u všech schvalovatelů.
  update notifications
  set read_at = coalesce(read_at, now())
  where leave_request_id = new.id and type = 'request_created' and read_at is null;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Žádost o zrušení absence (schvalovatel) a její vyřízení (žadatel).
-- ---------------------------------------------------------------------------
create or replace function request_leave_cancellation(p_request_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  req record;
  requester_name text;
  requester_company_id uuid;
  type_label text;
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

  insert into notifications (profile_id, type, leave_request_id, title, body)
  select id, 'cancellation_requested', p_request_id, 'Žádost o zrušení: ' || requester_name,
    requester_name || ' už nepotřebuje schválenou absenci (' || coalesce(type_label, 'absence') || ', ' || cz_date_range(req.start_date, req.end_date) || ') a žádá o její zrušení. Do vašeho rozhodnutí absence platí dál a dny zůstávají vyčerpané.'
  from profiles
  where company_id = requester_company_id and role in ('manager', 'admin') and active and id <> auth.uid();
end;
$$;

create or replace function resolve_leave_cancellation(p_request_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
as $$
declare
  req record;
  type_label text;
  range_txt text;
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
  range_txt := cz_date_range(req.start_date, req.end_date);

  if p_approve then
    delete from leave_requests where id = p_request_id;
    insert into notifications (profile_id, type, title, body)
    values (req.profile_id, 'cancellation_resolved', 'Zrušení schváleno: ' || range_txt,
      'Absence (' || coalesce(type_label, 'absence') || ', ' || range_txt || ') je zrušená a dny se vám vrátily do zůstatku. Kdyby se plány změnily, stačí podat novou žádost.');
  else
    update leave_requests set cancellation_requested_at = null where id = p_request_id;
    insert into notifications (profile_id, type, leave_request_id, title, body)
    values (req.profile_id, 'cancellation_resolved', p_request_id, 'Zrušení zamítnuto: ' || range_txt,
      'Absence (' || coalesce(type_label, 'absence') || ', ' || range_txt || ') zůstává v platnosti, zrušení schvalovatel nepotvrdil. Pokud se vás to týká, domluvte se s ním osobně.');
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Pozvánky: kdy byla pozvánka odeslána e-mailem a kdy jí byla připomenuta (jednou).
-- ---------------------------------------------------------------------------
alter table company_invites add column if not exists invited_at timestamptz;
alter table company_invites add column if not exists reminded_at timestamptz;
