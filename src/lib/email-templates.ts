// Katalog e-mailových šablon Dodia. Texty jsou česky, oslovení "vy", lidsky a přirozeně (jako by psal kolega),
// ale s vědomím, že jde o pracovní věc — ne kamarádsky/tykání; termín "absence" (ne "volno").
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
    paragraphs: (v) => [`${v.zadatel} vám poslal(a) žádost o absenci (${v.typ}, ${v.termin}) — mrkněte se na ni, až budete mít chvíli.`],
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
    paragraphs: (v) => [`${v.zadatel} poslal(a) žádost o absenci (${v.typ}, ${v.termin}) i přesto, že termín spadá do blokovaného období „${v.blokace}“. Mrkněte se na ni a rozhodněte, jestli ji přesto pustíte dál.`],
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
    paragraphs: (v) => [`Dobrá zpráva — žádost o absenci (${v.typ}, ${v.termin}) je schválená, můžete s tím počítat.`],
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
    paragraphs: (v) => [`Mrzí nás to, ale žádost o absenci (${v.typ}, ${v.termin}) tentokrát neprošla.`, `Důvod: ${v.duvod}`],
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
    paragraphs: (v) => [`${v.zadatel} by rád(a) zrušil(a) už schválenou absenci (${v.typ}, ${v.termin}) — stačí mrknout a rozhodnout.`],
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
    paragraphs: (v) => [v.vysledek === "schváleno" ? "Zrušení prošlo, absence je pryč z kalendáře." : "Zrušení jsme nepotvrdili, absence platí dál beze změny."],
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
    paragraphs: (v) => [`${v.zadatel} čeká na rozhodnutí o žádosti (${v.typ}) — zaskakujete za schvalovatele (${v.duvod}), tak to prosím vyřiďte.`],
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
    paragraphs: (v) => [`Dobré ráno ${v.jmeno},`, `tady je váš týdenní přehled — čeká na vás ${v.cekajici} žádostí, absencí tento týden: ${v.pocet}.`, v.seznam],
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
    paragraphs: (v) => ["Dobré ráno,", "tady je váš týdenní přehled pro HR — pár věcí, na které stojí za to mrknout.", "Riziko podkapacity v nejbližších týdnech:", v.seznam, `Řešení trvalo déle než obvykle u ${v.cekajici} čekajících žádostí.`],
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
    paragraphs: () => ["Než skončí rok, zbývá vám ještě nevyčerpaná dovolená — naplánujte si ji včas, ať vám nepropadne."],
    cta: { label: "Naplánovat dovolenou", path: "/calendar" },
    optOut: true,
  },
  {
    key: "carryover_expiring",
    name: "Blíží se propadnutí převedené dovolené",
    when: "30 a 7 dní před datem propadnutí převedené dovolené (nastavení: Kalendář a provoz).",
    to: "Zaměstnanec s nevyčerpanou převedenou dovolenou",
    live: false,
    vars: ["jmeno", "dny", "datum"],
    subject: (v) => `Převedená dovolená propadne ${v.datum}`,
    paragraphs: (v) => [hello(v), `z loňska vám ještě zbývá ${v.dny} dní dovolené a ${v.datum} propadnou.`, "Naplánujte si je radši teď, ať o ně nepřijdete."],
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
    paragraphs: () => ["Všimli jsme si, že už dlouho nemáte v plánu žádné volno.", "Naplánujte si pořádný odpočinek — zasloužíte si ho."],
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
      `firma ${v.firma} je na světě a můžete rovnou začít. Na nástěnce najdete průvodce „Začínáme“: doplňte údaje o firmě, vytvořte oddělení, pozvěte kolegy a zkontrolujte pravidla absencí.`,
      "Kdyby něco nešlo najít, v Centru nápovědy máme postupy krok za krokem.",
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
    paragraphs: (v) => [hello(v), `váš účet ve firmě ${v.firma} je hotový a připravený k použití. V Dodiu si zažádáte o dovolenou, uvidíte, kdo z týmu je pryč, a máte přehled o svém zůstatku.`, "Stačí kliknout na „Nová žádost“ a je to."],
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
      `${v.pozvatel} vás zve do Dodia — appky, kterou ${v.firma} používá na dovolené a další absence.`,
      "Stačí kliknout níže, zvolit si heslo a jste v týmu. E-mail máte už předvyplněný.",
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
    paragraphs: (v) => [`${v.jmeno} (${v.email}) se přihlásil(a) přes registrační odkaz a čeká, až mu/jí dáte zelenou. Do té doby se do firmy nedostane.`],
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
    paragraphs: (v) => [hello(v), `správce firmy ${v.firma} vás pustil dovnitř — registrace je potvrzená a můžete se rovnou přihlásit.`],
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
      `ve firmě už máte ${v.pocet} z ${v.limit} lidí, kolik jich pokrývá tarif ${v.tarif}.`,
      `Jakmile se limit naplní, nepůjde přidat další lidi — mrkněte se na tarif ${v.dalsi_tarif}, ať vás to nezaskočí.`,
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
    paragraphs: (v) => [hello(v), `ve firmě máte ${v.pocet} lidí, ale tarif ${v.tarif} pokrývá jen ${v.limit}.`, "Než půjde přidat někoho dalšího, bude potřeba přejít na vyšší tarif."],
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
    paragraphs: (v) => [`Dobrý den,`, `právě jsme vystavili fakturu ${v.cislo} na ${v.castka}, splatnou do ${v.splatnost}.`, "Najdete ji v archivu faktur v appce, kdybyste ji potřebovali znovu."],
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
    paragraphs: (v) => ["Dobrý den,", `faktura ${v.cislo} na ${v.castka} měla být uhrazená k ${v.splatnost} a zatím ji u sebe nevidíme.`, "Pokud jste už platili, berte to jako křížení se s tímto e-mailem — a díky."],
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
    paragraphs: (v) => ["Dobrý den,", `faktura ${v.cislo} na ${v.castka} je teď už týden po splatnosti (${v.splatnost}).`, "Uhraďte ji prosím co nejdřív, ať vám nezačneme omezovat službu. A kdyby s platbou byl nějaký zádrhel, stačí odpovědět na tenhle e-mail."],
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
      `faktura ${v.cislo} na ${v.castka} je bohužel už 14 dní po splatnosti (${v.splatnost}).`,
      `Když ji neuhradíte do ${v.datum_omezeni}, přepneme firmu na tarif Free a nadlimitní funkce se zamknou — data ale zůstanou v pořádku, o nic nepřijdete.`,
    ],
    cta: { label: "Zobrazit fakturu", path: "/admin/settings?sekce=billing" },
    optOut: false,
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
      `upravili jsme dokument „${v.dokument}“ a nová verze platí od ${v.od_data}.`,
      "Co přesně se změnilo, najdete v přehledu na odkazu níže. Kdyby vám nové znění nesedělo, do data účinnosti můžete službu ukončit.",
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
      `máme vaši žádost o smazání dat firmy ${v.firma} — provedeme to ${v.datum} a pak už to nepůjde vzít zpět.`,
      "Do té doby žádost můžete v appce zrušit. A kdybyste si ještě chtěli něco stáhnout, exporty najdete v Exporty → CSV / XLSX.",
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
      `data firmy ${v.firma} jsme ${v.datum} smazali — účty, absence i nastavení, všechno je pryč a nejde to vrátit.`,
      "Zálohy doběhnou svým vlastním cyklem do 30 dnů. Díky, že jste s námi Dodio zkusili.",
    ],
    optOut: false,
  },
  {
    key: "integration_failing",
    name: "Integrace do chatu nefunguje",
    when: "Odeslání do Slacku / Teams selže opakovaně (např. smazaný webhook).",
    to: "Admini",
    live: false,
    vars: ["jmeno", "integrace", "chyba"],
    subject: (v) => `Integrace „${v.integrace}“ nefunguje`,
    paragraphs: (v) => [hello(v), `zprávy do „${v.integrace}“ nám teď nejdou odeslat (${v.chyba}).`, "Nejčastěji za tím bývá smazaný nebo vypnutý webhook — stačí vytvořit nový a vložit jeho adresu zpátky do integrace."],
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
export const FOOTER_TRANSACTIONAL = "Tento e-mail je provozní a nelze ho vypnout. Dodio — správa firemních absencí na pár kliknutí.";

/** Vykreslí šablonu s proměnnými: předmět, prostý text a HTML. Chybějící proměnná se vypíše jako „[název]“. */
export function renderTemplate(key: string, vars: Vars, baseUrl: string) {
  const t = templateByKey(key);
  if (!t) throw new Error(`Neznámá šablona: ${key}`);
  const safe = new Proxy(vars, { get: (o, k: string) => o[k] ?? `[${k}]` }) as Vars;
  const subject = t.subject(safe);
  const paragraphs = t.paragraphs(safe);
  const cta = t.cta ? { label: t.cta.label, url: vars.odkaz && t.key === "invite" ? vars.odkaz : `${baseUrl.replace(/\/$/, "")}${t.cta.path}` } : undefined;
  const footer = t.optOut ? FOOTER_NOTIFICATION : FOOTER_TRANSACTIONAL;
  return {
    subject,
    text: `${paragraphs.join("\n\n")}${cta ? `\n\n${cta.label}: ${cta.url}` : ""}\n\n${footer}`,
    html: emailLayout({ title: subject, paragraphs, cta, footer, baseUrl: baseUrl.replace(/\/$/, "") }),
  };
}
