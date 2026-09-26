# Nasazení Dodio

## 1. Supabase
1. Vytvořte projekt, v **SQL Editoru** spusťte celý `supabase/schema.sql` (jde spouštět opakovaně).
2. **Authentication → URL Configuration**: nastavte `Site URL` na produkční adresu a přidejte `https://<vaše-doména>/reset-password` do Redirect URLs.
3. **Authentication → Providers → Email**: pro ostrý provoz zapněte potvrzování e-mailů a nastavte vlastní SMTP.
4. Storage buckety (`company-logos`, `leave-attachments`, faktury) vznikají skriptem.

## 2. Proměnné prostředí (Vercel → Settings → Environment Variables)
| Proměnná | K čemu |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | klient |
| `SUPABASE_SERVICE_ROLE_KEY` | jen server (mazání uživatelů, iCal feed, cron) — nikdy nesmí do klienta |
| `APP_URL` | veřejná adresa aplikace (odkazy v e-mailech) |
| `RESEND_API_KEY` | odesílání e-mailů (resend.com); bez něj se e-maily jen řadí do fronty |
| `EMAIL_FROM` | např. `Dodio <notifikace@vase-domena.cz>` (doména musí být ověřená v Resend) |
| `NEXT_PUBLIC_SALES_EMAIL` | kam míří tlačítko „Přejít na vyšší tarif“ (mailto) |
| `CRON_SECRET` | libovolný dlouhý náhodný řetězec; Vercel ho posílá cron úlohám jako `Authorization: Bearer …` |
| `APPROVAL_TOKEN_SECRET` | min. 32 náhodných znaků; podepisuje odkazy „Schválit / Zamítnout“ v e-mailech (v produkci je povinný) |

## 3. Vercel
1. Importujte repozitář, framework Next.js, `npm run build`.
2. `vercel.json` obsahuje cron úlohy `/api/cron/process` (odesílání fronty) a `/api/cron/daily` (eskalace, pondělní přehled, změny tarifů). Nastavení je pro plán **Hobby** (každá jednou denně, 5:00 a 6:00 UTC). Pro ostrý provoz změňte `process` na `*/10 * * * *` (vyžaduje plán Pro), nebo použijte krok 3a níže (zdarma, přes Supabase).

## 3a. Časté odesílání fronty e-mailů zdarma (bez Vercel Pro)
`schema.sql` obsahuje `pg_cron` úlohu `dodio-process-emails`, která volá `/api/cron/process` každé 3 minuty přímo z databáze (Vercel Hobby dovoluje jen denní cron, což by u schvalování žádostí bylo pomalé). Adresa aplikace je v SQL napevno (`https://dodio-app.vercel.app` — při jiné doméně ji v `schema.sql` upravte), ale **tajný `CRON_SECRET` se do souboru neukládá** (ten je ve verzovaném gitu). Ukládá se do tabulky `system_secrets`, ke které se zvenčí (prohlížeč, aplikace) vůbec nedá přistoupit — čte ji jen tahle SQL úloha uvnitř databáze. (`alter database ... set` na Supabase nejde použít — SQL Editor na to nemá dost vysoká oprávnění.)

Po nahrání `schema.sql` proto v Supabase → **SQL Editor** spusťte navíc, jen jednou a ručně, se svou hodnotou `CRON_SECRET` (stejnou, jakou máte ve Vercelu):
```sql
insert into system_secrets (key, value) values ('cron_secret', 'sem vložte CRON_SECRET z Vercelu')
on conflict (key) do update set value = excluded.value;
```
Ověření, že úloha běží: `select jobid, jobname, schedule, active from cron.job;` a `select status, start_time, return_message from cron.job_run_details where jobid = (select jobid from cron.job where jobname = 'dodio-process-emails') order by start_time desc limit 5;`.

## 4. Kontrola před spuštěním
- `npm test` (jednotkové testy zůstatků, pracovních dnů, formátování) a `npm run build` musí projít.
- Ručně ověřte přihlášení, žádost → schválení → e-mail, a reset hesla na produkční doméně.
- Pravidelně zálohujte databázi (Supabase → Database → Backups).

## 5. Změny schématu
`supabase/schema.sql` je zdroj pravdy a je idempotentní. `supabase/migrations/…_baseline.sql` je jeho kopie pro `supabase db push`; další změny přidávejte jako nové očíslované soubory ve `supabase/migrations/` a do `schema.sql` je promítněte také.
