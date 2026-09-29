// Katalog e-mailových šablon Dodia. Texty jsou česky, oslovení "vy", věcně a přátelsky; termín "absence" (ne "volno").
// `live: true` = e-mail už dnes odchází (texty vznikají v SQL triggerech a v /api/cron/*, tady je jejich podoba);
// `live: false` = připraveno k zapojení (fakturace, trial se NEpoužívá — tarif Free je trvale zdarma).
// Zdravotní údaje se do e-mailů nikdy nepíšou; u soukromých absencí (nemoc) se typ uvádí jen schvalovateli.

export type Vars = Record<string, string>;

export interface EmailTemplate {
  key: string;
  name: string;
  /** Kdy se posílá. */
  when: string;
  /** Komu. */
  to: string;
  live: boolean;
  /** Dostupné proměnné (ukázkové hodnoty viz `sample`). */
  vars: string[];
  subject: (v: Vars) => string;
  paragraphs: (v: Vars) => string[];
  cta?: { label: string; path: string };
  /** Věta v patičce — u provozních/právních e-mailů nejde vypnout. */
  optOut?: boolean;
  /** Patří k funkci, která je teď vypnutá (CHAT_INTEGRATIONS_ENABLED) — nepočítá se mezi „připravené k zapojení“. */
  dormant?: boolean;
  /** Obchodní sdělení (úvodní série „Co Dodio umí“) — jiná patička, nejde o provozní e-mail. */
  marketing?: boolean;
}

