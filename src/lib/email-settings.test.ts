import { describe, expect, it } from "vitest";
import { EMAIL_CATEGORIES, categoryLabel, categoryOfTemplate, isCategoryEnabled } from "./email-settings";
import { EMAIL_TEMPLATES } from "./email-templates";

describe("email settings", () => {
  it("treats a missing switch as enabled and only an explicit false as disabled", () => {
    expect(isCategoryEnabled({}, "weekly_digest")).toBe(true);
    expect(isCategoryEnabled(null, "weekly_digest")).toBe(true);
    expect(isCategoryEnabled({ weekly_digest: true }, "weekly_digest")).toBe(true);
    expect(isCategoryEnabled({ weekly_digest: false }, "weekly_digest")).toBe(false);
    expect(isCategoryEnabled({ weekly_digest: false }, "hr_digest")).toBe(true);
  });

  it("every category lists only existing templates and no template is in two categories", () => {
    const keys = new Set(EMAIL_TEMPLATES.map((t) => t.key));
    const seen = new Set<string>();
    for (const c of EMAIL_CATEGORIES) {
      for (const t of c.templates) {
        expect(keys.has(t), `${t} neexistuje`).toBe(true);
        expect(seen.has(t), `${t} je ve dvou kategoriích`).toBe(false);
        seen.add(t);
      }
    }
  });

  it("all live, opt-out templates belong to a category (so admins can switch them off)", () => {
    for (const t of EMAIL_TEMPLATES.filter((x) => x.live && x.optOut)) {
      expect(categoryOfTemplate(t.key), `${t.key} nemá kategorii`).toBeDefined();
    }
  });

  it("HR may change only the HR digest and the reminders", () => {
    expect(EMAIL_CATEGORIES.filter((c) => c.hrCanChange).map((c) => c.key).sort()).toEqual(["hr_digest", "reminders"]);
  });

  it("labels categories and falls back to the raw type", () => {
    expect(categoryLabel("weekly_digest")).toBe("Týdenní přehled pro manažery");
    expect(categoryLabel("request_created_x")).toBe("request created x");
    expect(categoryLabel(null)).toBe("—");
  });
});
