import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Test úplnosti mazání firmy: každá tabulka se sloupcem company_id v supabase/schema.sql musí být buď mazaná funkcí
 * platform_purge_company, nebo výslovně uvedená mezi tabulkami, které se ponechávají. Nová tabulka mimo oba seznamy test shodí,
 * takže se na ni při přidání nezapomene (jinak by po smazání firmy zůstala v databázi).
 */
const schema = fs.readFileSync(path.resolve(__dirname, "../../../supabase/schema.sql"), "utf8");

// Smaže je Auth API (auth.users → profiles → kaskáda), ne SQL funkce.
const DELETED_WITH_MEMBERS = ["profiles"];
// Zůstávají po smazání firmy: účetní doklady a jejich vazby, audit, úlohy a GDPR evidence bez osobních údajů.
const KEPT = ["company_invoices", "payments", "dunning_events", "data_subject_requests", "platform_audit_log", "platform_jobs", "platform_impersonation_sessions"];

function tablesWithCompanyId(): string[] {
  const found = new Set<string>();
  for (const m of schema.matchAll(/create table if not exists (\w+) \(([\s\S]*?)\n\);/g)) {
    if (/\bcompany_id\b/.test(m[2])) found.add(m[1]);
  }
  for (const m of schema.matchAll(/alter table (\w+) add column if not exists company_id\b/g)) found.add(m[1]);
  return [...found].sort();
}

function purgedTables(): string[] {
  const fn = schema.slice(schema.lastIndexOf("create or replace function platform_purge_company"));
  const list = /foreach t in array array\[([\s\S]*?)\]\s*loop/.exec(fn);
  if (!list) throw new Error("Seznam tabulek ve funkci platform_purge_company nebyl nalezen.");
  return [...list[1].matchAll(/'(\w+)'/g)].map((m) => m[1]);
}

describe("úplnost mazání firmy", () => {
  it("každá firemní tabulka je mazaná, nebo výslovně ponechaná", () => {
    const purged = new Set(purgedTables());
    const known = new Set([...DELETED_WITH_MEMBERS, ...KEPT, ...purged]);
    const missing = tablesWithCompanyId().filter((t) => !known.has(t));
    expect(missing, `Tabulky se sloupcem company_id, které mazání nezná: ${missing.join(", ")}. Přidejte je do platform_purge_company, nebo do KEPT s odůvodněním.`).toEqual([]);
  });

  it("mazací funkce nemaže účetní doklady ani audit", () => {
    const purged = purgedTables();
    for (const t of ["company_invoices", "payments", "dunning_events", "data_subject_requests", "platform_audit_log"]) expect(purged).not.toContain(t);
  });

  it("mazací funkce zná jen tabulky, které ve schématu existují", () => {
    const existing = new Set([...schema.matchAll(/create table if not exists (\w+)/g)].map((m) => m[1]));
    for (const t of purgedTables()) expect(existing.has(t), `tabulka ${t} ve schématu není`).toBe(true);
  });
});
