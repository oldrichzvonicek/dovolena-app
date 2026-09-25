# E-mailové šablony Dodia

Zdroj pravdy je `src/lib/email-templates.ts` (kód i testy). Tento soubor je z něj vygenerovaný. Texty jsou česky, oslovení „vy“, termín „absence“.

**Zásady**

- Do e-mailů nikdy nepíšeme zdravotní údaje. U soukromých absencí (nemoc) se typ absence uvádí jen schvalovateli, nikdy kolegům.
- Provozní a právní e-maily (pozvánky, fakturace, podmínky, smazání dat) nejdou vypnout. Upozornění na žádosti a přehledy si uživatel vypíná u zvonečku.
- Trial nemáme: tarif Free je trvale zdarma, proto neexistuje šablona „Trial končí“.

## Už dnes odchází

### Nová žádost o absenci

- **Kdy:** Zaměstnanec odešle žádost, která vyžaduje schválení.
- **Komu:** Schvalovatel (nadřízený, vedoucí / zástupce oddělení, admin)
- **Proměnné:** `{zadatel}`, `{typ}`, `{termin}`
- **Předmět (ukázka):** Nová žádost o absenci

> Petr Novák žádá o absenci: Dovolená, 12. 10. – 16. 10. 2026.
> 
> Žádost čeká na vaše schválení.
> 
> Otevřít žádosti ke schválení: https://app.dodio.cz/approvals
> 
> Tato upozornění můžete vypnout v aplikaci u zvonečku notifikací.

### Žádost v blokovaném termínu

- **Kdy:** Zaměstnanec odešle žádost i přes blokovaný termín (firemní odstávka, uzávěrka…).
- **Komu:** Schvalovatel
- **Proměnné:** `{zadatel}`, `{typ}`, `{termin}`, `{blokace}`
- **Předmět (ukázka):** ⚠️ Žádost v blokovaném termínu

> Petr Novák přesto podal(a) žádost o absenci (Dovolená, 12. 10. – 16. 10. 2026) v blokovaném termínu „Inventura“.
> 
> Rozhodněte prosím, zda ji schválíte.
> 
> Otevřít žádosti ke schválení: https://app.dodio.cz/approvals
> 
> Tato upozornění můžete vypnout v aplikaci u zvonečku notifikací.

### Žádost schválena

- **Kdy:** Schvalovatel žádost schválí (nebo se schválí automaticky).
- **Komu:** Žadatel
- **Proměnné:** `{typ}`, `{termin}`
- **Předmět (ukázka):** Žádost schválena

> Vaše žádost o absenci (Dovolená, 12. 10. – 16. 10. 2026) byla schválena.
> 
> Příjemný odpočinek!
> 
> Zobrazit moje žádosti: https://app.dodio.cz/requests
> 
> Tato upozornění můžete vypnout v aplikaci u zvonečku notifikací.

### Žádost zamítnuta

- **Kdy:** Schvalovatel žádost zamítne (důvod je povinný).
- **Komu:** Žadatel
- **Proměnné:** `{typ}`, `{termin}`, `{duvod}`
- **Předmět (ukázka):** Žádost zamítnuta

> Vaše žádost o absenci (Dovolená, 12. 10. – 16. 10. 2026) byla zamítnuta.
> 
> Důvod: V tomto týdnu je v týmu jen jeden člověk.
> 
> Můžete ji upravit a poslat znovu.
> 
> Upravit a poslat znovu: https://app.dodio.cz/requests
> 
> Tato upozornění můžete vypnout v aplikaci u zvonečku notifikací.

### Žádost o zrušení schválené absence

- **Kdy:** Zaměstnanec požádá o zrušení už schválené absence.
- **Komu:** Schvalovatel
- **Proměnné:** `{zadatel}`, `{typ}`, `{termin}`
- **Předmět (ukázka):** Žádost o zrušení absence

> Petr Novák žádá o zrušení schválené absence: Dovolená, 12. 10. – 16. 10. 2026.
> 
> Rozhodnout o zrušení: https://app.dodio.cz/dashboard
> 
> Tato upozornění můžete vypnout v aplikaci u zvonečku notifikací.

### Zrušení absence vyřízeno

- **Kdy:** Schvalovatel schválí nebo zamítne zrušení.
- **Komu:** Žadatel
- **Proměnné:** `{vysledek}`
- **Předmět (ukázka):** Zrušení schváleno

