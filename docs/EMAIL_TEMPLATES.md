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
- **Proměnné:** `{zadatel}`, `{typ}`, `{termin}`, `{pocet_dnu}`, `{kolegove}`
- **Předmět (ukázka):** Nová žádost: Petr Novák, Dovolená

> Petr Novák žádá o absenci (Dovolená, 12. 10. – 16. 10. 2026, 5 pracovních dnů). Ve stejném termínu chybí z jeho oddělení ještě 1 kolega. Rozhodnout můžete jedním kliknutím.
> 
> Otevřít žádosti ke schválení: https://app.dodio.cz/approvals
> 
> Tato upozornění můžete vypnout v aplikaci u zvonečku notifikací.

### Žádost v blokovaném termínu

- **Kdy:** Zaměstnanec odešle žádost i přes blokovaný termín (firemní odstávka, uzávěrka…).
- **Komu:** Schvalovatel
- **Proměnné:** `{zadatel}`, `{typ}`, `{termin}`, `{pocet_dnu}`, `{blokace}`, `{kolegove}`
- **Předmět (ukázka):** Žádost v blokovaném termínu: Petr Novák

> Petr Novák žádá o absenci (Dovolená, 12. 10. – 16. 10. 2026, 5 pracovních dnů), i když termín spadá do blokovaného období „Inventura“. Posuďte prosím, zda ji přesto schválíte. Ve stejném termínu chybí z jeho oddělení ještě 1 kolega.
> 
> Otevřít žádosti ke schválení: https://app.dodio.cz/approvals
> 
> Tato upozornění můžete vypnout v aplikaci u zvonečku notifikací.

### Žádost schválena

- **Kdy:** Schvalovatel žádost schválí (při automatickém schválení se místo jména schvalovatele napíše, že se schválila podle pravidel firmy).
- **Komu:** Žadatel
- **Proměnné:** `{jmeno}`, `{typ}`, `{termin}`, `{pocet_dnu}`, `{schvalovatel}`, `{zastup}`
- **Předmět (ukázka):** Dovolená schválena: 12. 10. – 16. 10. 2026

> Jano, vaše žádost (Dovolená, 12. 10. – 16. 10. 2026, 5 pracovních dnů) je schválená — potvrdil(a) ji Jana Malá. Zastupovat vás bude Karel Beneš. Termín už máte v týmovém kalendáři.
> 
> Zobrazit moje žádosti: https://app.dodio.cz/requests
> 
> Tato upozornění můžete vypnout v aplikaci u zvonečku notifikací.

### Žádost zamítnuta

- **Kdy:** Schvalovatel žádost zamítne (důvod je povinný).
- **Komu:** Žadatel
- **Proměnné:** `{typ}`, `{termin}`, `{duvod}`, `{schvalovatel}`
- **Předmět (ukázka):** Žádost zamítnuta: Dovolená, 12. 10. – 16. 10. 2026

> Žádost (Dovolená, 12. 10. – 16. 10. 2026) bohužel nebyla schválena — rozhodl(a) Jana Malá. Důvod: „V tomto týdnu je v týmu jen jeden člověk.“. Můžete ji upravit (třeba posunout termín) a poslat znovu, nebo se s rozhodujícím domluvit osobně.
> 
> Upravit a poslat znovu: https://app.dodio.cz/requests
> 
> Tato upozornění můžete vypnout v aplikaci u zvonečku notifikací.

### Žádost o zrušení schválené absence

- **Kdy:** Zaměstnanec požádá o zrušení už schválené absence.
- **Komu:** Schvalovatel
- **Proměnné:** `{zadatel}`, `{typ}`, `{termin}`
- **Předmět (ukázka):** Žádost o zrušení: Petr Novák

> Petr Novák už nepotřebuje schválenou absenci (Dovolená, 12. 10. – 16. 10. 2026) a žádá o její zrušení. Do vašeho rozhodnutí absence platí dál a dny zůstávají vyčerpané.
> 
> Rozhodnout o zrušení: https://app.dodio.cz/dashboard
> 
> Tato upozornění můžete vypnout v aplikaci u zvonečku notifikací.

