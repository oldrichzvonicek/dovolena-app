import { describe, expect, it } from "vitest";
import { EMAIL_TEMPLATES, TEMPLATE_SAMPLE, renderTemplate } from "./email-templates";

describe("email templates", () => {
  it("has unique keys", () => {
    const keys = EMAIL_TEMPLATES.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("does not offer a trial template (Dodio has no trial)", () => {
    expect(EMAIL_TEMPLATES.some((t) => /trial/i.test(t.key + t.name))).toBe(false);
  });

  for (const t of EMAIL_TEMPLATES) {
    it(`renders ${t.key} with sample data, no placeholders left`, () => {
      const r = renderTemplate(t.key, TEMPLATE_SAMPLE, "https://app.example.cz");
      expect(r.subject.length).toBeGreaterThan(3);
      expect(r.text).not.toMatch(/\[[a-z_]+\]/);
      expect(r.html).toContain("<!doctype html>");
      expect(r.subject).not.toMatch(/volno/i); // wording: "absence"
    });

    it(`declares every variable ${t.key} uses`, () => {
      const used = new Set<string>();
      const probe = new Proxy({} as Record<string, string>, {
        get: (_o, k: string) => {
          used.add(k);
          return "x";
        },
      });
      t.subject(probe);
      t.paragraphs(probe);
      for (const k of used) expect(t.vars, `${t.key}: ${k}`).toContain(k);
    });
  }

  it("escapes HTML in variables", () => {
    const r = renderTemplate("help_question", { ...TEMPLATE_SAMPLE, dotaz: "<script>alert(1)</script>" }, "https://x.cz");
    expect(r.html).not.toContain("<script>");
  });
});

describe("templateText", () => {
  it("skutečné hodnoty přebijí ukázkové (upomínky nesmí ukazovat vzorových 7 dní)", async () => {
    const { templateText } = await import("./email-templates");
    const t = templateText("payment_reminder_7", { cislo: "2026-001", castka: "5 900 Kč", splatnost: "1. 10. 2026", po_splatnosti: "9" });
    expect(t.body).toContain("Je po splatnosti 9 dní");
    expect(t.subject).toContain("2026-001");
  });
  it("žádné šablony nemají v pozdravu jméno v 1. pádě ani „(a)“", () => {
    for (const t of EMAIL_TEMPLATES) {
      const text = [t.subject(TEMPLATE_SAMPLE), ...t.paragraphs(TEMPLATE_SAMPLE)].join(" ");
      expect(text, t.key).not.toMatch(/\(a\)|\(la\)|mu\/jí/);
      expect(text, t.key).not.toMatch(/^Dobrý den \S+,/);
    }
  });
});