> Vaše absence byla zrušena.
> 
> Zobrazit moje žádosti: https://app.dodio.cz/requests
> 
> Tato upozornění můžete vypnout v aplikaci u zvonečku notifikací.

### Žádost čeká — zastupujete schvalovatele

- **Kdy:** Žádost čeká déle než nastavená doba nebo je schvalovatel dnes nepřítomen (denní kontrola).
- **Komu:** Zástupce vedoucího oddělení, případně admini
- **Proměnné:** `{zadatel}`, `{typ}`, `{duvod}`
- **Předmět (ukázka):** Žádost čeká na schválení

> Petr Novák — Dovolená (V tomto týdnu je v týmu jen jeden člověk.). Zastupujete schvalovatele.
> 
> Otevřít žádosti ke schválení: https://app.dodio.cz/approvals
> 
> Tato upozornění můžete vypnout v aplikaci u zvonečku notifikací.

### Týdenní přehled absencí

- **Kdy:** Každé pondělí ráno.
- **Komu:** Manažeři a admini
- **Proměnné:** `{jmeno}`, `{cekajici}`, `{pocet}`, `{seznam}`
- **Předmět (ukázka):** Týdenní přehled absencí — Dodio

> Dobré ráno Jano,
> 
> zde je přehled na tento týden.
> 
> Čeká na schválení: 2
> Absence tento týden: 5
> 
> • Petr Novák — Dovolená (12. 10. – 16. 10.)
> 
> Otevřít kalendář: https://app.dodio.cz/calendar
> 
> Tato upozornění můžete vypnout v aplikaci u zvonečku notifikací.

### Týdenní přehled pro HR

- **Kdy:** Každé pondělí ráno, jen když je co řešit (riziko podkapacity, žádosti čekající déle, dovolená, která propadne).
- **Komu:** Admini a lidé s rolí HR
- **Proměnné:** `{cekajici}`, `{seznam}`
- **Předmět (ukázka):** Týdenní přehled pro HR — Dodio

> Dobré ráno,
> 
> zde je týdenní přehled pro HR.
> 
> • Obchod — týden od 2. 11.: chybí 2 z 5 (40 %)
> 
> Žádosti čekající na schválení: 2
> 
> Otevřít Analytiku: https://app.dodio.cz/admin/overview
> 
> Tato upozornění můžete vypnout v aplikaci u zvonečku notifikací.

### Nevyčerpaná dovolená

- **Kdy:** HR nebo admin pošle hromadnou připomínku (Analytika → Nevyčerpaná dovolená).
- **Komu:** Vybraní zaměstnanci
- **Proměnné:** —
- **Předmět (ukázka):** Nevyčerpaná dovolená

> Do konce roku vám zbývá nevyčerpaná dovolená.
> 
> Naplánujte si ji včas, ať vám nepropadne.
> 
> Naplánovat dovolenou: https://app.dodio.cz/calendar
> 
> Tato upozornění můžete vypnout v aplikaci u zvonečku notifikací.

### Připomínka delší dovolené

- **Kdy:** Manažer klikne na „Připomenout“ u člověka, který dlouho nečerpal delší dovolenou.
- **Komu:** Zaměstnanec
- **Proměnné:** —
- **Předmět (ukázka):** Čas na pořádný odpočinek

> Už dlouho jste si nevzali delší dovolenou.
> 
> Naplánujte si prosím odpočinek — dobře si ho zasloužíte.
> 
> Naplánovat dovolenou: https://app.dodio.cz/calendar
> 
> Tato upozornění můžete vypnout v aplikaci u zvonečku notifikací.

### Nový uživatel čeká na schválení

- **Kdy:** Někdo se zaregistruje přes registrační odkaz a firma vyžaduje schválení.
- **Komu:** Admini
- **Proměnné:** `{jmeno}`, `{email}`
- **Předmět (ukázka):** Nový uživatel čeká na schválení

> Jano (jana@firma.cz) se zaregistroval(a) přes registrační odkaz.
> 
> Do schválení se dotyčný nepřihlásí a nic ve firmě neuvidí.
> 
> Schválit nebo odmítnout: https://app.dodio.cz/admin/settings?sekce=users
> 
> Tato upozornění můžete vypnout v aplikaci u zvonečku notifikací.

### Nový dotaz z Nápovědy

