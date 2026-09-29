-- Když se o žádosti rozhodne (schválení/zamítnutí), zmizí i její "Nová žádost o absenci" notifikace,
-- pokud ji ještě někdo nestihl přečíst. Dřív zůstávala nepřečtená a zvýrazněná i poté, co ji vyřídil
-- jiný schvalovatel (např. další admin) — vypadalo to, že pořád čeká, i když už bylo hotovo.

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

  -- Zamítnutí i schválení zruší i pořád nepřečtenou "Nová žádost o absenci" notifikaci u všech
  -- schvalovatelů, kterým se poslala (jde-li o víc adminů, ne jen jednoho nadřízeného) — jinak by
  -- jim dál svítila jako čekající, i když o žádosti mezitím rozhodl někdo jiný.
  update notifications
  set read_at = coalesce(read_at, now())
  where leave_request_id = new.id and type = 'request_created' and read_at is null;

  return new;
end;
$$;
