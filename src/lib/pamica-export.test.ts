import { describe, expect, it } from "vitest";
import { buildPamicaXml } from "./pamica-export";

const person = (id: string, name: string, personalNumber = "001") => ({ id, name, personalNumber });
const vacation = (profile_id: string, start_date: string, end_date: string, working_days = 1) => ({
  profile_id,
  start_date,
  end_date,
  half_day: false,
  working_days,
  leave_type: { payroll_code: "V01", counts_as_present: false },
});

describe("buildPamicaXml", () => {
  it("wraps every person's block in the schema's root element and namespace", () => {
    const { xml } = buildPamicaXml([person("p1", "Jan Novák")], [vacation("p1", "2026-10-06", "2026-10-06")], "2026-10", { hoursPerDay: 8 });
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<dochazky_zamestnancu version="1.0" xmlns="http://www.stormware.cz/schema/pamica/dochazka.xsd">');
    expect(xml).toContain("</dochazky_zamestnancu>");
  });

  it("splits the name into firstName/lastName and includes the personal number as cislo_pracovniho_pomeru", () => {
    const { xml } = buildPamicaXml([person("p1", "Jan Karel Novák", "Z0004-01")], [vacation("p1", "2026-10-06", "2026-10-06")], "2026-10", { hoursPerDay: 8 });
    expect(xml).toContain("<jmeno>Jan Karel</jmeno>");
    expect(xml).toContain("<prijmeni>Novák</prijmeni>");
    expect(xml).toContain("<cislo_pracovniho_pomeru>Z0004-01</cislo_pracovniho_pomeru>");
  });

  it("lists exactly one uvazek per day of the month, 0:00 on weekends/holidays and the daily hours on work days", () => {
    const { xml } = buildPamicaXml([person("p1", "Jan Novák")], [vacation("p1", "2026-10-06", "2026-10-06")], "2026-10", { hoursPerDay: 8 });
    expect((xml.match(/<uvazek /g) ?? []).length).toBe(31); // October has 31 days
    expect(xml).toContain('<uvazek datum="2026-10-01">8:00</uvazek>'); // Thursday, work day
    expect(xml).toContain('<uvazek datum="2026-10-03">0:00</uvazek>'); // Saturday
    expect(xml).toContain('<uvazek datum="2026-10-05">8:00</uvazek>'); // Monday, work day
    expect(xml).toContain('<uvazek datum="2026-10-28">0:00</uvazek>'); // 28. 10. state holiday (Den vzniku samostatného československého státu)
  });

  it("emits kod/od/do for a full-day absence with no shortened-duration attribute", () => {
    const { xml } = buildPamicaXml([person("p1", "Jan Novák")], [vacation("p1", "2026-10-06", "2026-10-08", 3)], "2026-10", { hoursPerDay: 8 });
    expect(xml).toContain("<nepritomnost><kod>V01</kod><od>2026-10-06</od><do>2026-10-08</do></nepritomnost>");
  });

  it("puts the shortened duration only on <od> for a half-day absence", () => {
    const half = { profile_id: "p1", start_date: "2026-10-06", end_date: "2026-10-06", half_day: true, working_days: 0.5, leave_type: { payroll_code: "V01", counts_as_present: false } };
    const { xml } = buildPamicaXml([person("p1", "Jan Novák")], [half], "2026-10", { hoursPerDay: 8 });
    expect(xml).toContain('<od nepritomnost="4:00">2026-10-06</od><do>2026-10-06</do>');
  });

  it("clips an absence crossing the month boundary to the month's own start/end", () => {
    const { xml } = buildPamicaXml([person("p1", "Jan Novák")], [vacation("p1", "2026-09-29", "2026-10-02", 4)], "2026-10", { hoursPerDay: 8 });
    expect(xml).toContain("<od>2026-10-01</od><do>2026-10-02</do>");
  });

  it("skips Home Office (counts_as_present) — it isn't an absence", () => {
    const wfh = { profile_id: "p1", start_date: "2026-10-06", end_date: "2026-10-06", half_day: false, working_days: 1, leave_type: { payroll_code: "V01", counts_as_present: true } };
    const { xml } = buildPamicaXml([person("p1", "Jan Novák")], [wfh], "2026-10", { hoursPerDay: 8 });
    expect(xml).not.toContain("<dochazka_zamestnance>");
  });

  it("reports and skips a person with no personal number, and counts absences with no payroll code", () => {
    const noCode = { profile_id: "p2", start_date: "2026-10-06", end_date: "2026-10-06", half_day: false, working_days: 1, leave_type: { payroll_code: null, counts_as_present: false } };
    const { xml, skippedNoNumber, skippedNoCode } = buildPamicaXml(
      [person("p1", "Jan Novák", ""), person("p2", "Eva Malá")],
      [vacation("p1", "2026-10-06", "2026-10-06"), noCode],
      "2026-10",
      { hoursPerDay: 8 }
    );
    expect(skippedNoNumber).toEqual(["Jan Novák"]);
    expect(skippedNoCode).toBe(1);
    expect(xml).not.toContain("Jan");
  });

  it("escapes XML-sensitive characters in names", () => {
    const { xml } = buildPamicaXml([person("p1", "Ondřej & Synové <s.r.o.>")], [vacation("p1", "2026-10-06", "2026-10-06")], "2026-10", { hoursPerDay: 8 });
    expect(xml).toContain("&amp;");
    expect(xml).not.toContain("<s.r.o.>");
  });
});
