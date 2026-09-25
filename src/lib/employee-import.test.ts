import { describe, expect, it } from "vitest";
import {
  buildBalanceRows,
  buildRows,
  cleanEmail,
  decodeText,
  detectDelimiter,
  detectHeaderRow,
  detectMapping,
  guessEmail,
  isImportable,
  isValidEmail,
  matchPerson,
  parseDate,
  parseNumber,
  parseTable,
  resolveBalance,
  stripTitles,
  swapLastFirst,
  type BuildOptions,
} from "./employee-import";

const opts: BuildOptions = {
  nameOrder: "auto",
  today: "2026-09-25",
  defaultVacation: 20,
  defaultSick: 5,
  existingEmails: new Set(["stary@firma.cz"]),
};

describe("file decoding", () => {
  it("reads UTF-8 and strips the BOM", () => {
    const bytes = new TextEncoder().encode("﻿Jméno;E-mail");
    expect(decodeText(bytes.buffer as ArrayBuffer)).toBe("Jméno;E-mail");
  });

  it("falls back to Windows-1250 (typical for Czech payroll exports)", () => {
    const cp1250 = new Uint8Array([0x50, 0xf8, 0xed, 0x6a, 0x6d, 0x65, 0x6e, 0xed]); // Příjmení
    expect(decodeText(cp1250.buffer as ArrayBuffer)).toBe("Příjmení");
  });

  it("detects the delimiter", () => {
    expect(detectDelimiter("Jméno;Příjmení;E-mail")).toBe(";");
    expect(detectDelimiter("Name,Email,Dept")).toBe(",");
    expect(detectDelimiter("Jméno\tE-mail")).toBe("\t");
    expect(detectDelimiter('"Novák, Jan";jan@x.cz')).toBe(";");
    expect(detectDelimiter("Firma s.r.o.\nSeznam zaměstnanců\nPříjmení\tJméno\tE-mail\nNovák\tJan\tjan@x.cz")).toBe("\t");
  });

  it("keeps decimal commas inside a semicolon-separated file", () => {
    const t = parseTable("Jméno;Dovolená zbývá\nJan Novák;12,5");
    expect(t[1]).toEqual(["Jan Novák", "12,5"]);
  });
});

describe("column detection", () => {
  it("maps a typical payroll export with separate first and last name", () => {
    const m = detectMapping(["Osobní číslo", "Příjmení", "Jméno", "Titul", "Středisko", "Datum nástupu", "Datum ukončení", "E-mail"]);
    expect(m).toMatchObject({ personalNumber: 0, lastName: 1, firstName: 2, department: 4, hireDate: 5, endDate: 6, email: 7 });
    expect(m.name).toBeUndefined();
  });

  it("treats a lone 'Jméno' column as the full name", () => {
    const m = detectMapping(["Jméno", "Oddělení", "Nadřízený", "E-mail"]);
    expect(m).toMatchObject({ name: 0, department: 1, manager: 2, email: 3 });
  });

  it("recognizes vacation columns and prefers the work e-mail", () => {
    const m = detectMapping(["Příjmení a jméno", "Soukromý e-mail", "Pracovní e-mail", "Nárok na dovolenou", "Zbývající dovolená"]);
    expect(m).toMatchObject({ name: 0, email: 2, vacationTotal: 3, vacationRemaining: 4 });
  });

  it("finds the header below title rows", () => {
    const table = [["Firma s.r.o."], ["Seznam zaměstnanců k 1. 9. 2026"], ["Příjmení", "Jméno", "E-mail"], ["Novák", "Jan", "jan@x.cz"]];
    expect(detectHeaderRow(table)).toBe(2);
  });
});

