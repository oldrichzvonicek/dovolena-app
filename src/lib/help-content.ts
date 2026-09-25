import {
  BarChart3,
  Bell,
  CalendarDays,
  Clock,
  LayoutDashboard,
  ListChecks,
  Plus,
  Settings,
  UserCircle,
  Users,
  type LucideIcon,
} from "lucide-react";

export type HelpRole = "employee" | "manager" | "admin";

// undefined roles = visible to everyone. A section/FAQ tagged with roles is
// only shown to someone whose profile.role is in that list — "manager" here
// means "manager and admin both", matching how the rest of the app treats
// admin as a superset of manager.
export interface HelpSection {
  title: string;
  icon: LucideIcon;
  color: "teal" | "amber" | "sky" | "violet" | "plum" | "moss" | "sage" | "rust";
  roles?: HelpRole[];
  items: string[];
}

export interface HelpFaq {
  q: string;
  a: string;
  /** Title of the section (see `sections`) this article belongs to. */
  section: string;
  /** One of the handful of most-needed answers shown on top of the help centre. */
  top?: boolean;
  roles?: HelpRole[];
}

export const sections: HelpSection[] = [
  {
    title: "Nástěnka",
    icon: LayoutDashboard,
    color: "teal",
    items: [
      "Karty se zůstatkem dovolené, sick days a Home Office — vždy za aktuální rok. Kroužek se zbarví do oranžova, když zbývá málo dní; převedená dovolená z loňska je vidět zvlášť i s datem, kdy propadne.",
      "Rychlé čipy „Dovolená“, „Home Office“ a „Sick Day“ otevřou formulář rovnou s vybraným typem; ostatní typy najdete v tlačítku „+ Nová žádost“.",
      "„Kapacita týmu dnes“ ukazuje, kolik lidí z vašeho oddělení dnes chybí. Home Office se za absenci nepočítá.",
      "„Kdo dnes / tento týden chybí“ jde filtrovat podle typu absence.",
      "V „Nadcházející absence“ vidíte i vlastní čekající žádosti (s odznakem „Čeká“).",
      "Manažer a admin mají na nástěnce widget „Ke schválení“ s rychlými tlačítky a upozorněními na konflikty.",
    ],
  },
  {
    title: "Žádost o absenci",
    icon: Plus,
    color: "amber",
    items: [
      "Půlden jde vybrat jen pro jednodenní termín. Víkendy a státní svátky se automaticky neodečítají; žádost, která by měla 0 pracovních dní, nejde odeslat.",
      "Systém hlídá firemní pravidla: blokované termíny, minimální předstih, zpětné zadávání a čerpání do mínusu (nastavuje admin v Provozu). Zůstatek se počítá za rok, do kterého termín spadá.",
      "Zobrazí se, kolik lidí z vašeho oddělení má ve stejném termínu už schválenou absenci.",
      "Některé typy (např. Home Office, krátká absence do nastaveného počtu dní) se schvalují automaticky — takovou žádost uvidíte rovnou jako schválenou.",
      "Pole „Zastupování“ se předvyplní vaším výchozím zástupcem.",
    ],
  },
  {
    title: "Týmový kalendář",
    icon: CalendarDays,
    color: "sky",
    items: [
      "Vidíte všechny aktivní kolegy z firmy. Váš řádek je vždy připnutý nahoře a zůstává na očích při posouvání.",
      "Schválené absence jsou plnou barvou, čekající šrafované. Legendu typů a stavů najdete pod kalendářem.",
      "Na vlastním řádku jde termín vybrat přetažením myší — rovnou otevře formulář žádosti.",
      "Pohled Měsíc / 2 týdny / Týden (na telefonu se otevírá týden), filtr podle oddělení, typu a jména, volba „Seskupit podle oddělení“.",
      "Najetím (na telefonu klepnutím) na pruh se ukáže detail — kdo, typ absence, termín a zástup. Státní svátky mají vlastní barvu.",
      "Kalendář si můžete přihlásit do Google / Outlook / Apple přes odkaz iCal pod kalendářem; jednotlivou žádost jde stáhnout jako .ics v Moje žádosti.",
    ],
  },
  {
    title: "Moje žádosti",
    icon: ListChecks,
    color: "violet",
    items: [
      "Záložky Všechny / Čekající / Schválené / Zamítnuté / Zrušené a filtr roku a typu. Na telefonu se žádosti zobrazí jako karty.",
      "U každé žádosti je vidět počet dní (i půldny), kdo ji schválil a barevný stav.",
      "U zamítnuté žádosti se zobrazí důvod a tlačítko „Upravit a poslat znovu“.",
      "Čekající žádost jde upravit nebo zrušit. U schválené žádosti požádáte o zrušení — rozhodne schvalovatel.",
      "Akce „Duplikovat“ a „Do kalendáře“ jsou v menu ⋯ u každé žádosti.",
    ],
  },
  {
    title: "Ke schválení (manažer)",
    icon: Clock,
    color: "plum",
    roles: ["manager", "admin"],
    items: [
      "Žádosti od vašich přímých podřízených se řadí nahoru a mají odznak „Váš tým“. Filtr: Všechny / S konfliktem / Bez konfliktu.",
      "U každé žádosti je varování (záporný zůstatek, překročená kapacita oddělení, konflikt s kolegou ze stejného oddělení) a náhled týdne s ostatními z oddělení.",
      "Zaškrtnutím více žádostí je schválíte nebo zamítnete najednou v liště dole.",
      "Zamítnutí vyžaduje důvod — žadatel ho uvidí. Vlastní žádost si neschválíte, pokud existuje jiný schvalovatel.",
      "Žádosti, které čekají moc dlouho nebo je schvalovatel nepřítomen, se automaticky eskalují na zástupce vedoucího oddělení, případně na adminy.",
      "Žádosti o zrušení už schválené absence najdete v samostatném bloku nahoře.",
    ],
  },
  {
    title: "Můj tým",
    icon: Users,
    color: "moss",
    roles: ["manager", "admin"],
    items: [
      "Přiřazování oddělení, nadřízeného a výchozího zástupce jednotlivým lidem; detail zaměstnance ukazuje zůstatky a historii.",
      "Pozvání nového kolegy přes „Pozvat kolegu“ — e-mailem nebo odkazem; po registraci se rovnou přiřadí k firmě.",
      "„Riziko vyhoření“ upozorní, když někdo déle než 6 měsíců nečerpal delší dovolenou.",
      "Chytré tipy (Smart HR Insights) upozorní na nevyčerpanou dovolenou, která brzy propadne, a další zajímavosti.",
    ],
  },
  {
    title: "Nastavení firmy (admin)",
    icon: Settings,
    color: "sage",
    roles: ["admin"],
    items: [
      "Menu „Nastavení firmy“ vlevo se rozbalí na sekce; změny se ukládají automaticky (u polí je vidět stav „Uloženo“).",
      "Uživatelé — pozvání e-mailem, odkazem nebo CSV importem; hromadné akce (oddělení, nadřízený, nároky, deaktivace), roční nároky a individuální limit Home Office. Odcházející lidi deaktivujte — ztratí přístup a zmizí z kalendáře, historie zůstane.",
      "Oddělení — vedoucí a zástupce vedoucího, sloučení duplicit.",
      "Typy absencí — barvy, řazení přetažením, z jakého limitu se čerpá, automatické schválení do X dní, poměrné krácení nároku u nových zaměstnanců, výchozí nároky. Nepoužívané typy lze skrýt.",
      "Provoz & kalendář — směny a pracovní dny, pravidla pro žádosti (předstih, zpětné zadávání, mínus), převod dovolenky do dalšího roku (max. dní a datum propadnutí), připomínky, kapacitní varování, blokované termíny, celozávodní dovolená a firemní logo.",
      "Fakturace & tarify — aktuální tarif s počtem uživatelů, srovnání tarifů (Free, Starter, Pro, Enterprise), fakturační údaje (načtení z ARES podle IČO) a způsob platby.",
      "Integrace — napojení Slack, Microsoft Teams, Mattermost, Discord, Google Chat nebo libovolného webhooku; vyberete, které události se do kanálu posílají.",
      "Historie změn — kdo, kdy a co v systému změnil.",
    ],
  },
  {
    title: "Analytika a Exporty (admin)",
    icon: BarChart3,
    color: "rust",
    roles: ["admin"],
    items: [
      "Analytika — období (týden, měsíc, kvartál, rok), filtr oddělení, absence podle typu a oddělení, žebříčky, nadcházející absence a export přehledu do CSV nebo tisku.",
      "Nevyčerpaná dovolená ke konci roku s hromadnou připomínkou a upozornění na dovolenou, která brzy propadne.",
      "Exporty — podklady pro mzdy za zvolený měsíc a oddělení ve formátu CSV, XLSX nebo ODS.",
    ],
  },
  {
    title: "Oznámení a e-maily",
    icon: Bell,
    color: "amber",
    items: [
      "Zvoneček v horní liště ukazuje oznámení o nové žádosti, schválení nebo zamítnutí.",
      "E-mailová upozornění (nová žádost, rozhodnutí, připomínky) můžete vypnout v nabídce u zvonečku.",
      "Manažeři a admini dostávají v pondělí týdenní přehled absencí; admin může navíc posílat denní přehled do chatu.",
    ],
  },
  {
    title: "Účet",
    icon: UserCircle,
    color: "teal",
    items: [
      "Zapomenuté heslo jde obnovit odkazem z přihlašovací stránky.",
      "Rychlá navigace: stiskněte Ctrl+K (⌘K na Macu) a napište název stránky nebo akce.",
      "Aplikace funguje i na telefonu — menu otevřete tlačítkem vlevo nahoře.",
    ],
  },
];