### Zrušení absence vyřízeno

- **Kdy:** Schvalovatel schválí nebo zamítne zrušení.
- **Komu:** Žadatel
- **Proměnné:** `{vysledek}`, `{typ}`, `{termin}`
- **Předmět (ukázka):** Zrušení schváleno: 12. 10. – 16. 10. 2026

> Absence (Dovolená, 12. 10. – 16. 10. 2026) je zrušená a dny se vám vrátily do zůstatku. Kdyby se plány změnily, stačí podat novou žádost.
> 
> Zobrazit moje žádosti: https://app.dodio.cz/requests
> 
> Tato upozornění můžete vypnout v aplikaci u zvonečku notifikací.

### Žádost čeká — zastupujete schvalovatele

- **Kdy:** Žádost čeká déle než nastavená doba nebo je schvalovatel dnes nepřítomen (denní kontrola).
- **Komu:** Zástupce vedoucího oddělení, případně admini
- **Proměnné:** `{zadatel}`, `{typ}`, `{termin}`, `{schvalovatel}`, `{duvod}`
- **Předmět (ukázka):** Žádost čeká na vás: Petr Novák

> Petr Novák žádá o absenci (Dovolená, 12. 10. – 16. 10. 2026) a odpověď zatím nedostal(a). Zastupujete Jana Malá (V tomto týdnu je v týmu jen jeden člověk.), takže rozhodnout můžete vy.
> 
> Otevřít žádosti ke schválení: https://app.dodio.cz/approvals
> 
> Tato upozornění můžete vypnout v aplikaci u zvonečku notifikací.

### Připomínka schvalovateli

- **Kdy:** Žádost čeká na rozhodnutí déle než den (jednou; denní kontrola). Eskalace na zástupce (tarif Pro) přichází až později.
- **Komu:** Schvalovatel
- **Proměnné:** `{zadatel}`, `{typ}`, `{termin}`
- **Předmět (ukázka):** Připomínka: žádost od Petr Novák čeká na vás

> Petr Novák žádá o absenci (Dovolená, 12. 10. – 16. 10. 2026) už déle než den a zatím se nikdo nevyjádřil. Stačí jedno kliknutí. Schválit nebo zamítnout můžete i přímo z tohoto e-mailu.
> 
> Otevřít žádosti ke schválení: https://app.dodio.cz/approvals
> 
> Tato upozornění můžete vypnout v aplikaci u zvonečku notifikací.

### Zastupujete kolegu

- **Kdy:** Žádost se schválí a jako zástup je uvedený jiný kolega.
- **Komu:** Zastupující kolega
- **Proměnné:** `{zadatel}`, `{termin}`
- **Předmět (ukázka):** Petr Novák vás bude mít jako zástup

> Petr Novák bude nepřítomen(a) 12. 10. – 16. 10. 2026 a jako zástup je uvedeno vaše jméno. Předat si agendu můžete s předstihem, ať to nezůstane na poslední chvíli.
> 
> Otevřít kalendář: https://app.dodio.cz/calendar
> 
> Tato upozornění můžete vypnout v aplikaci u zvonečku notifikací.

### Týdenní přehled absencí

- **Kdy:** Každé pondělí ráno. Kdo je zároveň admin nebo HR, dostane pod týdenním přehledem i HR část v jednom e-mailu (ne dva zvlášť).
- **Komu:** Manažeři a admini
- **Proměnné:** `{jmeno}`, `{cekajici}`, `{pocet}`, `{seznam}`
- **Předmět (ukázka):** Týdenní přehled absencí — Dodio

> Dobré ráno Jano,
> 
> na schválení čeká 2 žádostí a tento týden chybí 5 lidí. Kdo a kdy:
> 
> • Petr Novák — Dovolená (12. 10. – 16. 10.)
> • Jana Malá — Sick Day (13. 10. 2026)
> • Karel Beneš — Home Office (14. 10. – 15. 10.)
> 
> Otevřít kalendář: https://app.dodio.cz/calendar
> 
> Tato upozornění můžete vypnout v aplikaci u zvonečku notifikací.

