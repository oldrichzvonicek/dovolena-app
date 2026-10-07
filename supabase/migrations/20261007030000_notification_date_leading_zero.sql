-- Postgres to_char(date, 'DD. MM.') dává nulu na začátku ("09. 11."), zatímco zbytek appky (JS) píše "9. 11."
-- bez ní. FM modifikátor nulu potlačí — opravuje notifikace o nové žádosti, o rozhodnutí a chat/webhook zprávy.
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
  type_key text;
  type_label text;
  type_phrase text;
  date_range text;
  mgr record;
begin
  if new.status <> 'pending' then
    return new;
  end if;

  select name, company_id into requester_name, requester_company_id from profiles where id = new.profile_id;

  select label into blackout_label
  from blackout_periods
  where company_id = requester_company_id and start_date <= new.end_date and end_date >= new.start_date
  limit 1;

  select key, label into type_key, type_label from leave_types where id = new.leave_type_id;
  date_range := case
    when new.start_date = new.end_date then to_char(new.start_date, 'FMDD. FMMM. YYYY')
    else to_char(new.start_date, 'FMDD. FMMM.') || ' – ' || to_char(new.end_date, 'FMDD. FMMM. YYYY')
  end;
  type_phrase := case
    when type_key = 'dovolena' then 'o dovolenou (' || date_range || ')'
    else '— ' || coalesce(type_label, 'absence') || ', ' || date_range || ' —'
  end;

  if blackout_label is not null then
    notif_title := '⚠️ Žádost v blokovaném termínu';
    notif_body := requester_name || ' přesto podal(a) žádost ' || type_phrase || ' v blokovaném termínu „' || blackout_label || '“. Rozhodněte prosím, zda ji schválíte.';
  else
    notif_title := case when type_key = 'dovolena' then 'Nová žádost o dovolenou' else 'Nová žádost o absenci' end;
    notif_body := requester_name || ' vám poslal(a) žádost ' || type_phrase || ' — mrkněte se na ni, až budete mít chvíli.';
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

create or replace function notify_on_leave_request_status_change()
returns trigger
language plpgsql
security definer
as $$
declare
  type_key text;
  type_label text;
  type_phrase text;
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
  type_phrase := case
    when type_key = 'dovolena' then 'o dovolenou (' || date_range || ')'
    else '— ' || coalesce(type_label, 'absence') || ', ' || date_range || ' —'
  end;

  if new.status = 'approved' then
    insert into notifications (profile_id, type, leave_request_id, title, body)
    values (new.profile_id, 'request_approved', new.id, 'Žádost schválena',
      'Vaše žádost ' || type_phrase || ' byla schválena.');
  elsif new.status = 'rejected' then
    insert into notifications (profile_id, type, leave_request_id, title, body)
    values (
      new.profile_id, 'request_rejected', new.id, 'Žádost zamítnuta',
      'Vaše žádost ' || type_phrase || ' byla zamítnuta.'
        || case when new.rejection_reason is not null and new.rejection_reason <> ''
             then ' Důvod: ' || new.rejection_reason
             else ''
           end
    );
  end if;

  return new;
end;
$$;

create or replace function queue_integration_events()
returns trigger
language plpgsql
security definer
as $$
declare
  cid uuid;
  who text;
  lt text;
  rng text;
  ev text;
  msg text;
begin
  select company_id, name into cid, who from profiles where id = new.profile_id;
  select case when hide_from_colleagues then 'absenci' else label end into lt from leave_types where id = new.leave_type_id;
  rng := case
    when new.start_date = new.end_date then to_char(new.start_date, 'FMDD. FMMM. YYYY')
    else to_char(new.start_date, 'FMDD. FMMM.') || ' – ' || to_char(new.end_date, 'FMDD. FMMM. YYYY')
  end;

  if tg_op = 'INSERT' and new.status = 'pending' then
    ev := 'request_created';
    msg := '🆕 ' || who || ' žádá o ' || lt || ' (' || rng || ')';
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status and new.status in ('approved', 'rejected') then
    ev := 'request_decided';
    msg := case when new.status = 'approved' then '✅ Schváleno: ' else '❌ Zamítnuto: ' end
      || who || ' — ' || lt || ' (' || rng || ')'
      || case when new.status = 'rejected' and coalesce(new.rejection_reason, '') <> '' then ' — důvod: ' || new.rejection_reason else '' end;
  elsif tg_op = 'UPDATE' and new.cancellation_requested_at is not null and old.cancellation_requested_at is null then
    ev := 'cancellation_requested';
    msg := '↩️ ' || who || ' žádá o zrušení absence: ' || lt || ' (' || rng || ')';
  else
    return new;
  end if;

  if cid is not null and exists (
    select 1 from webhook_integrations w
    where w.company_id = cid and w.active and ev = any(w.events)
      and company_feature(cid, case when w.provider::text = 'webhook' then 'webhooks' else 'chat_integrations' end)
  ) then
    insert into integration_outbox (company_id, event, text) values (cid, ev, msg);
  end if;
  return new;
end;
$$;