- **Kdy:** Někdo pošle dotaz přes „Napsat na podporu“ v Nápovědě.
- **Komu:** Manažeři a admini firmy
- **Proměnné:** `{jmeno}`, `{dotaz}`
- **Předmět (ukázka):** Dotaz od Jano

> Jano se ptá:
> 
> Jak si mám zapsat půlden?
> 
> Tato upozornění můžete vypnout v aplikaci u zvonečku notifikací.

## Připraveno k zapojení

### Blíží se propadnutí převedené dovolené

- **Kdy:** 30 a 7 dní před datem propadnutí převedené dovolené (nastavení: Provoz & kalendář).
- **Komu:** Zaměstnanec s nevyčerpanou převedenou dovolenou
- **Proměnné:** `{jmeno}`, `{dny}`, `{datum}`
- **Předmět (ukázka):** Převedená dovolená propadne 31. 3. 2027

> Dobrý den Jano,
> 
> z minulého roku vám zbývá 3 dní dovolené, které propadnou 31. 3. 2027.
> 
> Vyčerpejte je prosím včas.
> 
> Naplánovat dovolenou: https://app.dodio.cz/calendar
> 
> Tato upozornění můžete vypnout v aplikaci u zvonečku notifikací.

### Vítejte v Dodio (zakladatel firmy)

- **Kdy:** Po založení firmy.
- **Komu:** Nový admin
- **Proměnné:** `{jmeno}`, `{firma}`
- **Předmět (ukázka):** Vítejte v Dodio

> Dobrý den Jano,
> 
> firma NaturaMed s.r.o. je založená a můžete začít. Na nástěnce najdete průvodce „Začínáme“: doplňte údaje o firmě, vytvořte oddělení, pozvěte kolegy a zkontrolujte pravidla absencí.
> 
> Když si nebudete vědět rady, v Centru nápovědy najdete postupy krok za krokem.
> 
> Pokračovat v nastavení: https://app.dodio.cz/dashboard
> 
> Tento e-mail je provozní a nelze ho vypnout. Dodio — správa firemních absencí na pár kliknutí.

### Vítejte v Dodio (zaměstnanec)

- **Kdy:** Po připojení k firmě (pozvánkou nebo odkazem) a schválení účtu.
- **Komu:** Nový zaměstnanec
- **Proměnné:** `{jmeno}`, `{firma}`
- **Předmět (ukázka):** Vítejte v NaturaMed s.r.o. na Dodiu

> Dobrý den Jano,
> 
> váš účet ve firmě NaturaMed s.r.o. je připravený. V Dodiu požádáte o dovolenou, uvidíte kolegy v týmovém kalendáři a sledujete svůj zůstatek.
> 
> Žádost o absenci podáte jedním kliknutím na tlačítko „Nová žádost“.
> 
> Otevřít Dodio: https://app.dodio.cz/dashboard
> 
> Tento e-mail je provozní a nelze ho vypnout. Dodio — správa firemních absencí na pár kliknutí.

### Pozvánka do firmy

- **Kdy:** Admin nebo HR pozve člověka e-mailem.
- **Komu:** Zvaný
- **Proměnné:** `{jmeno}`, `{pozvatel}`, `{firma}`, `{odkaz}`
- **Předmět (ukázka):** Oldřich Zvoníček vás zve do Dodia (NaturaMed s.r.o.)

> Dobrý den Jano,
> 
> Oldřich Zvoníček vás zve do firmy NaturaMed s.r.o. v aplikaci Dodio pro správu absencí.
> 
> Zaregistrujte se prosím na odkazu níže stejným e-mailem, na který jste pozvánku dostali. Nováčky zařadíme do firmy automaticky.
> 
> Přijmout pozvánku: https://app.dodio.cz/login
> 
> Tento e-mail je provozní a nelze ho vypnout. Dodio — správa firemních absencí na pár kliknutí.

### Váš účet byl schválen

- **Kdy:** Admin schválí registraci z odkazu.
- **Komu:** Nový zaměstnanec
- **Proměnné:** `{jmeno}`, `{firma}`
- **Předmět (ukázka):** Váš účet ve firmě NaturaMed s.r.o. byl schválen

> Dobrý den Jano,
> 
> správce firmy NaturaMed s.r.o. schválil vaši registraci. Nyní se můžete přihlásit.
> 
> Přihlásit se: https://app.dodio.cz/login
> 
> Tento e-mail je provozní a nelze ho vypnout. Dodio — správa firemních absencí na pár kliknutí.

### Blízko limitu tarifu (90 %)

