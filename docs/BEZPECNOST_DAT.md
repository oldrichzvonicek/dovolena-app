# Bezpečnost dat — Dodio

> **KONCEPT k odborné/právní kontrole.** Technický popis toho, kde jsou data uložena a jak k nim Dodio přistupuje —
> podklad pro zákazníky (due diligence, IT bezpečnost) i pro Přílohu B Zpracovatelské smlouvy, se kterou je tento
> dokument obsahově sladěný. Místa v **[hranatých závorkách]** je nutné doplnit skutečnými údaji před zveřejněním.
> Kapitola 9 otevřeně uvádí, co ještě není hotové — než dokument půjde ven, buď to dopracujte, nebo text upravte.

**Verze:** [1] · **Aktuální k datu:** 2026-09-30

## 1. Přehled

Dodio je software jako služba (SaaS) pro evidenci dovolené a dalších absencí. Data jedné zákaznické firmy (dále
„Správce“) jsou od dat ostatních firem striktně oddělená a k jejich uložení i zpracování používáme několik prověřených
poskytovatelů infrastruktury místo vlastních serverů. Tento dokument popisuje: (1) kde data fyzicky leží, (2) jak se
k nim aplikace a její uživatelé dostávají, (3) jak jsou chráněna citlivější údaje, (4) co v zabezpečení ještě chybí.

## 2. Kde jsou data uložena

| Poskytovatel | Co u něj leží | Umístění | Poznámka |
|---|---|---|---|
| **Supabase** (databáze Postgres, přihlašování, souborové úložiště) | Všechna data popsaná v čl. 3 Zpracovatelské smlouvy — firmy, uživatelé, absence, přílohy, exporty | [region projektu — doplnit, např. EU/Frankfurt] | Jediné místo, kde leží samotná data; appka nemá žádnou vlastní databázi |
| **Vercel** (hosting aplikace) | Nic trvale — jen zpracovává jednotlivé požadavky (vykreslení stránky, API volání) a krátkodobě je v paměti, než je uloží/přečte ze Supabase | [region funkcí — doplnit, např. Frankfurt (fra1)] | Provozní logy (čas, cesta, chybový stav) se ukládají u Vercelu podle jeho standardní retence |
| **Resend** (odesílání e-mailů) | Jméno a e-mail příjemce, text notifikace (např. „žádost o dovolenou ke schválení“) — jen na dobu nutnou k doručení | [doplnit] | Neukládáme přes Resend přílohy ani citlivé údaje — e-maily neobsahují typ nemoci u soukromých absencí |

Appka žádná data neukládá lokálně u uživatele ani v appce samotné mimo tyto tři služby — není tedy třeba řešit
zabezpečení „vlastního serveru“, ale zabezpečení nastavení a přístupových oprávnění u těchto tří účtů.

## 3. Jak appka k datům přistupuje

### 3.1 Oddělení dat jednotlivých firem

Každý řádek dat (uživatel, žádost o absenci, oddělení…) nese `company_id`. Přístupová pravidla databáze
(**Row Level Security**, RLS) na úrovni samotné databáze — ne jen v kódu appky — zaručují, že přihlášený uživatel může
číst a měnit výhradně data vlastní firmy. I kdyby appka měla chybu, databáze sama cizí data nevydá.

### 3.2 Role a co která role vidí

| Role | Přístup |
|---|---|
| Zaměstnanec | vlastní žádosti a zůstatek; v týmovém kalendáři kolegy jen jako „přítomen/nepřítomen“ |
| Manažer | navíc žádosti a přehledy svého oddělení / podřízených, schvalování |
| HR | zaměstnanci a jejich absence napříč firmou (bez mzdových údajů) |
| Účetní | podklady pro mzdy (exporty, docházka) napříč firmou |
| Administrátor | správa firmy, uživatelů, nastavení; nejvyšší role v rámci firmy |

Žádná role kromě nadřízeného a administrátora nevidí **skutečný typ soukromé absence** (typicky nemoc) u jiného
člověka — ostatním se zobrazí jen „Nepřítomen“ (viz kapitolu 5). Toto pravidlo je vynucené v databázi, ne jen
schované v uživatelském rozhraní.

### 3.3 Přístup ze strany serveru appky

Server appky (Next.js na Vercelu) se k databázi standardně hlásí **stejným přihlášeným uživatelem** jako prohlížeč —
platí tedy stejná RLS pravidla. Zvýšený („servisní“) přístup mimo tato pravidla appka používá jen ve třech typech
případů a vždy jen po nezbytnou operaci:
- naplánované úlohy (denní e-mailové přehledy, eskalace čekajících žádostí),
- odkazy pro schválení žádosti z e-mailu bez přihlášení (viz 4.2),
- interní administrace provozovatele (super-admin, viz kapitolu 6).

### 3.4 Externí volání mimo appku

| Kam appka volá | Co posílá | Proč |
|---|---|---|
| ARES (veřejný rejstřík ekonomických subjektů, Ministerstvo financí) | pouze IČO | předvyplnění fakturačních údajů firmy; IČO je veřejný údaj, ARES není zpracovatelem |
| Resend | jméno, e-mail a text notifikace | odeslání e-mailu (viz kapitolu 2) |
| Webhook zákazníka (Slack/Teams) | krátký text „kdo dnes chybí“ | volitelná, appkou vypnutá funkce — pokud si ji zákazník sám zapne a vloží vlastní adresu webhooku, posílá appka data **tam, kam si zákazník sám určí**, ne nám ani třetí straně |

Žádný krok appky neposílá data zákazníků do nástrojů umělé inteligence ani jiných analytických/reklamních služeb.