describe("values", () => {
  it("parses dates in Czech and ISO formats and Excel serials", () => {
    expect(parseDate("1. 3. 2021")).toBe("2021-03-01");
    expect(parseDate("01.03.2021")).toBe("2021-03-01");
    expect(parseDate("2021-03-01")).toBe("2021-03-01");
    expect(parseDate("2021-03-01 00:00:00")).toBe("2021-03-01");
    expect(parseDate("44256")).toBe("2021-03-01");
    expect(parseDate("31.02.2021")).toBeNull();
    expect(parseDate("")).toBeNull();
  });

  it("parses numbers with decimal commas", () => {
    expect(parseNumber("12,5")).toBe(12.5);
    expect(parseNumber("1 025,5")).toBe(1025.5);
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("abc")).toBeNull();
  });

  it("strips academic titles and swaps 'Příjmení Jméno'", () => {
    expect(stripTitles("Ing. Jan Novák, Ph.D.")).toBe("Jan Novák");
    expect(stripTitles("Mgr. Petra Svobodová MBA")).toBe("Petra Svobodová");
    expect(swapLastFirst("Novák Jan")).toBe("Jan Novák");
    expect(swapLastFirst("Novák Jan Karel")).toBe("Jan Karel Novák");
  });

  it("validates e-mails, including addresses containing the letter s", () => {
    expect(isValidEmail("jana@seznam.cz")).toBe(true);
    expect(isValidEmail("jana@seznam")).toBe(false);
    expect(isValidEmail("jana novakova@x.cz")).toBe(false);
    expect(cleanEmail("Jana@Seznam.cz; jana@firma.cz")).toBe("jana@seznam.cz");
  });

  it("guesses e-mails from names, without diacritics", () => {
    expect(guessEmail("Šárka Čermáková", "firma.cz", "jmeno.prijmeni")).toBe("sarka.cermakova@firma.cz");
    expect(guessEmail("Jan Novák", "@firma.cz", "prijmeni")).toBe("novak@firma.cz");
    expect(guessEmail("Jan Novák", "", "prijmeni")).toBe("");
  });

  it("derives total and used days from any two of total / remaining / used", () => {
    expect(resolveBalance(25, 10, null, 20)).toEqual({ total: 25, used: 15 });
    expect(resolveBalance(25, null, 5, 20)).toEqual({ total: 25, used: 5 });
    expect(resolveBalance(null, 8, null, 20)).toEqual({ total: 20, used: 12 });
    expect(resolveBalance(null, 30, null, 20)).toEqual({ total: 30, used: 0 });
    expect(resolveBalance(null, null, null, 20)).toEqual({ total: 20, used: 0 });
  });
});

describe("building rows", () => {
  const csv = [
    "Osobní číslo;Příjmení a jméno;Středisko;Nadřízený;Datum nástupu;Datum ukončení;E-mail;Nárok na dovolenou;Zbývající dovolená",
    "101;Ing. Novák Jan;Obchod;Svobodová Petra;1. 3. 2021;;jan@seznam.cz;25;10,5",
    "102;Svobodová Petra;Obchod;;15.06.2019;;petra@firma.cz;25;25",
    "103;Dvořák Karel;Sklad;;2020-01-02;30.06.2026;karel@firma.cz;20;0",
    "104;Malá Eva;Sklad;;;;;20;20",
    "105;Novák Jan;Sklad;;;;jan@seznam.cz;20;20",
    "106;Starý Pavel;Sklad;;;;stary@firma.cz;20;20",
  ].join("\n");
  const table = parseTable(csv);
  const rows = buildRows(table, 0, detectMapping(table[0]), opts);

  it("reorders names, strips titles and reads dates and balances", () => {
    expect(rows[0]).toMatchObject({
      name: "Jan Novák",
      manager: "Petra Svobodová",
      department: "Obchod",
      hireDate: "2021-03-01",
      email: "jan@seznam.cz",
      vacationTotal: 25,
      vacationUsed: 14.5,
    });
    expect(isImportable(rows[0], true)).toBe(true);
  });

  it("flags people who have already left, missing and duplicate e-mails, and existing users", () => {
    expect(rows[2].issues).toContain("ended");
    expect(isImportable(rows[2], true)).toBe(false);
    expect(isImportable(rows[2], false)).toBe(true);
    expect(rows[3].issues).toContain("missing-email");
    expect(rows[4].issues).toContain("duplicate-email");
    expect(rows[5].issues).toContain("already-exists");
    expect(isImportable(rows[5], false)).toBe(false);
  });

  it("fills missing e-mails from a domain pattern and accepts manual overrides", () => {
    const guessed = buildRows(table, 0, detectMapping(table[0]), { ...opts, guessDomain: "firma.cz" });
    expect(guessed[3].email).toBe("eva.mala@firma.cz");
    expect(isImportable(guessed[3], false)).toBe(true);
    const fixed = buildRows(table, 0, detectMapping(table[0]), { ...opts, emailOverrides: { 3: "eva@x.cz" } });
    expect(fixed[3].email).toBe("eva@x.cz");
  });

  it("works with separate first/last name columns", () => {
    const t = parseTable("Příjmení;Jméno;E-mail\nNovák;Jan;jan@x.cz");
    const r = buildRows(t, 0, detectMapping(t[0]), opts);
    expect(r[0].name).toBe("Jan Novák");
  });
});

