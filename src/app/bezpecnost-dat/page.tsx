import type { Metadata } from "next";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { Footer } from "@/components/marketing/Footer";
import { Container } from "@/components/marketing/Container";
import { CookieBanner } from "@/components/marketing/CookieBanner";

// Draft/concept document pending legal review (contains [bracketed]
// placeholders and an explicit "not done yet" section) — noindex until
// it's finalized with real values, so it doesn't show up in search
// results in this state.
export const metadata: Metadata = {
  title: "Bezpečnost dat – Dodio",
  robots: { index: false, follow: false },
};

const H2 = "m-0 mt-10 font-dodio-display text-2xl font-extrabold text-dodio-ink first:mt-0 lg:text-[28px]";
const H3 = "m-0 mt-6 font-dodio-display text-lg font-bold text-dodio-ink";
const P = "m-0 mt-3 text-[15px] leading-[24px] text-dodio-ink-muted";
const UL = "m-0 mt-3 flex flex-col gap-2 pl-5 text-[15px] leading-[24px] text-dodio-ink-muted";
const TABLE = "mt-3 w-full border-collapse text-[14px] leading-[21px]";
const TH = "border-b border-dodio-border p-3 text-left font-semibold text-dodio-ink";
const TD = "border-b border-dodio-border p-3 align-top text-dodio-ink-muted";