### Týdenní přehled pro HR

- **Kdy:** Každé pondělí ráno, jen když je co řešit (riziko podkapacity, žádosti čekající déle, dovolená, která propadne). Příjemcům, kteří dostávají i týdenní přehled pro manažery, se přidá pod něj.
- **Komu:** Admini a lidé s rolí HR
- **Proměnné:** `{cekajici}`, `{seznam}`
- **Předmět (ukázka):** Týdenní přehled pro HR — Dodio

> Dobré ráno,
> 
> tady je týdenní přehled pro HR.
> 
> Riziko podkapacity v nejbližších týdnech:
> 
> • Petr Novák — Dovolená (12. 10. – 16. 10.)
> • Jana Malá — Sick Day (13. 10. 2026)
> • Karel Beneš — Home Office (14. 10. – 15. 10.)
> 
> Řešení trvalo déle než obvykle u 2 čekajících žádostí.
> 
> Otevřít Analytiku: https://app.dodio.cz/admin/overview
> 
> Tato upozornění můžete vypnout v aplikaci u zvonečku notifikací.

### Nevyčerpaná dovolená

- **Kdy:** HR nebo admin pošle hromadnou připomínku (Analytika → Nevyčerpaná dovolená).
- **Komu:** Vybraní zaměstnanci
- **Proměnné:** žádné
- **Předmět (ukázka):** Nevyčerpaná dovolená

> Do konce roku vám zbývá nevyčerpaná dovolená — naplánujte si ji včas, ať nepropadne.
> 
> Naplánovat dovolenou: https://app.dodio.cz/calendar
> 
> Tato upozornění můžete vypnout v aplikaci u zvonečku notifikací.

### Připomínka delší dovolené

- **Kdy:** Manažer klikne na „Připomenout“ u člověka, který dlouho nečerpal delší dovolenou.
- **Komu:** Zaměstnanec
- **Proměnné:** žádné
- **Předmět (ukázka):** Čas na pořádný odpočinek

> Už dlouho jste si nevzali delší dovolenou.
> 
> Naplánujte si prosím odpočinek — dobře si ho zasloužíte.
> 
> Naplánovat dovolenou: https://app.dodio.cz/calendar
> 
> Tato upozornění můžete vypnout v aplikaci u zvonečku notifikací.

### Pozvánka do firmy

- **Kdy:** Admin nebo HR pozve člověka e-mailem.
- **Komu:** Zvaný
- **Proměnné:** `{jmeno}`, `{pozvatel}`, `{firma}`, `{odkaz}`
- **Předmět (ukázka):** Oldřich Zvoníček vás zve do Dodia (NaturaMed s.r.o.)

> Dobrý den Jano,
> 
> Oldřich Zvoníček vás zve do firmy NaturaMed s.r.o. v aplikaci Dodio pro správu absencí.
> 
> Klikněte na tlačítko níže, zvolte si heslo a hned se zařadíte do firmy. Adresa je už předvyplněná.
> 
> Dokončit registraci: https://app.dodio.cz/login
> 
> Tento e-mail je provozní a nelze ho vypnout. Dodio — správa firemních absencí na pár kliknutí.

### Připomínka pozvánky

- **Kdy:** Pozvaný se do 3 dnů od odeslání pozvánky nezaregistroval (jednou).
- **Komu:** Zvaný
- **Proměnné:** `{jmeno}`, `{firma}`, `{odkaz}`
- **Předmět (ukázka):** Jano, pozvánka do firmy NaturaMed s.r.o. na vás pořád čeká