describe("balances import", () => {
  const people = [
    { id: "1", name: "Jan Novák", email: "jan@firma.cz" },
    { id: "2", name: "Petra Svobodová", email: null },
    { id: "3", name: "Karel Dvořák", email: "karel@firma.cz" },
    { id: "4", name: "Karel Dvořák", email: "karel2@firma.cz" },
  ];

  it("recognizes a carry-over column", () => {
    const m = detectMapping(["Příjmení a jméno", "Nárok", "Převod z minulého roku", "Vyčerpáno dovolená"]);
    expect(m.carryover).toBe(2);
    expect(m.vacationUsed).toBe(3);
  });

  it("reads balance rows with optional values", () => {
    const t = parseTable("Příjmení a jméno;E-mail;Nárok na dovolenou;Vyčerpaná dovolená;Převod z minulého roku\nNovák Jan;jan@firma.cz;25;7,5;3\nMalá Eva;;20;;");
    const rows = buildBalanceRows(t, 0, detectMapping(t[0]), "auto");
    expect(rows[0]).toMatchObject({ name: "Jan Novák", email: "jan@firma.cz", vacationTotal: 25, vacationUsed: 7.5, carryover: 3 });
    expect(rows[1]).toMatchObject({ name: "Eva Malá", vacationTotal: 20, vacationUsed: null, carryover: null });
  });

  it("matches people by e-mail first, then by name in any order without diacritics", () => {
    expect(matchPerson({ name: "Whoever", email: "jan@firma.cz" }, people)).toMatchObject({ kind: "email", person: { id: "1" } });
    expect(matchPerson({ name: "Svobodová Petra", email: "" }, people)).toMatchObject({ kind: "name", person: { id: "2" } });
    expect(matchPerson({ name: "petra svobodova", email: "" }, people)).toMatchObject({ kind: "name", person: { id: "2" } });
    expect(matchPerson({ name: "Ing. Jan Novák", email: "" }, people)).toMatchObject({ kind: "name", person: { id: "1" } });
  });

  it("does not guess when the name is ambiguous or unknown", () => {
    expect(matchPerson({ name: "Karel Dvořák", email: "" }, people).kind).toBe("ambiguous");
    expect(matchPerson({ name: "Nikdo Takový", email: "" }, people).kind).toBe("none");
    expect(matchPerson({ name: "", email: "" }, people).kind).toBe("none");
  });
});

describe("plain balance headers", () => {
  it("recognizes bare 'Nárok', 'Vyčerpáno' and 'Zbývá' as vacation columns", () => {
    const m = detectMapping(["Příjmení a jméno", "Nárok", "Vyčerpáno", "Zbývá"]);
    expect(m).toMatchObject({ name: 0, vacationTotal: 1, vacationUsed: 2, vacationRemaining: 3 });
  });

  it("does not mistake sick-day columns for vacation", () => {
    const m = detectMapping(["Jméno", "Sick days zbývá", "Sick days celkem"]);
    expect(m.vacationRemaining).toBeUndefined();
    expect(m).toMatchObject({ sickRemaining: 1, sickTotal: 2 });
  });
});