const hello = (v: Vars) => `Dobrý den${v.jmeno ? ` ${v.jmeno}` : ""},`;

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  // ------------------------------------------------------------------ žádosti o absenci
  {
    key: "request_created",
    name: "Nová žádost o absenci",
    when: "Zaměstnanec odešle žádost, která vyžaduje schválení.",
    to: "Schvalovatel (nadřízený, vedoucí / zástupce oddělení, admin)",
    live: true,
    vars: ["zadatel", "typ", "termin"],
    subject: () => "Nová žádost o absenci",
    paragraphs: (v) => [`${v.zadatel} podal(a) žádost o absenci (${v.typ}, ${v.termin}) a čeká na vaše rozhodnutí.`],
    cta: { label: "Otevřít žádosti ke schválení", path: "/approvals" },
    optOut: true,
  },
  {
    key: "request_blackout",
    name: "Žádost v blokovaném termínu",
    when: "Zaměstnanec odešle žádost i přes blokovaný termín (firemní odstávka, uzávěrka…).",
    to: "Schvalovatel",
    live: true,
    vars: ["zadatel", "typ", "termin", "blokace"],
    subject: () => "⚠️ Žádost v blokovaném termínu",
    paragraphs: (v) => [`${v.zadatel} podal(a) žádost o absenci (${v.typ}, ${v.termin}), i když termín spadá do blokovaného období „${v.blokace}“. Posuďte prosím, zda ji přesto schválíte.`],
    cta: { label: "Otevřít žádosti ke schválení", path: "/approvals" },
    optOut: true,
  },
  {
    key: "request_approved",
    name: "Žádost schválena",
    when: "Schvalovatel žádost schválí (nebo se schválí automaticky).",
    to: "Žadatel",
    live: true,
    vars: ["typ", "termin"],
    subject: () => "Žádost schválena",
    paragraphs: (v) => [`Dobrá zpráva: vaše žádost o absenci (${v.typ}, ${v.termin}) je schválená.`],
    cta: { label: "Zobrazit moje žádosti", path: "/requests" },
    optOut: true,
  },
  {
    key: "request_rejected",
    name: "Žádost zamítnuta",
    when: "Schvalovatel žádost zamítne (důvod je povinný).",
    to: "Žadatel",
    live: true,
    vars: ["typ", "termin", "duvod"],
    subject: () => "Žádost zamítnuta",
    paragraphs: (v) => [`Vaše žádost o absenci (${v.typ}, ${v.termin}) bohužel nebyla schválena.`, `Důvod: ${v.duvod}`],
    cta: { label: "Upravit a poslat znovu", path: "/requests" },
    optOut: true,
  },
  {
    key: "cancellation_requested",
    name: "Žádost o zrušení schválené absence",
    when: "Zaměstnanec požádá o zrušení už schválené absence.",
    to: "Schvalovatel",
    live: true,
    vars: ["zadatel", "typ", "termin"],
    subject: () => "Žádost o zrušení absence",
    paragraphs: (v) => [`${v.zadatel} žádá o zrušení schválené absence (${v.typ}, ${v.termin}).`],
    cta: { label: "Rozhodnout o zrušení", path: "/dashboard" },
    optOut: true,
  },
  {
    key: "cancellation_resolved",
    name: "Zrušení absence vyřízeno",
    when: "Schvalovatel schválí nebo zamítne zrušení.",
    to: "Žadatel",
    live: true,
    vars: ["vysledek"],
    subject: (v) => (v.vysledek === "schváleno" ? "Zrušení schváleno" : "Zrušení zamítnuto"),
    paragraphs: (v) => [v.vysledek === "schváleno" ? "Vaše absence byla zrušena." : "Vaše absence zůstává v platnosti."],
    cta: { label: "Zobrazit moje žádosti", path: "/requests" },
    optOut: true,
  },
  {
    key: "escalation",
    name: "Žádost čeká — zastupujete schvalovatele",
    when: "Žádost čeká déle než nastavená doba nebo je schvalovatel dnes nepřítomen (denní kontrola).",
    to: "Zástupce vedoucího oddělení, případně admini",
    live: true,
    vars: ["zadatel", "typ", "duvod"],
    subject: () => "Žádost čeká na schválení",
    paragraphs: (v) => [`${v.zadatel} podal(a) žádost o absenci (${v.typ}) a čeká na rozhodnutí — zastupujete jejich schvalovatele (${v.duvod}).`],
    cta: { label: "Otevřít žádosti ke schválení", path: "/approvals" },
    optOut: true,
  },
  // ------------------------------------------------------------------ přehledy a připomínky
  {
    key: "weekly_digest",
    name: "Týdenní přehled absencí",
    when: "Každé pondělí ráno.",
    to: "Manažeři a admini",
    live: true,
    vars: ["jmeno", "cekajici", "pocet", "seznam"],
    subject: () => "Týdenní přehled absencí — Dodio",
    paragraphs: (v) => [`Dobré ráno ${v.jmeno},`, `tady je týdenní přehled — čekající žádosti: ${v.cekajici}, absence tento týden: ${v.pocet}.`, v.seznam],
    cta: { label: "Otevřít kalendář", path: "/calendar" },
    optOut: true,
  },
  {
    key: "hr_digest",
    name: "Týdenní přehled pro HR",
    when: "Každé pondělí ráno, jen když je co řešit (riziko podkapacity, žádosti čekající déle, dovolená, která propadne).",
    to: "Admini a lidé s rolí HR",
    live: true,
    vars: ["cekajici", "seznam"],
    subject: () => "Týdenní přehled pro HR — Dodio",
    paragraphs: (v) => ["Dobré ráno,", "tady je týdenní přehled pro HR.", "Riziko podkapacity v nejbližších týdnech:", v.seznam, `Řešení trvalo déle než obvykle u ${v.cekajici} čekajících žádostí.`],
    cta: { label: "Otevřít Analytiku", path: "/admin/overview" },
    optOut: true,
  },
  {
    key: "vacation_reminder",
    name: "Nevyčerpaná dovolená",
    when: "HR nebo admin pošle hromadnou připomínku (Analytika → Nevyčerpaná dovolená).",
    to: "Vybraní zaměstnanci",
    live: true,
    vars: [],
    subject: () => "Nevyčerpaná dovolená",
    paragraphs: () => ["Do konce roku vám zbývá nevyčerpaná dovolená — naplánujte si ji včas, ať nepropadne."],
    cta: { label: "Naplánovat dovolenou", path: "/calendar" },
    optOut: true,
  },
  {
    key: "carryover_expiring",
    name: "Blíží se propadnutí převedené dovolené",
    when: "30 a 7 dní před datem propadnutí převedené dovolené (nastavení: Provoz & kalendář).",
    to: "Zaměstnanec s nevyčerpanou převedenou dovolenou",
    live: false,
    vars: ["jmeno", "dny", "datum"],
    subject: (v) => `Převedená dovolená propadne ${v.datum}`,
    paragraphs: (v) => [hello(v), `z minulého roku vám zbývá ${v.dny} dní dovolené, které propadnou ${v.datum}.`, "Vyčerpejte je prosím včas."],
    cta: { label: "Naplánovat dovolenou", path: "/calendar" },
    optOut: true,
  },
  {
    key: "wellbeing_reminder",
    name: "Připomínka delší dovolené",
    when: "Manažer klikne na „Připomenout“ u člověka, který dlouho nečerpal delší dovolenou.",
    to: "Zaměstnanec",
    live: true,
    vars: [],
    subject: () => "Čas na pořádný odpočinek",
    paragraphs: () => ["Už dlouho jste si nevzali delší dovolenou.", "Naplánujte si prosím odpočinek — dobře si ho zasloužíte."],
    cta: { label: "Naplánovat dovolenou", path: "/calendar" },
    optOut: true,
  },
  // ------------------------------------------------------------------ účty a pozvánky
  {
    key: "welcome_admin",
    name: "Vítejte v Dodio (zakladatel firmy)",
    when: "Po založení firmy.",
    to: "Nový admin",
    live: false,
    vars: ["jmeno", "firma"],
    subject: () => "Vítejte v Dodio",
    paragraphs: (v) => [
      hello(v),
      `firma ${v.firma} je založená a můžete začít. Na nástěnce najdete průvodce „Začínáme“: doplňte údaje o firmě, vytvořte oddělení, pozvěte kolegy a zkontrolujte pravidla absencí.`,
      "Když si nebudete vědět rady, v Centru nápovědy najdete postupy krok za krokem.",
    ],
    cta: { label: "Pokračovat v nastavení", path: "/dashboard" },
    optOut: false,
  },
  {
    key: "welcome_employee",
    name: "Vítejte v Dodio (zaměstnanec)",
    when: "Po připojení k firmě (pozvánkou nebo odkazem) a schválení účtu.",
    to: "Nový zaměstnanec",
    live: false,
    vars: ["jmeno", "firma"],
    subject: (v) => `Vítejte v ${v.firma} na Dodiu`,
    paragraphs: (v) => [hello(v), `váš účet ve firmě ${v.firma} je připravený. V Dodiu požádáte o dovolenou, uvidíte kolegy v týmovém kalendáři a sledujete svůj zůstatek.`, "Žádost o absenci podáte jedním kliknutím na tlačítko „Nová žádost“."],
    cta: { label: "Otevřít Dodio", path: "/dashboard" },
    optOut: false,
  },
  {
    key: "invite",
    name: "Pozvánka do firmy",
    when: "Admin nebo HR pozve člověka e-mailem.",
    to: "Zvaný",
    live: true,
    vars: ["jmeno", "pozvatel", "firma", "odkaz"],
    subject: (v) => `${v.pozvatel} vás zve do Dodia (${v.firma})`,
    paragraphs: (v) => [
      hello(v),
      `${v.pozvatel} vás zve do firmy ${v.firma} v aplikaci Dodio pro správu absencí.`,
      "Klikněte na tlačítko níže, zvolte si heslo a hned se zařadíte do firmy. Adresa je už předvyplněná.",
    ],
    cta: { label: "Dokončit registraci", path: "/login" },
    optOut: false,
  },
  {
    key: "join_pending",
    name: "Nový uživatel čeká na schválení",
    when: "Někdo se zaregistruje přes registrační odkaz a firma vyžaduje schválení.",
    to: "Admini",
    live: true,
    vars: ["jmeno", "email"],
    subject: () => "Nový uživatel čeká na schválení",
    paragraphs: (v) => [`${v.jmeno} (${v.email}) se zaregistroval(a) přes registrační odkaz a čeká na vaše schválení. Do té doby se nepřihlásí a nic ve firmě neuvidí.`],
    cta: { label: "Schválit nebo odmítnout", path: "/admin/settings?sekce=users" },
    optOut: true,
  },
  {
    key: "account_approved",
    name: "Váš účet byl schválen",
    when: "Admin schválí registraci z odkazu.",
    to: "Nový zaměstnanec",
    live: false,
    vars: ["jmeno", "firma"],
    subject: (v) => `Váš účet ve firmě ${v.firma} byl schválen`,
    paragraphs: (v) => [hello(v), `správce firmy ${v.firma} schválil vaši registraci. Nyní se můžete přihlásit.`],
    cta: { label: "Přihlásit se", path: "/login" },
    optOut: false,
  },
  {
    key: "help_question",
    name: "Nový dotaz z Nápovědy",
    when: "Někdo pošle dotaz přes „Napsat na podporu“ v Nápovědě.",
    to: "Manažeři a admini firmy",
    live: true,
    vars: ["jmeno", "dotaz"],
    subject: (v) => `Dotaz od ${v.jmeno}`,
    paragraphs: (v) => [`${v.jmeno} se ptá:`, v.dotaz],
    optOut: true,
  },
  // ------------------------------------------------------------------ tarif a fakturace
  {
    key: "plan_limit_90",
    name: "Blízko limitu tarifu (90 %)",
    when: "Počet uživatelů dosáhne 90 % limitu tarifu.",
    to: "Admini",
    live: false,
    vars: ["jmeno", "tarif", "pocet", "limit", "dalsi_tarif"],
    subject: (v) => `Blížíte se limitu tarifu ${v.tarif}`,
    paragraphs: (v) => [
      hello(v),
      `ve firmě máte ${v.pocet} z ${v.limit} uživatelů, které zahrnuje tarif ${v.tarif}.`,
      `Až tým poroste, doporučujeme přejít na tarif ${v.dalsi_tarif}, ať máte pro všechny místo a k dispozici všechny funkce.`,
    ],
    cta: { label: "Porovnat tarify", path: "/admin/settings?sekce=billing" },
    optOut: false,
  },
  {
    key: "plan_limit_reached",
    name: "Limit tarifu překročen",
    when: "Počet uživatelů překročí limit tarifu.",
    to: "Admini",
    live: false,
    vars: ["jmeno", "tarif", "pocet", "limit"],
    subject: (v) => `Limit tarifu ${v.tarif} je překročen`,
    paragraphs: (v) => [hello(v), `ve firmě máte ${v.pocet} uživatelů, tarif ${v.tarif} jich zahrnuje ${v.limit}.`, "Vyberte prosím tarif, který odpovídá počtu lidí ve firmě. Aplikace vám zatím běží beze změny."],
    cta: { label: "Zvolit tarif", path: "/admin/settings?sekce=billing" },
    optOut: false,
  },
  {
    key: "invoice_issued",
    name: "Faktura vystavena",
    when: "Po vystavení faktury.",
    to: "E-mail pro faktury (Fakturace → Fakturační údaje)",
    live: false,
    vars: ["cislo", "castka", "splatnost"],
    subject: (v) => `Faktura ${v.cislo} — Dodio`,
    paragraphs: (v) => [`Dobrý den,`, `vystavili jsme fakturu ${v.cislo} na částku ${v.castka}. Splatnost: ${v.splatnost}.`, "Fakturu najdete v archivu faktur v aplikaci."],
    cta: { label: "Otevřít archiv faktur", path: "/admin/settings?sekce=billing" },
    optOut: false,
  },
  {
    key: "payment_reminder_3",
    name: "Upomínka k platbě (+3 dny po splatnosti)",
    when: "3 dny po splatnosti nezaplacené faktury.",
    to: "E-mail pro faktury",
    live: false,
    vars: ["cislo", "castka", "splatnost"],
    subject: (v) => `Připomínka platby faktury ${v.cislo}`,
    paragraphs: (v) => ["Dobrý den,", `evidujeme nezaplacenou fakturu ${v.cislo} na ${v.castka}, splatnou ${v.splatnost}.`, "Pokud jste už zaplatili, tento e-mail prosím ignorujte. Děkujeme."],
    cta: { label: "Zobrazit fakturu", path: "/admin/settings?sekce=billing" },
    optOut: false,
  },
  {
    key: "payment_reminder_7",
    name: "Upomínka k platbě (+7 dní po splatnosti)",
    when: "7 dní po splatnosti.",
    to: "E-mail pro faktury",
    live: false,
    vars: ["cislo", "castka", "splatnost"],
    subject: (v) => `Faktura ${v.cislo} je po splatnosti`,
    paragraphs: (v) => ["Dobrý den,", `faktura ${v.cislo} na ${v.castka} je 7 dní po splatnosti (${v.splatnost}).`, "Uhraďte ji prosím co nejdříve, aby nedošlo k omezení služby. Kdyby byl s platbou problém, odpovězte na tento e-mail."],
    cta: { label: "Zobrazit fakturu", path: "/admin/settings?sekce=billing" },
    optOut: false,
  },
  {
    key: "payment_reminder_14",
    name: "Upomínka k platbě (+14 dní po splatnosti)",
    when: "14 dní po splatnosti.",
    to: "E-mail pro faktury a admini",
    live: false,
    vars: ["cislo", "castka", "splatnost", "datum_omezeni"],
    subject: (v) => `Poslední upomínka: faktura ${v.cislo}`,
    paragraphs: (v) => [
      "Dobrý den,",
      `faktura ${v.cislo} na ${v.castka} je 14 dní po splatnosti (${v.splatnost}).`,
      `Pokud nebude uhrazena do ${v.datum_omezeni}, přejde firma na tarif Free a nadlimitní funkce se omezí. Vaše data zůstanou zachována.`,
    ],
    cta: { label: "Zobrazit fakturu", path: "/admin/settings?sekce=billing" },
    optOut: false,
  },
  // ------------------------------------------------------------------ úvodní série „Co Dodio umí“ (adminům, dny 1 / 3 / 6 / 10 / 14 po založení firmy)
  // Obchodní sdělení: před spuštěním je potřeba odhlašovací odkaz a vlastní kategorie (viz FOOTER_MARKETING).
  {
    key: "intro_1_requests",
    name: "Co Dodio umí 1/5: Žádost jedním klikem",
    when: "Den 1 po založení firmy.",
    to: "Admin nově založené firmy",
    live: false,
    marketing: true,
    vars: ["jmeno", "firma"],
    subject: () => "Dovolená na pár kliknutí: jak funguje žádost v Dodiu",
    paragraphs: (v) => [
      hello(v),
      `firma ${v.firma} je v Dodiu založená. V následujících dnech vám v pěti krátkých e-mailech ukážeme, co všechno aplikace umí. Začneme tím nejdůležitějším: žádostí o absenci.`,
      "Zaměstnanec vybere typ a termín a Dodio za něj ohlídá zbytek: víkendy a státní svátky se neodečítají, zůstatek se počítá za správný rok a půlden jde zadat u jednodenního termínu. Systém také hlídá vaše pravidla: blokované termíny, minimální předstih nebo čerpání do mínusu.",
      "Vybrané typy, třeba Home Office nebo krátká absence do nastaveného počtu dní, se schvalují automaticky. Schvalovatel tak řeší jen to, co opravdu vyžaduje jeho rozhodnutí.",
      "Tip: na nástěnce najdete rychlé čipy „Dovolená“, „Home Office“ a „Sick Day“, které otevřou formulář rovnou s vybraným typem.",
    ],
    cta: { label: "Zkusit novou žádost", path: "/dashboard" },
  },
  {
    key: "intro_2_calendar",
    name: "Co Dodio umí 2/5: Týmový kalendář",
    when: "Den 3 po založení firmy.",
    to: "Admin nově založené firmy",
    live: false,
    marketing: true,
    vars: ["jmeno"],
    subject: () => "Kdo kdy chybí? Podívejte se do týmového kalendáře",
    paragraphs: (v) => [
      hello(v),
      "dnes vám ukážeme týmový kalendář, místo, kde se sejdou všechny absence ve firmě.",
      "Schválené absence jsou plnou barvou, čekající šrafované, státní svátky mají vlastní barvu. Kalendář jde filtrovat podle oddělení, typu a jména a přepínat mezi týdnem, dvěma týdny a měsícem. Termín na vlastním řádku stačí přetáhnout myší a rovnou se otevře formulář žádosti.",
      "Kalendář si můžete přihlásit i do Google, Outlooku nebo Apple Kalendáře přes odkaz iCal v sekci Můj účet, takže absence kolegů uvidíte i v mobilu. iCal je součástí tarifu Starter a vyšších.",
      "Tip: zapněte „Seskupit podle oddělení“ a hned uvidíte, kde se v týmu překrývá víc lidí najednou.",
    ],
    cta: { label: "Otevřít kalendář", path: "/calendar" },
  },
  {
    key: "intro_3_approvals",
    name: "Co Dodio umí 3/5: Schvalování bez zdržení",
    when: "Den 6 po založení firmy.",
    to: "Admin nově založené firmy",
    live: false,
    marketing: true,
    vars: ["jmeno"],
    subject: () => "Schvalování žádostí na jedno kliknutí, i z e-mailu",
    paragraphs: (v) => [
      hello(v),
      "dobré rozhodnutí o dovolené potřebuje kontext a rychlost. Právě to Dodio schvalovatelům dává.",
      "U každé žádosti je vidět varování: záporný zůstatek, překročená kapacita oddělení nebo konflikt s kolegou. K tomu náhled týdne s ostatními z oddělení. Více žádostí najednou schválíte nebo zamítnete zaškrtnutím a lištou dole. Zamítnutí vyžaduje důvod, který žadatel uvidí.",
      "Žádost můžete schválit nebo zamítnout přímo z e-mailu, bez přihlášení do aplikace. V tarifu Pro navíc žádosti, které čekají příliš dlouho nebo je schvalovatel nepřítomen, automaticky přejdou na zástupce.",
      "Tip: u lidí nastavte nadřízeného a výchozího zástupce v sekci Můj tým. Žádosti pak putují ke správnému člověku samy.",
    ],
    cta: { label: "Nastavit nadřízené a zástupce", path: "/team" },
  },
  {
    key: "intro_4_planning",
    name: "Co Dodio umí 4/5: Dovolená pod kontrolou",
    when: "Den 10 po založení firmy.",
    to: "Admin nově založené firmy",
    live: false,
    marketing: true,
    vars: ["jmeno"],
    subject: () => "Ať dovolená nepropadne: pravidla a připomínky v Dodiu",
    paragraphs: (v) => [
      hello(v),
      "nejčastější starost s dovolenou zní: „Kolik mi ještě zbývá a nepropadne mi něco?“ Dodio na ni odpovídá samo.",
      "V nastavení určíte, kolik dní se smí převést do dalšího roku a kdy převedená dovolená propadne. Zaměstnanci to vidí přímo na nástěnce u svého zůstatku. Nevyčerpanou dovolenou ke konci roku uvidíte v Analytice a jedním kliknutím pošlete připomínku vybraným lidem.",
      "Chytré návrhy dovolené doporučí vhodné termíny podle toho, co zbývá a kdy je v týmu klid. Tarif Team navíc umí přiznat nárok automaticky podle odpracovaných let ve firmě.",
      "Tip: v sekci Provoz & kalendář si nastavte i blokované termíny, například inventuru nebo uzávěrku, aby se do nich žádosti nedostávaly nepovšimnuty.",
    ],
    cta: { label: "Otevřít nastavení provozu", path: "/admin/settings" },
  },
  {
    key: "intro_5_reports",
    name: "Co Dodio umí 5/5: Podklady pro mzdy a přehledy",
    when: "Den 14 po založení firmy.",
    to: "Admin nově založené firmy",
    live: false,
    marketing: true,
    vars: ["jmeno", "firma"],
    subject: () => "Konec měsíce bez tabulek: podklady pro mzdy z Dodia",
    paragraphs: (v) => [
      hello(v),
      `poslední e-mail k tomu, co Dodio umí, je pro ${v.firma} o přehledech.`,
      "Analytika ukazuje absence podle typu a oddělení, kapacitu týmu a nadcházející absence a je součástí i tarifu Free. Podklady pro mzdy za zvolený měsíc a oddělení stáhnete jako CSV, XLSX nebo ODS a pošlete účetní. Exporty a role Účetní jsou v tarifu Starter a vyšších, historie změn (kdo, kdy a co změnil) v tarifu Team.",
      "Free je trvale zdarma pro až 5 uživatelů. Až vám bude tým růst, tarify najdete porovnané v aplikaci.",
      "Kdybyste si nevěděli rady, v Centru nápovědy jsou postupy krok za krokem a případně nám můžete napsat rovnou z aplikace.",
    ],
    cta: { label: "Porovnat tarify", path: "/admin/settings?sekce=billing" },
  },
  // ------------------------------------------------------------------ právní a provozní
  {
    key: "terms_updated",
    name: "Nová verze podmínek",
    when: "Po nahrání nové verze obchodních podmínek nebo zásad zpracování údajů.",
    to: "Admini (a případně všichni uživatelé u změny zásad ochrany údajů)",
    live: false,
    vars: ["jmeno", "dokument", "od_data", "odkaz"],
    subject: (v) => `Aktualizace dokumentu: ${v.dokument}`,
    paragraphs: (v) => [
      hello(v),
      `aktualizovali jsme dokument „${v.dokument}“. Nová verze platí od ${v.od_data}.`,
      "Co se změnilo, najdete v přehledu změn na odkazu níže. Pokud nesouhlasíte, můžete službu do data účinnosti ukončit.",
    ],
    cta: { label: "Přečíst novou verzi", path: "/help" },
    optOut: false,
  },
  {
    key: "data_deletion_scheduled",
    name: "Smazání dat naplánováno",
    when: "Po požadavku na smazání dat firmy nebo účtu.",
    to: "Žadatel (admin)",
    live: false,
    vars: ["jmeno", "firma", "datum"],
    subject: () => "Smazání dat bylo naplánováno",
    paragraphs: (v) => [
      hello(v),
      `přijali jsme žádost o smazání dat firmy ${v.firma}. Data budou nenávratně smazána dne ${v.datum}.`,
      "Do tohoto data můžete žádost zrušit v aplikaci. Před smazáním si můžete stáhnout exporty (Exporty → CSV / XLSX).",
    ],
    cta: { label: "Zrušit smazání", path: "/admin/settings?sekce=billing" },
    optOut: false,
  },
  {
    key: "data_deleted",
    name: "Data byla smazána",
    when: "Po provedení výmazu.",
    to: "Žadatel (admin)",
    live: false,
    vars: ["jmeno", "firma", "datum"],
    subject: () => "Data byla smazána",
    paragraphs: (v) => [
      hello(v),
      `potvrzujeme, že data firmy ${v.firma} byla dne ${v.datum} nenávratně smazána včetně všech účtů, absencí a nastavení.`,
      "Zálohy se mažou v rámci běžného cyklu do 30 dnů. Děkujeme, že jste Dodio používali.",
    ],
    optOut: false,
  },
  {
    key: "integration_failing",
    name: "Integrace do chatu nefunguje",
    when: "Odeslání do Slacku / Teams selže opakovaně (např. smazaný webhook).",
    to: "Admini",
    live: false,
    dormant: true,
    vars: ["jmeno", "integrace", "chyba"],
    subject: (v) => `Integrace „${v.integrace}“ nefunguje`,
    paragraphs: (v) => [hello(v), `zprávy do kanálu „${v.integrace}“ se nedaří odeslat (${v.chyba}).`, "Nejčastěji byl webhook smazán nebo vypnut. Vytvořte prosím nový a vložte jeho adresu do integrace."],
    cta: { label: "Otevřít integrace", path: "/admin/settings?sekce=integrations" },
    optOut: false,
  },
];