> Dobrý den Jano,
> 
> před pár dny vám přišla pozvánka do firmy NaturaMed s.r.o. v aplikaci Dodio. Registrace zabere minutu: zvolíte si heslo a hned uvidíte svůj zůstatek dovolené i kalendář týmu.
> 
> Odkaz níže platí ještě několik dní.
> 
> Dokončit registraci: https://app.dodio.cz/login
> 
> Tento e-mail je provozní a nelze ho vypnout. Dodio — správa firemních absencí na pár kliknutí.

### Nový uživatel čeká na schválení

- **Kdy:** Někdo se zaregistruje přes registrační odkaz a firma vyžaduje schválení.
- **Komu:** Admini
- **Proměnné:** `{jmeno}`, `{email}`
- **Předmět (ukázka):** Nový uživatel čeká na schválení

> Jano (jana@firma.cz) se zaregistroval(a) přes registrační odkaz a čeká na vaše schválení. Do té doby se nepřihlásí a nic ve firmě neuvidí.
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

- **Kdy:** Po připojení k firmě: hned po dokončení pozvánky, nebo po schválení registrace z odkazu (jedna zpráva „účet je připraven“, nic dalšího se neposílá).
- **Komu:** Nový zaměstnanec
- **Proměnné:** `{jmeno}`, `{firma}`
- **Předmět (ukázka):** Vítejte v NaturaMed s.r.o. na Dodiu

> Dobrý den Jano,
> 
> váš účet ve firmě NaturaMed s.r.o. je schválený a připravený. V Dodiu požádáte o dovolenou, uvidíte kolegy v týmovém kalendáři a sledujete svůj zůstatek.
> 
> Žádost o absenci podáte jedním kliknutím na tlačítko „Nová žádost“.
> 
> Otevřít Dodio: https://app.dodio.cz/dashboard
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
> Až tým poroste, doporučujeme přejít na tarif Pro, ať máte pro všechny místo a k dispozici všechny funkce.
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
> Vyberte prosím tarif, který odpovídá počtu lidí ve firmě. Aplikace vám zatím běží beze změny.
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

## Úvodní série „Co Dodio umí“ (zatím se neposílá)

Obchodní sdělení: před spuštěním je potřeba odhlašovací odkaz a vlastní kategorie v Nastavení → E-maily. Adminům jde pět e-mailů ve dnech 1, 3, 6, 10 a 14, zaměstnancům dva (den 1 a 4).

### Co Dodio umí 1/5: Žádost jedním klikem

- **Kdy:** Den 1 po založení firmy.
- **Komu:** Admin nově založené firmy
- **Proměnné:** `{jmeno}`, `{firma}`
- **Předmět (ukázka):** Dovolená na pár kliknutí: jak funguje žádost v Dodiu

> Dobrý den Jano,
> 
> firma NaturaMed s.r.o. je v Dodiu založená. V následujících dnech vám v pěti krátkých e-mailech ukážeme, co všechno aplikace umí. Začneme tím nejdůležitějším: žádostí o absenci.
> 
> Zaměstnanec vybere typ a termín a Dodio za něj ohlídá zbytek: víkendy a státní svátky se neodečítají, zůstatek se počítá za správný rok a půlden jde zadat u jednodenního termínu. Systém také hlídá vaše pravidla: blokované termíny, minimální předstih nebo čerpání do mínusu.
> 
> Vybrané typy, třeba Home Office nebo krátká absence do nastaveného počtu dní, se schvalují automaticky. Schvalovatel tak řeší jen to, co opravdu vyžaduje jeho rozhodnutí.
> 
> Tip: na nástěnce najdete rychlé čipy „Dovolená“, „Home Office“ a „Sick Day“, které otevřou formulář rovnou s vybraným typem.
> 
> Zkusit novou žádost: https://app.dodio.cz/dashboard
> 
> Tento e-mail je součástí úvodní série o funkcích Dodia. Další e-maily z ní můžete kdykoli odhlásit odpovědí na tento e-mail.

### Co Dodio umí 2/5: Týmový kalendář

- **Kdy:** Den 3 po založení firmy.
- **Komu:** Admin nově založené firmy
- **Proměnné:** `{jmeno}`
- **Předmět (ukázka):** Kdo kdy chybí? Podívejte se do týmového kalendáře