## 4. Ověřování uživatelů a přístupové odkazy

### 4.1 Přihlášení

Přihlašování (heslo, jeho uložení, obnova) zajišťuje Supabase Auth, ne appka sama — appka nikdy neukládá ani nevidí
hesla v čitelné podobě. Administrátor firmy může u rolí HR/účetní/admin vyžadovat **dvoufázové ověření** (TOTP,
aplikace typu Google Authenticator).

### 4.2 Schválení žádosti z e-mailu bez přihlášení

Tlačítka „Schválit“/„Zamítnout“ v e-mailu vedou na kryptograficky podepsaný jednorázový odkaz platný 7 dní, vázaný na
konkrétní žádost a konkrétního schvalovatele — nejde ho použít na jinou žádost ani přeposlat cizímu člověku k platnému
rozhodnutí za někoho jiného. Pouhé otevření odkazu (např. automatickým bezpečnostním skenerem e-mailové schránky)
o žádosti **nerozhodne** — teprve ruční potvrzení na stránce ano/ne provede zápis do databáze.

## 5. Citlivé údaje

Dodio se vědomě vyhýbá zpracování zvláštní kategorie osobních údajů (čl. 9 GDPR — údaje o zdravotním stavu):

- appka **neumožňuje přiložit** k žádosti potvrzení od lékaře ani jiný dokument (funkce příloh byla záměrně
  odstraněna),
- u nemoci/soukromých typů absence appka neeviduje diagnózu ani důvod, jen skutečnost a dobu nepřítomnosti,
- typ soukromé absence vidí jen dotčený člověk, jeho nadřízený a administrátor firmy (podle role, viz 3.2); ostatním
  kolegům se v kalendáři, přehledech i e-mailech zobrazí jen „Nepřítomen“.

## 6. Přístup provozovatele Dodia k datům zákazníků

Provozovatel (my) má k datům zákazníků přístup jen v nezbytné míře a přes oddělené administrační rozhraní
(„super-admin“), ne přes běžný účet firmy:

- náhled do firmy je **jen pro čtení** (impersonace bez možnosti přihlásit se „za“ uživatele a měnit data jeho jménem),
- náhled i každá administrativní změna (např. změna tarifu, pozastavení firmy) se zapisují do auditního záznamu
  s časem a identitou pracovníka,
- typ soukromé absence (nemoc) zůstává skrytý i v tomto náhledu — stejné pravidlo jako v 3.2 a 5,
- přístup do super-adminu je omezen na pracovníky provozovatele a chráněný vlastním přihlášením a dvoufázovým
  ověřením.

## 7. Šifrování a síťová bezpečnost

- veškerá komunikace mezi prohlížečem, appkou a databází probíhá přes **HTTPS/TLS**,
- data „v klidu“ (na disku) jsou šifrovaná na úrovni poskytovatele infrastruktury (Supabase),
- citlivé klíče (přístup k databázi, k odesílání e-mailů, podpisové klíče schvalovacích odkazů) appka drží jen jako
  proměnné prostředí serveru, nikdy v kódu ani v repozitáři,
- appka omezuje počet požadavků na citlivé/veřejné endpointy (např. ARES proxy, schvalovací odkazy) proti zneužití
  automatizovaným zkoušením (rate limiting).

## 8. Bezpečný vývoj

- pravidla přístupu (RLS) a role appka pravidelně ověřuje automatizovanou sadou testů (desítky scénářů pro každou roli
  i pro cizí/nepřihlášeného uživatele) a bezpečnostní kontrolou databáze (tabulky bez pravidel přístupu, funkce se
  zvýšeným oprávněním bez omezené cesty vyhledávání, funkce dostupné anonymně),
- nové db funkce se zvýšeným oprávněním procházejí kontrolou, že nejsou dostupné bez přihlášení, pokud to není
  žádoucí,
- [doplnit: postup revize kódu, kontrola závislostí na zranitelnosti, frekvence aktualizací].

## 9. Co v zabezpečení ještě chybí (otevřené položky)

Transparentně: appka je v testovacím provozu a následující body ještě nejsou hotové nebo ověřené. Než dokument
půjde k zákazníkovi, buď je dořešte, nebo tuto kapitolu upravte podle skutečnosti.

- **Zálohy dat a jejich obnova** — appka spoléhá na standardní zálohování poskytovatele databáze; vlastní plán
  zálohování, jeho frekvence a **vyzkoušená obnova** ještě nejsou zdokumentované.
- **Řízení bezpečnostních incidentů** — chybí formální postup (kdo, jak rychle, koho informuje) a jeho procvičení.
  Lhůta 48 hodin uvedená ve Zpracovatelské smlouvě zatím není podložená reálným postupem.
- **Sledování chyb a výpadků** (např. Sentry) — appka zatím nemá automatické upozornění na chybu nebo výpadek
  odesílání e-mailů/naplánovaných úloh.
- **Automatická kontrola zranitelných závislostí** — zatím se neprovádí pravidelně/automaticky.
- **Region uložení dat** — u Supabase i Vercelu je potřeba potvrdit a v tomto dokumentu doplnit skutečný region
  (kapitola 2), aby odpovídal slibu uložení dat v EU/EHP ve Zpracovatelské smlouvě.

## 10. Související dokumenty

Tento dokument je technickým podkladem k [Příloze B Zpracovatelské smlouvy](./ZPRACOVATELSKA_SMLOUVA.md) (popis
technických a organizačních opatření) a k [Zásadám zpracování osobních údajů](./ZASADY_ZPRACOVANI_UDAJU.md). Seznam
subdodavatelů (Supabase, Vercel, Resend) a jejich role je v Příloze A Zpracovatelské smlouvy.
