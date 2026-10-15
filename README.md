# Dodio (dovolena-app)

Česká aplikace pro evidenci dovolených a absencí ve firmách: žádosti a schvalování (i jedním klikem z e-mailu),
týmový kalendář, nároky a zůstatky, mzdové podklady a exporty, nastavení firmy, historie změn, tarify s fakturací
přes Fakturoid, iCal a webhooky (Slack). Provozovatel má vlastní super-admin rozhraní (`/platform`, `admin.dodio.cz`).

Stack: Next.js 15 (App Router), React 19, Tailwind, Supabase (Postgres, Auth, Storage, RLS), Resend pro e-maily,
Sentry pro sledování chyb, nasazení na Vercel.

## Vývoj

```bash
npm install
npm run dev
```

Proměnné prostředí (do `.env.local`) jsou popsané v [DEPLOY.md](DEPLOY.md), minimum jsou ty pro Supabase.

- `npm test`: jednotkové testy (Vitest)
- `npm run lint`, `npm run build`: totéž, co spouští CI (`.github/workflows/ci.yml`) u každého pushe a PR

## Kde co je

- `src/app/(app)`: aplikace pro firmy, `src/app/(platform)`: super-admin, `src/app/api`: API a cron úlohy
- `src/lib`: doménová logika (pracovní dny a svátky, zůstatky, e-mailové šablony, fakturace) s testy vedle souborů
- `supabase/schema.sql`: zdroj pravdy pro databázi, `supabase/migrations/`: změny pro `supabase db push`
- `docs/`: bezpečnost dat, e-mailové šablony, Fakturoid, podmínky tarifů

## Nasazení

Postup, proměnné prostředí a kontrola před spuštěním jsou v [DEPLOY.md](DEPLOY.md).

Pozor: `xlsx` se instaluje z CDN SheetJS (`cdn.sheetjs.com`), protože na npm je jen stará verze se známými
zranitelnostmi. Prostředí, které tu doménu blokuje, instalaci nedokončí.
