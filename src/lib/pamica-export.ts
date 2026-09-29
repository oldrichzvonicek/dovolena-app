import { DEFAULT_WORK_DAYS, isCzechHoliday } from "@/lib/working-days";
import { splitName } from "@/lib/payroll";

/**
 * Export docházky do XML pro import do mzdového systému PAMICA (Stormware) — podle oficiálního XSD schématu
 * https://www.stormware.cz/schema/pamica/dochazka.xsd. Kódy nepřítomností (V01 dovolená, N01 nemoc, …) jsou
 * z téhož schématu; admin je nastaví u typu absence v Nastavení firmy → Typy absencí → „Kód pro mzdy“.
 *
 * PAMICA není součástí účetního programu Pohoda (ten mzdy vůbec neřeší — má vlastní, samostatný XML import
 * jen pro faktury/sklad/adresář) — jde o oddělený produkt od stejné firmy (Stormware) na personalistiku a mzdy.
 */

export interface PamicaPerson {
  id: string;
  name: string;
  /** cislo_pracovniho_pomeru v PAMICA — v appce zatím nemáme samostatné pole, používá se osobní číslo
      (profile_hr.personal_number), stejné jako v CSV/Excel podkladu. Bez něj nejde osobu exportovat. */
  personalNumber: string;
}

export interface PamicaAbsence {
  profile_id: string;
  start_date: string;
  end_date: string;
  half_day: boolean;
  working_days: number;
  leave_type: { payroll_code: string | null; counts_as_present?: boolean } | null;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Desetinné hodiny na formát HH:MM (nebo H:MM), jak to vyžaduje typ hodinyType ve schématu. */
function hoursToHHMM(hours: number): string {
  const totalMinutes = Math.max(0, Math.round(hours * 60));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

const isoWeekdayOf = (d: Date) => ((d.getDay() + 6) % 7) + 1;

function isCompanyWorkDay(d: Date, workDays: number[]): boolean {
  return workDays.includes(isoWeekdayOf(d)) && !isCzechHoliday(d);
}

function monthBounds(month: string): { start: string; end: string; year: number; monthNum: number; days: number } {
  const year = Number(month.slice(0, 4));
  const monthNum = Number(month.slice(5, 7));
  const days = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
  return { start: `${month}-01`, end: `${month}-${String(days).padStart(2, "0")}`, year, monthNum, days };
}

/**
 * Sestaví XML podle schématu dochazka.xsd pro jeden měsíc. Zahrnuje jen lidi, kteří mají vyplněné osobní
 * číslo (povinný element cislo_pracovniho_pomeru) a aspoň jednu nepřítomnost s vyplněným kódem pro mzdy —
 * schéma sice dovoluje poslat i "prázdné" rozvrhy bez nepřítomností, ale to by PAMICA zbytečně zahltilo.
 */
export function buildPamicaXml(
  people: PamicaPerson[],
  absences: PamicaAbsence[],
  month: string,
  opts: { workDays?: number[]; hoursPerDay: number }
): { xml: string; skippedNoNumber: string[]; skippedNoCode: number } {
  const { start, end, year, monthNum, days } = monthBounds(month);
  const workDays = opts.workDays ?? DEFAULT_WORK_DAYS;
  const hoursPerDay = opts.hoursPerDay;

  const byPerson = new Map<string, PamicaAbsence[]>();
  let skippedNoCode = 0;
  for (const a of absences) {
    if (a.end_date < start || a.start_date > end) continue;
    if (a.leave_type?.counts_as_present) continue; // Home Office apod. není nepřítomnost.
    if (!a.leave_type?.payroll_code) {
      skippedNoCode++;
      continue;
    }
    (byPerson.get(a.profile_id) ?? byPerson.set(a.profile_id, []).get(a.profile_id)!).push(a);
  }

  const skippedNoNumber: string[] = [];
  const blocks: string[] = [];

  for (const person of people) {
    const personAbsences = byPerson.get(person.id);
    if (!personAbsences || personAbsences.length === 0) continue;
    if (!person.personalNumber.trim()) {
      skippedNoNumber.push(person.name);
      continue;
    }
    const { firstName, lastName } = splitName(person.name);

    const rozvrh: string[] = [];
    for (let day = 1; day <= days; day++) {
      const date = new Date(Date.UTC(year, monthNum - 1, day));
      const iso = `${month}-${String(day).padStart(2, "0")}`;
      const hours = isCompanyWorkDay(date, workDays) ? hoursToHHMM(hoursPerDay) : "0:00";
      rozvrh.push(`<uvazek datum="${iso}">${hours}</uvazek>`);
    }

    const nepritomnosti = personAbsences
      .map((a) => {
        const od = a.start_date < start ? start : a.start_date;
        const doD = a.end_date > end ? end : a.end_date;
        // Půlden a hodinová absence jsou v appce vždy jednodenní — zkrácené trvání se uvádí jen na <od>,
        // stejně jako to popisuje schéma pro jednodenní nepřítomnost.
        const isSingleDayPartial = od === doD && (a.half_day || a.working_days < 1) && a.working_days > 0;
        const shortAttr = isSingleDayPartial ? ` nepritomnost="${hoursToHHMM(Number(a.working_days) * hoursPerDay)}"` : "";
        return `<nepritomnost><kod>${esc(a.leave_type!.payroll_code!)}</kod><od${shortAttr}>${od}</od><do>${doD}</do></nepritomnost>`;
      })
      .join("");

    blocks.push(
      `<dochazka_zamestnance>` +
        `<hlavicka><mesic>${monthNum}</mesic><rok>${year}</rok><jmeno>${esc(firstName)}</jmeno><prijmeni>${esc(lastName)}</prijmeni><cislo_pracovniho_pomeru>${esc(
          person.personalNumber
        )}</cislo_pracovniho_pomeru></hlavicka>` +
        `<rozvrh>${rozvrh.join("")}</rozvrh>` +
        `<nepritomnosti>${nepritomnosti}</nepritomnosti>` +
        `<pritomnost></pritomnost>` +
        `<mzdy></mzdy>` +
        `</dochazka_zamestnance>`
    );
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<dochazky_zamestnancu version="1.0" xmlns="http://www.stormware.cz/schema/pamica/dochazka.xsd">\n` +
    blocks.join("\n") +
    `\n</dochazky_zamestnancu>\n`;

  return { xml, skippedNoNumber, skippedNoCode };
}
