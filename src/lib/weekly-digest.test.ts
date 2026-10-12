import { describe, expect, it } from "vitest";
import { buildWeeklyDigest, type DigestRow } from "./weekly-digest";

const row = (over: Partial<DigestRow>): DigestRow => ({
  start_date: "2026-10-16",
  end_date: "2026-10-16",
  profileId: "p1",
  name: "Jana Malá",
  label: "Dovolená",
  hidden: false,
  present: false,
  ...over,
});
const base = { pending: 0, firstName: "Oldřich", from: "2026-10-12", to: "2026-10-18" };

describe("buildWeeklyDigest", () => {
  it("předmět nese rozsah týdne", () => {
    expect(buildWeeklyDigest({ ...base, rows: [] }).subject).toBe("Týdenní přehled absencí · 12.–18. 10.");
    expect(buildWeeklyDigest({ ...base, rows: [], from: "2026-10-26", to: "2026-11-01" }).subject).toBe("Týdenní přehled absencí · 26. 10. – 1. 11.");
  });

  it("prázdný týden je jen pozdrav a jedna věta", () => {
    const { body, missing } = buildWeeklyDigest({ ...base, rows: [] });
    expect(missing).toBe(0);
    expect(body).toBe("Dobré ráno Oldřich,\n\ntady je váš týdenní přehled — tento týden nikdo nechybí.");
  });

  it("Home Office se nepočítá mezi chybějící a je až dole", () => {
    const { body, missing } = buildWeeklyDigest({
      ...base,
      rows: [
        row({ profileId: "a", name: "Zuzana Musilová", label: "Home Office", present: true, start_date: "2026-10-14", end_date: "2026-10-14" }),
        row({ profileId: "b", name: "Veronika Růžičková", label: "Home Office", present: true }),
        row({ profileId: "c", name: "Oldřich Zvoníček", start_date: "2026-10-16", end_date: "2026-10-19" }),
      ],
    });
    expect(missing).toBe(1);
    expect(body).toContain("tento týden chybí 1 člověk.");
    expect(body.indexOf("## Dovolená")).toBeLessThan(body.indexOf("## Home Office (2)"));
    expect(body).toContain("• Oldřich Zvoníček — pá 16. 10. – po 19. 10.");
    expect(body).toContain("• Zuzana Musilová — st 14. 10.");
  });

  it("jeden člověk s víc žádostmi se počítá jednou", () => {
    const { missing } = buildWeeklyDigest({ ...base, rows: [row({}), row({ start_date: "2026-10-13", end_date: "2026-10-13" })] });
    expect(missing).toBe(1);
  });

  it("skrytý typ (nemoc) se ukáže jako Nepřítomen", () => {
    const { body } = buildWeeklyDigest({ ...base, rows: [row({ label: "Nemoc", hidden: true })] });
    expect(body).toContain("## Nepřítomen");
    expect(body).not.toContain("Nemoc");
  });

  it("dlouhý seznam se ořízne s uvedením zbytku", () => {
    const rows = Array.from({ length: 15 }, (_, i) => row({ profileId: `p${i}`, name: `Člověk ${String(i).padStart(2, "0")}` }));
    const { body } = buildWeeklyDigest({ ...base, rows });
    expect(body).toContain("• a 3 další");
  });
});
