-- Appka se stěhuje z dodio-app.vercel.app na app.dodio.cz — přepsat adresu i ve stávající
-- pg_cron úloze, co odesílá frontu e-mailů (viz DEPLOY.md, "Časté odesílání fronty e-mailů zdarma").
select cron.unschedule('dodio-process-emails');

select cron.schedule(
  'dodio-process-emails',
  '*/3 * * * *',
  $$
  -- /api/cron/process je GET handler (stejně jako denní vercel.json cron) — net.http_post na něj vrací 405 a e-mail se nikdy neodešle.
  select net.http_get(
    url := 'https://app.dodio.cz/api/cron/process',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select value from system_secrets where key = 'cron_secret'))
  );
  $$
);