export const TEMPLATE_SAMPLE: Vars = {
  jmeno: "Jano",
  zadatel: "Petr Novák",
  typ: "Dovolená",
  termin: "12. 10. – 16. 10. 2026",
  blokace: "Inventura",
  duvod: "V tomto týdnu je v týmu jen jeden člověk.",
  vysledek: "schváleno",
  cekajici: "2",
  pocet: "5",
  seznam: "• Petr Novák — Dovolená (12. 10. – 16. 10.)\n• Jana Malá — Sick Day (13. 10. 2026)\n• Karel Beneš — Home Office (14. 10. – 15. 10.)",
  firma: "NaturaMed s.r.o.",
  pozvatel: "Oldřich Zvoníček",
  odkaz: "https://app.dodio.cz/login",
  email: "jana@firma.cz",
  dotaz: "Jak si mám zapsat půlden?",
  dny: "3",
  datum: "31. 3. 2027",
  tarif: "Starter",
  limit: "15",
  dalsi_tarif: "Pro",
  cislo: "2026-014",
  castka: "5 900 Kč",
  splatnost: "15. 10. 2026",
  datum_omezeni: "6. 11. 2026",
  dokument: "Obchodní podmínky",
  od_data: "1. 11. 2026",
  integrace: "#absence",
  chyba: "HTTP 404",
};

