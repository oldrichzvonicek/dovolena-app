-- Plynulejší texty e-mailů/notifikací. Šlo o suché "Popisek: hodnota" věty nebo
-- vyjmenovaná fakta bez spojení do souvislé věty (viz src/lib/email-templates.ts,
-- katalog nahoře v souboru, pro kontext a víc šablon). Mění se jen text, ne logika.
-- Samostatná migrace (ne úprava schema.sql), protože schema.sql je teď sdílený se
-- souběžně rozpracovanou "super-admin" větví v jiném vlákně.

-- ---------------------------------------------------------------------------
-- notify_on_leave_request_insert — "Nová žádost o absenci" / blokovaný termín.
-- ---------------------------------------------------------------------------
create or replace function notify_on_leave_request_insert()
returns trigger
language plpgsql
security definer
as $$
declare
  requester_name text;
  requester_company_id uuid;
  blackout_label text;
  notif_title text;
  notif_body text;
  type_label text;
  date_range text;
  mgr record;
begin
  -- A row can be inserted already-approved (e.g. company-wide leave, or a
  -- seeded/imported record) — nothing is actually pending anyone's action then.
  if new.status <> 'pending' then
    return new;
  end if;

  select name, company_id into requester_name, requester_company_id from profiles where id = new.profile_id;

  -- The request form lets an employee submit anyway during a blocked period
  -- (with an explicit "odeslat i přesto" confirmation) — the approving
  -- manager needs to see that flag, not just a generic new-request notice.
  select label into blackout_label
  from blackout_periods
  where company_id = requester_company_id and start_date <= new.end_date and end_date >= new.start_date
  limit 1;

  select label into type_label from leave_types where id = new.leave_type_id;
  date_range := case
    when new.start_date = new.end_date then to_char(new.start_date, 'DD. MM. YYYY')
    else to_char(new.start_date, 'DD. MM.') || ' – ' || to_char(new.end_date, 'DD. MM. YYYY')
  end;

  if blackout_label is not null then
    notif_title := '⚠️ Žádost v blokovaném termínu';
    notif_body := requester_name || ' podal(a) žádost o absenci (' || coalesce(type_label, 'absence') || ', ' || date_range || '), i když termín spadá do blokovaného období „' || blackout_label || '“. Posuďte prosím, zda ji přesto schválíte.';
  else
    notif_title := 'Nová žádost o absenci';
    notif_body := requester_name || ' podal(a) žádost o absenci (' || coalesce(type_label, 'absence') || ', ' || date_range || ') a čeká na vaše rozhodnutí.';
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
-- notify_on_leave_request_status_change — "Žádost schválena" / "Žádost zamítnuta".
-- ---------------------------------------------------------------------------
create or replace function notify_on_leave_request_status_change()
returns trigger
language plpgsql
security definer
as $$
declare
  type_label text;
  date_range text;
begin
  if new.status = old.status then
    return new;
  end if;

  select label into type_label from leave_types where id = new.leave_type_id;
  date_range := case
    when new.start_date = new.end_date then to_char(new.start_date, 'DD. MM. YYYY')
    else to_char(new.start_date, 'DD. MM.') || ' – ' || to_char(new.end_date, 'DD. MM. YYYY')
  end;

  if new.status = 'approved' then
    insert into notifications (profile_id, type, leave_request_id, title, body)
    values (new.profile_id, 'request_approved', new.id, 'Žádost schválena',
      -- Typ se jmenuje přímo v závorce hned vedle "žádost" (ne přes obecné "absenci"), ať je hned na první
      -- pohled jasné, co bylo schváleno: dovolená / sick day / home office apod.
      'Dobrá zpráva: vaše žádost o absenci (' || coalesce(type_label, 'absence') || ', ' || date_range || ') je schválená.');
  elsif new.status = 'rejected' then
    insert into notifications (profile_id, type, leave_request_id, title, body)
    values (
      new.profile_id, 'request_rejected', new.id, 'Žádost zamítnuta',
      'Vaše žádost o absenci (' || coalesce(type_label, 'absence') || ', ' || date_range || ') bohužel nebyla schválena.'
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
-- send_vacation_reminders — hromadná připomínka nevyčerpané dovolené.
-- ---------------------------------------------------------------------------
create or replace function send_vacation_reminders(target_profile_ids uuid[])
returns int
language plpgsql
security definer
as $$
declare
  n int;
begin
  if current_user_role() is distinct from 'admin' and current_user_staff() is distinct from 'hr' then
    raise exception 'Jen admin nebo HR může odeslat hromadnou připomínku.';
  end if;

  insert into notifications (profile_id, type, title, body)
  select p.id, 'vacation_reminder',
    'Nevyčerpaná dovolená',
    'Do konce roku vám zbývá nevyčerpaná dovolená — naplánujte si ji včas, ať nepropadne.'
  from profiles p
  where p.id = any(target_profile_ids) and p.company_id = current_company_id();

  get diagnostics n = row_count;
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- request_leave_cancellation — "Žádost o zrušení absence" teď říká i typ a termín,
-- dřív schvalovatel viděl jen jméno bez kontextu, co se vlastně ruší.
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
    when req.start_date = req.end_date then to_char(req.start_date, 'DD. MM. YYYY')
    else to_char(req.start_date, 'DD. MM.') || ' – ' || to_char(req.end_date, 'DD. MM. YYYY')
  end;

  insert into notifications (profile_id, type, leave_request_id, title, body)
  select id, 'cancellation_requested', p_request_id, 'Žádost o zrušení absence',
    requester_name || ' žádá o zrušení schválené absence (' || coalesce(type_label, 'absence') || ', ' || date_range || ').'
  from profiles
  where company_id = requester_company_id and role in ('manager', 'admin') and active and id <> auth.uid();
end;
$$;

-- ---------------------------------------------------------------------------
-- join_company_by_code — "Nový uživatel čeká na schválení" teď adminovi rovnou
-- řekne, že se do schválení nikam nepřihlásí (dřív jen holá věta, že se zaregistroval).
-- ---------------------------------------------------------------------------
create or replace function join_company_by_code(p_code uuid, p_name text)
returns text
language plpgsql
security definer
set search_path = public
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
        p_name || ' (' || coalesce(caller_email, '') || ') se zaregistroval(a) přes registrační odkaz a čeká na vaše schválení. Do té doby se nepřihlásí a nic ve firmě neuvidí.');
    end loop;
  end if;

  return cname;
end;
$$;
