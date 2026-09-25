import {
  BarChart3,
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
  roles?: HelpRole[];
}

export const sections: HelpSection[] = [
  {
    title: "Nástěnka",
    icon: LayoutDashboard,
    color: "teal",
    items: [
      "Karty s ukazatelem zůstatku dovolené a sick days — kroužek a lišta se zbarví do oranžova, když zbývá málo dní.",
      "Rychlé čipy „Dovolená“, „Home Office“ a „Sick Day“ otevřou formulář rovnou s vybraným typem; ostatní typy najdete v tlačítku „+ Nová žádost“ vpravo nahoře.",
      "„Kapacita týmu dnes“ ukazuje, kolik lidí z vašeho oddělení dnes chybí.",
      "„Kdo dnes / tento týden chybí“ jde filtrovat bublinami podle typu absence.",
    ],
  },
  {
    title: "Žádost o absenci",
    icon: Plus,
    color: "amber",
    items: [
      "Půlden jde vybrat jen pro jednodenní termín — u víkendů se automaticky odečítají.",
      "Systém hlídá firemní pravidla: blokované termíny, minimální předstih, zpětné zadávání a čerpání do mínusu (nastavuje admin v Provozu).",
      "Zobrazí se, kolik lidí z vašeho týmu má ve stejném termínu už schválené volno.",
      "Pole „Zastupování“ se předvyplní vaším výchozím zástupcem (nastaví admin/manažer v Nastavení firmy nebo Můj tým).",
    ],
  },
  {
    title: "Týmový kalendář",
    icon: CalendarDays,
    color: "sky",
    items: [
      "Na vlastním řádku jde termín vybrat přetažením myší — rovnou otevře formulář žádosti.",
      "Přepínání pohledu: Měsíc / 2 týdny / Týden, plus filtr podle oddělení, typu absence a hledání jména.",
      "Dnešní den je zvýrazněný, státní svátky mají vlastní barvu (najetím myší se ukáže název svátku).",
      "Najetím myší na barevný pruh se zobrazí detail — kdo, jaký typ absence, kdo zastupuje.",
    ],
  },
  {
    title: "Moje žádosti",
    icon: ListChecks,
    color: "violet",
    items: [
      "U každé žádosti je vidět počet dní, kdo ji schválil, a barevný stav (zelená/oranžová/červená).",
      "U zamítnuté žádosti se zobrazí důvod a tlačítko „Upravit a poslat znovu“.",
      "Čekající žádost jde upravit nebo zrušit. Schválenou/zamítnutou jde rychle zopakovat tlačítkem „Duplikovat“.",
      "Filtr podle roku a typu absence nahoře.",
    ],
  },
  {
    title: "Ke schválení (manažer)",
    icon: Clock,
    color: "plum",
    roles: ["manager", "admin"],
    items: [
      "Žádosti od vašich přímých podřízených se řadí nahoru a mají odznak „Váš tým“.",
      "Checkboxy umožňují schválit více žádostí najednou.",
      "Systém upozorní, pokud by schválení srazilo zůstatek žadatele do minusu nebo přesáhlo kapacitní limit oddělení.",
    ],
  },
  {
    title: "Můj tým",
    icon: Users,
    color: "moss",
    roles: ["manager", "admin"],
    items: [
      "Přiřazování oddělení, nadřízeného a výchozího zástupce jednotlivým lidem.",
      "Pozvánkový odkaz pro nové kolegy — po registraci se rovnou přiřadí k firmě.",
      "„Riziko vyhoření“ upozorní, když někdo z týmu déle než 6 měsíců nečerpal delší dovolenou.",
    ],
  },
  {
    title: "Nastavení firmy (admin)",
    icon: Settings,
    color: "sage",
    roles: ["admin"],
    items: [
      "Uživatelé — role, oddělení, nadřízený, zástup, roční nároky, hromadný CSV import.",
      "Oddělení — vedoucí oddělení, sloučení duplicit.",
      "Typy absencí — barvy, co se čerpá z jakého limitu, výchozí nároky pro nové zaměstnance.",
      "Provoz — směny, pracovní dny, pravidla pro žádosti (předstih, zpětné zadávání, mínus, expirace dovolené), kapacitní varování, blokované termíny, celozávodní dovolená.",
      "Fakturace — fakturační údaje (lze načíst z ARES podle IČO) a logo firmy.",
    ],
  },
  {
    title: "Přehled a Exporty (admin)",
    icon: BarChart3,
    color: "rust",
    roles: ["admin"],
    items: [
      "Přehled — počet zaměstnanců, čekající žádosti, absence podle typu a oddělení, co se blíží v dalších 30 dnech, přehled nevyčerpané dovolené ke konci roku s hromadnou připomínkou.",
      "Exporty — stažení podkladů pro mzdy za zvolený měsíc a oddělení ve formátu CSV, XLSX nebo ODS.",
    ],
  },
  {
    title: "Účet",
    icon: UserCircle,
    color: "teal",
    items: ["Zapomenuté heslo jde obnovit odkazem z přihlašovací stránky."],
  },
];

