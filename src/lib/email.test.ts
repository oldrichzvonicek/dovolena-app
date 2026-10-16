import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { retryDelayMinutes, senderFor, sendEmail, sendEmailBatch } from "./email";

describe("retryDelayMinutes", () => {
  it("první opakování hned příště, pak čím dál delší odstup", () => {
    expect([1, 2, 3, 4].map(retryDelayMinutes)).toEqual([3, 15, 60, 240]);
    expect(retryDelayMinutes(9)).toBe(240);
  });
});

describe("senderFor", () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });
  it("fakturace má vlastního odesílatele, jen když je nastavený", () => {
    process.env.EMAIL_FROM = "Dodio <info@dodio.cz>";
    delete process.env.EMAIL_FROM_BILLING;
    expect(senderFor("billing")).toBe("Dodio fakturace <fakturace@dodio.cz>");
    process.env.EMAIL_FROM_BILLING = "Jiné <jine@dodio.cz>";
    expect(senderFor("billing")).toBe("Jiné <jine@dodio.cz>");
    expect(senderFor("weekly_digest")).toBe("Dodio <info@dodio.cz>");
  });
});

describe("odesílání", () => {
  const env = { ...process.env };
  const calls: { url: string; init: RequestInit }[] = [];
  beforeEach(() => {
    calls.length = 0;
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "Dodio <info@dodio.cz>";
    process.env.EMAIL_REPLY_TO = "podpora@dodio.cz";
  });
  afterEach(() => {
    process.env = { ...env };
    vi.unstubAllGlobals();
  });
  const stub = (respond: (url: string, n: number) => Response) =>
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return respond(url, calls.length);
    });
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

  it("jeden e-mail nese Idempotency-Key, Reply-To a vrací id", async () => {
    stub(() => json({ id: "r1" }));
    const r = await sendEmail("a@b.cz", "Předmět", "Text", undefined, { idempotencyKey: "k1" });
    expect(r).toEqual({ ok: true, id: "r1" });
    const h = calls[0].init.headers as Record<string, string>;
    expect(h["Idempotency-Key"]).toBe("k1");
    expect(JSON.parse(calls[0].init.body as string).reply_to).toBe("podpora@dodio.cz");
  });

  it("dávka jde jedním požadavkem a vrací id v pořadí; .invalid se přeskočí", async () => {
    stub(() => json({ data: [{ id: "r1" }, { id: "r2" }] }));
    const r = await sendEmailBatch([
      { to: "a@b.cz", subject: "1", body: "x" },
      { to: "demo@firma.invalid", subject: "2", body: "x" },
      { to: "c@d.cz", subject: "3", body: "x" },
    ]);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("/emails/batch");
    expect(r.map((x) => x.id ?? (x.skipped ? "skip" : "?"))).toEqual(["r1", "skip", "r2"]);
  });

  it("při 4xx na dávku se posílá po jedné, ať selže jen vadná zpráva", async () => {
    stub((url, n) => (url.endsWith("/batch") ? json({ message: "bad" }, 422) : n === 3 ? json({ message: "bad address" }, 422) : json({ id: "ok" })));
    const r = await sendEmailBatch([
      { to: "a@b.cz", subject: "1", body: "x" },
      { to: "vadna", subject: "2", body: "x" },
    ]);
    expect(r.map((x) => x.ok)).toEqual([true, false]);
    expect(r[1].rejected).toBe(true);
  });

  it("při 5xx na dávku se nic neposílá znovu po jedné (mohla projít)", async () => {
    stub(() => json({ message: "boom" }, 503));
    const r = await sendEmailBatch([
      { to: "a@b.cz", subject: "1", body: "x" },
      { to: "c@d.cz", subject: "2", body: "x" },
    ]);
    expect(calls).toHaveLength(1);
    expect(r.every((x) => !x.ok && !x.rejected)).toBe(true);
  });
});

describe("renderHtml", () => {
  it("tlačítko vede podle druhu e-mailu, jinak na nástěnku", async () => {
    const { renderHtml } = await import("./email");
    expect(renderHtml("P", "Text", "weekly_digest")).toContain("/calendar");
    expect(renderHtml("P", "Text", "billing")).toContain("sekce=billing");
    expect(renderHtml("P", "Text", "neznama")).toContain("/dashboard");
  });

  it("patička fakturačního e-mailu nenabízí vypnutí, protože se vypnout nedá", async () => {
    const { renderHtml } = await import("./email");
    expect(renderHtml("Faktura", "Text", "billing")).toContain("nelze ho vypnout");
    expect(renderHtml("Faktura", "Text", "billing")).not.toContain("zvonečku");
    expect(renderHtml("P", "Text", "weekly_digest")).toContain("zvonečku");
  });
});

