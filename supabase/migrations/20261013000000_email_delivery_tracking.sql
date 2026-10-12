-- E-maily: stav doručení z webhooku Resendu, seznam potlačených adres a odstup mezi opakovanými pokusy.
-- Aplikace funguje i před spuštěním této migrace (nové sloupce a tabulku zapisuje zvlášť a nezávazně).

alter table email_outbox add column if not exists resend_id text;          -- id e-mailu v Resendu (podle něj webhook najde řádek)
alter table email_outbox add column if not exists delivery_status text;    -- delivered | delayed | bounced | complained
alter table email_outbox add column if not exists delivery_at timestamptz;
alter table email_outbox add column if not exists next_attempt_at timestamptz; -- neúspěšný e-mail se zkusí znovu až potom
create index if not exists email_outbox_resend_id_idx on email_outbox (resend_id) where resend_id is not null;

-- Adresy, na které se nepíše (trvalý bounce, stížnost na spam). Čte a zapisuje jen server (service role).
create table if not exists email_suppressions (
  email text primary key,
  reason text not null check (reason in ('bounced', 'complained')),
  created_at timestamptz not null default now()
);
alter table email_suppressions enable row level security;
revoke all on email_suppressions from public, anon, authenticated;

-- Fronta: neúspěšné e-maily čekají na next_attempt_at (1. opakování hned, pak 15 min, 1 h, 4 h — viz retryDelayMinutes).
create or replace function claim_email_outbox(p_limit int default 50)
returns setof email_outbox
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with picked as (
    select id from email_outbox
    where sent_at is null and attempts < 5
      and (claimed_at is null or claimed_at < now() - interval '5 minutes')
      and (next_attempt_at is null or next_attempt_at <= now())
    order by created_at
    limit p_limit
    for update skip locked
  )
  update email_outbox o set claimed_at = now()
  from picked where o.id = picked.id
  returning o.*;
end;
$$;

revoke execute on function claim_email_outbox(int) from public, anon, authenticated;
grant execute on function claim_email_outbox(int) to service_role;

-- Přehled e-mailů firmy (jen admin): přibyly stavy delivered / bounced / complained z webhooku.
create or replace function email_log(p_limit int default 100)
returns table (id uuid, created_at timestamptz, sent_at timestamptz, to_email text, category text, subject text, attempts int, error text, status text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_user_role() is distinct from 'admin' then
    raise exception 'Přehled e-mailů vidí jen admin.';
  end if;
  return query
    select o.id, o.created_at, o.sent_at, o.to_email, o.category, o.subject, o.attempts, o.error,
           case when o.sent_at is not null and o.delivery_status in ('bounced', 'complained', 'delivered') then o.delivery_status
                when o.sent_at is not null then 'sent'
                when o.attempts >= 5 then 'failed'
                when o.error is not null then 'retrying'
                else 'pending' end
    from email_outbox o
    where o.company_id = current_company_id()
    order by o.created_at desc
    limit least(greatest(coalesce(p_limit, 100), 1), 500);
end;
$$;

-- Ruční "Poslat znovu" smaže i odstup mezi pokusy.
create or replace function retry_email(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_user_role() is distinct from 'admin' then
    raise exception 'E-maily znovu odesílá jen admin.';
  end if;
  update email_outbox set attempts = 0, error = null, claimed_at = null, next_attempt_at = null
   where id = p_id and company_id = current_company_id() and sent_at is null;
end;
$$;
