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

## 3. Vercel
1. Importujte repozitář, framework Next.js, `npm run build`.
2. `vercel.json` už obsahuje cron úlohy: `/api/cron/process` (odesílání fronty, každých 10 min) a `/api/cron/daily` (eskalace + pondělní přehled, 6:00 UTC). Na plánu Hobby jsou povoleny jen denní cron úlohy — buď upgrade, nebo volejte `/api/cron/process` z Supabase `pg_cron` + `pg_net`.

## 4. Kontrola před spuštěním
- `npm test` (jednotkové testy zůstatků, pracovních dnů, formátování) a `npm run build` musí projít.
- Ručně ověřte přihlášení, žádost → schválení → e-mail, a reset hesla na produkční doméně.
- Pravidelně zálohujte databázi (Supabase → Database → Backups).

## 5. Změny schématu
`supabase/schema.sql` je zdroj pravdy a je idempotentní. `supabase/migrations/…_baseline.sql` je jeho kopie pro `supabase db push`; další změny přidávejte jako nové očíslované soubory ve `supabase/migrations/` a do `schema.sql` je promítněte také.