describe("renderHtml – připomínka registrace", () => {
  it("poslední řádek s odkazem se stane tlačítkem a text nemá odkaz na nástěnku", async () => {
    const { renderHtml } = await import("./email");
    const html = renderHtml("Dokončete registraci", "Potvrzení chybí.\n\nhttps://x.supabase.co/auth/v1/verify?token=abc", "signup_reminder");
    expect(html).toContain('href="https://x.supabase.co/auth/v1/verify?token=abc"');
    expect(html).toContain("Potvrdit e-mail a začít");
    expect(html).not.toContain("/dashboard");
  });
});

describe("renderHtml – tipy po registraci", () => {
  it("tlačítko se bere z řádku @@cta a patička nabízí vypnutí", async () => {
    const { renderHtml } = await import("./email");
    const html = renderHtml("Tip", "Text tipu.\n\n@@cta Pozvat kolegy | https://app.dodio.cz/admin/settings?sekce=users", "onboarding_tips");
    expect(html).toContain('href="https://app.dodio.cz/admin/settings?sekce=users"');
    expect(html).toContain("Pozvat kolegy");
    expect(html).not.toContain("@@cta");
    expect(html).toContain("Notifikace");
  });
});

describe("rezervované domény", () => {
  it("na .invalid a .test se neposílá", async () => {
    const { sendEmail } = await import("./email");
    process.env.RESEND_API_KEY = "re_test";
    for (const to of ["a@firma.invalid", "admin@dilna-novak.test", "X@FIRMA.TEST"]) {
      expect(await sendEmail(to, "P", "T")).toEqual({ ok: false, skipped: true });
    }
  });
});

describe("rezervované domény – falešné shody", () => {
  it("adresa končící na „test“ bez tečky se neblokuje", async () => {
    const { sendEmail } = await import("./email");
    process.env.RESEND_API_KEY = "re_test";
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ id: "x" }), { status: 200 }));
    const r = await sendEmail("jana@latest.cz", "P", "T");
    const r2 = await sendEmail("jana@mytest.test.cz", "P", "T");
    vi.unstubAllGlobals();
    expect(r.ok).toBe(true);
    expect(r2.ok).toBe(true);
  });
});

describe("renderHtml – fakturace", () => {
  it("podpis jde do patičky, e-mail o fakturách má vlastní patičku a tlačítko na fakturaci", async () => {
    const { renderHtml } = await import("./email");
    const html = renderHtml("Faktura 1", "Dobrý den,\n\nText.\n\nS pozdravem\ntým Dodio", "billing");
    expect(html).not.toContain("zvonečku");
    expect(html).toContain("podpora@dodio.cz");
    expect(html).toContain("sekce=billing");
    expect(html.indexOf("S pozdravem, tým Dodio")).toBeGreaterThan(html.indexOf("Otevřít fakturaci"));
    expect(html.split("tým Dodio").length - 1).toBe(1);
  });
});

describe("renderHtml – fakturace s PDF", () => {
  it("odkaz na PDF je hlavní tlačítko a odkaz na fakturaci vedlejší; v textu je odkaz s popiskem", async () => {
    const { renderHtml } = await import("./email");
    const body = "Dobrý den,\n\nText.\n\nS pozdravem\ntým Dodio\n\n@@cta Stáhnout fakturu (PDF) | https://x.supabase.co/storage/v1/object/sign/f.pdf?token=1";
    const html = renderHtml("Faktura 1", body, "billing");
    expect(html).toContain("Stáhnout fakturu (PDF)");
    expect(html).toContain('href="https://x.supabase.co/storage/v1/object/sign/f.pdf?token=1"');
    expect(html).toContain("Otevřít fakturaci");
    expect(html).not.toContain("@@cta");
    expect(html).not.toContain("S pozdravem\ntým");
  });
});

describe("renderHtml – QR platba", () => {
  it("řádek @@qr se stane obrázkem z /api/qr a nezůstane v textu", async () => {
    const { renderHtml } = await import("./email");
    const html = renderHtml("Faktura 1", "Dobrý den,\n\n• Číslo účtu — 123/0100\n• Variabilní symbol — 1260001\n\n@@qr 1346|1260001\n\nS pozdravem\ntým Dodio", "billing");
    expect(html).toContain("/api/qr?am=1346&vs=1260001");
    expect(html).toContain("QR platba");
    expect(html).not.toContain("@@qr");
  });
});

describe("renderHtml – NPS", () => {
  it("řádek @@nps se stane stupnicí 0–10 s odkazy na skóre a nezůstane v textu", async () => {
    const { renderHtml } = await import("./email");
    const html = renderHtml("Hodnocení", "Dobrý den,\n\nOtázka.\n\n@@nps https://app.dodio.cz/api/nps?token=abc", "nps");
    expect(html).toContain("https://app.dodio.cz/api/nps?token=abc&amp;score=0");
    expect(html).toContain("score=10");
    expect(html.match(/&amp;score=/g)).toHaveLength(11);
    expect(html).not.toContain("@@nps");
  });
});