export const faqs: HelpFaq[] = [
  {
    q: "Kdy si můžu vybrat jen půlden?",
    section: "Žádost o absenci",
    a: "Pouze u jednodenního termínu. Víkendy a svátky se automaticky neodečítají.",
  },
  {
    q: "Proč mi systém nedovolí odeslat žádost o absenci?",
    section: "Žádost o absenci",
    top: true,
    a: "Nejspíš naráží na firemní pravidlo — blokovaný termín, příliš krátký předstih, zpětné zadávání, čerpání do mínusu, nebo vybraný termín obsahuje jen víkend a svátky (0 pracovních dní). Pravidla nastavuje admin v Nastavení firmy → Provoz & kalendář.",
  },
  {
    q: "Jak poznám, že má o stejný termín zažádáno i kolega?",
    section: "Žádost o absenci",
    a: "Formulář žádosti zobrazí, kolik lidí z vašeho oddělení má ve stejném termínu už schválenou absenci. Home Office se nepočítá.",
  },
  {
    q: "Jde už odeslanou žádost ještě upravit nebo zrušit?",
    section: "Moje žádosti",
    top: true,
    a: "Dokud čeká na schválení, ano — v Moje žádosti. Už schválenou žádost zrušíte přes „Požádat o zrušení“, které potvrdí schvalovatel.",
  },
  {
    q: "Proč mi byla žádost zamítnuta?",
    section: "Moje žádosti",
    a: "U zamítnuté žádosti v Moje žádosti se zobrazí důvod od schvalovatele a tlačítko „Upravit a poslat znovu“.",
  },
  {
    q: "Co se stane s nevyčerpanou dovolenou na konci roku?",
    section: "Nástěnka",
    top: true,
    a: "Část dní se převede do dalšího roku — kolik a do kdy je nastaveno ve firemních pravidlech (Provoz & kalendář). Převedené dny jsou na nástěnce vidět zvlášť a po datu propadnutí se odečtou.",
  },
  {
    q: "Proč mi Home Office nemění zůstatek dovolené?",
    section: "Nástěnka",
    a: "Home Office má vlastní roční limit dní (firemní výchozí, nebo individuální nastavený adminem) a nesnižuje kapacitu týmu ani se nepočítá jako konflikt.",
  },
  {
    q: "Proč mi někdo schválil žádost sám / bez čekání?",
    section: "Žádost o absenci",
    a: "Některé typy absence mají v nastavení automatické schválení (např. Home Office nebo krátká absence do daného počtu dní).",
  },
  {
    q: "Kdo se předvyplní do pole „Zastupování“?",
    section: "Žádost o absenci",
    a: "Váš výchozí zástupce, kterého nastaví admin nebo manažer v Nastavení firmy nebo v Můj tým.",
  },
  {
    q: "Koho vidím v Týmovém kalendáři?",
    section: "Týmový kalendář",
    top: true,
    a: "Všechny aktivní kolegy z vaší firmy. Seznam zúžíte filtrem oddělení, typu absence nebo hledáním jména; můžete také zapnout seskupení podle oddělení.",
  },
  {
    q: "Jak nejrychleji zadám žádost přímo z kalendáře?",
    section: "Týmový kalendář",
    a: "Na svém řádku v Týmovém kalendáři přetáhněte myší požadovaný termín — rovnou se otevře formulář žádosti.",
  },
  {
    q: "Jak si přidám dovolenou do Google / Outlook kalendáře?",
    section: "Týmový kalendář",
    a: "U jednotlivé žádosti v Moje žádosti zvolte „Do kalendáře“ (.ics), nebo si v Týmovém kalendáři zkopírujte odkaz iCal a přihlaste se k odběru.",
  },
  {
    q: "Jak schválím nebo zamítnu víc žádostí najednou?",
    section: "Ke schválení (manažer)",
    top: true,
    a: "V Ke schválení zaškrtněte žádosti a použijte lištu dole. Při zamítnutí je nutné uvést důvod.",
    roles: ["manager", "admin"],
  },
  {
    q: "Na co mě systém upozorní při schvalování?",
    section: "Ke schválení (manažer)",
    a: "Na záporný zůstatek žadatele, překročení kapacity oddělení a konflikt s kolegou ze stejného oddělení, který už má v termínu schválenou absenci.",
    roles: ["manager", "admin"],
  },
  {
    q: "Proč se mi zobrazují žádosti, které nejsou z mého týmu?",
    section: "Ke schválení (manažer)",
    a: "Pokud schvalovatel chybí, nebo žádost čeká déle než je nastaveno, systém ji automaticky eskaluje na zástupce vedoucího oddělení, případně na adminy.",
    roles: ["manager", "admin"],
  },
  {
    q: "Mohu schválit vlastní žádost?",
    section: "Ke schválení (manažer)",
    a: "Ne, pokud ve firmě existuje jiný schvalovatel. Samostatně ji schválí jen jediný admin.",
    roles: ["manager", "admin"],
  },
  {
    q: "Jak pozvu nového kolegu do firmy?",
    section: "Můj tým",
    top: true,
    a: "V Můj tým nebo v Nastavení firmy → Uživatelé zvolte „Pozvat uživatele“ (e-mail), „Kopírovat registrační odkaz“ nebo hromadný CSV import.",
    roles: ["manager", "admin"],
  },
  {
    q: "Jak hromadně importuji zaměstnance?",
    section: "Nastavení firmy (admin)",
    a: "V Nastavení firmy → Uživatelé klikněte na „Hromadný CSV import / export“ — založí se účty i oddělení najednou.",
    roles: ["admin"],
  },
  {
    q: "Jak odebrat člověka, který odešel z firmy?",
    section: "Nastavení firmy (admin)",
    a: "Deaktivujte ho v Nastavení firmy → Uživatelé. Ztratí přístup a zmizí z kalendáře, ale jeho historie zůstane. Trvale smazat jde jen deaktivovaného uživatele.",
    roles: ["admin"],
  },
  {
    q: "Kde nastavím firemní logo a fakturační údaje?",
    section: "Nastavení firmy (admin)",
    a: "Logo v Nastavení firmy → Provoz & kalendář, fakturační údaje a způsob platby v Fakturace & tarify. Údaje o firmě lze načíst z ARES podle IČO.",
    roles: ["admin"],
  },
  {
    q: "Jak změním tarif?",
    section: "Nastavení firmy (admin)",
    a: "V Nastavení firmy → Fakturace & tarify vidíte aktuální tarif, počet uživatelů a srovnání tarifů. Tlačítko „Zvolit tarif“ vás pošle e-mailem na obchod. Při překročení limitu uživatelů vás systém upozorní.",
    roles: ["admin"],
  },
  {
    q: "Jak propojím Dodio se Slackem nebo Teams?",
    section: "Nastavení firmy (admin)",
    top: true,
    a: "V Nastavení firmy → Integrace vyberte službu, vložte adresu příchozího webhooku a zaškrtněte události (nová žádost, rozhodnutí, žádost o zrušení, denní přehled). Tlačítkem „Zkušební zpráva“ si spojení ověříte. Adresa webhooku je tajná, vidí ji jen admin.",
    roles: ["admin"],
  },
  {
    q: "Co je celozávodní dovolená?",
    section: "Nastavení firmy (admin)",
    a: "Admin ji nastaví v Nastavení firmy → Provoz & kalendář — jednotná absence, která se rovnou přiřadí celé firmě nebo vybraným oddělením (např. vánoční odstávka).",
    roles: ["admin"],
  },
  {
    q: "Jak nastavím automatické schvalování nebo poměrné krácení nároku?",
    section: "Nastavení firmy (admin)",
    a: "V Nastavení firmy → Typy absencí u konkrétního typu: „Automaticky schválit do X dní“ a „Poměrně krátit u nových zaměstnanců“ (podle měsíce nástupu).",
    roles: ["admin"],
  },
  {
    q: "Jak funguje upozornění na riziko vyhoření?",
    section: "Můj tým",
    a: "Na stránce Můj tým se zobrazí lidé, kteří si déle než 6 měsíců nevzali delší dovolenou (aspoň 3 dny v kuse) — stojí za to jim ji připomenout.",
    roles: ["manager", "admin"],
  },
  {
    q: "Jak pošlu hromadnou připomínku o nevyčerpané dovolené?",
    section: "Analytika a Exporty (admin)",
    a: "V Analytice je sekce „Nevyčerpaná dovolená ke konci roku“ — zaškrtněte lidi a klikněte na „Poslat připomínku“. Každému přijde upozornění v aplikaci.",
    roles: ["admin"],
  },
  {
    q: "Kde vidím, kdo co v systému změnil?",
    section: "Nastavení firmy (admin)",
    a: "V Nastavení firmy → Historie změn.",
    roles: ["admin"],
  },
  {
    q: "Co znamená oranžový kroužek a štítek „Dochází“?",
    a: "Zůstatek dané absence klesl pod 20 % nároku nebo pod 2 dny. Je to jen upozornění — žádost můžete dál podat.",
    section: "Nástěnka",
  },
  {
    q: "Jak se počítá můj zůstatek?",
    a: "Roční nárok + dny převedené z loňska − už vyčerpané − schválené do budoucna. U každé karty na nástěnce najdete odkaz „Jak se to počítá?“ s rozpisem. Čekající žádosti se do zůstatku nepočítají.",
    section: "Nástěnka",
  },
  {
    q: "Co znamená stav „Čeká na schválení“?",
    a: "Žádost odešla schvalovateli (vašemu nadřízenému, případně vedoucímu oddělení nebo adminovi). Dokud ji nerozhodne, žádost jde upravit nebo zrušit. O výsledku dostanete oznámení.",
    section: "Moje žádosti",
  },
  {
    q: "Proč u kolegy vidím jen „Nepřítomen“?",
    a: "Některé typy absencí (výchozí je nemoc) jsou soukromé. Kolegové vidí jen to, že člověk chybí; důvod vidí on sám, jeho nadřízený a admin. Admin to nastavuje u typu absence.",
    section: "Týmový kalendář",
  },
  {
    q: "Jak vypnu e-mailová upozornění?",
    a: "Klikněte na zvoneček v horní liště a e-maily vypněte v jeho nabídce. Oznámení v aplikaci zůstanou.",
    section: "Oznámení a e-maily",
  },
  {
    q: "Kdy chodí týdenní přehled absencí?",
    a: "Manažerům a adminům každé pondělí ráno e-mailem. Admin může navíc zapnout ranní přehled „kdo dnes chybí“ do Slacku nebo Teams.",
    section: "Oznámení a e-maily",
    roles: ["manager", "admin"],
  },
  {
    q: "Kdo mi dá vědět, že žádost čeká příliš dlouho?",
    a: "Schvalovatelé dostávají připomínky a po nastavené době se žádost automaticky předá zástupci vedoucího, případně adminům.",
    section: "Oznámení a e-maily",
  },
  {
    q: "Jak funguje rychlé hledání Ctrl+K?",
    a: "Stiskněte Ctrl+K (⌘K na Macu) a začněte psát: najdete stránky, kolegy (otevře se kalendář s jejich jménem) i akce jako „Nová žádost: Dovolená“.",
    section: "Účet",
  },
  {
    q: "Funguje Dodio na telefonu?",
    a: "Ano. Menu otevřete tlačítkem vlevo nahoře, kalendář se otevírá v týdenním pohledu a tabulky se zobrazují jako karty. Detail absence v kalendáři otevřete klepnutím.",
    section: "Účet",
  },
  {
    q: "Jaké klávesové zkratky má kalendář?",
    a: "Šipky ← → posouvají období, T se vrátí na dnešek a M, 2 a W přepínají mezi měsícem, dvěma týdny a týdnem.",
    section: "Týmový kalendář",
  },
  {
    q: "Zapomněl(a) jsem heslo, co mám dělat?",
    section: "Účet",
    a: "Na přihlašovací stránce klikněte na odkaz pro obnovení hesla.",
  },
];


export const colorIcon: Record<HelpSection["color"], string> = {
  teal: "bg-teal-light text-teal-dark",
  amber: "bg-amber-light text-amber-dark",
  sky: "bg-sky-light text-sky-dark",
  violet: "bg-violet-light text-violet-dark",
  plum: "bg-plum-light text-plum-dark",
  moss: "bg-moss-light text-moss-dark",
  sage: "bg-sage-light text-sage-dark",
  rust: "bg-rust-light text-rust-dark",
};

export function slug(title: string) {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** manager-tagged content is also shown to admins — admin is a superset, same convention as the rest of the app (see Sidebar's isManager/isAdmin). */
export function visibleTo(role: HelpRole | undefined, roles?: HelpRole[]): boolean {
  if (!roles) return true;
  if (!role) return false;
  if (role === "admin") return true;
  return roles.includes(role);
}

export function sectionsForRole(role: HelpRole | undefined): HelpSection[] {
  return sections.filter((s) => visibleTo(role, s.roles));
}

export function faqsForRole(role: HelpRole | undefined): HelpFaq[] {
  return faqs.filter((f) => visibleTo(role, f.roles));
}
