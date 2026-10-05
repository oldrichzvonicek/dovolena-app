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

## 6. Super-admin (interní nástroj provozovatele)
Kód: `src/app/(platform)`, `src/app/api/platform`, `src/server/platform`, `src/components/platform` (zákaznická část ho neimportuje, hlídá to ESLint). Návrh je v dokumentu „Dodio Super-admin – technická dokumentace BE“, tady je fáze 1: přihlášení s povinným TOTP, přehled a KPI, firmy, změna tarifu a platnosti, faktury a „Označit jako zaplaceno“, poznámky, audit log a admin tým.

**Zprovoznění (jednou):**
1. V Supabase → **SQL Editor** spusťte `supabase/migrations/20260928000000_platform_phase1.sql` (je i na konci `schema.sql`, jde spouštět opakovaně). Přidá tabulky `platform_*`, `payments`, sloupce `companies.status` a další a rozšíří `company_invoices`.
2. Založte prvního admina (v adresáři projektu, potřebuje `.env.local`):
   ```
   npx tsx scripts/create-platform-admin.ts vas@email.cz --role super_admin --name "Vaše Jméno"
   ```
   Heslo se vypíše jednou do terminálu (nebo ho zadejte přes `PLATFORM_ADMIN_PASSWORD`). Nepoužívejte e-mail, který je uživatelem některé firmy.
3. `npm run dev` a otevřete **http://admin.localhost:3000**. Při prvním přihlášení naskenujete QR kód v autentizační aplikaci (TOTP je povinné).

**Adresy:** `src/middleware.ts` pozná admina podle hostu (`PLATFORM_HOSTS`, výchozí `admin.localhost,admin.dodio.cz`). Na těchto hostech se cesty přepisují do `/platform/…`; na všech ostatních jsou `/platform` a `/api/platform` 404. Přihlášení do adminu a do aplikace se tak nesdílí (různé cookies).

**Ostrý provoz:** samostatný Vercel projekt ze stejného repozitáře s doménou `admin.dodio.cz` a vlastními proměnnými prostředí (`SUPABASE_SERVICE_ROLE_KEY` atd.). Další admin účty přidávejte stejným skriptem. Časové limity relace (30 min nečinnosti, 12 h) hlídá aplikace sama (`platform_admin_sessions`).

### 6a. Fáze 2 a 3 (pozastavení a mazání firem, export, GDPR, ceník, upomínky, náhled firmy)
1. V SQL Editoru spusťte `supabase/migrations/20260929000000_platform_phase2_3.sql` (je i na konci `schema.sql`). Bez ní stránky Firmy a Přehled nefungují (chybí nové sloupce). Migrace mimo jiné upraví `current_company_id()`: firma ke smazání ztratí přístup k datům, pozastavená firma je jen pro čtení (trigger `guard_company_writable`). Po nasazení proveďte `npx tsx scripts/permission-matrix.ts`.
2. Dlouhé operace (export, definitivní smazání, uvolnění zamčené ceny) běží přes frontu `platform_jobs`. Lokálně je zpracujete tlačítkem **Spustit teď** na stránce Úlohy (spustí i upomínky po splatnosti). Na ostrém provozu je volá plánovač na `GET /api/cron/platform-jobs` s hlavičkou `Authorization: Bearer <CRON_SECRET>`. Vercel Hobby má nejvýš 2 cron úlohy, proto použijte `pg_cron` (po nasazení adminu na `admin.dodio.cz`):
   ```sql
   select cron.schedule('dodio-platform-jobs', '*/5 * * * *', $$
     select net.http_get(
       url := 'https://admin.dodio.cz/api/cron/platform-jobs',
       headers := jsonb_build_object('Authorization', 'Bearer ' || (select value from system_secrets where key = 'cron_secret'))
     );
   $$);
   ```
3. Smazání firmy: 30 dní ochranná lhůta, potom se smažou všichni uživatelé (přes Auth API), firemní tabulky a soubory; zůstane „náhrobek“ s fakturami, platbami a auditem. Seznam mazaných tabulek hlídá test `src/server/platform/purge-coverage.test.ts`: přidáte-li tabulku se sloupcem `company_id`, přidejte ji do `platform_purge_company` (nebo do seznamu ponechávaných).
4. Náhled firmy (impersonace) je jen pro čtení a nese se na serveru (service role), ne jako přihlášení za uživatele; typ nemoci se nikdy nezobrazí.
5. Ceník: ceny bere aplikace z tabulky `plans` (při startu přepíše hodnoty z `src/lib/plans.ts`). Firmy se zamčenou původní cenou platí starou cenu na fakturách, ale v zákaznické aplikaci vidí aktuální ceník.
6. Souhlasy (`consents`): aplikace je zatím nesbírá, obrazovka Právní dokumenty ukazuje nuly.