export const faqs: HelpFaq[] = [
  {
    q: "Kdy si můžu vybrat jen půlden?",
    a: "Pouze u jednodenního termínu. U víkendů se dny automaticky odečítají.",
  },
  {
    q: "Proč mi systém nedovolí odeslat žádost o absenci?",
    a: "Nejspíš naráží na firemní pravidlo — blokovaný termín, příliš krátký předstih, zpětné zadávání nebo by vám čerpání šlo do mínusu. Přesná pravidla nastavuje admin v Nastavení firmy → Provoz.",
  },
  {
    q: "Jak poznám, že má o stejný termín zažádáno i kolega?",
    a: "Formulář žádosti zobrazí, kolik lidí z vašeho týmu má ve stejném termínu už schválené volno.",
  },
  {
    q: "Jde už odeslanou žádost ještě upravit nebo zrušit?",
    a: "Dokud čeká na schválení, ano — v Moje žádosti. Schválenou nebo zamítnutou žádost jde rychle zopakovat tlačítkem „Duplikovat“.",
  },
  {
    q: "Proč mi byla žádost zamítnuta?",
    a: "U zamítnuté žádosti v Moje žádosti se zobrazí důvod od schvalovatele a tlačítko „Upravit a poslat znovu“.",
  },
  {
    q: "Kdo se předvyplní do pole „Zastupování“?",
    a: "Váš výchozí zástupce, kterého nastaví admin nebo manažer v Nastavení firmy nebo v Můj tým.",
  },
  {
    q: "Jak nejrychleji zadám žádost přímo z kalendáře?",
    a: "Na svém řádku v Týmovém kalendáři přetáhněte myší požadovaný termín — rovnou se otevře formulář žádosti.",
  },
  {
    q: "Jak schválím víc žádostí najednou?",
    a: "V Ke schválení zaškrtněte checkboxy u vybraných žádostí a schvalte hromadně.",
    roles: ["manager", "admin"],
  },
  {
    q: "Na co mě systém upozorní při schvalování?",
    a: "Pokud by schválení srazilo zůstatek žadatele do mínusu nebo přesáhlo kapacitní limit oddělení.",
    roles: ["manager", "admin"],
  },
  {
    q: "Jak pozvu nového kolegu do firmy?",
    a: "V Můj tým nebo v Nastavení firmy → Uživatelé odešlete pozvánkový odkaz — po registraci se kolega rovnou přiřadí k firmě.",
    roles: ["manager", "admin"],
  },
  {
    q: "Jak hromadně importuji zaměstnance?",
    a: "V Nastavení firmy → Uživatelé je CSV import, který založí účty i oddělení najednou.",
    roles: ["admin"],
  },
  {
    q: "Kde nastavím firemní logo a fakturační údaje?",
    a: "V Nastavení firmy → Fakturace. Údaje o firmě lze načíst automaticky z ARES podle IČO.",
    roles: ["admin"],
  },
  {
    q: "Co je celozávodní dovolená?",
    a: "Admin ji nastaví v Nastavení firmy → Provoz — je to jednotné volno, které se rovnou přiřadí celé firmě nebo vybraným oddělením (např. vánoční odstávka).",
    roles: ["admin"],
  },
  {
    q: "Jak funguje upozornění na riziko vyhoření?",
    a: "Na stránce Můj tým se zobrazí lidé, kteří si déle než 6 měsíců nevzali delší dovolenou (aspoň 3 dny v kuse) — stojí za to jim ji připomenout.",
    roles: ["manager", "admin"],
  },
  {
    q: "Jak pošlu hromadnou připomínku o nevyčerpané dovolené?",
    a: "V Přehledu je sekce „Nevyčerpaná dovolená ke konci roku“ — zaškrtněte lidi a klikněte na „Poslat připomínku“, každému přijde upozornění v aplikaci.",
    roles: ["admin"],
  },
  {
    q: "Zapomněl(a) jsem heslo, co mám dělat?",
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