> Dobrý den Jano,
> 
> dnes vám ukážeme týmový kalendář, místo, kde se sejdou všechny absence ve firmě.
> 
> Schválené absence jsou plnou barvou, čekající šrafované, státní svátky mají vlastní barvu. Kalendář jde filtrovat podle oddělení, typu a jména a přepínat mezi týdnem, dvěma týdny a měsícem. Termín na vlastním řádku stačí přetáhnout myší a rovnou se otevře formulář žádosti.
> 
> Kalendář si můžete přihlásit i do Google, Outlooku nebo Apple Kalendáře přes odkaz iCal v sekci Můj účet, takže absence kolegů uvidíte i v mobilu. iCal je součástí tarifu Starter a vyšších.
> 
> Tip: zapněte „Seskupit podle oddělení“ a hned uvidíte, kde se v týmu překrývá víc lidí najednou.
> 
> Otevřít kalendář: https://app.dodio.cz/calendar
> 
> Tento e-mail je součástí úvodní série o funkcích Dodia. Další e-maily z ní můžete kdykoli odhlásit odpovědí na tento e-mail.

### Co Dodio umí 3/5: Schvalování bez zdržení

- **Kdy:** Den 6 po založení firmy.
- **Komu:** Admin nově založené firmy
- **Proměnné:** `{jmeno}`
- **Předmět (ukázka):** Schvalování žádostí na jedno kliknutí, i z e-mailu

> Dobrý den Jano,
> 
> dobré rozhodnutí o dovolené potřebuje kontext a rychlost. Právě to Dodio schvalovatelům dává.
> 
> U každé žádosti je vidět varování: záporný zůstatek, překročená kapacita oddělení nebo konflikt s kolegou. K tomu náhled týdne s ostatními z oddělení. Více žádostí najednou schválíte nebo zamítnete zaškrtnutím a lištou dole. Zamítnutí vyžaduje důvod, který žadatel uvidí.
> 
> Žádost můžete schválit nebo zamítnout přímo z e-mailu, bez přihlášení do aplikace. V tarifu Pro navíc žádosti, které čekají příliš dlouho nebo je schvalovatel nepřítomen, automaticky přejdou na zástupce.
> 
> Tip: u lidí nastavte nadřízeného a výchozího zástupce v sekci Můj tým. Žádosti pak putují ke správnému člověku samy.
> 
> Nastavit nadřízené a zástupce: https://app.dodio.cz/team
> 
> Tento e-mail je součástí úvodní série o funkcích Dodia. Další e-maily z ní můžete kdykoli odhlásit odpovědí na tento e-mail.

### Co Dodio umí 4/5: Dovolená pod kontrolou

- **Kdy:** Den 10 po založení firmy.
- **Komu:** Admin nově založené firmy
- **Proměnné:** `{jmeno}`
- **Předmět (ukázka):** Ať dovolená nepropadne: pravidla a připomínky v Dodiu

> Dobrý den Jano,
> 
> nejčastější starost s dovolenou zní: „Kolik mi ještě zbývá a nepropadne mi něco?“ Dodio na ni odpovídá samo.
> 
> V nastavení určíte, kolik dní se smí převést do dalšího roku a kdy převedená dovolená propadne. Zaměstnanci to vidí přímo na nástěnce u svého zůstatku. Nevyčerpanou dovolenou ke konci roku uvidíte v Analytice a jedním kliknutím pošlete připomínku vybraným lidem.
> 
> Chytré návrhy dovolené doporučí vhodné termíny podle toho, co zbývá a kdy je v týmu klid. Tarif Team navíc umí přiznat nárok automaticky podle odpracovaných let ve firmě.
> 
> Tip: v sekci Provoz & kalendář si nastavte i blokované termíny, například inventuru nebo uzávěrku, aby se do nich žádosti nedostávaly nepovšimnuty.
> 
> Otevřít nastavení provozu: https://app.dodio.cz/admin/settings
> 
> Tento e-mail je součástí úvodní série o funkcích Dodia. Další e-maily z ní můžete kdykoli odhlásit odpovědí na tento e-mail.