export function templateByKey(key: string) {
  return EMAIL_TEMPLATES.find((t) => t.key === key);
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Sjednocený vzhled všech e-mailů Dodia (inline styly kvůli e-mailovým klientům). */
export interface EmailAction {
  label: string;
  url: string;
  kind: "approve" | "reject" | "link";
}

const ACTION_STYLE: Record<EmailAction["kind"], string> = {
  approve: "background:#085041;color:#fff;border:1px solid #085041",
  reject: "background:#fff;color:#A32D2D;border:1px solid #A32D2D",
  link: "background:#fff;color:#085041;border:1px solid #D3D1C7",
};

// Stejná značka jako v aplikaci (src/components/shared/AppLogo.tsx). V e-mailu ale NESMÍ jít o inline SVG ani o
// CSS position:absolute — Gmail i Outlook takové věci z HTML e-mailu vystřihnou (proto se dřív ukazoval jen
// text "Dodio" bez značky). Jde tedy o obyčejný <img> na PNG v public/brand/logo-mark.png (viz scripts/gen-email-logo.mjs),
// což zvládne spolehlivě úplně každý klient.
const emailLogoHtml = (baseUrl: string) => `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:16px"><tr>
  <td style="width:32px;padding-right:9px" valign="middle">
    <img src="${esc(baseUrl)}/brand/logo-mark.png" width="32" height="32" alt="" style="display:block;border-radius:7px" />
  </td>
  <td valign="middle" style="font-size:20px;font-weight:bold;color:#085041">Dodio</td>
</tr></table>`;

// A paragraph made only of "• " lines (e.g. the weekly digest's list of who's out) renders as a real list —
// bordered rows, the part before " — " in bold — instead of one <br>-joined wall of text.
function renderParagraph(p: string): string {
  const rawLines = p.split("\n");
  if (rawLines.length < 2 || !rawLines.every((l) => l.startsWith("• "))) {
    return `<p style="margin:0 0 14px;line-height:1.55">${esc(p).replace(/\n/g, "<br>")}</p>`;
  }
  const items = rawLines
    .map((l) => l.slice(2))
    .map((l, i, all) => {
      const border = i < all.length - 1 ? "border-bottom:1px solid #EFEDE6;" : "";
      const dashIdx = l.indexOf(" — ");
      if (dashIdx === -1) return `<li style="padding:7px 0;${border}">${esc(l)}</li>`;
      return `<li style="padding:7px 0;${border}"><strong>${esc(l.slice(0, dashIdx))}</strong> — ${esc(l.slice(dashIdx + 3))}</li>`;
    })
    .join("");
  return `<ul style="margin:0 0 14px;padding:0;list-style:none">${items}</ul>`;
}

export function emailLayout(opts: { title: string; paragraphs: string[]; cta?: { label: string; url: string }; actions?: EmailAction[]; footer: string; baseUrl: string }): string {
  const body = opts.paragraphs.map(renderParagraph).join("");
  const actions = (opts.actions ?? [])
    .map((a) => `<a href="${esc(a.url)}" style="display:inline-block;margin:6px 8px 0 0;${ACTION_STYLE[a.kind]};text-decoration:none;padding:11px 20px;border-radius:6px;font-size:14px;font-weight:bold">${esc(a.label)}</a>`)
    .join("");
  const button = opts.cta
    ? `<a href="${esc(opts.cta.url)}" style="display:inline-block;margin-top:6px;background:#085041;color:#fff;text-decoration:none;padding:11px 20px;border-radius:6px;font-size:14px;font-weight:bold">${esc(opts.cta.label)}</a>`
    : "";
  return `<!doctype html><html lang="cs"><body style="margin:0;background:#F7F5F0;font-family:Arial,Helvetica,sans-serif;color:#2C2C2A">
<div style="max-width:560px;margin:0 auto;padding:24px">
  ${emailLogoHtml(opts.baseUrl)}
  <div style="background:#fff;border:1px solid #D3D1C7;border-radius:8px;padding:24px">
    <h1 style="font-size:18px;margin:0 0 14px">${esc(opts.title)}</h1>
    ${body}
    ${button}${actions}
  </div>
  <div style="font-size:12px;color:#5F5E5A;margin-top:14px;line-height:1.5">${esc(opts.footer)}</div>
</div></body></html>`;
}

export const FOOTER_NOTIFICATION = "Tato upozornění můžete vypnout v aplikaci u zvonečku notifikací.";
// Obchodní sdělení: před ostrým spuštěním doplnit skutečný odhlašovací odkaz (a vlastní kategorii v Nastavení → E-maily).
export const FOOTER_MARKETING = "Tento e-mail je součástí úvodní série o funkcích Dodia. Další e-maily z ní můžete kdykoli odhlásit odpovědí na tento e-mail.";
export const FOOTER_TRANSACTIONAL = "Tento e-mail je provozní a nelze ho vypnout. Dodio — správa firemních absencí na pár kliknutí.";

/** Vykreslí šablonu s proměnnými: předmět, prostý text a HTML. Chybějící proměnná se vypíše jako „[název]“. */
export function renderTemplate(key: string, vars: Vars, baseUrl: string) {
  const t = templateByKey(key);
  if (!t) throw new Error(`Neznámá šablona: ${key}`);
  const safe = new Proxy(vars, { get: (o, k: string) => o[k] ?? `[${k}]` }) as Vars;
  const subject = t.subject(safe);
  const paragraphs = t.paragraphs(safe);
  const cta = t.cta ? { label: t.cta.label, url: vars.odkaz && t.key === "invite" ? vars.odkaz : `${baseUrl.replace(/\/$/, "")}${t.cta.path}` } : undefined;
  const footer = t.marketing ? FOOTER_MARKETING : t.optOut ? FOOTER_NOTIFICATION : FOOTER_TRANSACTIONAL;
  return {
    subject,
    text: `${paragraphs.join("\n\n")}${cta ? `\n\n${cta.label}: ${cta.url}` : ""}\n\n${footer}`,
    html: emailLayout({ title: subject, paragraphs, cta, footer, baseUrl: baseUrl.replace(/\/$/, "") }),
  };
}
