import { describe, expect, it } from "vitest";
import { fetchAll } from "./fetch-all";

const source = Array.from({ length: 2500 }, (_, i) => i);
const page = (from: number, to: number) => Promise.resolve({ data: source.slice(from, to + 1), error: null });

describe("fetchAll", () => {
  it("načte všechny stránky, i když je řádků víc než 1 000", async () => {
    const r = await fetchAll<number>(page);
    expect(r.data).toHaveLength(2500);
    expect(r.error).toBeNull();
  });
  it("skončí u přesně plné poslední stránky", async () => {
    const r = await fetchAll<number>((f, t) => Promise.resolve({ data: source.slice(0, 2000).slice(f, t + 1), error: null }));
    expect(r.data).toHaveLength(2000);
  });
  it("při chybě vrátí chybu a to, co už načetl", async () => {
    let n = 0;
    const r = await fetchAll<number>((f, t) => (n++ === 1 ? Promise.resolve({ data: null, error: { message: "boom" } }) : page(f, t)));
    expect(r.error?.message).toBe("boom");
    expect(r.data).toHaveLength(1000);
  });
});