### Co Dodio umí 5/5: Podklady pro mzdy a přehledy

- **Kdy:** Den 14 po založení firmy.
- **Komu:** Admin nově založené firmy
- **Proměnné:** `{jmeno}`, `{firma}`
- **Předmět (ukázka):** Konec měsíce bez tabulek: podklady pro mzdy z Dodia

> Dobrý den Jano,
> 
> poslední e-mail k tomu, co Dodio umí, je pro NaturaMed s.r.o. o přehledech.
> 
> Analytika ukazuje absence podle typu a oddělení, kapacitu týmu a nadcházející absence a je součástí i tarifu Free. Podklady pro mzdy za zvolený měsíc a oddělení stáhnete jako CSV, XLSX nebo ODS a pošlete účetní. Exporty a role Účetní jsou v tarifu Starter a vyšších, historie změn (kdo, kdy a co změnil) v tarifu Team.
> 
> Free je trvale zdarma pro až 5 uživatelů. Až vám bude tým růst, tarify najdete porovnané v aplikaci.
> 
> Kdybyste si nevěděli rady, v Centru nápovědy jsou postupy krok za krokem a případně nám můžete napsat rovnou z aplikace.
> 
> Porovnat tarify: https://app.dodio.cz/admin/settings?sekce=billing
> 
> Tento e-mail je součástí úvodní série o funkcích Dodia. Další e-maily z ní můžete kdykoli odhlásit odpovědí na tento e-mail.

### Co Dodio umí (zaměstnanec) 1/2: Žádost o absenci

- **Kdy:** Den 1 po připojení k firmě.
- **Komu:** Nový zaměstnanec
- **Proměnné:** `{jmeno}`, `{firma}`
- **Předmět (ukázka):** Žádost o dovolenou na pár kliknutí

> Dobrý den Jano,
> 
> v Dodiu ve firmě NaturaMed s.r.o. požádáte o dovolenou během chvilky. Na nástěnce vidíte svůj zůstatek, vyberete typ absence a termín a Dodio samo spočítá pracovní dny bez víkendů a svátků.
> 
> Schválení vám přijde e-mailem a termín se objeví v týmovém kalendáři. Když si to rozmyslíte, u čekající žádosti ji můžete upravit nebo zrušit.
> 
> Tip: čipy „Dovolená“, „Home Office“ a „Sick Day“ na nástěnce otevřou formulář rovnou s vybraným typem.
> 
> Zkusit novou žádost: https://app.dodio.cz/dashboard
> 
> Tento e-mail je součástí úvodní série o funkcích Dodia. Další e-maily z ní můžete kdykoli odhlásit odpovědí na tento e-mail.

### Co Dodio umí (zaměstnanec) 2/2: Týmový kalendář

- **Kdy:** Den 4 po připojení k firmě.
- **Komu:** Nový zaměstnanec
- **Proměnné:** `{jmeno}`
- **Předmět (ukázka):** Kdo kdy chybí? Podívejte se do týmového kalendáře

> Dobrý den Jano,
> 
> než si naplánujete dovolenou, koukněte do týmového kalendáře. Uvidíte, kdy chybí kolegové ze stejného oddělení, a vyhnete se termínům, kdy by byl tým prořídlý.
> 
> Termín na svém řádku stačí přetáhnout myší a otevře se formulář žádosti. Kalendář si můžete přihlásit i do Google, Outlooku nebo Apple Kalendáře přes odkaz iCal v sekci Můj účet (podle tarifu firmy).
> 
> Otevřít kalendář: https://app.dodio.cz/calendar
> 
> Tento e-mail je součástí úvodní série o funkcích Dodia. Další e-maily z ní můžete kdykoli odhlásit odpovědí na tento e-mail.

## Uspané (patří k dočasně vypnuté funkci)


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