export default function DataSecurityPage() {
  return (
    <div className="flex min-h-screen flex-col bg-dodio-surface font-dodio-sans text-dodio-ink">
      <SiteHeader />
      <main className="flex-1">
        <Container className="max-w-[760px] py-16">
          <h1 className="m-0 font-dodio-display text-4xl font-extrabold">Bezpečnost dat — Dodio</h1>
          <p className="m-0 mt-3 text-sm text-dodio-ink-muted">Verze: [1] · Aktuální k datu: 2026-09-30</p>

          <h2 className={H2}>1. Přehled</h2>
          <p className={P}>
            Dodio je software jako služba (SaaS) pro evidenci dovolené a dalších absencí. Data jedné
            zákaznické firmy (dále „Správce“) jsou od dat ostatních firem striktně oddělená a k jejich
            uložení i zpracování používáme několik prověřených poskytovatelů infrastruktury místo vlastních
            serverů. Tento dokument popisuje: (1) kde data fyzicky leží, (2) jak se k nim aplikace a její
            uživatelé dostávají, (3) jak jsou chráněna citlivější údaje, (4) co v zabezpečení ještě chybí.
          </p>

          <h2 className={H2}>2. Kde jsou data uložena</h2>
          <div className="overflow-x-auto">
            <table className={TABLE}>
              <thead>
                <tr>
                  <th className={TH}>Poskytovatel</th>
                  <th className={TH}>Co u něj leží</th>
                  <th className={TH}>Umístění</th>
                  <th className={TH}>Poznámka</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={TD}>Supabase (databáze Postgres, přihlašování, souborové úložiště)</td>
                  <td className={TD}>
                    Všechna data popsaná v čl. 3 Zpracovatelské smlouvy — firmy, uživatelé, absence,
                    přílohy, exporty
                  </td>
                  <td className={TD}>[region projektu — doplnit, např. EU/Frankfurt]</td>
                  <td className={TD}>Jediné místo, kde leží samotná data; appka nemá žádnou vlastní databázi</td>
                </tr>
                <tr>
                  <td className={TD}>Vercel (hosting aplikace)</td>
                  <td className={TD}>
                    Nic trvale — jen zpracovává jednotlivé požadavky (vykreslení stránky, API volání) a
                    krátkodobě je v paměti, než je uloží/přečte ze Supabase
                  </td>
                  <td className={TD}>[region funkcí — doplnit, např. Frankfurt (fra1)]</td>
                  <td className={TD}>
                    Provozní logy (čas, cesta, chybový stav) se ukládají u Vercelu podle jeho standardní
                    retence
                  </td>
                </tr>
                <tr>
                  <td className={TD}>Resend (odesílání e-mailů)</td>
                  <td className={TD}>
                    Jméno a e-mail příjemce, text notifikace (např. „žádost o dovolenou ke schválení“) — jen
                    na dobu nutnou k doručení
                  </td>
                  <td className={TD}>[doplnit]</td>
                  <td className={TD}>
                    Neukládáme přes Resend přílohy ani citlivé údaje — e-maily neobsahují typ nemoci u
                    soukromých absencí
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className={P}>
            Appka žádná data neukládá lokálně u uživatele ani v appce samotné mimo tyto tři služby — není
            tedy třeba řešit zabezpečení „vlastního serveru“, ale zabezpečení nastavení a přístupových
            oprávnění u těchto tří účtů.
          </p>

          <h2 className={H2}>3. Jak appka k datům přistupuje</h2>

          <h3 className={H3}>3.1 Oddělení dat jednotlivých firem</h3>
          <p className={P}>
            Každý řádek dat (uživatel, žádost o absenci, oddělení…) nese <code>company_id</code>. Přístupová
            pravidla databáze (Row Level Security, RLS) na úrovni samotné databáze — ne jen v kódu appky —
            zaručují, že přihlášený uživatel může číst a měnit výhradně data vlastní firmy. I kdyby appka
            měla chybu, databáze sama cizí data nevydá.
          </p>

          <h3 className={H3}>3.2 Role a co která role vidí</h3>
          <div className="overflow-x-auto">
            <table className={TABLE}>
              <thead>
                <tr>
                  <th className={TH}>Role</th>
                  <th className={TH}>Přístup</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={TD}>Zaměstnanec</td>
                  <td className={TD}>
                    vlastní žádosti a zůstatek; v týmovém kalendáři kolegy jen jako „přítomen/nepřítomen“
                  </td>
                </tr>
                <tr>
                  <td className={TD}>Manažer</td>
                  <td className={TD}>navíc žádosti a přehledy svého oddělení / podřízených, schvalování</td>
                </tr>
                <tr>
                  <td className={TD}>HR</td>
                  <td className={TD}>zaměstnanci a jejich absence napříč firmou (bez mzdových údajů)</td>
                </tr>
                <tr>
                  <td className={TD}>Účetní</td>
                  <td className={TD}>podklady pro mzdy (exporty, docházka) napříč firmou</td>
                </tr>
                <tr>
                  <td className={TD}>Administrátor</td>
                  <td className={TD}>správa firmy, uživatelů, nastavení; nejvyšší role v rámci firmy</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className={P}>
            Žádná role kromě nadřízeného a administrátora nevidí skutečný typ soukromé absence (typicky
            nemoc) u jiného člověka — ostatním se zobrazí jen „Nepřítomen“ (viz kapitolu 5). Toto pravidlo je
            vynucené v databázi, ne jen schované v uživatelském rozhraní.
          </p>

          <h3 className={H3}>3.3 Přístup ze strany serveru appky</h3>
          <p className={P}>
            Server appky (Next.js na Vercelu) se k databázi standardně hlásí stejným přihlášeným uživatelem
            jako prohlížeč — platí tedy stejná RLS pravidla. Zvýšený („servisní“) přístup mimo tato pravidla
            appka používá jen ve třech typech případů a vždy jen po nezbytnou operaci:
          </p>
          <ul className={UL}>
            <li>naplánované úlohy (denní e-mailové přehledy, eskalace čekajících žádostí),</li>
            <li>odkazy pro schválení žádosti z e-mailu bez přihlášení (viz 4.2),</li>
            <li>interní administrace provozovatele (super-admin, viz kapitolu 6).</li>
          </ul>

          <h3 className={H3}>3.4 Externí volání mimo appku</h3>
          <div className="overflow-x-auto">
            <table className={TABLE}>
              <thead>
                <tr>
                  <th className={TH}>Kam appka volá</th>
                  <th className={TH}>Co posílá</th>
                  <th className={TH}>Proč</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={TD}>ARES (veřejný rejstřík ekonomických subjektů, Ministerstvo financí)</td>
                  <td className={TD}>pouze IČO</td>
                  <td className={TD}>
                    předvyplnění fakturačních údajů firmy; IČO je veřejný údaj, ARES není zpracovatelem
                  </td>
                </tr>
                <tr>
                  <td className={TD}>Resend</td>
                  <td className={TD}>jméno, e-mail a text notifikace</td>
                  <td className={TD}>odeslání e-mailu (viz kapitolu 2)</td>
                </tr>
                <tr>
                  <td className={TD}>Webhook zákazníka (Slack/Teams)</td>
                  <td className={TD}>krátký text „kdo dnes chybí“</td>
                  <td className={TD}>
                    volitelná, appkou vypnutá funkce — pokud si ji zákazník sám zapne a vloží vlastní adresu
                    webhooku, posílá appka data tam, kam si zákazník sám určí, ne nám ani třetí straně
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className={P}>
            Žádný krok appky neposílá data zákazníků do nástrojů umělé inteligence ani jiných
            analytických/reklamních služeb.
          </p>

          <h2 className={H2}>4. Ověřování uživatelů a přístupové odkazy</h2>

          <h3 className={H3}>4.1 Přihlášení</h3>
          <p className={P}>
            Přihlašování (heslo, jeho uložení, obnova) zajišťuje Supabase Auth, ne appka sama — appka nikdy
            neukládá ani nevidí hesla v čitelné podobě. Administrátor firmy může u rolí HR/účetní/admin
            vyžadovat dvoufázové ověření (TOTP, aplikace typu Google Authenticator).
          </p>

          <h3 className={H3}>4.2 Schválení žádosti z e-mailu bez přihlášení</h3>
          <p className={P}>
            Tlačítka „Schválit“/„Zamítnout“ v e-mailu vedou na kryptograficky podepsaný jednorázový odkaz
            platný 7 dní, vázaný na konkrétní žádost a konkrétního schvalovatele — nejde ho použít na jinou
            žádost ani přeposlat cizímu člověku k platnému rozhodnutí za někoho jiného. Pouhé otevření
            odkazu (např. automatickým bezpečnostním skenerem e-mailové schránky) o žádosti nerozhodne —
            teprve ruční potvrzení na stránce ano/ne provede zápis do databáze.
          </p>

          <h2 className={H2}>5. Citlivé údaje</h2>
          <p className={P}>
            Dodio se vědomě vyhýbá zpracování zvláštní kategorie osobních údajů (čl. 9 GDPR — údaje o
            zdravotním stavu):
          </p>
          <ul className={UL}>
            <li>
              appka neumožňuje přiložit k žádosti potvrzení od lékaře ani jiný dokument (funkce příloh byla
              záměrně odstraněna),
            </li>
            <li>
              u nemoci/soukromých typů absence appka neeviduje diagnózu ani důvod, jen skutečnost a dobu
              nepřítomnosti,
            </li>
            <li>
              typ soukromé absence vidí jen dotčený člověk, jeho nadřízený a administrátor firmy (podle
              role, viz 3.2); ostatním kolegům se v kalendáři, přehledech i e-mailech zobrazí jen
              „Nepřítomen“.
            </li>
          </ul>

          <h2 className={H2}>6. Přístup provozovatele Dodia k datům zákazníků</h2>
          <p className={P}>
            Provozovatel (my) má k datům zákazníků přístup jen v nezbytné míře a přes oddělené administrační
            rozhraní („super-admin“), ne přes běžný účet firmy:
          </p>
          <ul className={UL}>
            <li>
              náhled do firmy je jen pro čtení (impersonace bez možnosti přihlásit se „za“ uživatele a měnit
              data jeho jménem),
            </li>
            <li>
              náhled i každá administrativní změna (např. změna tarifu, pozastavení firmy) se zapisují do
              auditního záznamu s časem a identitou pracovníka,
            </li>
            <li>
              typ soukromé absence (nemoc) zůstává skrytý i v tomto náhledu — stejné pravidlo jako v 3.2 a
              5,
            </li>
            <li>
              přístup do super-adminu je omezen na pracovníky provozovatele a chráněný vlastním přihlášením
              a dvoufázovým ověřením.
            </li>
          </ul>

          <h2 className={H2}>7. Šifrování a síťová bezpečnost</h2>
          <ul className={UL}>
            <li>veškerá komunikace mezi prohlížečem, appkou a databází probíhá přes HTTPS/TLS,</li>
            <li>data „v klidu“ (na disku) jsou šifrovaná na úrovni poskytovatele infrastruktury (Supabase),</li>
            <li>
              citlivé klíče (přístup k databázi, k odesílání e-mailů, podpisové klíče schvalovacích odkazů)
              appka drží jen jako proměnné prostředí serveru, nikdy v kódu ani v repozitáři,
            </li>
            <li>
              appka omezuje počet požadavků na citlivé/veřejné endpointy (např. ARES proxy, schvalovací
              odkazy) proti zneužití automatizovaným zkoušením (rate limiting).
            </li>
          </ul>

          <h2 className={H2}>8. Bezpečný vývoj</h2>
          <ul className={UL}>
            <li>
              pravidla přístupu (RLS) a role appka pravidelně ověřuje automatizovanou sadou testů (desítky
              scénářů pro každou roli i pro cizí/nepřihlášeného uživatele) a bezpečnostní kontrolou databáze
              (tabulky bez pravidel přístupu, funkce se zvýšeným oprávněním bez omezené cesty vyhledávání,
              funkce dostupné anonymně),
            </li>
            <li>
              nové db funkce se zvýšeným oprávněním procházejí kontrolou, že nejsou dostupné bez přihlášení,
              pokud to není žádoucí,
            </li>
            <li>
              [doplnit: postup revize kódu, kontrola závislostí na zranitelnosti, frekvence aktualizací].
            </li>
          </ul>

          <h2 className={H2}>9. Co v zabezpečení ještě chybí (otevřené položky)</h2>
          <p className={P}>
            Transparentně: appka je v testovacím provozu a následující body ještě nejsou hotové nebo
            ověřené.
          </p>
          <ul className={UL}>
            <li>
              <strong className="text-dodio-ink">Zálohy dat a jejich obnova</strong> — appka spoléhá na
              standardní zálohování poskytovatele databáze; vlastní plán zálohování, jeho frekvence a
              vyzkoušená obnova ještě nejsou zdokumentované.
            </li>
            <li>
              <strong className="text-dodio-ink">Řízení bezpečnostních incidentů</strong> — chybí formální
              postup (kdo, jak rychle, koho informuje) a jeho procvičení. Lhůta 48 hodin uvedená ve
              Zpracovatelské smlouvě zatím není podložená reálným postupem.
            </li>
            <li>
              <strong className="text-dodio-ink">Sledování chyb a výpadků</strong> (např. Sentry) — appka
              zatím nemá automatické upozornění na chybu nebo výpadek odesílání e-mailů/naplánovaných úloh.
            </li>
            <li>
              <strong className="text-dodio-ink">Automatická kontrola zranitelných závislostí</strong> —
              zatím se neprovádí pravidelně/automaticky.
            </li>
            <li>
              <strong className="text-dodio-ink">Region uložení dat</strong> — u Supabase i Vercelu je
              potřeba potvrdit a v tomto dokumentu doplnit skutečný region (kapitola 2), aby odpovídal
              slibu uložení dat v EU/EHP ve Zpracovatelské smlouvě.
            </li>
          </ul>

          <h2 className={H2}>10. Související dokumenty</h2>
          <p className={P}>
            Tento dokument je technickým podkladem k Příloze B Zpracovatelské smlouvy (popis technických a
            organizačních opatření) a k Zásadám zpracování osobních údajů. Seznam subdodavatelů (Supabase,
            Vercel, Resend) a jejich role je v Příloze A Zpracovatelské smlouvy.
          </p>
        </Container>
      </main>
      <Footer />
      <CookieBanner />
    </div>
  );
}
