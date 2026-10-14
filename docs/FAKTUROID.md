# Automatické fakturování přes Fakturoid

Dodio vystavuje faktury placeným firmám samo a platby přijímá webhookem. Bez proměnných níže je integrace vypnutá a nic se nevolá.

## Nastavení (jednorázově)
Ve Vercelu (Settings → Environment Variables):

| Proměnná | Hodnota |
|---|---|
| `FAKTUROID_ACCOUNT` | část adresy účtu, `app.fakturoid.cz/<ACCOUNT>` |
| `FAKTUROID_CLIENT_ID` | Fakturoid → Nastavení → Uživatelský účet → API |
| `FAKTUROID_CLIENT_SECRET` | totéž místo |
| `BILLING_BANK_ACCOUNT` | volitelné; výchozí `8180385003/5500 (Raiffeisenbank)` |

Webhook `invoice_paid` si Dodio při prvním běhu zaregistruje samo (`/api/webhooks/fakturoid`), tajný token se odvozuje z client secretu.

## Co se děje
1. Plánovač super-adminu (`/api/cron/platform-jobs`, každých pár minut) pro každou aktivní, ne-testovací firmu s placeným tarifem:
   - zkontroluje, že za období ještě není faktura a že firma nemá jinou nezaplacenou,
   - týden před koncem `plan_paid_until` (nebo hned, když není nastavený) vystaví ve Fakturoidu fakturu na další období (cena z ceníku, po slevě),
   - uloží PDF, zapíše fakturu a pošle zákazníkovi e-mail s číslem účtu, VS a odkazem na PDF.
2. Fakturoid spáruje platbu z banky a zavolá webhook → faktura se uzavře, prodlouží se tarif, případně se obnoví pozastavený účet.

## Pojistky
- max. 25 faktur na jeden běh,
- bez vyplněných fakturačních údajů firmy (název) se nefakturuje,
- jedna faktura na firmu a období (unikátní index + `custom_id` ve Fakturoidu),
- firmy označené jako testovací se nefakturují.
