import { describe, expect, it } from "vitest";
import { czIban, spayd } from "./spayd";

describe("czIban", () => {
  it("vzorový účet z dokumentace ČNB s předčíslím", () => {
    expect(czIban("19-2000145399/0800")).toBe("CZ6508000000192000145399");
  });
  it("účet bez předčíslí a s popiskem banky", () => {
    const iban = czIban("8180385003/5500 (Raiffeisenbank)");
    expect(iban).toMatch(/^CZ\d{2}5500000000\d{10}$/);
    expect(iban!.slice(-10)).toBe("8180385003");
  });
  it("neplatný vstup vrací null", () => {
    expect(czIban("neni-ucet")).toBeNull();
  });
});

describe("spayd", () => {
  it("řetězec pro platbu s VS a zprávou bez diakritiky", () => {
    const s = spayd({ iban: "CZ6508000000192000145399", amount: 1346, variableSymbol: "1260001", message: "Faktura 1260001 – Dodio, Příliš" });
    expect(s).toBe("SPD*1.0*ACC:CZ6508000000192000145399*AM:1346.00*CC:CZK*X-VS:1260001*MSG:Faktura 1260001 Dodio, Prilis");
  });
  it("VS se omezí na číslice", () => {
    expect(spayd({ iban: "CZ0", amount: 1, variableSymbol: "2026-014" })).toContain("X-VS:2026014");
  });
});