- **Kdy:** Počet uživatelů dosáhne 90 % limitu tarifu.
- **Komu:** Admini
- **Proměnné:** `{jmeno}`, `{tarif}`, `{pocet}`, `{limit}`, `{dalsi_tarif}`
- **Předmět (ukázka):** Blížíte se limitu tarifu Starter

> Dobrý den Jano,
> 
> ve firmě máte 5 z 15 uživatelů, které zahrnuje tarif Starter.
> 
> Po dosažení limitu nepůjde přidat další lidi. Doporučujeme přejít na tarif Pro.
> 
> Porovnat tarify: https://app.dodio.cz/admin/settings?sekce=billing
> 
> Tento e-mail je provozní a nelze ho vypnout. Dodio — správa firemních absencí na pár kliknutí.

### Limit tarifu překročen

- **Kdy:** Počet uživatelů překročí limit tarifu.
- **Komu:** Admini
- **Proměnné:** `{jmeno}`, `{tarif}`, `{pocet}`, `{limit}`
- **Předmět (ukázka):** Limit tarifu Starter je překročen

> Dobrý den Jano,
> 
> ve firmě máte 5 uživatelů, tarif Starter jich zahrnuje 15.
> 
> Aby bylo možné přidávat další lidi, vyberte prosím vyšší tarif.
> 
> Zvolit tarif: https://app.dodio.cz/admin/settings?sekce=billing
> 
> Tento e-mail je provozní a nelze ho vypnout. Dodio — správa firemních absencí na pár kliknutí.

### Faktura vystavena

- **Kdy:** Po vystavení faktury.
- **Komu:** E-mail pro faktury (Fakturace → Fakturační údaje)
- **Proměnné:** `{cislo}`, `{castka}`, `{splatnost}`
- **Předmět (ukázka):** Faktura 2026-014 — Dodio

> Dobrý den,
> 
> vystavili jsme fakturu 2026-014 na částku 5 900 Kč. Splatnost: 15. 10. 2026.
> 
> Fakturu najdete v archivu faktur v aplikaci.
> 
> Otevřít archiv faktur: https://app.dodio.cz/admin/settings?sekce=billing
> 
> Tento e-mail je provozní a nelze ho vypnout. Dodio — správa firemních absencí na pár kliknutí.

### Upomínka k platbě (+3 dny po splatnosti)

- **Kdy:** 3 dny po splatnosti nezaplacené faktury.
- **Komu:** E-mail pro faktury
- **Proměnné:** `{cislo}`, `{castka}`, `{splatnost}`
- **Předmět (ukázka):** Připomínka platby faktury 2026-014

> Dobrý den,
> 
> evidujeme nezaplacenou fakturu 2026-014 na 5 900 Kč, splatnou 15. 10. 2026.
> 
> Pokud jste už zaplatili, tento e-mail prosím ignorujte. Děkujeme.
> 
> Zobrazit fakturu: https://app.dodio.cz/admin/settings?sekce=billing
> 
> Tento e-mail je provozní a nelze ho vypnout. Dodio — správa firemních absencí na pár kliknutí.

### Upomínka k platbě (+7 dní po splatnosti)

- **Kdy:** 7 dní po splatnosti.
- **Komu:** E-mail pro faktury
- **Proměnné:** `{cislo}`, `{castka}`, `{splatnost}`
- **Předmět (ukázka):** Faktura 2026-014 je po splatnosti

> Dobrý den,
> 
> faktura 2026-014 na 5 900 Kč je 7 dní po splatnosti (15. 10. 2026).
> 
> Uhraďte ji prosím co nejdříve, aby nedošlo k omezení služby. Kdyby byl s platbou problém, odpovězte na tento e-mail.
> 
> Zobrazit fakturu: https://app.dodio.cz/admin/settings?sekce=billing
> 
> Tento e-mail je provozní a nelze ho vypnout. Dodio — správa firemních absencí na pár kliknutí.

### Upomínka k platbě (+14 dní po splatnosti)

- **Kdy:** 14 dní po splatnosti.
- **Komu:** E-mail pro faktury a admini
- **Proměnné:** `{cislo}`, `{castka}`, `{splatnost}`, `{datum_omezeni}`
- **Předmět (ukázka):** Poslední upomínka: faktura 2026-014

> Dobrý den,
> 
> faktura 2026-014 na 5 900 Kč je 14 dní po splatnosti (15. 10. 2026).
> 
> Pokud nebude uhrazena do 6. 11. 2026, přejde firma na tarif Free a nadlimitní funkce se omezí. Vaše data zůstanou zachována.
> 
> Zobrazit fakturu: https://app.dodio.cz/admin/settings?sekce=billing
> 
> Tento e-mail je provozní a nelze ho vypnout. Dodio — správa firemních absencí na pár kliknutí.

### Nová verze podmínek

- **Kdy:** Po nahrání nové verze obchodních podmínek nebo zásad zpracování údajů.
- **Komu:** Admini (a případně všichni uživatelé u změny zásad ochrany údajů)
- **Proměnné:** `{jmeno}`, `{dokument}`, `{od_data}`, `{odkaz}`
- **Předmět (ukázka):** Aktualizace dokumentu: Obchodní podmínky

> Dobrý den Jano,
> 
> aktualizovali jsme dokument „Obchodní podmínky“. Nová verze platí od 1. 11. 2026.
> 
> Co se změnilo, najdete v přehledu změn na odkazu níže. Pokud nesouhlasíte, můžete službu do data účinnosti ukončit.
> 
> Přečíst novou verzi: https://app.dodio.cz/help
> 
> Tento e-mail je provozní a nelze ho vypnout. Dodio — správa firemních absencí na pár kliknutí.

### Smazání dat naplánováno

- **Kdy:** Po požadavku na smazání dat firmy nebo účtu.
- **Komu:** Žadatel (admin)
- **Proměnné:** `{jmeno}`, `{firma}`, `{datum}`
- **Předmět (ukázka):** Smazání dat bylo naplánováno

> Dobrý den Jano,
> 
> přijali jsme žádost o smazání dat firmy NaturaMed s.r.o.. Data budou nenávratně smazána dne 31. 3. 2027.
> 
> Do tohoto data můžete žádost zrušit v aplikaci. Před smazáním si můžete stáhnout exporty (Exporty → CSV / XLSX).
> 
> Zrušit smazání: https://app.dodio.cz/admin/settings?sekce=billing
> 
> Tento e-mail je provozní a nelze ho vypnout. Dodio — správa firemních absencí na pár kliknutí.

### Data byla smazána

- **Kdy:** Po provedení výmazu.
- **Komu:** Žadatel (admin)
- **Proměnné:** `{jmeno}`, `{firma}`, `{datum}`
- **Předmět (ukázka):** Data byla smazána

> Dobrý den Jano,
> 
> potvrzujeme, že data firmy NaturaMed s.r.o. byla dne 31. 3. 2027 nenávratně smazána včetně všech účtů, absencí a nastavení.
> 
> Zálohy se mažou v rámci běžného cyklu do 30 dnů. Děkujeme, že jste Dodio používali.
> 
> Tento e-mail je provozní a nelze ho vypnout. Dodio — správa firemních absencí na pár kliknutí.

### Integrace do chatu nefunguje

- **Kdy:** Odeslání do Slacku / Teams selže opakovaně (např. smazaný webhook).
- **Komu:** Admini
- **Proměnné:** `{jmeno}`, `{integrace}`, `{chyba}`
- **Předmět (ukázka):** Integrace „#absence“ nefunguje

> Dobrý den Jano,
> 
> zprávy do kanálu „#absence“ se nedaří odeslat (HTTP 404).
> 
> Nejčastěji byl webhook smazán nebo vypnut. Vytvořte prosím nový a vložte jeho adresu do integrace.
> 
> Otevřít integrace: https://app.dodio.cz/admin/settings?sekce=integrations
> 
> Tento e-mail je provozní a nelze ho vypnout. Dodio — správa firemních absencí na pár kliknutí.

## Systémové e-maily Supabase (potvrzení e-mailu, obnovení hesla, změna e-mailu)

Vkládají se v Supabase: **Authentication → Emails → Templates**. HTML je ve složce `supabase/email-templates/`, předměty jsou níže.

- **Confirm sign up** — soubor `confirm-signup.html`, předmět: „Potvrďte svůj e-mail — Dodio“
- **Reset password** — soubor `recovery.html`, předmět: „Obnovení hesla — Dodio“
- **Change email address** — soubor `email-change.html`, předmět: „Potvrďte změnu e-mailu — Dodio“

Šablony „Magic link“, „Invite user“ a „Reauthentication“ Dodio nepoužívá, nechte výchozí.
